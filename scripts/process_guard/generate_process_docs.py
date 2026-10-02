#!/usr/bin/env python3
"""TARA-0116: Generiert Markdown-Abschnitte aus docs/process_definition.yml.

Ersetzt die dafuer vorgesehenen Marker-Bloecke in den vier Prozessdokumenten
mit dem aus der YAML-Quelle abgeleiteten Markdown - statt Regelanzahl/-namen
manuell und redundant an mehreren Stellen zu pflegen.

Verwendung:
    python scripts/process_guard/generate_process_docs.py            # schreibt Aenderungen
    python scripts/process_guard/generate_process_docs.py --check    # nur pruefen (CI), exit 1 bei Drift
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - Abhaengigkeit fehlt im Environment
    print("FEHLER: PyYAML ist nicht installiert (siehe tests/requirements.txt)", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFINITION_PATH = REPO_ROOT / "docs" / "process_definition.yml"

DEV_AGENT_ONBOARDING = REPO_ROOT / ".github" / "agents" / "developer.agent.md"
PROCESS_GUARD_AGENT = REPO_ROOT / ".github" / "agents" / "process-guard.policy.md"
REVIEW_AGENT_WORKFLOW = REPO_ROOT / ".github" / "agents" / "reviewer.agent.md"
COPILOT_INSTRUCTIONS = REPO_ROOT / ".github" / "copilot-instructions.md"

# Pro Zieldatei die dort erwarteten Marker-Namen (R-34: fehlende/umbenannte
# Marker duerfen NIE als "kein Drift" durchgehen, sondern muessen hart
# fehlschlagen).
EXPECTED_MARKERS = {
    DEV_AGENT_ONBOARDING: {"rule-range", "process-rules-table"},
    PROCESS_GUARD_AGENT: {"process-rules-table"},
    REVIEW_AGENT_WORKFLOW: {"review-rules-table"},
    COPILOT_INSTRUCTIONS: {"rule-range"},
}


class MissingMarkerError(RuntimeError):
    """Wird ausgeloest, wenn ein fuer eine Datei erwarteter Marker fehlt oder
    ein START/END-Markerpaar nicht zusammenpasst (z.B. Tippfehler)."""

MARKER_START = "<!-- GENERATED:{name}:START (docs/process_definition.yml, scripts/process_guard/generate_process_docs.py) -->"
MARKER_END = "<!-- GENERATED:{name}:END -->"

# Block-Marker umschliessen mehrzeiligen Inhalt (z.B. ganze Tabellen) und
# werden mit umgebenden Zeilenumbruechen eingefuegt. Inline-Marker sitzen
# innerhalb einer bestehenden Zeile/Tabellenzelle (z.B. eine kurze
# Regelbereichs-Angabe) und werden OHNE zusaetzliche Zeilenumbrueche ersetzt.
BLOCK_MARKERS = {"process-rules-table", "review-rules-table"}
INLINE_MARKERS = {"rule-range", "status-enum"}


def load_definition() -> dict:
    with DEFINITION_PATH.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _rule_ids(rules: dict) -> list[str]:
    """Sortiert Regel-IDs numerisch (P-01 < P-04b < P-27 statt lexikografisch)."""

    def sort_key(rule_id: str):
        m = re.match(r"^[A-Z]+-(\d+)([a-z]?)$", rule_id)
        return (int(m.group(1)), m.group(2)) if m else (9999, rule_id)

    return sorted(rules.keys(), key=sort_key)


def render_process_rules_table(data: dict) -> str:
    rules = data["rules"]
    lines = ["| Regel | Beschreibung | Automatisiert |", "| ----- | ------------ | -------------- |"]
    for rule_id in _rule_ids(rules):
        rule = rules[rule_id]
        lines.append(f"| {rule_id} | {rule['title']} | {rule['automation']} |")
    return "\n".join(lines)


def render_review_rules_table(data: dict) -> str:
    rules = data["review_rules"]
    lines = ["| Regel | Kategorie | Beschreibung |", "| ----- | --------- | ------------ |"]
    for rule_id in _rule_ids(rules):
        rule = rules[rule_id]
        lines.append(f"| {rule_id} | {rule['category']} | {rule['description']} |")
    return "\n".join(lines)


def render_rule_range(data: dict) -> str:
    p_ids = _rule_ids(data["rules"])
    r_ids = _rule_ids(data["review_rules"])
    return f"Prozessregeln {p_ids[0]}-{p_ids[-1]}, Review-Regeln {r_ids[0]}-{r_ids[-1]}"


def render_status_enum(data: dict) -> str:
    return " -> ".join(data["statuses"])


GENERATORS = {
    "process-rules-table": render_process_rules_table,
    "review-rules-table": render_review_rules_table,
    "rule-range": render_rule_range,
    "status-enum": render_status_enum,
}


def replace_marker(text: str, marker_name: str, new_content: str) -> tuple[str, bool]:
    start = MARKER_START.format(name=marker_name)
    end = MARKER_END.format(name=marker_name)
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.DOTALL)
    if marker_name in BLOCK_MARKERS:
        replacement = f"{start}\n{new_content}\n{end}"
    else:
        replacement = f"{start}{new_content}{end}"
    if not pattern.search(text):
        return text, False
    # Callable als repl-Argument: re.sub interpretiert den Rueckgabewert nicht
    # als Backreference-Syntax, daher ist kein Escaping von "\" noetig.
    return pattern.sub(lambda _m: replacement, text), True


def format_with_prettier(relpath: Path, text: str) -> str:
    """Formatiert generierten Markdown-Text mit dem projekteigenen Prettier
    (gleiche Konfiguration wie `npm run format:write`), damit die generierten
    Abschnitte nicht durch einen nachgelagerten Prettier-Lauf wieder als Diff
    auftauchen (P-12)."""
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    try:
        result = subprocess.run(
            [npx, "prettier", "--stdin-filepath", str(relpath)],
            input=text,
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=60,
            shell=(sys.platform == "win32"),
        )
    except (OSError, subprocess.SubprocessError) as exc:  # pragma: no cover - Umgebung ohne npx
        print(f"WARNUNG: Prettier konnte nicht ausgefuehrt werden ({exc}) - ungeformatete Ausgabe wird verwendet")
        return text
    if result.returncode != 0 or not result.stdout:
        print(f"WARNUNG: Prettier-Formatierung fuer {relpath} fehlgeschlagen:\n{result.stderr}")
        return text
    return result.stdout


def apply_generators(text: str, data: dict) -> tuple[str, list[str]]:
    applied = []
    for marker_name, generator in GENERATORS.items():
        text, matched = replace_marker(text, marker_name, generator(data))
        if matched:
            applied.append(marker_name)
    return text, applied


def _display_path(path: Path) -> str:
    """Formatiert einen Pfad relativ zum Repo-Root, falls moeglich (sonst
    absolut) - z.B. fuer Testdateien ausserhalb des Repos."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def _check_expected_markers(path: Path, original: str, applied: list[str]) -> None:
    """R-34: fehlende oder kaputte Marker duerfen niemals als 'kein Drift'
    durchgehen. Prueft explizit, dass jeder fuer diese Datei erwartete Marker
    tatsaechlich (mind. einmal) angewendet wurde."""
    expected = EXPECTED_MARKERS.get(path, set())
    missing = expected - set(applied)
    if not missing:
        return
    details = []
    for name in sorted(missing):
        start_token = MARKER_START.format(name=name)
        end_token = MARKER_END.format(name=name)
        if start_token not in original:
            details.append(f"'{name}': Marker fehlt komplett (kein START-Tag gefunden)")
        elif end_token not in original:
            details.append(f"'{name}': START-Tag vorhanden, aber END-Tag fehlt/ist umbenannt")
        else:
            details.append(f"'{name}': START/END vorhanden, aber Ersetzung fehlgeschlagen")
    raise MissingMarkerError(
        f"{_display_path(path)}: erwartete Marker fehlen oder sind defekt -> " + "; ".join(details)
    )


def process_file(path: Path, data: dict, check_only: bool) -> bool:
    """Gibt True zurueck, wenn Drift gefunden wurde (nur relevant bei check_only).

    Wirft MissingMarkerError (statt still 'kein Drift' zu melden), wenn ein
    fuer diese Datei erwarteter Marker fehlt oder ein START/END-Paar nicht
    zusammenpasst - siehe R-34.
    """
    original = path.read_text(encoding="utf-8")
    updated, applied = apply_generators(original, data)
    _check_expected_markers(path, original, applied)
    if not applied:
        return False
    updated = format_with_prettier(path.relative_to(REPO_ROOT), updated)
    if updated == original:
        return False
    if check_only:
        print(f"DRIFT: {path.relative_to(REPO_ROOT)} ist nicht auf dem generierten Stand ({', '.join(applied)})")
        return True
    path.write_text(updated, encoding="utf-8")
    print(f"OK: {path.relative_to(REPO_ROOT)} aktualisiert ({', '.join(applied)})")
    return False



def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Nur pruefen (CI), keine Dateien schreiben")
    args = parser.parse_args()

    data = load_definition()
    targets = [DEV_AGENT_ONBOARDING, PROCESS_GUARD_AGENT, REVIEW_AGENT_WORKFLOW, COPILOT_INSTRUCTIONS]

    drift_found = False
    try:
        for target in targets:
            if process_file(target, data, check_only=args.check):
                drift_found = True
    except MissingMarkerError as exc:
        print(f"FEHLER: {exc}", file=sys.stderr)
        return 2

    if args.check:
        if drift_found:
            print("FAIL: Generierte Doku-Abschnitte weichen von process_definition.yml ab.")
            print("      'python scripts/process_guard/generate_process_docs.py' ausfuehren und committen.")
            return 1
        print("OK: Alle generierten Doku-Abschnitte sind konsistent mit process_definition.yml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
