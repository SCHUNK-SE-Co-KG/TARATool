"""TARA-0059: Fehlerbehandlung, Defaultwerte und Null/Undefined-Probleme.

Prüft JavaScript/TypeScript-Code auf:
  R-33 – Unvollständige Fehlerbehandlung (leere catch, console.log-only, JSON.parse ohne try)
  R-34 – Falsche Defaultwerte (|| statt ??, fehlende Guards)
  R-35 – Null/Undefined Property-Chains ohne Optional-Chaining/Guards
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

# R-33
_CATCH_START        = re.compile(r'^\s*(?:\}\s*)?catch\s*\(')  # } catch( oder standalone catch(
_EMPTY_LINE         = re.compile(r'^\s*$')
_BLOCK_CLOSER       = re.compile(r'^\s*\}')
_CONSOLE_ONLY       = re.compile(r'^\s*console\.\w+\s*\(')
_JSON_PARSE         = re.compile(r'\bJSON\.parse\s*\(')
_TRY_START          = re.compile(r'^\s*try\s*\{')
# Zeilen, die nur Kommentare enthalten – kein echter Code im catch-Block
_LINE_COMMENT       = re.compile(r'^\s*//')
_BLOCK_COMMENT_LINE = re.compile(r'^\s*/\*.*\*/\s*$')  # einzeiliger /* ... */

# R-34 – || Operator mit Literal-Default (potenziell falsy-Problem)
# Sucht: varname = expr || default  -- nicht in kommentaren
_OR_DEFAULT      = re.compile(
    r'(?:const|let|var)\s+\w+\s*=\s*.+\s*\|\|\s*(\w+|["\'].*?["\']|\d+)'
)
# Schließt reine boolean-Defaults aus: || true / || false -> häufig bewusst
_BOOLEAN_DEFAULT = re.compile(r'\|\|\s*(true|false)\s*[;,\n]')
# R-34b: ||= Zuweisungsoperator (gleiche Semantik wie ||)
_OR_ASSIGN       = re.compile(r'(\w[\w.]*)\s*\|\|=\s*(\w+|["\'].*?["\']|\d+)')

# R-35 – mehrstufige Property-Zugriffe ohne Optional-Chaining
# Erkennt: a.b.c (ohne ?.) wobei mindestens 2 Ebenen tief
_DEEP_CHAIN      = re.compile(r'\b(\w+)\.(\w+)\.(\w+)\b(?!\s*\()')
_OPTIONAL_CHAIN  = re.compile(r'\?\.')  # hat schon optional chaining
_TYPEOF_GUARD    = re.compile(r'typeof\s+\w+')
# Bekannte immer-verfügbare Objekte (browser/node globals) – keine R-35-Findings
_SAFE_ROOTS      = frozenset({
    "window", "document", "navigator", "location", "history",
    "console", "process", "Math", "Date", "JSON", "Object",
    "Array", "String", "Number", "Boolean", "Symbol",
    "Promise", "Error", "RegExp", "Map", "Set", "WeakMap",
    "globalThis", "self", "global",
})
# R-35b: Partielles Optional-Chaining a?.b.c.d – letztes Segment noch unsicher
# Erkennt: \w+\?\.(\w+)\.(\w+)  (ein ?. vorhanden aber noch .x.y dahinter)
_PARTIAL_OPTIONAL = re.compile(r'\w+\?\.\w+\.(\w+)(?![\?\.])')
# Pattern für inline-Code nach dem { auf einer catch-Zeile
_CATCH_INLINE_CODE = re.compile(r'\}\s*catch\s*\([^)]*\)\s*\{(.+)')



class ErrorHandlerAnalyzer:
    """Analysiert JS/TS-Code auf R-33 (Fehlerbehandlung), R-34 (Defaults), R-35 (Null-Chains)."""

    def analyze_code(self, code: str, file_path: str) -> list[Finding]:
        """Vollständige Analyse eines Code-Strings."""
        if not code.strip():
            return []
        lines = code.splitlines()
        results: list[Finding] = []
        results.extend(self._check_error_handling(lines, file_path))
        results.extend(self._check_json_parse(lines, file_path))
        results.extend(self._check_or_defaults(lines, file_path))
        results.extend(self._check_null_chains(lines, file_path))
        return results

    # ── R-33: Fehlerbehandlung ────────────────────────────────────────────────

    def _check_error_handling(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt leere catch-Blöcke und catch mit nur console.log."""
        findings: list[Finding] = []
        for i, line in enumerate(lines):
            if not _CATCH_START.match(line):
                continue
            catch_line = i
            # Sammle den Inhalt des catch-Blocks (ab Zeile NACH der catch-Zeile)
            # brace_depth=1: catch-Block ist bereits durch das { am Ende der catch-Zeile geöffnet
            brace_depth = 1
            block_lines: list[tuple[int, str]] = []
            j = catch_line + 1
            while j < len(lines):
                l = lines[j]
                brace_depth += l.count("{") - l.count("}")
                if brace_depth <= 0:
                    break  # catch-Block endet
                block_lines.append((j, l))
                j += 1

            # Filtere Leerzeilen und reine Kommentarzeilen (kein echter Code)
            code_lines = [
                (ln, l) for ln, l in block_lines
                if not _EMPTY_LINE.match(l)
                and not _LINE_COMMENT.match(l)
                and not _BLOCK_COMMENT_LINE.match(l)
            ]

            # Prüfe ob catch-Header-Zeile selbst Code enthält (single-line catch)
            # z.B.  } catch(e) { console.log(e); }
            catch_inline = _CATCH_INLINE_CODE.search(line)
            if catch_inline:
                inline_code = catch_inline.group(1).strip()
                # Inline-Code nur hinzufügen wenn es echter Code ist (kein Kommentar)
                if inline_code and not _LINE_COMMENT.match(inline_code) and not _BLOCK_COMMENT_LINE.match(inline_code):
                    code_lines = [(i, inline_code)] + code_lines

            if not code_lines:
                # Leerer catch-Block
                findings.append(create_finding(
                    tara_id="0059",
                    rule="R-33",
                    severity=Severity.Hoch,
                    confidence=Confidence.High,
                    file=file_path,
                    line=catch_line + 1,
                    finding_type="Fehlerbehandlung",
                    evidence={"code_snippet": line.strip()},
                    reasoning=(
                        "Leerer catch-Block: Fehler wird still verschluckt. "
                        "Mindestens console.error() + Rückgabe/Re-throw erforderlich."
                    ),
                ))
            elif all(_CONSOLE_ONLY.match(l) for _, l in code_lines):
                # Nur console.* im catch
                findings.append(create_finding(
                    tara_id="0059",
                    rule="R-33",
                    severity=Severity.Mittel,
                    confidence=Confidence.High,
                    file=file_path,
                    line=catch_line + 1,
                    finding_type="Fehlerbehandlung",
                    evidence={"code_snippet": line.strip()},
                    reasoning=(
                        "catch-Block enthält nur console-Ausgabe: Fehler wird nicht "
                        "behandelt oder weitergegeben. Caller weiß nichts von dem Fehler."
                    ),
                ))
        return findings

    def _check_json_parse(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt JSON.parse außerhalb eines try-Blocks."""
        findings: list[Finding] = []
        # Stack von brace-depths, bei denen ein try-Block begann.
        # Jeder geschachtelte try-Block bekommt seinen eigenen Eintrag.
        try_starts: list[int] = []
        depth = 0

        for i, line in enumerate(lines):
            if _TRY_START.match(line):
                # try-Block öffnet sich auf dem aktuellen depth-Level
                try_starts.append(depth)

            depth += line.count("{") - line.count("}")

            # Alle try-Blöcke entfernen, deren öffnender Depth nach dem Update nicht mehr aktiv ist
            try_starts = [d for d in try_starts if depth > d]

            in_try = len(try_starts) > 0

            if _JSON_PARSE.search(line) and not in_try:
                findings.append(create_finding(
                    tara_id="0059",
                    rule="R-33",
                    severity=Severity.Hoch,
                    confidence=Confidence.High,
                    file=file_path,
                    line=i + 1,
                    finding_type="Fehlerbehandlung",
                    evidence={"code_snippet": line.strip()},
                    reasoning=(
                        "JSON.parse() ohne umgebenden try/catch: Ungültige JSON-Strings "
                        "werfen SyntaxError und bringen die Funktion unkontrolliert zum Absturz."
                    ),
                ))

        return findings

    # ── R-34: Defaultwerte ────────────────────────────────────────────────────

    def _check_or_defaults(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt || und ||= statt ?? bei potenziell falschen Defaults."""
        findings: list[Finding] = []
        for i, line in enumerate(lines):
            if line.strip().startswith("//"):
                continue

            # R-34: const/let/var x = expr || default
            m = _OR_DEFAULT.search(line)
            if m and not _BOOLEAN_DEFAULT.search(line):
                default_val = m.group(1)
                findings.append(create_finding(
                    tara_id="0059",
                    rule="R-34",
                    severity=Severity.Mittel,
                    confidence=Confidence.Medium,
                    file=file_path,
                    line=i + 1,
                    finding_type="Defaultwert",
                    evidence={"code_snippet": line.strip()},
                    reasoning=(
                        f"|| mit Default '{default_val}': Der ||-Operator greift bei ALLEN "
                        "falsy-Werten (0, '', false, NaN). Falls der linke Operand 0 oder '' "
                        "sein kann, verwende ?? (Nullish-Coalescing) stattdessen."
                    ),
                ))

            # R-34b: x ||= default  (OR-Zuweisung – gleiche Semantik)
            m2 = _OR_ASSIGN.search(line)
            if m2 and not _BOOLEAN_DEFAULT.search(line):
                target, default_val = m2.group(1), m2.group(2)
                findings.append(create_finding(
                    tara_id="0059",
                    rule="R-34",
                    severity=Severity.Mittel,
                    confidence=Confidence.Medium,
                    file=file_path,
                    line=i + 1,
                    finding_type="Defaultwert",
                    evidence={"code_snippet": line.strip()},
                    reasoning=(
                        f"||= Zuweisung auf '{target}' mit Default '{default_val}': "
                        "||= überschreibt bei ALLEN falsy-Werten (0, '', false, NaN). "
                        "Verwende ??= (Nullish-Assignment) wenn nur null/undefined ersetzt werden soll."
                    ),
                ))

        return findings

    # ── R-35: Null/Undefined Chains ───────────────────────────────────────────

    def _check_null_chains(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt mehrstufige Property-Zugriffe ohne Optional-Chaining (R-35)
        und partielles Optional-Chaining wo letzte Ebene noch unsicher ist (R-35b)."""
        findings: list[Finding] = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith("//") or "require(" in line or "import " in line:
                continue
            # typeof-Guard vorhanden → OK
            if _TYPEOF_GUARD.search(line):
                continue

            if _OPTIONAL_CHAIN.search(line):
                # R-35b: Hat ?. aber noch unsicheres Trailing-Segment (a?.b.c.d)
                m_p = _PARTIAL_OPTIONAL.search(line)
                if m_p:
                    findings.append(create_finding(
                        tara_id="0059",
                        rule="R-35",
                        severity=Severity.Niedrig,
                        confidence=Confidence.Low,
                        file=file_path,
                        line=i + 1,
                        finding_type="NullSafety",
                        evidence={"code_snippet": stripped},
                        reasoning=(
                            "Partielles Optional-Chaining: Die Chain verwendet ?. an einer "
                            f"Stelle, hat danach aber noch unsichere Property-Zugriffe (.{m_p.group(1)}). "
                            "Optional-Chaining konsequent auf alle Ebenen ausweiten."
                        ),
                    ))
                continue  # Normale R-35-Prüfung überspringen

            m = _DEEP_CHAIN.search(line)
            if m:
                root = m.group(1)
                if root in _SAFE_ROOTS:
                    continue
                chain = f"{m.group(1)}.{m.group(2)}.{m.group(3)}"
                findings.append(create_finding(
                    tara_id="0059",
                    rule="R-35",
                    severity=Severity.Mittel,
                    confidence=Confidence.Medium,
                    file=file_path,
                    line=i + 1,
                    finding_type="NullSafety",
                    evidence={"code_snippet": stripped},
                    reasoning=(
                        f"Property-Chain '{chain}' ohne Optional-Chaining (?.) oder "
                        f"null-Guard. Falls '{m.group(1)}.{m.group(2)}' null/undefined ist, "
                        f"wirft der Zugriff auf '.{m.group(3)}' einen TypeError."
                    ),
                ))
        return findings
