"""TARA-0121: PO-Release-Gate (P-27).

Analog zu `po_acceptance_gate.py` (P-25), aber fuer den Uebergang
"Accepted -> PO Release -> Done": Ein "PO Release"-Kommando (siehe
`po_approval_parser.extract_po_release_ids`) autorisiert diesen Uebergang
NUR, wenn

1. der Kommentator Schreibrechte hat (`permitted`-Flag, wie bei P-25 vom
   Aufrufer/GitHub-Actions-Layer gesetzt), UND
2. der aktuelle Board-Status des Items tatsaechlich "Accepted" ist (die
   technische Review-Abnahme also bereits erfolgt und der PR gemergt ist -
   PO Release darf nicht "an Accepted vorbei" erteilt werden), UND
3. der Kommentar zeitlich NICHT VOR dem Erreichen von "Accepted"
   (`accepted_at`) liegt - sonst bezieht er sich nicht auf den tatsaechlich
   akzeptierten/gemergten Stand (Analogie zum P-25-Push-Zeitstempel-Check).

Ein nachtraeglicher Statuswechsel (z.B. ein erneuter Review-Zyklus, der den
Status wieder von "Accepted" wegbewegt) macht ein zuvor gueltiges "PO
Release"-Kommando automatisch ungueltig, da Bedingung (2) dann nicht mehr
erfuellt ist.
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import po_approval_parser  # noqa: E402
from status_timing_check import _parse_iso  # noqa: E402


def find_latest_bound_release(
    comments: List[Dict[str, Any]], tara_id: str
) -> Optional[Dict[str, Any]]:
    """Liefert den zeitlich spaetesten Kommentar eines berechtigten Nutzers,
    der ein an `tara_id` gebundenes "PO Release"-Kommando enthaelt. Liefert
    None, wenn kein solcher Kommentar existiert."""
    candidates = []
    for comment in comments:
        if not comment.get("permitted", False):
            continue
        bound_ids = po_approval_parser.extract_po_release_ids(comment.get("body", ""))
        if tara_id in bound_ids:
            candidates.append(comment)
    if not candidates:
        return None
    return max(candidates, key=lambda c: c.get("created_at") or "")


def validate_release_gate(
    comments: List[Dict[str, Any]],
    tara_id: str,
    current_status: str,
    accepted_at: str,
) -> Tuple[bool, str]:
    """Prueft das vollstaendige P-27-Gate: aktueller Status ist "Accepted"
    UND eine gebundene, zeitlich gueltige "PO Release"-Freigabe liegt vor.

    Rueckgabe: (ok: bool, message: str)
    """
    if current_status != "Accepted":
        return False, (
            f"P-27: Aktueller Status ist '{current_status}', nicht 'Accepted' - "
            "PO Release ist erst nach abgeschlossener technischer Abnahme "
            "(Accepted) und erfolgtem Merge zulaessig."
        )

    release_comment = find_latest_bound_release(comments, tara_id)
    if release_comment is None:
        return False, (
            f"P-27: Keine gebundene, berechtigte 'PO Release'-Freigabe fuer {tara_id} "
            "gefunden (erwartet z.B. 'PO Release " + tara_id + "' von einem Nutzer mit "
            "Schreibrechten)."
        )

    released_at = release_comment.get("created_at")
    if not released_at or not accepted_at:
        return False, "P-27: Zeitstempel fuer Release-Pruefung fehlen."

    try:
        released_dt = _parse_iso(released_at)
        accepted_dt = _parse_iso(accepted_at)
    except ValueError as exc:
        return False, f"P-27: Zeitstempel nicht parsebar ({exc})."

    if released_dt < accepted_dt:
        return False, (
            f"P-27: 'PO Release'-Kommando ({released_at}) liegt VOR dem Erreichen "
            f"von 'Accepted' ({accepted_at}) - Freigabe bezieht sich nicht auf den "
            "tatsaechlich akzeptierten/gemergten Stand."
        )

    return True, (
        "P-27: OK - Status ist 'Accepted' und 'PO Release'-Kommando ist "
        "TARA-ID-gebunden, berechtigt und zeitlich nach der Accepted-Abnahme."
    )


def main(argv: Optional[List[str]] = None) -> int:
    import json

    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) < 4:
        print(
            "FAIL P-27: Usage: po_release_gate.py <COMMENTS_JSON_FILE> <TARA_ID> "
            "<CURRENT_STATUS> <ACCEPTED_AT>"
        )
        return 1

    comments_file, tara_id, current_status, accepted_at = argv[0], argv[1], argv[2], argv[3]
    try:
        with open(comments_file, "r", encoding="utf-8") as f:
            comments = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL P-27: Kommentar-Datei konnte nicht gelesen werden: {exc}")
        return 1

    ok, message = validate_release_gate(comments, tara_id, current_status, accepted_at)
    print(("OK " if ok else "FAIL ") + message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
