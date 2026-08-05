"""TARA-0057: Change-Scope und Impact-Analyse.

Analysiert einen Git-Diff und erstellt einen maschinenlesbaren ScopeReport mit:
- Geänderten Dateien und Funktionen
- Caller-Graph (1 Ebene, flach)
- Vertragsbruch-Liste (Signaturänderungen)
- Fehlende Kontext-Informationen
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
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
    function_name: str  # the changed function being called

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
    caller_graph: dict[str, list[CallerInfo]]  # function_name -> callers
    contract_violations: list[ContractViolation]
    missing_context: list[str]

    def to_dict(self) -> dict:
        return {
            "changed_files": [f.to_dict() for f in self.changed_files],
            "changed_functions": [f.to_dict() for f in self.changed_functions],
            "caller_graph": {
                fn: [c.to_dict() for c in callers]
                for fn, callers in self.caller_graph.items()
            },
            "contract_violations": [cv.to_dict() for cv in self.contract_violations],
            "missing_context": self.missing_context,
        }


# ─── Patterns ────────────────────────────────────────────────────────────────

# Matches: -function foo(a, b) or +function foo(a, b, c=1)
_FUNC_SIGNATURE_RE = re.compile(
    r'^[+-](?!---|\+\+\+)\s*(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)'
    r'|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>)',
)

# Matches diff file header: diff --git a/path b/path
_FILE_HEADER_RE = re.compile(r'^diff --git a/(.+?) b/')


# ─── Analyser ────────────────────────────────────────────────────────────────

class ChangeScopeAnalyzer:
    """Parses a git diff and builds a ScopeReport.

    Args:
        grep_runner: Callable(function_name, search_root) -> list[str of matching lines].
                     Defaults to a real subprocess grep. Inject a mock for testing.
    """

    def __init__(
        self,
        grep_runner: Callable[[str, str], list[str]] | None = None,
    ) -> None:
        self._grep = grep_runner or _default_grep_runner

    # ── Public API ────────────────────────────────────────────────────────────

    def analyze_from_diff(self, diff_text: str, search_root: str = ".") -> ScopeReport:
        """Build a ScopeReport from a raw unified diff string."""
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
        """Compute diff between branches and build ScopeReport."""
        diff_text = _run_git_diff(base_branch, feature_branch, repo_root)
        return self.analyze_from_diff(diff_text, search_root)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _parse_diff(
        self, diff_text: str
    ) -> tuple[list[ChangedFile], list[ChangedFunction]]:
        """Extract changed files and functions from unified diff."""
        changed_files: list[ChangedFile] = []
        changed_functions: list[ChangedFunction] = []
        current_file: str = ""
        seen_functions: set[str] = set()  # (file, name) dedup
        # Track old/new signatures per function to detect changes
        old_sigs: dict[str, str] = {}  # function_name -> old param string
        new_sigs: dict[str, str] = {}  # function_name -> new param string

        for line in diff_text.splitlines():
            # New file
            m = _FILE_HEADER_RE.match(line)
            if m:
                current_file = m.group(1)
                cf = ChangedFile(path=current_file)
                changed_files.append(cf)
                continue

            if not current_file:
                continue

            # Count additions/deletions
            if line.startswith("+") and not line.startswith("+++"):
                for f in changed_files:
                    if f.path == current_file:
                        f.additions += 1
            elif line.startswith("-") and not line.startswith("---"):
                for f in changed_files:
                    if f.path == current_file:
                        f.deletions += 1

            # Detect function declarations
            m = _FUNC_SIGNATURE_RE.match(line)
            if not m:
                continue

            # Extract name and params (group 1+2 for function, 3+4 for arrow)
            fn_name = m.group(1) or m.group(3)
            params = m.group(2) if m.group(2) is not None else (m.group(4) or "")
            if not fn_name:
                continue

            is_deletion = line.startswith("-")
            is_addition = line.startswith("+")

            if is_deletion:
                old_sigs[fn_name] = params.strip()
            elif is_addition:
                new_sigs[fn_name] = params.strip()

            key = (current_file, fn_name)
            if key not in seen_functions:
                seen_functions.add(key)
                changed_functions.append(
                    ChangedFunction(file_path=current_file, name=fn_name)
                )
                # Register with parent ChangedFile
                for cf in changed_files:
                    if cf.path == current_file and fn_name not in cf.changed_functions:
                        cf.changed_functions.append(fn_name)

        # Mark signature_changed where both old and new sigs exist and differ
        for fn in changed_functions:
            if fn.name in old_sigs and fn.name in new_sigs:
                if old_sigs[fn.name] != new_sigs[fn.name]:
                    fn.signature_changed = True
            elif fn.name in old_sigs or fn.name in new_sigs:
                # Only one side seen → signature change (added or removed)
                fn.signature_changed = True

        return changed_files, changed_functions

    def _build_caller_graph(
        self,
        changed_functions: list[ChangedFunction],
        search_root: str,
    ) -> dict[str, list[CallerInfo]]:
        """For each changed function, find all call sites (1 level deep)."""
        graph: dict[str, list[CallerInfo]] = {}
        for fn in changed_functions:
            raw_lines = self._grep(fn.name, search_root)
            callers = _parse_grep_lines(fn.name, raw_lines)
            graph[fn.name] = callers
        return graph

    def _detect_contract_violations(
        self, changed_functions: list[ChangedFunction]
    ) -> list[ContractViolation]:
        """Functions with changed signatures are contract violations."""
        violations: list[ContractViolation] = []
        for fn in changed_functions:
            if fn.signature_changed:
                violations.append(
                    ContractViolation(
                        function_name=fn.name,
                        violation_type="signature_change",
                        detail=(
                            f"Signatur von '{fn.name}' in {fn.file_path} geändert. "
                            "Alle Aufrufstellen müssen geprüft werden."
                        ),
                    )
                )
        return violations

    def _identify_missing_context(
        self,
        changed_functions: list[ChangedFunction],
        caller_graph: dict[str, list[CallerInfo]],
    ) -> list[str]:
        """Flag functions with signature changes AND active callers as missing context."""
        missing: list[str] = []
        for fn in changed_functions:
            callers = caller_graph.get(fn.name, [])
            if fn.signature_changed and callers:
                missing.append(
                    f"'{fn.name}' hat {len(callers)} Aufrufstelle(n) mit geänderter Signatur "
                    f"→ manuelle Prüfung erforderlich: {', '.join(c.file_path for c in callers)}"
                )
        return missing


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_grep_lines(function_name: str, lines: list[str]) -> list[CallerInfo]:
    """Parse `grep -n` output lines into CallerInfo objects."""
    callers: list[CallerInfo] = []
    for line in lines:
        # Format: path/file.js:42:  code line
        parts = line.split(":", 2)
        if len(parts) < 2:
            continue
        file_path = parts[0]
        try:
            line_no = int(parts[1])
        except ValueError:
            continue
        callers.append(CallerInfo(
            file_path=file_path,
            line_number=line_no,
            function_name=function_name,
        ))
    return callers


def _default_grep_runner(function_name: str, search_root: str) -> list[str]:
    """Real subprocess grep: searches for function_name in search_root."""
    try:
        result = subprocess.run(
            ["grep", "-rn", "--include=*.js", "--include=*.ts",
             function_name, search_root],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout.splitlines()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []


def _run_git_diff(base_branch: str, feature_branch: str, repo_root: str) -> str:
    """Run git diff between two branches and return the unified diff text."""
    result = subprocess.run(
        ["git", "diff", f"{base_branch}...{feature_branch}"],
        capture_output=True,
        text=True,
        cwd=repo_root,
        timeout=60,
    )
    return result.stdout
