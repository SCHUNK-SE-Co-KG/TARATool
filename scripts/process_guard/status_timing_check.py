"""TARA-0108: Deterministische Zeitstempel-Pruefung fuer Statusuebergaenge.

Ersetzt die bisherige Dev-Agent-Selbstattestierung fuer P-02 (Status "In
Progress" gesetzt *bevor* die Arbeit begann) und P-09 (Status "inReview"
gesetzt *vor* PR-Erstellung) durch eine deterministische, GitHub-API-basierte
Pruefung:

- Der Dev-Agent hinterlaesst bei jedem Statuswechsel ohnehin einen
  Audit-Trail-Kommentar im Issue (z.B. "P-02: Status Todo -> In Progress ...").
- Dieses Modul sucht den FRUEHESTEN Kommentar, der zu einem bestimmten
  Uebergangsmuster passt (z.B. "-> In Progress"), und vergleicht dessen
  `created_at`-Zeitstempel mit einem Referenzereignis (z.B. dem Zeitstempel
  des ersten Commits auf dem Feature-Branch fuer P-02, bzw. dem
  `created_at` des PRs fuer P-09).
- Liegt der Kommentar-Zeitstempel NICHT vor (oder exakt bei) dem
  Referenzereignis, ist die Regel verletzt (Status wurde nachtraeglich/zu
  spaet gesetzt) - FAIL statt stillem PASS.

Kein Agent entscheidet hier mehr selbst, ob er regelkonform gehandelt hat;
die Reihenfolge wird ausschliesslich anhand unveraenderlicher GitHub-
Zeitstempel (Issue-Kommentar vs. Commit/PR) bestimmt.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

ISSUE_NUMBER_PATTERN = re.compile(r"Bezug:\s*#(\d+)", re.IGNORECASE)


def extract_issue_number(pr_body: str) -> Optional[int]:
    """Extrahiert die Issue-Nummer aus der Pflichtangabe "Bezug: #NNN" im PR-Body
    (P-19). Liefert None, wenn keine solche Angabe gefunden wird."""
    if not pr_body:
        return None
    match = ISSUE_NUMBER_PATTERN.search(pr_body)
    if not match:
        return None
    return int(match.group(1))


def _parse_iso(timestamp: str) -> datetime:
    normalized = timestamp.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def find_earliest_transition_comment(
    comments: List[Dict[str, Any]], pattern: str
) -> Optional[Dict[str, Any]]:
    """Findet den zeitlich fruehesten Kommentar, dessen Body `pattern`
    (case-insensitive Teilstring) enthaelt. Liefert None, wenn keiner passt."""
    matching = [c for c in comments if pattern.lower() in (c.get("body") or "").lower()]
    if not matching:
        return None
    return min(matching, key=lambda c: c.get("created_at") or "")


def validate_transition_before_event(
    comments: List[Dict[str, Any]],
    pattern: str,
    event_iso: str,
    rule_label: str,
) -> Tuple[bool, str]:
    """Prueft, dass ein Statuswechsel-Audit-Kommentar (erkannt ueber `pattern`)
    zeitlich vor (oder gleichzeitig mit) einem Referenzereignis liegt.

    Rueckgabe: (ok: bool, message: str)
    """
    if not event_iso:
        return False, f"{rule_label}: Kein Referenz-Zeitstempel uebergeben."

    comment = find_earliest_transition_comment(comments, pattern)
    if comment is None:
        return False, (
            f"{rule_label}: Kein Audit-Trail-Kommentar gefunden, der '{pattern}' "
            "enthaelt - Statuswechsel nicht nachweisbar."
        )

    comment_at = comment.get("created_at")
    if not comment_at:
        return False, f"{rule_label}: Audit-Trail-Kommentar ohne Zeitstempel gefunden."

    try:
        comment_dt = _parse_iso(comment_at)
        event_dt = _parse_iso(event_iso)
    except ValueError as exc:
        return False, f"{rule_label}: Zeitstempel nicht parsebar ({exc})."

    if comment_dt <= event_dt:
        return True, (
            f"{rule_label}: Statuswechsel-Kommentar ({comment_at}) liegt vor/"
            f"bei Referenzereignis ({event_iso})."
        )

    return False, (
        f"{rule_label}: Statuswechsel-Kommentar ({comment_at}) liegt NACH "
        f"dem Referenzereignis ({event_iso}). Status wurde nachtraeglich gesetzt."
    )


def main(argv: Optional[List[str]] = None) -> int:
    import json
    import sys

    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) < 4:
        print(
            "FAIL: Usage: status_timing_check.py <COMMENTS_JSON_FILE> <PATTERN> "
            "<EVENT_ISO> <RULE_LABEL>"
        )
        return 1

    comments_file, pattern, event_iso, rule_label = argv[0], argv[1], argv[2], argv[3]
    try:
        with open(comments_file, "r", encoding="utf-8") as f:
            comments = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL {rule_label}: Kommentar-Datei konnte nicht gelesen werden: {exc}")
        return 1

    ok, message = validate_transition_before_event(comments, pattern, event_iso, rule_label)
    print(("OK: " if ok else "FAIL: ") + message)
    return 0 if ok else 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
