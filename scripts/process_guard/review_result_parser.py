"""TARA-0107: Parser/Validator fuer den maschinenlesbaren Review-Nachweis (P-10).

Ersetzt den frei formulierbaren Text-Marker aus TARA-0089
("Review-Agent: OK - keine Findings") durch einen JSON-Block, der vom
Review-Agent als PR-Kommentar veroeffentlicht wird und mindestens folgende
Felder enthaelt:

    story                   z.B. "TARA-0107"
    pull_request            PR-Nummer (int)
    reviewed_head_sha       Commit-SHA, der tatsaechlich geprueft wurde
    review_profile_version  Version des verwendeten Pruefkatalogs
    result                  "passed" oder "failed"
    critical                Anzahl offener Critical-Findings (int)
    high                    Anzahl offener High-Findings (int)
    timestamp               ISO-8601 Zeitstempel des Reviews

Optional:
    findings_issue          Issue-Nummer, unter der offene Critical/High
                            Findings dokumentiert sind (macht das Ergebnis
                            trotz offener Findings mergefaehig, siehe
                            validate_review_result()).

Der Process Guard prueft ueber validate_review_result():
1. Es liegt ueberhaupt ein vollstaendiges JSON-Ergebnis vor.
2. reviewed_head_sha == aktueller PR-Head-SHA (sonst: Review veraltet, weil
   nach dem Review weitere Commits gepusht wurden).
3. Keine offenen Critical/High-Findings ohne begleitendes Findings-Issue.
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

REQUIRED_KEYS = (
    "story",
    "pull_request",
    "reviewed_head_sha",
    "review_profile_version",
    "result",
    "critical",
    "high",
    "timestamp",
)

_JSON_BLOCK_PATTERN = re.compile(r"```json\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


def _extract_json_blocks(body: str) -> List[Dict[str, Any]]:
    """Extrahiert alle syntaktisch gueltigen, vollstaendigen JSON-Bloecke aus
    einem einzelnen Kommentar-Body. Unvollstaendige/ungueltige Bloecke werden
    stillschweigend uebersprungen (kein Absturz bei fremden JSON-Snippets)."""
    blocks = []
    for match in _JSON_BLOCK_PATTERN.finditer(body or ""):
        raw = match.group(1)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and all(key in data for key in REQUIRED_KEYS):
            blocks.append(data)
    return blocks


def extract_latest_review_result(comments: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Sucht ueber alle PR-Kommentare (Liste von {"body": ..., "created_at": ...})
    hinweg nach vollstaendigen Review-Ergebnis-JSON-Bloecken und liefert den
    zeitlich zuletzt veroeffentlichten zurueck (bzw. den letzten in Uebergabe-
    Reihenfolge, falls kein created_at vorhanden ist). Liefert None, wenn kein
    gueltiger Block gefunden wurde."""
    if not comments:
        return None

    def _sort_key(comment: Dict[str, Any]) -> str:
        return comment.get("created_at") or ""

    ordered = sorted(comments, key=_sort_key)

    latest: Optional[Dict[str, Any]] = None
    for comment in ordered:
        for block in _extract_json_blocks(comment.get("body", "")):
            latest = block
    return latest


def validate_review_result(
    result: Optional[Dict[str, Any]], expected_head_sha: str
) -> Tuple[bool, str]:
    """Prueft ein extrahiertes Review-Ergebnis gegen den aktuellen PR-Head-SHA.

    Rueckgabe: (ok: bool, message: str)
    """
    if result is None:
        return False, "Kein maschinenlesbarer Review-Nachweis (JSON-Block) gefunden."

    if not expected_head_sha:
        return False, "Kein PR-Head-SHA zum Abgleich uebergeben."

    reviewed_sha = result.get("reviewed_head_sha", "")
    if reviewed_sha != expected_head_sha:
        return False, (
            f"Review-Nachweis veraltet: reviewed_head_sha={reviewed_sha} "
            f"entspricht nicht dem aktuellen PR-Head-SHA={expected_head_sha}. "
            "Vermutlich wurde nach dem Review weiter gepusht."
        )

    try:
        critical = int(result.get("critical", 0))
        high = int(result.get("high", 0))
    except (TypeError, ValueError):
        return False, "Review-Nachweis fehlerhaft: critical/high nicht numerisch."

    if (critical > 0 or high > 0) and not result.get("findings_issue"):
        return False, (
            f"Offene blockierende Findings (critical={critical}, high={high}) "
            "ohne referenziertes findings_issue - Merge nicht zulaessig."
        )

    return True, "OK: Review-Nachweis gueltig und SHA-aktuell."


def main(argv: Optional[List[str]] = None) -> int:
    import sys

    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) < 2:
        print("FAIL P-10: Usage: review_result_parser.py <COMMENTS_JSON_FILE> <PR_HEAD_SHA>")
        return 1

    comments_file, head_sha = argv[0], argv[1]
    try:
        with open(comments_file, "r", encoding="utf-8") as f:
            comments = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL P-10: Kommentar-Datei konnte nicht gelesen werden: {exc}")
        return 1

    result = extract_latest_review_result(comments)
    ok, message = validate_review_result(result, head_sha)
    if ok:
        print(f"OK P-10: {message}")
        return 0
    print(f"FAIL P-10: {message}")
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
