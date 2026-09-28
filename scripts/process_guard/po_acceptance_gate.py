"""TARA-0110: PO-Akzeptanz-Gate vor Merge (P-25, Statusmodell B).

Siehe tests/test_TARA_0110.py fuer die vollstaendige fachliche Begruendung.
Kurzfassung: Merge nach `development` darf erst erfolgen, wenn

1. ein gueltiger, SHA-aktueller Review-Nachweis vorliegt (P-10, TARA-0107,
   `review_result_parser.py`, wiederverwendet), UND
2. ein an die TARA-ID gebundenes PO-Akzeptanz-Kommando
   (TARA-0109-Format, `po_approval_parser.py`, wiederverwendet) von einem
   berechtigten Nutzer vorliegt, dessen Zeitstempel NICHT vor dem letzten
   Push auf den PR-Head liegt.

Die Berechtigungspruefung selbst (Schreibrechte des Kommentators) erfolgt
NICHT in diesem Modul, sondern in der aufrufenden GitHub-Actions-Schicht
(analog zu po-approve.yml) - jeder Kommentar wird dort bereits mit einem
`permitted`-Flag angereichert, bevor er hierher gelangt. Das haelt dieses
Modul frei von Netzwerkzugriffen und damit deterministisch testbar.
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import po_approval_parser  # noqa: E402
import review_result_parser  # noqa: E402
from status_timing_check import _parse_iso  # noqa: E402


def find_latest_bound_acceptance(
    comments: List[Dict[str, Any]], tara_id: str
) -> Optional[Dict[str, Any]]:
    """Liefert den zeitlich spaetesten Kommentar eines berechtigten Nutzers,
    der ein an `tara_id` gebundenes Freigabe-Kommando (TARA-0109-Format)
    enthaelt. Liefert None, wenn kein solcher Kommentar existiert."""
    candidates = []
    for comment in comments:
        if not comment.get("permitted", False):
            continue
        bound_ids = po_approval_parser.extract_approved_tara_ids(comment.get("body", ""))
        if tara_id in bound_ids:
            candidates.append(comment)
    if not candidates:
        return None
    return max(candidates, key=lambda c: c.get("created_at") or "")


def validate_acceptance_gate(
    comments: List[Dict[str, Any]],
    tara_id: str,
    head_sha: str,
    head_pushed_at: str,
) -> Tuple[bool, str]:
    """Prueft das vollstaendige P-25-Gate: gueltiger Review-Nachweis (P-10)
    UND gebundene, zeitlich gueltige PO-Akzeptanz (P-25).

    Rueckgabe: (ok: bool, message: str)
    """
    review_result = review_result_parser.extract_latest_review_result(comments)
    review_ok, review_msg = review_result_parser.validate_review_result(review_result, head_sha)
    if not review_ok:
        return False, f"P-25: Review-Voraussetzung (P-10) nicht erfuellt - {review_msg}"

    acceptance_comment = find_latest_bound_acceptance(comments, tara_id)
    if acceptance_comment is None:
        return False, (
            f"P-25: Keine gebundene, berechtigte PO-Akzeptanz fuer {tara_id} gefunden "
            "(erwartet z.B. 'akzeptiert " + tara_id + "' von einem Nutzer mit "
            "Schreibrechten)."
        )

    accepted_at = acceptance_comment.get("created_at")
    if not accepted_at or not head_pushed_at:
        return False, "P-25: Zeitstempel fuer Akzeptanz-Pruefung fehlen."

    try:
        accepted_dt = _parse_iso(accepted_at)
        pushed_dt = _parse_iso(head_pushed_at)
    except ValueError as exc:
        return False, f"P-25: Zeitstempel nicht parsebar ({exc})."

    if accepted_dt < pushed_dt:
        return False, (
            f"P-25: PO-Akzeptanz ({accepted_at}) liegt VOR dem letzten Push "
            f"({head_pushed_at}) - Akzeptanz bezieht sich nicht auf den aktuellen "
            "Commit-Stand und ist veraltet."
        )

    return True, (
        "P-25: OK - Review bestanden (SHA-aktuell) und PO-Akzeptanz nach letztem "
        "Push, TARA-ID-gebunden."
    )


def main(argv: Optional[List[str]] = None) -> int:
    import json

    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) < 4:
        print(
            "FAIL P-25: Usage: po_acceptance_gate.py <COMMENTS_JSON_FILE> <TARA_ID> "
            "<HEAD_SHA> <HEAD_PUSHED_AT>"
        )
        return 1

    comments_file, tara_id, head_sha, head_pushed_at = argv[0], argv[1], argv[2], argv[3]
    try:
        with open(comments_file, "r", encoding="utf-8") as f:
            comments = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL P-25: Kommentar-Datei konnte nicht gelesen werden: {exc}")
        return 1

    ok, message = validate_acceptance_gate(comments, tara_id, head_sha, head_pushed_at)
    print(("OK " if ok else "FAIL ") + message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
