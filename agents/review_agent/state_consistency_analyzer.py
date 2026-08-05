"""TARA-0060: Zustandsinkonsistenzen und Event-Listener-Leaks.

Prüft JavaScript/TypeScript-Code auf:
  R-37 – localStorage.setItem ohne nachfolgenden UI-Refresh-Aufruf
  R-38 – addEventListener in render*/update*/refresh*/build*-Funktionen ohne Guard
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

# R-37 – State-Konsistenz
_LOCALSTORAGE_SET  = re.compile(r'localStorage\.setItem\s*\(')
# UI-Refresh-Signale: Funktionen die den UI-State aktualisieren
_UI_REFRESH_CALLS  = re.compile(
    r'\b(render\w*|getActiveAnalysis|refreshTab|updateUI|repaint|'
    r'displayAnalysis|loadAnalysis|showTab|updateView|redraw|'
    r'renderActiveTab|syncUI)\s*\('
)

# R-38 – Listener-Leak
_FUNC_DEF          = re.compile(
    r'^\s*(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|'
    r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()'
)
# Funktionen die typischerweise wiederholt aufgerufen werden
_REPEAT_FUNC_NAMES = re.compile(
    r'^(render|update|refresh|build|create|draw|paint|show|display|load|rebuild)',
    re.IGNORECASE,
)
_ADD_EVENT         = re.compile(r'\.addEventListener\s*\(')
# Guards: einmalige Initialisierung
_INIT_GUARD        = re.compile(
    r'\b(_initialized|_listenersAdded|_bound|initialized|once|_setup)\b'
    r'|\bif\s*\(\s*\w*[Ii]nit\w*\)'
    r'|\bif\s*\(\s*window\.\w+\)'
)


class StateConsistencyAnalyzer:
    """Analysiert JS/TS-Code auf R-37 (State-Inkonsistenz) und R-38 (Listener-Leaks)."""

    def analyze_code(self, code: str, file_path: str) -> list[Finding]:
        """Vollständige Analyse eines Code-Strings."""
        if not code.strip():
            return []
        lines = code.splitlines()
        results: list[Finding] = []
        results.extend(self._check_state_consistency(lines, file_path))
        results.extend(self._check_listener_leaks(lines, file_path))
        return results

    # ── R-37: State-Konsistenz ────────────────────────────────────────────────

    def _check_state_consistency(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt localStorage.setItem ohne nachfolgenden UI-Refresh im selben Block."""
        findings: list[Finding] = []

        # Finde alle setItem-Aufrufe und prüfe ob im gleichen Funktions-Block
        # ein UI-Refresh folgt
        func_start  = 0
        func_depth  = 0
        in_func     = False
        depth       = 0

        # Verarbeite alle Funktionen einzeln
        current_func_lines: list[tuple[int, str]] = []

        for i, line in enumerate(lines):
            m = _FUNC_DEF.match(line)
            if m and not in_func:
                in_func    = True
                func_start = i
                func_depth = depth
                current_func_lines = [(i, line)]
            elif in_func:
                current_func_lines.append((i, line))

            depth += line.count("{") - line.count("}")

            if in_func and depth <= func_depth and i > func_start:
                # Funktion endet – prüfen
                self._analyze_function_for_r37(
                    current_func_lines, file_path, findings
                )
                in_func = False
                current_func_lines = []

        # Letzte Funktion falls Datei nicht endet mit }
        if in_func and current_func_lines:
            self._analyze_function_for_r37(current_func_lines, file_path, findings)

        return findings

    def _analyze_function_for_r37(
        self,
        func_lines: list[tuple[int, str]],
        file_path: str,
        findings: list[Finding],
    ) -> None:
        """Prüft eine Funktion auf setItem ohne Refresh."""
        set_item_lines: list[int] = []
        has_refresh    = False

        for ln, line in func_lines:
            if _LOCALSTORAGE_SET.search(line):
                set_item_lines.append(ln)
            if _UI_REFRESH_CALLS.search(line):
                has_refresh = True

        if set_item_lines and not has_refresh:
            func_name = ""
            m = _FUNC_DEF.match(func_lines[0][1])
            if m:
                func_name = m.group(1) or m.group(2) or ""

            for set_ln in set_item_lines:
                line_text = func_lines[set_ln - func_lines[0][0]][1].strip()
                findings.append(create_finding(
                    tara_id="0060",
                    rule="R-37",
                    severity=Severity.Mittel,
                    confidence=Confidence.Medium,
                    file=file_path,
                    line=set_ln + 1,
                    finding_type="Zustandsinkonsistenz",
                    evidence={"code_snippet": line_text},
                    reasoning=(
                        f"localStorage.setItem in '{func_name}' ohne nachfolgenden "
                        "UI-Refresh-Aufruf (z.B. renderActiveTab(), getActiveAnalysis()). "
                        "UI-State und Daten-State könnten auseinanderlaufen (R-37)."
                    ),
                ))

    # ── R-38: Event-Listener-Leaks ────────────────────────────────────────────

    def _check_listener_leaks(self, lines: list[str], file_path: str) -> list[Finding]:
        """Erkennt addEventListener in wiederholend aufrufbaren Funktionen ohne Guard."""
        findings: list[Finding] = []
        depth      = 0
        in_func    = False
        func_name  = ""
        func_start = 0
        func_depth = 0
        func_lines: list[tuple[int, str]] = []

        for i, line in enumerate(lines):
            m = _FUNC_DEF.match(line)
            if m and not in_func:
                name = m.group(1) or m.group(2) or ""
                # Nur Funktionen mit risikobehafteten Namen prüfen
                if _REPEAT_FUNC_NAMES.match(name):
                    in_func    = True
                    func_name  = name
                    func_start = i
                    func_depth = depth
                    func_lines = [(i, line)]

            if in_func:
                if i > func_start:
                    func_lines.append((i, line))

            depth += line.count("{") - line.count("}")

            if in_func and depth <= func_depth and i > func_start:
                # Funktion endet – prüfen
                self._analyze_function_for_r38(
                    func_lines, func_name, file_path, findings
                )
                in_func    = False
                func_lines = []

        return findings

    def _analyze_function_for_r38(
        self,
        func_lines: list[tuple[int, str]],
        func_name: str,
        file_path: str,
        findings: list[Finding],
    ) -> None:
        """Prüft eine Funktion auf Listener-Registrierung ohne Guard."""
        listener_lines: list[tuple[int, str]] = []
        has_guard = False

        for ln, line in func_lines:
            if _ADD_EVENT.search(line):
                listener_lines.append((ln, line))
            if _INIT_GUARD.search(line):
                has_guard = True

        if listener_lines and not has_guard:
            for lst_ln, lst_line in listener_lines:
                findings.append(create_finding(
                    tara_id="0060",
                    rule="R-38",
                    severity=Severity.Mittel,
                    confidence=Confidence.Medium,
                    file=file_path,
                    line=lst_ln + 1,
                    finding_type="ListenerLeak",
                    evidence={
                        "code_snippet": (
                            f"In '{func_name}': {lst_line.strip()}"
                        ),
                    },
                    reasoning=(
                        f"addEventListener in '{func_name}' (Funktion mit "
                        "wiederholtem Aufruf-Muster) ohne Initialisierungs-Guard. "
                        "Jeder Aufruf registriert einen weiteren Listener → Memory-Leak "
                        "und mehrfache Handler-Ausführung (R-38)."
                    ),
                ))
