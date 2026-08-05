"""TARA-0058: Kontrollfluss-Analyse, Race Conditions und asynchrone Sequenzen.

Prüft JavaScript/TypeScript-Code auf:
  R-31 – Toter Code nach return/throw
  R-32 – Potenzielle Lost-Update-Patterns bei localStorage.setItem
          (getItem → Mutation → setItem mit async/await dazwischen)
  R-36 – Fehlendes await vor asynchronen Aufrufen in async-Funktionen

Review-Fixes H1/H2/H3:
  H1: R-32 brace_depth-Boundary fixed (<=0 statt <0)
  H2: R-32 konzeptionell überarbeitet – nur getItem+setItem auf GLEICHEN Key
      ohne await → echter Lost-Update-Verdacht; Confidence.Low wegen Regex-Grenzen
  H3: R-36 Stack statt einzelner Variable für verschachtelte async-Funktionen
"""
from __future__ import annotations

import re

from agents.review_agent.finding_framework import (
    Confidence,
    Finding,
    Severity,
    create_finding,
)

# ─── Patterns ────────────────────────────────────────────────────────────────

# R-31
_RETURN_OR_THROW = re.compile(r'^\s*(return|throw)\b')
_NON_EMPTY_CODE  = re.compile(r'^\s*\S')
_BLOCK_CLOSER    = re.compile(r'^\s*\}')
_COMMENT_LINE    = re.compile(r'^\s*//')

# R-36 – Stack-basierter Async-Scope
_ASYNC_FUNC_START = re.compile(
    r'^\s*(?:export\s+)?async\s+function\s+\w+'
    r'|^\s*(?:const|let|var)\s+\w+\s*=\s*async\s*\('
    r'|^\s*(?:const|let|var)\s+\w+\s*=\s*async\s+\('
)
# const/let/var x = fn(  – aber NICHT  const x = await fn(
_ASSIGN_CALL_NO_AWAIT = re.compile(
    r'^\s*(?:const|let|var)\s+\w+\s*=\s*(?!await\s)(\w+)\s*\('
)

# R-32 – Lost-Update: getItem + setItem auf gleichem Key ohne await dazwischen
_LOCALSTORAGE_GET = re.compile(r'localStorage\.getItem\s*\(\s*([\'"][\w-]+[\'"])\s*\)')
_LOCALSTORAGE_SET = re.compile(r'localStorage\.setItem\s*\(\s*([\'"][\w-]+[\'"])')
_HAS_AWAIT        = re.compile(r'\bawait\b')

# Sync-Builtins – niemals async, R-36 überspringen
_SYNC_BUILTINS = frozenset({
    "new", "JSON", "Object", "Array", "String", "Number",
    "Boolean", "Math", "Date", "RegExp", "Error", "parseInt",
    "parseFloat", "isNaN", "isFinite", "console",
})


class ControlFlowAnalyzer:
    """Analysiert JS/TS-Code auf R-31, R-32, R-36 Defekte."""

    def analyze_code(self, code: str, file_path: str) -> list[Finding]:
        """Vollständige Analyse eines Code-Strings."""
        if not code.strip():
            return []
        lines = code.splitlines()
        results: list[Finding] = []
        results.extend(self._check_dead_code(lines, file_path))
        results.extend(self._check_missing_await(lines, file_path))
        results.extend(self._check_race_conditions(lines, file_path))
        return results

    # ── R-31: Toter Code ─────────────────────────────────────────────────────

    def _check_dead_code(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt Code-Zeilen nach return/throw im selben Block."""
        findings: list[Finding] = []
        for i, line in enumerate(lines):
            m = _RETURN_OR_THROW.match(line)
            if not m:
                continue
            keyword = m.group(1)
            for j in range(i + 1, len(lines)):
                nxt = lines[j]
                if _BLOCK_CLOSER.match(nxt):
                    break
                if _COMMENT_LINE.match(nxt) or not _NON_EMPTY_CODE.match(nxt):
                    continue
                findings.append(create_finding(
                    tara_id="0058",
                    rule="R-31",
                    severity=Severity.Mittel,
                    confidence=Confidence.High,
                    file=file_path,
                    line=j + 1,
                    finding_type="Kontrollfluss",
                    evidence={"code_snippet": nxt.strip()},
                    reasoning=(
                        f"Toter Code nach '{keyword}' (Zeile {i + 1}): "
                        "Diese Anweisung wird nie ausgeführt."
                    ),
                ))
                break
        return findings

    # ── R-36: Fehlendes await (Stack-basiert, H3-Fix) ────────────────────────

    def _check_missing_await(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt fehlende await-Aufrufe in async-Funktionen.

        Stack-basierter Ansatz (H3-Fix): verschachtelte async-Funktionen werden
        korrekt behandelt.
        """
        findings: list[Finding] = []
        depth       = 0
        # Stack: list of (func_entry_depth) – jede async-Funktion schiebt ihren Eintrittslevel
        async_stack: list[int] = []

        for i, line in enumerate(lines):
            if _ASYNC_FUNC_START.match(line):
                async_stack.append(depth)

            opens  = line.count("{")
            closes = line.count("}")
            depth += opens - closes

            # Pop vollständig beendete async-Kontexte
            while async_stack and closes > 0 and depth <= async_stack[-1]:
                async_stack.pop()

            if not async_stack:
                continue

            # Prüfe nur wenn wir innerhalb einer async-Funktion sind
            m = _ASSIGN_CALL_NO_AWAIT.match(line)
            if m:
                fn_name = m.group(1)
                if fn_name not in _SYNC_BUILTINS:
                    findings.append(create_finding(
                        tara_id="0058",
                        rule="R-36",
                        severity=Severity.Hoch,
                        confidence=Confidence.Medium,
                        file=file_path,
                        line=i + 1,
                        finding_type="AsyncSequenz",
                        evidence={"code_snippet": line.strip()},
                        reasoning=(
                            f"In async-Funktion: '{fn_name}(...)' wird ohne 'await' aufgerufen. "
                            "Falls der Aufruf ein Promise zurückgibt, wird er nicht aufgelöst."
                        ),
                    ))

        return findings

    # ── R-32: Lost-Update-Pattern (H1/H2-Fix) ────────────────────────────────

    def _check_race_conditions(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt getItem → [await/async gap] → setItem auf GLEICHEM Key.

        H1-Fix: Nur GLEICHER Storage-Key wird als Lost-Update gewertet.
        H2-Fix: Confidence.Low – Regex-Analyse kann async-Grenzen nicht zuverlässig bestimmen.

        Erkennt: localStorage.getItem('key') ... await ... localStorage.setItem('key', ...)
        ohne dass der Wert explizit re-gelesen wird → potentielles Lost-Update.
        """
        findings: list[Finding] = []
        # Sammel getItem-Keys und ihre Zeilennummern
        get_keys: dict[str, int] = {}  # key → first getItem line
        # Zwischen getItem und setItem: flag ob await gesehen
        has_await_between: dict[str, bool] = {}

        for i, line in enumerate(lines):
            # getItem registrieren
            gm = _LOCALSTORAGE_GET.search(line)
            if gm:
                key = gm.group(1)
                if key not in get_keys:
                    get_keys[key] = i + 1
                    has_await_between[key] = False

            # await zwischen getItem und setItem merken
            if _HAS_AWAIT.search(line):
                for key in get_keys:
                    has_await_between[key] = True

            # setItem auf bekanntem getItem-Key mit await dazwischen → Lost-Update
            sm = _LOCALSTORAGE_SET.search(line)
            if sm:
                key = sm.group(1)
                if key in get_keys and has_await_between.get(key, False):
                    evidence_str = (
                        f"localStorage.getItem({key}) in Zeile {get_keys[key]}, "
                        f"localStorage.setItem({key}) in Zeile {i + 1} mit await dazwischen"
                    )
                    findings.append(create_finding(
                        tara_id="0058",
                        rule="R-32",
                        severity=Severity.Mittel,
                        confidence=Confidence.Low,
                        file=file_path,
                        line=i + 1,
                        finding_type="RaceCondition",
                        evidence={"code_snippet": evidence_str},
                        reasoning=(
                            f"Potentielles Lost-Update: localStorage.getItem({key}) gefolgt von "
                            f"await und localStorage.setItem({key}). Ein anderer Handler könnte "
                            "den Wert zwischen Read und Write überschreiben (R-32)."
                        ),
                    ))
                    # Key entfernen, nicht doppelt melden
                    del get_keys[key]

        return findings
