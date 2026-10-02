#!/usr/bin/env python3
"""TARA-0117: Zentrale Transition-API fuer Boardstatus-Uebergaenge (P-18).

Ersetzt direkte, unkontrollierte Board-Status-GraphQL-Mutationen - bisher
setzte der Dev-Agent die Uebergaenge "PO Accepted -> In Progress" (P-02) und
"In Progress -> inReview" (P-09) manuell per Ad-hoc-GraphQL-Mutation, OHNE
dass eine unabhaengige Instanz die Vorbedingung (korrekter Vorgaenger-Status)
prueft. Das widerspricht der in TARA-0108 etablierten Architektur (Process
Guard als deterministische Policy Engine statt Selbstattestierung).

Diese Datei ist die EINZIGE Stelle im Repository, die die Status-Feld-
GraphQL-Mutation (`updateProjectV2ItemFieldValue`) fuer diese beiden
Uebergaenge ausfuehrt (siehe tests/test_TARA_0117.py,
test_no_other_python_script_calls_the_mutation_directly). Alle anderen
Skripte (z.B. scripts/set_story_status.py) delegieren die eigentliche
Mutation hierher.

"PO Accepted", "Accepted", "PO Release" und "Done" bleiben bewusst
AUSSERHALB dieser API - sie werden bereits ueber die dedizierten,
PO-gebundenen Jobs in .github/workflows/po-approve.yml bzw. das
Merge-Event in .github/workflows/post-merge-status.yml gesetzt (siehe
TARA-0109/TARA-0110/TARA-0121). Ein Versuch, sie hier zu setzen, wird
deterministisch abgelehnt.

Design: Alle GitHub-API-Zugriffe (Board-Item lesen, Status mutieren,
Kommentar posten) sind als injizierbare Callables gefasst (siehe
`run_transition`), damit die eigentliche Entscheidungslogik ohne
Netzwerkzugriff deterministisch testbar bleibt (gleiches Prinzip wie
status_timing_check.py/po_acceptance_gate.py aus TARA-0107/TARA-0108/
TARA-0110). Nur main()/die *_via_gh-Helfer sprechen tatsaechlich mit `gh`.

Verwendung (CLI, siehe scripts/workflow/transition.sh):
    python scripts/workflow/transition_engine.py --story TARA-0117 \\
        --to "inReview" --head-sha abc123 --repo owner/name
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from typing import Any, Callable, Dict, Optional, Tuple

PROJECT_ID = "PVT_kwDOBu4dv84BfbaR"
PROJECT_OWNER = "SCHUNK-SE-Co-KG"
PROJECT_NUMBER = "4"
STATUS_FIELD_ID = "PVTSSF_lADOBu4dv84BfbaRzhZuYME"

STATUS_OPTION_IDS = {
    "Todo": "f75ad846",
    "PO Accepted": "d2d86c41",
    "In Progress": "47fc9ee4",
    "inReview": "2338665f",
    "Accepted": "d98e05b2",
    "PO Release": "a21de5e9",
    "Done": "98236657",
}

# TARA-0117 (P-18): nur diese beiden Uebergaenge sind bisher NICHT ueber
# einen automatisierten, vorbedingungsgeprueften Workflow abgedeckt (die
# uebrigen -- PO Accepted/Accepted/PO Release/Done -- werden bereits atomar
# und vorbedingungsgeprueft in .github/workflows/po-approve.yml bzw.
# post-merge-status.yml gesetzt, siehe TARA-0109/TARA-0110/TARA-0121). Map:
# Zielstatus -> Menge der erlaubten AKTUELLEN Vorgaenger-Status.
TRANSITIONS: Dict[str, Tuple[str, ...]] = {
    "In Progress": ("PO Accepted",),
    "inReview": ("In Progress",),
}

PROTECTED_STATUSES = ("Todo", "PO Accepted", "Accepted", "PO Release", "Done")

AUDIT_MESSAGE_TEMPLATES = {
    "In Progress": "P-02: Status PO Accepted -> In Progress (via transition.sh/transition_engine.py, TARA-0117)",
    "inReview": "P-09: Status In Progress -> inReview (via transition.sh/transition_engine.py, TARA-0117, SHA {head_sha})",
}

FetchItem = Callable[[str], Optional[Dict[str, Any]]]
MutateStatus = Callable[[str, str], bool]
PostComment = Callable[[int, str], bool]


def validate_precondition(
    current_status: Optional[str], to_status: str, head_sha: Optional[str]
) -> Tuple[bool, str]:
    """Deterministische Vorbedingungspruefung (Statemachine) - KEIN Agent
    entscheidet hier selbst, ob ein Uebergang zulaessig ist.

    Rueckgabe: (ok: bool, message: str)
    """
    if to_status in PROTECTED_STATUSES:
        return False, (
            f"P-18: '{to_status}' ist ein geschuetzter Status und darf nicht ueber "
            "transition.sh/transition_engine.py gesetzt werden - dieser Uebergang "
            "laeuft bereits automatisiert und vorbedingungsgeprueft ueber "
            "die dedizierten Jobs in .github/workflows/po-approve.yml bzw. "
            "post-merge-status.yml."
        )

    allowed_predecessors = TRANSITIONS.get(to_status)
    if allowed_predecessors is None:
        return False, (
            f"P-18: Unbekannter/nicht von transition_engine.py unterstuetzter "
            f"Zielstatus '{to_status}'."
        )

    if current_status not in allowed_predecessors:
        return False, (
            f"P-18: Uebergang nach '{to_status}' nicht erlaubt - aktueller Status "
            f"ist '{current_status}', erwartet wird einer von "
            f"{list(allowed_predecessors)}."
        )

    if to_status == "inReview" and not head_sha:
        return False, "P-10: --head-sha ist fuer den Uebergang zu 'inReview' Pflicht (SHA-Nachweisbarkeit)."

    return True, "OK: Vorbedingung erfuellt."


def build_audit_comment(to_status: str, head_sha: Optional[str]) -> str:
    template = AUDIT_MESSAGE_TEMPLATES.get(
        to_status, f"Status -> {to_status} (via transition.sh/transition_engine.py, TARA-0117)"
    )
    return template.format(head_sha=head_sha or "")


def run_transition(
    tara_id: str,
    to_status: str,
    head_sha: Optional[str],
    *,
    fetch_item: FetchItem,
    mutate_status: MutateStatus,
    post_comment: PostComment,
    post_process_violation: PostComment,
) -> Tuple[bool, str]:
    """Fuehrt einen Statuswechsel NUR aus, wenn die Vorbedingung erfuellt ist.

    Bei Erfolg: Status-Mutation, DANACH (im selben, unteilbaren Aufruf) der
    Audit-Trail-Kommentar (P-20) - kein Zwischenzustand, in dem einer von
    beiden fehlt, waehrend der andere bereits ausgefuehrt wurde und der
    Prozess vorzeitig abbricht.

    Bei Fehlschlag: KEIN Status wird gesetzt, stattdessen wird automatisch
    ein `process-violation`-Kommentar gepostet (TARA-0116) - ein
    Vorbedingungs-Fehlschlag ist ein Fehler im Ablauf und muss sichtbar
    sein, statt still zu verpuffen.
    """
    item = fetch_item(tara_id)
    if item is None:
        return False, f"FAIL: Kein Board-Item fuer {tara_id} gefunden."

    ok, message = validate_precondition(item.get("status"), to_status, head_sha)
    if not ok:
        issue_number = item.get("issue_number")
        if issue_number:
            post_process_violation(issue_number, message)
        return False, message

    option_id = STATUS_OPTION_IDS.get(to_status)
    if option_id is None:
        return False, f"FAIL: Keine Options-ID fuer Status '{to_status}' bekannt."

    if not mutate_status(item["id"], option_id):
        return False, f"FAIL: Board-Mutation fuer {tara_id} -> {to_status} fehlgeschlagen."

    issue_number = item.get("issue_number")
    comment_posted = True
    if issue_number:
        comment_posted = post_comment(issue_number, build_audit_comment(to_status, head_sha))

    if not comment_posted:
        # Review-Finding (Mittel): Status-Mutation war erfolgreich, aber der
        # Audit-Trail-Kommentar (P-20) konnte nicht gepostet werden - das
        # MUSS sichtbar bleiben statt als "OK" durchzugehen, sonst faellt
        # der Nachweis der Nachvollziehbarkeit unbemerkt weg.
        return (
            True,
            f"OK (mit Warnung): {tara_id} -> {to_status} gesetzt, "
            f"Audit-Kommentar auf Issue #{issue_number} konnte NICHT gepostet werden.",
        )

    return True, f"OK: {tara_id} -> {to_status}"


# ---------------------------------------------------------------------------
# Echte GitHub-API-Anbindung (nur hier - main()/CLI-Pfad - Netzwerkzugriffe)
# ---------------------------------------------------------------------------


def _run_gh(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess:
    # Bugfix (Windows): ohne explizites encoding="utf-8" faellt subprocess auf
    # die lokale Konsolen-Codepage (z.B. cp1252) zurueck, was bei UTF-8-Inhalt
    # (z.B. Umlaute in Issue-Titeln) mit UnicodeDecodeError abbricht und
    # result.stdout als None zurueckliefert.
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace"
    )


# Bugfix (TARA-0133): "gh project item-list --owner <org>" scheitert in
# GitHub Actions zuverlaessig mit "unknown owner type", weil gh dafuer den
# Owner-Typ (User vs. Organisation) per zusaetzlicher API-Anfrage aufloesen
# muss, was eine "read:org"-Scope auf dem verwendeten Token voraussetzt -
# diese fehlte bei dem fuer Projekt-Mutationen genutzten PROJECT_TOKEN. Der
# Fehler wurde zuvor durch fehlende Returncode-Pruefung verschluckt (leerer
# stdout wurde als "{}"/keine Items interpretiert statt als Fehler). Die
# robuste Alternative: Items direkt per GraphQL ueber die bekannte
# PROJECT_ID abfragen (node(id: ...)) - das benoetigt keine Owner-Aufloesung
# und somit auch keine zusaetzliche Token-Scope.
_ITEMS_QUERY = (
    "query($p:ID!,$cursor:String){node(id:$p){... on ProjectV2{items(first:100,after:$cursor){"
    "pageInfo{hasNextPage endCursor}"
    "nodes{id content{... on Issue{number title}}"
    "fieldValueByName(name:\"Status\"){... on ProjectV2ItemFieldSingleSelectValue{name}}}}}}}"
)


def fetch_item_via_gh(tara_id: str) -> Optional[Dict[str, Any]]:
    """Sucht das Board-Item, dessen Titel die TARA-ID enthaelt (gleiches
    Suchmuster wie scripts/set_story_status.py), und liefert dessen ID,
    aktuellen Status sowie die verknuepfte Issue-Nummer.

    Fragt die Items direkt per GraphQL ueber PROJECT_ID ab (siehe Bugfix-
    Kommentar oben), statt "gh project item-list --owner ...".
    """
    cursor: Optional[str] = None
    while True:
        args = ["api", "graphql", "-f", f"query={_ITEMS_QUERY}", "-f", f"p={PROJECT_ID}"]
        if cursor:
            args += ["-f", f"cursor={cursor}"]
        result = _run_gh(args)
        if result.returncode != 0:
            print(f"FEHLER: gh api graphql (Items-Abfrage) fehlgeschlagen: {result.stderr.strip()}", file=sys.stderr)
            return None
        try:
            data = json.loads(result.stdout or "{}")
        except json.JSONDecodeError as exc:
            print(f"FEHLER: Items-Antwort nicht als JSON lesbar: {exc!r}", file=sys.stderr)
            return None

        items_block = (data.get("data") or {}).get("node") or {}
        items = (items_block.get("items") or {}).get("nodes") or []
        for item in items:
            content = item.get("content") or {}
            title = content.get("title") or ""
            if tara_id in title:
                status_value = item.get("fieldValueByName") or {}
                return {
                    "id": item.get("id"),
                    "status": status_value.get("name"),
                    "issue_number": content.get("number"),
                }

        page_info = (items_block.get("items") or {}).get("pageInfo") or {}
        if page_info.get("hasNextPage"):
            cursor = page_info.get("endCursor")
            continue
        return None


def mutate_status_via_gh(item_id: str, option_id: str) -> bool:
    query = (
        "mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{"
        "projectId:$p itemId:$i fieldId:$f value:{singleSelectOptionId:$o}"
        "}){projectV2Item{id}}}"
    )
    result = _run_gh(
        [
            "api", "graphql",
            "-f", f"query={query}",
            "-f", f"p={PROJECT_ID}",
            "-f", f"i={item_id}",
            "-f", f"f={STATUS_FIELD_ID}",
            "-f", f"o={option_id}",
        ]
    )
    return result.returncode == 0


def _post_issue_comment(issue_number: int, body: str, repo: str) -> bool:
    result = _run_gh(["issue", "comment", str(issue_number), "--repo", repo, "--body", body])
    if result.returncode != 0:
        print(f"FEHLER: Audit-Kommentar auf #{issue_number} fehlgeschlagen: {result.stderr.strip()}", file=sys.stderr)
    return result.returncode == 0


def post_comment_via_gh(repo: str) -> PostComment:
    return lambda issue_number, body: _post_issue_comment(issue_number, body, repo)


def post_process_violation_via_gh(repo: str) -> PostComment:
    def _post(issue_number: int, message: str) -> bool:
        _run_gh(["issue", "edit", str(issue_number), "--repo", repo, "--add-label", "process-violation"])
        body = f"**process-violation**\n\n{message}"
        return _post_issue_comment(issue_number, body, repo)

    return _post


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--story", required=True, help="TARA-ID, z.B. TARA-0117")
    parser.add_argument("--to", required=True, help="Zielstatus, z.B. 'In Progress' oder 'inReview'")
    parser.add_argument("--head-sha", default=None, help="Commit-SHA (Pflicht fuer 'inReview')")
    parser.add_argument("--repo", default="SCHUNK-SE-Co-KG/TARATool", help="owner/name")
    args = parser.parse_args(argv)

    ok, message = run_transition(
        args.story,
        args.to,
        args.head_sha,
        fetch_item=fetch_item_via_gh,
        mutate_status=mutate_status_via_gh,
        post_comment=post_comment_via_gh(args.repo),
        post_process_violation=post_process_violation_via_gh(args.repo),
    )
    print(("OK: " if ok else "FAIL: ") + message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
