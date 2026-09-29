"""TARA-0108/TARA-0110/TARA-0121: Bestaetigt nach dem Merge, dass der
PO-Akzeptanz-Gate (P-25) eingehalten wurde (Board-Status "Accepted").

Ersetzt den bisher manuellen, vom Dev-Agent selbst verantworteten Schritt
"Nach Merge: Item auf den Zielstatus setzen" durch eine automatische
GitHub-Actions-Aktion direkt beim Merge-Event (`pull_request` -> `closed`
mit `merged == true`). Der Dev-Agent kann diesen Schritt damit weder
vergessen noch uebergehen noch sich selbst faelschlich als regelkonform
attestieren - die Pruefung erfolgt technisch, nicht durch Selbstauskunft.

TARA-0121 (P-26/P-27): Seit Einfuehrung des geschuetzten Status "PO
Release" setzt dieses Skript den Status nach dem Merge NICHT MEHR
automatisch auf "Done" - das war vor TARA-0121 der Fall (Statusmodell B,
TARA-0110), ist aber jetzt ein unautorisierter Bypass des neuen P-27-Gates
("Accepted" -> "PO Release" -> "Done" NUR nach gebundenem
"PO Release TARA-XXXX"-Kommando, siehe po_release_gate.py /
check-po-release-Job in po-approve.yml). Stattdessen bestaetigt dieses
Skript nur, dass der Status beim Merge tatsaechlich "Accepted" war
(Sicherheitsnetz gegen eine P-25-Umgehung) und hinterlaesst einen
Audit-Kommentar - der Status selbst bleibt unveraendert auf "Accepted",
bis der PO die finale Freigabe per "PO Release TARA-XXXX" erteilt.

Sicherheitsnetz: Der AKTUELLE Board-Status wird geprueft. Ist er nicht
"Accepted", wird das als Fehler gemeldet - das waere ein Hinweis darauf,
dass P-25 umgangen wurde (Process-Guard-Regel P-25 selbst sollte das
technisch verhindern; dieser Check ist eine zusaetzliche, unabhaengige
Absicherung nach dem Defense-in-Depth-Prinzip).

Die Issue-Nummer wird aus der PR-Body-Pflichtangabe "Bezug: #NNN" (P-19)
extrahiert - nicht aus einer TARA-ID/Issue-Nummer-Mappingtabelle, da diese
Angabe ohnehin bereits fuer jeden PR verbindlich vorgeschrieben ist.
"""
from __future__ import annotations

import json
import subprocess
import sys
from typing import Optional

# Wiederverwendung der bereits fuer P-02/P-09 etablierten Extraktionslogik.
from status_timing_check import extract_issue_number  # noqa: E402

ACCEPTED_OPTION_ID = "d98e05b2"
ACCEPTED_STATUS_NAME = "Accepted"


def get_project_item_id(
    repo_owner: str, repo_name: str, issue_number: int, project_id: str
) -> Optional[str]:
    """Ermittelt die Projekt-Item-ID eines Issues innerhalb eines bestimmten
    Projects (V2) ueber die GitHub GraphQL API."""
    query = (
        "query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r)"
        "{issue(number:$n){projectItems(first:10){nodes{id project{id}}}}}}"
    )
    result = subprocess.run(
        [
            "gh", "api", "graphql",
            "-f", f"query={query}",
            "-f", f"o={repo_owner}",
            "-f", f"r={repo_name}",
            "-F", f"n={issue_number}",
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        return None
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    nodes = data.get("data", {}).get("repository", {}).get("issue", {}).get(
        "projectItems", {}
    ).get("nodes", [])
    for node in nodes:
        if node.get("project", {}).get("id") == project_id:
            return node.get("id")
    return None


def get_current_status_name(item_id: str) -> Optional[str]:
    """Ermittelt den aktuellen Namen des Status-Feldwerts eines Projekt-Items
    (fuer die P-25-Sicherheitspruefung vor dem Setzen von "Done")."""
    query = (
        "query($i:ID!){node(id:$i){... on ProjectV2Item{"
        "fieldValueByName(name:\"Status\"){"
        "... on ProjectV2ItemFieldSingleSelectValue{name}}}}}"
    )
    result = subprocess.run(
        ["gh", "api", "graphql", "-f", f"query={query}", "-f", f"i={item_id}"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        return None
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    field_value = data.get("data", {}).get("node", {}).get("fieldValueByName")
    if not field_value:
        return None
    return field_value.get("name")


def post_audit_comment(repo: str, issue_number: int) -> bool:
    """Hinterlaesst einen Audit-Kommentar (P-20), dass der Merge erfolgt ist
    und der Status bis zur finalen PO-Freigabe auf "Accepted" bleibt (P-27).
    Ein Fehlschlag hier ist NICHT kritisch fuer P-11/P-25 selbst (die
    eigentliche Pruefung ist bereits erfolgt) und wird daher separat
    behandelt statt den gesamten Job scheitern zu lassen."""
    body = (
        "P-11: Merge nach `development` erfolgt, Status bleibt **Accepted** "
        "(TARA-0121, P-27) - finale Freigabe erst nach gebundenem "
        "`PO Release TARA-XXXX`-Kommando."
    )
    result = subprocess.run(
        ["gh", "issue", "comment", str(issue_number), "--repo", repo, "--body", body],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode == 0


def main(argv: Optional[list] = None) -> int:
    import os

    argv = argv if argv is not None else sys.argv[1:]
    pr_body = os.environ.get("PR_BODY", "")
    repo = os.environ.get("REPO", "")
    project_id = os.environ.get("PROJECT_ID", "")
    status_field_id = os.environ.get("STATUS_FIELD_ID", "")

    if len(argv) >= 4:
        pr_body, repo, project_id, status_field_id = argv[0], argv[1], argv[2], argv[3]

    issue_number = extract_issue_number(pr_body)
    if issue_number is None:
        print("FAIL P-11: Keine Issue-Nummer ('Bezug: #NNN') im PR-Body gefunden.")
        return 1

    if "/" not in repo:
        print(f"FAIL P-11: REPO nicht im Format 'owner/name' ({repo}).")
        return 1
    owner, name = repo.split("/", 1)

    item_id = get_project_item_id(owner, name, issue_number, project_id)
    if item_id is None:
        print(f"FAIL P-11: Kein Projekt-Item fuer Issue #{issue_number} gefunden.")
        return 1

    current_status = get_current_status_name(item_id)
    if current_status != ACCEPTED_STATUS_NAME:
        print(
            f"FAIL P-11/P-25: Issue #{issue_number} hatte beim Merge nicht den "
            f"erwarteten Status '{ACCEPTED_STATUS_NAME}' (tatsaechlich: "
            f"'{current_status}'). Das deutet auf eine Umgehung des "
            "PO-Akzeptanz-Gates (P-25) hin - Status bleibt unveraendert. "
            "Bitte manuell pruefen."
        )
        return 1

    # TARA-0121 (P-27): Der Status wird NICHT MEHR automatisch auf "Done"
    # gesetzt - das wuerde das neue PO-Release-Gate umgehen. Der Uebergang
    # "Accepted" -> "PO Release" -> "Done" erfolgt ausschliesslich ueber
    # den check-po-release-Job in po-approve.yml, ausgeloest durch ein
    # gebundenes "PO Release TARA-XXXX"-Kommando des PO.
    post_audit_comment(repo, issue_number)
    print(
        f"OK P-11: Merge fuer Issue #{issue_number} bestaetigt, Status bleibt "
        f"'{ACCEPTED_STATUS_NAME}' (P-27: finale Freigabe erst nach 'PO Release')."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
