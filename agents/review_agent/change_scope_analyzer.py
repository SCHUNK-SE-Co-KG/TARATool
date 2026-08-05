"""TARA-0057: Change-Scope und Impact-Analyse.

Analysiert einen Git-Diff und erstellt einen maschinenlesbaren ScopeReport mit:
- Geänderten Dateien und Funktionen
- Caller-Graph (1 Ebene, plattformunabhängige Python-Suche)
- Vertragsbruch-Liste (nur echte Signaturänderungen, keine reinen Add/Remove)
- Fehlende Kontext-Informationen

Review-Fixes (High/Medium):
- H1: (file, name) als zusammengesetzter Key für Signatur-Tracking
- H2: Plattformunabhängige Python-Suche statt grep-Subprocess
- H3: caller_graph Key = "file::name" für eindeutige Identität
- M1: Neue/gelöschte Funktionen nicht als Signaturänderung klassifizieren
- M2: dict-Lookup für current_file (O(1) statt O(n))
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


# ─── Datenklassen ────────────────────────────────────────────────────────────

@dataclass
class ChangedFile:
    path: str
    additions: int = 0
    deletions: int = 0
    changed_functions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "additions": self.additions,
            "deletions": self.deletions,
            "changed_functions": self.changed_functions,
        }


@dataclass
class ChangedFunction:
    file_path: str
    name: str
    signature_changed: bool = False

    @property
    def uid(self) -> str:
        """Eindeutiger Bezeichner: 'file::name'."""
        return f"{self.file_path}::{self.name}"

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "name": self.name,
            "signature_changed": self.signature_changed,
        }


@dataclass
class CallerInfo:
    file_path: str
    line_number: int
    function_name: str  # Bezeichner der geänderten Funktion (uid)

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "function_name": self.function_name,
        }


@dataclass
class ContractViolation:
    function_name: str
    violation_type: str  # "signature_change" | "parameter_removal" | "return_type_change"
    detail: str

    def to_dict(self) -> dict:
        return {
            "function_name": self.function_name,
            "violation_type": self.violation_type,
            "detail": self.detail,
        }


@dataclass
class ScopeReport:
    changed_files: list[ChangedFile]
    changed_functions: list[ChangedFunction]
    # Key = ChangedFunction.uid ("file::name") für eindeutige Identität (H3)
    caller_graph: dict[str, list[CallerInfo]]
    contract_violations: list[ContractViolation]
    missing_context: list[str]

    def to_dict(self) -> dict:
        return {
            "changed_files": [f.to_dict() for f in self.changed_files],
            "changed_functions": [f.to_dict() for f in self.changed_functions],
            "caller_graph": {
                uid: [c.to_dict() for c in callers]
                for uid, callers in self.caller_graph.items()
            },
            "contract_violations": [cv.to_dict() for cv in self.contract_violations],
            "missing_context": self.missing_context,
        }


# ─── Patterns ────────────────────────────────────────────────────────────────

# Erkennt: -function foo(a, b) oder +function foo(a, b, c=1)
# sowie Arrow Functions: const foo = (a) =>
_FUNC_SIGNATURE_RE = re.compile(
    r'^[+-](?!---|\+\+\+)\s*(?:'
    r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'
    r'|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>'
    r')',
)

# Diff-Dateikopf: diff --git a/path b/path
_FILE_HEADER_RE = re.compile(r'^diff --git a/(.+?) b/')

# Suche nach Funktionsaufruf-Muster: name( → reduziert False-Positives
_CALL_PATTERN_TEMPLATE = r'\b{name}\s*\('


# ─── Analyser ────────────────────────────────────────────────────────────────

class ChangeScopeAnalyzer:
    """Parst einen Git-Diff und erstellt einen ScopeReport.

    Args:
        grep_runner: Callable(function_name, search_root) -> list[str matching lines].
                     Standardmäßig plattformunabhängige Python-Suche (H2).
                     Dependency Injection für Tests.
    """

    def __init__(
        self,
        grep_runner: Callable[[str, str], list[str]] | None = None,
    ) -> None:
        self._grep = grep_runner or _python_grep_runner

    # ── Public API ────────────────────────────────────────────────────────────

    def analyze_from_diff(self, diff_text: str, search_root: str = ".") -> ScopeReport:
        """ScopeReport aus rohem Unified-Diff-String erzeugen."""
        changed_files, changed_functions = self._parse_diff(diff_text)
        caller_graph = self._build_caller_graph(changed_functions, search_root)
        contract_violations = self._detect_contract_violations(changed_functions)
        missing_context = self._identify_missing_context(changed_functions, caller_graph)
        return ScopeReport(
            changed_files=changed_files,
            changed_functions=changed_functions,
            caller_graph=caller_graph,
            contract_violations=contract_violations,
            missing_context=missing_context,
        )

    def analyze_from_branches(
        self,
        base_branch: str,
        feature_branch: str,
        search_root: str = ".",
        repo_root: str = ".",
    ) -> ScopeReport:
        """Diff zwischen Branches berechnen und ScopeReport erstellen."""
        diff_text = _run_git_diff(base_branch, feature_branch, repo_root)
        return self.analyze_from_diff(diff_text, search_root)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _parse_diff(
        self, diff_text: str
    ) -> tuple[list[ChangedFile], list[ChangedFunction]]:
        """Geänderte Dateien und Funktionen aus Unified-Diff extrahieren."""
        files_by_path: dict[str, ChangedFile] = {}   # M2: O(1) Lookup
        changed_functions: list[ChangedFunction] = []
        seen_functions: set[tuple[str, str]] = set()  # (file, name) dedup
        current_file: str = ""

        # H1: Signatur-Tracking per (file, name) statt nur name
        old_sigs: dict[tuple[str, str], str] = {}
        new_sigs: dict[tuple[str, str], str] = {}

        for line in diff_text.splitlines():
            # Neue Datei im Diff
            m = _FILE_HEADER_RE.match(line)
            if m:
                current_file = m.group(1)
                if current_file not in files_by_path:
                    files_by_path[current_file] = ChangedFile(path=current_file)
                continue

            if not current_file:
                continue

            # Additions/Deletions zählen (M2: direkter dict-Zugriff)
            if line.startswith("+") and not line.startswith("+++"):
                files_by_path[current_file].additions += 1
            elif line.startswith("-") and not line.startswith("---"):
                files_by_path[current_file].deletions += 1

            # Funktionsdeklarationen erkennen
            m = _FUNC_SIGNATURE_RE.match(line)
            if not m:
                continue

            fn_name = m.group(1) or m.group(3)
            params = m.group(2) if m.group(2) is not None else (m.group(4) or "")
            if not fn_name:
                continue

            sig_key = (current_file, fn_name)

            if line.startswith("-"):
                old_sigs[sig_key] = params.strip()
            elif line.startswith("+"):
                new_sigs[sig_key] = params.strip()

            if sig_key not in seen_functions:
                seen_functions.add(sig_key)
                cf_obj = ChangedFunction(file_path=current_file, name=fn_name)
                changed_functions.append(cf_obj)
                if fn_name not in files_by_path[current_file].changed_functions:
                    files_by_path[current_file].changed_functions.append(fn_name)

        # M1: signature_changed NUR bei echter Änderung (nicht bei reinem Add/Remove)
        for fn in changed_functions:
            key = (fn.file_path, fn.name)
            if key in old_sigs and key in new_sigs:
                fn.signature_changed = old_sigs[key] != new_sigs[key]
            # Sonst: fn.signature_changed bleibt False (neue oder gelöschte Funktion)

        return list(files_by_path.values()), changed_functions

    def _build_caller_graph(
        self,
        changed_functions: list[ChangedFunction],
        search_root: str,
    ) -> dict[str, list[CallerInfo]]:
        """Für jede geänderte Funktion Aufrufstellen suchen (1 Ebene).

        Key = fn.uid ('file::name') für eindeutige Identität (H3).
        """
        graph: dict[str, list[CallerInfo]] = {}
        for fn in changed_functions:
            raw_lines = self._grep(fn.name, search_root)
            callers = _parse_grep_lines(fn.uid, raw_lines)
            graph[fn.uid] = callers
        return graph

    def _detect_contract_violations(
        self, changed_functions: list[ChangedFunction]
    ) -> list[ContractViolation]:
        """Funktionen mit geänderter Signatur als Vertragsbruch melden."""
        return [
            ContractViolation(
                function_name=fn.uid,
                violation_type="signature_change",
                detail=(
                    f"Signatur von '{fn.name}' in {fn.file_path} geändert. "
                    "Alle Aufrufstellen müssen geprüft werden."
                ),
            )
            for fn in changed_functions
            if fn.signature_changed
        ]

    def _identify_missing_context(
        self,
        changed_functions: list[ChangedFunction],
        caller_graph: dict[str, list[CallerInfo]],
    ) -> list[str]:
        """Funktionen mit Signaturänderung UND aktiven Callern als missing context melden."""
        missing: list[str] = []
        for fn in changed_functions:
            callers = caller_graph.get(fn.uid, [])
            if fn.signature_changed and callers:
                caller_files = ", ".join(c.file_path for c in callers)
                missing.append(
                    f"'{fn.name}' ({fn.file_path}) hat {len(callers)} Aufrufstelle(n) "
                    f"mit geänderter Signatur → manuelle Prüfung: {caller_files}"
                )
        return missing


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_grep_lines(function_uid: str, lines: list[str]) -> list[CallerInfo]:
    """Parst Grep-Output-Zeilen (Format: 'path:lineno:code') in CallerInfo-Objekte.

    Verwendet nur den letzten ':' vor der Zeilennummer um Windows-Pfade (C:\\...) korrekt zu parsen.
    """
    callers: list[CallerInfo] = []
    # Format: "path/to/file.js:42:  code line"
    # Windows: "C:\\path\\file.js:42:  code" – split maxsplit=2 vom Ende
    for raw in lines:
        # Rückwärts splitten: letztes ':Zahl:' Muster suchen
        match = re.match(r'^(.+?):(\d+):', raw)
        if not match:
            continue
        file_path = match.group(1)
        line_no = int(match.group(2))
        callers.append(CallerInfo(
            file_path=file_path,
            line_number=line_no,
            function_name=function_uid,
        ))
    return callers


def _python_grep_runner(function_name: str, search_root: str) -> list[str]:
    """Plattformunabhängige Datei-Suche via Python pathlib + re (H2).

    Sucht nach Aufrufmuster 'name(' um Definitionen/Kommentare zu reduzieren.
    Gibt Zeilen im Format 'path:lineno:code' zurück.
    """
    pattern = re.compile(_CALL_PATTERN_TEMPLATE.format(name=re.escape(function_name)))
    results: list[str] = []
    root = Path(search_root)
    if not root.exists():
        return results
    for suffix in ("*.js", "*.ts", "*.jsx", "*.tsx"):
        for file_path in root.rglob(suffix):
            try:
                lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
                for i, line in enumerate(lines, start=1):
                    if pattern.search(line):
                        results.append(f"{file_path}:{i}:{line}")
            except OSError:
                continue
    return results


def _run_git_diff(base_branch: str, feature_branch: str, repo_root: str) -> str:
    """Git-Diff zwischen zwei Branches berechnen.

    Raises RuntimeError bei Git-Fehler (Niedrig-Finding behoben).
    """
    result = subprocess.run(
        ["git", "diff", f"{base_branch}...{feature_branch}"],
        capture_output=True,
        text=True,
        cwd=repo_root,
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"git diff fehlgeschlagen (code {result.returncode}): {result.stderr.strip()}"
        )
    return result.stdout
