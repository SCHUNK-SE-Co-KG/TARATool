#!/usr/bin/env python3
"""TARA-0125: Epic-Batch-Gate (Option B der Regressionspolicy, Issue #208).

Waehrend der Bearbeitung einzelner Stories eines Epics laeuft nur die
jeweilige Story-Testdatei (P-06) bzw. - bei Risikopfaden - sofort die volle
Suite (P-06c). Die volle Regressionssuite fuer den "Rest" (nicht
risikobehafteter, aber gemeinsam genutzter Code) wird gebuendelt NACH
Abschluss aller Stories eines Epics nachgeholt, bevor ein Merge-PR nach
`main` erstellt wird (P-17, jetzt automatisiert statt nur "PO informieren").

Design (gleiches Prinzip wie scripts/workflow/transition_engine.py): Alle
GitHub-API-Zugriffe sind injizierbare Callables, damit die Entscheidungslogik
(`epic_batch_status`) ohne Netzwerkzugriff deterministisch testbar bleibt.

Verwendung (CLI):
    python scripts/workflow/epic_batch_gate.py --epic 176 \\
        --repo SCHUNK-SE-Co-KG/TARATool
Gibt "EPIC_BATCH_READY=true" aus (exit 0), wenn alle Sub-Issues des Epics
einen Status >= "Accepted" (Accepted/PO Release/Done) erreicht haben, sonst
"EPIC_BATCH_READY=false" (ebenfalls exit 0 - informativer Check, das
aufrufende Workflow entscheidet ueber die naechsten Schritte).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

PROJECT_NUMBER = "4"
PROJECT_OWNER = "SCHUNK-SE-Co-KG"

# Status, die belegen, dass eine Story das Epic-Batch-Gate nicht mehr
# blockiert (bereits gemergt und PO-akzeptiert bzw. released/done).
READY_STATUSES = {"Accepted", "PO Release", "Done"}


def epic_batch_status(sub_issue_numbers: List[int], fetch_status: Callable[[int], Optional[str]]) -> Dict[str, Any]:
    """Reine Entscheidungslogik (kein Netzwerkzugriff): ermittelt, ob ALLE
    Sub-Issues eines Epics einen "bereit"-Status erreicht haben.

    Ein Epic OHNE Sub-Issues gilt NICHT als bereit (leeres Epic ist kein
    sinnvoller Batch-Trigger - vermutlich fehlt die Sub-Issue-Verknuepfung).
    """
    if not sub_issue_numbers:
        return {"ready": False, "reason": "Epic hat keine verknuepften Sub-Issues (Stories)", "stories": {}}

    stories: Dict[int, Optional[str]] = {}
    blocking: List[int] = []
    for number in sub_issue_numbers:
        status = fetch_status(number)
        stories[number] = status
        if status not in READY_STATUSES:
            blocking.append(number)

    if blocking:
        return {
            "ready": False,
            "reason": f"Noch nicht bereit: Issue(s) {blocking} haben keinen Status in {sorted(READY_STATUSES)}",
            "stories": stories,
        }
    return {"ready": True, "reason": "Alle Sub-Issues sind Accepted/PO Release/Done", "stories": stories}


# ---------------------------------------------------------------------------
# gh-Anbindung (einzige Stelle mit echtem Netzwerkzugriff)
# ---------------------------------------------------------------------------


def _run_gh(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace"
    )


def fetch_sub_issue_numbers_via_gh(owner: str, repo: str, epic: int) -> List[int]:
    """Nutzt dieselbe Sub-Issues-REST-API wie scripts/workflow/link_epic_subissue.sh
    (TARA-0113), um die Issue-Nummern aller Sub-Issues eines Epics zu lesen."""
    result = _run_gh(["api", f"repos/{owner}/{repo}/issues/{epic}/sub_issues", "--jq", "[.[].number]"])
    if result.returncode != 0 or not result.stdout.strip():
        return []
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return []


def fetch_parent_epic_via_gh(owner: str, repo: str, issue_number: int) -> Optional[int]:
    """Liest den Parent (Epic) eines Story-Issues ueber die Sub-Issues-REST-API
    (`GET /repos/{owner}/{repo}/issues/{issue_number}/parent`, TARA-0125).
    Liefert None, wenn das Issue kein Sub-Issue eines Epics ist (z.B. 404)."""
    result = _run_gh(["api", f"repos/{owner}/{repo}/issues/{issue_number}/parent", "--jq", ".number"])
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return int(result.stdout.strip())
    except ValueError:
        return None


def fetch_status_via_gh(issue_number: int) -> Optional[str]:
    """Liest den Board-Status eines Issues ueber die Projekt-Item-Liste
    (gleiches Muster wie transition_engine.fetch_item_via_gh, aber ueber die
    Issue-NUMMER statt einen TARA-ID-Titel-Substring gematcht)."""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as fh:
        tmp = fh.name
    try:
        result = _run_gh(
            [
                "project", "item-list", PROJECT_NUMBER,
                "--owner", PROJECT_OWNER,
                "--format", "json",
                "--limit", "200",
            ]
        )
        Path(tmp).write_text(result.stdout, encoding="utf-8")
        data = json.loads(Path(tmp).read_text(encoding="utf-8") or "{}")
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return None
    finally:
        Path(tmp).unlink(missing_ok=True)

    items = data.get("items", [])
    match = next((i for i in items if (i.get("content") or {}).get("number") == issue_number), None)
    if match is None:
        return None
    return match.get("status")


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--epic", type=int, help="Epic-Issue-Nummer, z.B. 176")
    group.add_argument(
        "--story-issue",
        type=int,
        help="Story-Issue-Nummer (z.B. aus 'Bezug: #NNN' des gemergten PR) - "
        "das zugehoerige Epic wird automatisch ueber die Sub-Issues-Parent-API ermittelt",
    )
    parser.add_argument("--repo", default="SCHUNK-SE-Co-KG/TARATool", help="owner/name")
    args = parser.parse_args(argv)
    owner, repo = args.repo.split("/", 1)

    epic = args.epic
    if epic is None:
        epic = fetch_parent_epic_via_gh(owner, repo, args.story_issue)
        if epic is None:
            print("EPIC_BATCH_READY=false")
            print(f"INFO: Issue #{args.story_issue} hat kein verknuepftes Parent-Epic - kein Batch-Trigger.")
            return 0
        print(f"INFO: Story-Issue #{args.story_issue} gehoert zu Epic #{epic}")

    sub_issues = fetch_sub_issue_numbers_via_gh(owner, repo, epic)
    result = epic_batch_status(sub_issues, fetch_status_via_gh)

    print(f"EPIC_BATCH_READY={'true' if result['ready'] else 'false'}")
    print(f"EPIC_NUMBER={epic}")
    print(f"INFO: {result['reason']}")
    for number, status in result["stories"].items():
        print(f"  Issue #{number}: {status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
