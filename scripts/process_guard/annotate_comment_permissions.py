"""TARA-0110: Reichert PR-/Issue-Kommentare mit einem `permitted`-Flag an
(nur Kommentare von Nutzern mit `write`/`maintain`/`admin`-Berechtigung
duerfen als gebundene PO-Akzeptanz zaehlen, P-25).

Wird ausschliesslich aus process-guard.yml aufgerufen (GitHub-Actions-
Kontext, `gh api` verfuegbar) - reine Netzwerk-/CLI-Aufruf-Schicht ohne
eigene Entscheidungslogik, damit `po_acceptance_gate.py` selbst frei von
Netzwerkzugriffen und deterministisch testbar bleibt.
"""
from __future__ import annotations

import json
import subprocess
import sys
from typing import Any, Dict, List, Optional


def is_permitted_author(repo: str, author: Optional[str]) -> bool:
    """Prueft per `gh api`, ob `author` write/maintain/admin-Rechte auf
    `repo` (Format 'owner/name') hat."""
    if not author:
        return False
    result = subprocess.run(
        ["gh", "api", f"repos/{repo}/collaborators/{author}/permission", "--jq", ".permission"],
        capture_output=True,
        text=True,
    )
    level = result.stdout.strip() if result.returncode == 0 else ""
    return level in ("write", "maintain", "admin")


def annotate_permissions(
    comments: List[Dict[str, Any]], repo: str
) -> List[Dict[str, Any]]:
    """Liefert eine neue Liste, in der jeder Kommentar um ein `permitted`-
    Flag ergaenzt und das `author`-Feld entfernt wurde. Berechtigungs-
    Abfragen werden pro Autor gecacht, um wiederholte API-Aufrufe fuer
    denselben Kommentator zu vermeiden."""
    cache: Dict[str, bool] = {}
    annotated = []
    for comment in comments:
        author = comment.get("author")
        if author not in cache:
            cache[author] = is_permitted_author(repo, author)
        new_comment = {k: v for k, v in comment.items() if k != "author"}
        new_comment["permitted"] = cache[author]
        annotated.append(new_comment)
    return annotated


def main(argv: Optional[List[str]] = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]
    if len(argv) < 3:
        print(
            "Usage: annotate_comment_permissions.py <RAW_COMMENTS_JSON_FILE> "
            "<OUT_FILE> <owner/repo>"
        )
        return 1

    raw_path, out_path, repo = argv[0], argv[1], argv[2]
    with open(raw_path, "r", encoding="utf-8") as f:
        comments = json.load(f)

    annotated = annotate_permissions(comments, repo)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(annotated, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
