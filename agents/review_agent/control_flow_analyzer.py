"""TARA-0058: Kontrollfluss-Analyse, Race Conditions und asynchrone Sequenzen.

Prüft JavaScript/TypeScript-Code auf:
  R-31 – Toter Code nach return/throw
  R-32 – Race Conditions bei localStorage.setItem in mehreren Event-Handlern
  R-36 – Fehlendes await vor asynchronen Aufrufen in async-Funktionen

Jedes Finding nutzt das Finding-Framework aus TARA-0062.
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

# R-36
_ASYNC_FUNC_START = re.compile(
    r'^\s*(?:export\s+)?async\s+function\s+\w+'
    r'|^\s*(?:const|let|var)\s+\w+\s*=\s*async\s*\('
)
# const/let/var x = fn(  -- but NOT  const x = await fn(
_ASSIGN_CALL_NO_AWAIT = re.compile(
    r'^\s*(?:const|let|var)\s+\w+\s*=\s*(?!await\s)(\w+)\s*\('
)

# R-32
_ADD_EVENT_LISTENER = re.compile(r'\.addEventListener\s*\(')
_LOCALSTORAGE_SET   = re.compile(r'localStorage\.setItem\s*\(')

# Sync-Builtins – niemals async, R-36 überspringen
_SYNC_BUILTINS = frozenset({
    "new", "JSON", "Object", "Array", "String", "Number",
    "Boolean", "Math", "Date", "RegExp", "Error", "parseInt",
    "parseFloat", "isNaN", "isFinite", "console",
})


class ControlFlowAnalyzer:
    """Analysiert JS/TS-Code-Strings auf R-31, R-32, R-36 Defekte.

    Gibt Liste von Finding-Objekten zurück (Finding-Framework TARA-0062).
    """

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

    # ── R-36: Fehlendes await ─────────────────────────────────────────────────

    def _check_missing_await(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt fehlende await-Aufrufe in async-Funktionen."""
        findings: list[Finding] = []
        in_async   = False
        depth      = 0
        func_depth = 0

        for i, line in enumerate(lines):
            if _ASYNC_FUNC_START.match(line):
                in_async   = True
                func_depth = depth

            opens  = line.count("{")
            closes = line.count("}")
            depth += opens - closes

            if not in_async:
                continue

            # Funktion endet wenn Tiefe auf Eintrittstiefe fällt
            if closes > 0 and depth <= func_depth:
                in_async = False
                continue

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

    # ── R-32: Race Conditions ─────────────────────────────────────────────────

    def _check_race_conditions(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt localStorage.setItem in mehreren Event-Handler-Callbacks."""
        findings: list[Finding] = []
        in_handler  = False
        brace_depth = 0
        set_lines: list[int] = []

        for i, line in enumerate(lines):
            if _ADD_EVENT_LISTENER.search(line):
                in_handler  = True
                brace_depth = 0

            if in_handler:
                brace_depth += line.count("{") - line.count("}")
                if _LOCALSTORAGE_SET.search(line):
                    set_lines.append(i + 1)
                if brace_depth < 0:
                    in_handler  = False
                    brace_depth = 0

        if len(set_lines) >= 2:
            evidence_str = f"localStorage.setItem in Zeilen: {', '.join(map(str, set_lines))}"
            findings.append(create_finding(
                tara_id="0058",
                rule="R-32",
                severity=Severity.Hoch,
                confidence=Confidence.Medium,
                file=file_path,
                line=set_lines[0],
                finding_type="RaceCondition",
                evidence={"code_snippet": evidence_str},
                reasoning=(
                    f"localStorage.setItem in {len(set_lines)} Event-Handlern ohne "
                    "Synchronisierungslogik. Gleichzeitige Events können zu "
                    "inkonsistenten Speicherzuständen führen (R-32)."
                ),
            ))

        return findings
