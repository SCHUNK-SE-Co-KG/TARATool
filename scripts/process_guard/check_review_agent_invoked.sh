#!/usr/bin/env bash
# Prueft P-10: Der Review-Agent muss vor dem Merge fuer den PR aktiviert
# worden sein UND sein Ergebnis muss sich auf den aktuellen PR-Head-SHA
# beziehen (TARA-0107).
#
# Bis TARA-0107 akzeptierte dieser Check einen frei formulierten Text-Marker
# ("Review-Agent: OK - keine Findings"), der von jedem (Mensch oder Agent)
# geschrieben werden konnte und keinerlei Bindung an den tatsaechlich
# geprueften Commit hatte. Das ist ein faelschbarer Nachweis und wird NICHT
# mehr akzeptiert.
#
# Neuer Nachweis: Der Review-Agent veroeffentlicht einen maschinenlesbaren
# JSON-Block (```json ... ```) als PR-Kommentar mit mindestens den Feldern
# story, pull_request, reviewed_head_sha, review_profile_version, result,
# critical, high, timestamp (siehe scripts/process_guard/review_result_parser.py).
#
# Die eigentliche Extraktion/Validierung uebernimmt review_result_parser.py.
# Dieses Skript ist nur ein duenner Wrapper, damit der Aufruf aus
# process-guard.yml unveraendert bash-basiert bleibt.
#
# Usage: check_review_agent_invoked.sh <PR_COMMENTS_JSON_FILE> <PR_HEAD_SHA>
#   PR_COMMENTS_JSON_FILE: JSON-Array von {"body": "...", "created_at": "..."}
#                          (z.B. via `gh api .../comments --jq '[.[] | {body, created_at}]'`)
#   PR_HEAD_SHA:           aktueller Head-Commit-SHA des PRs
#
# Exit 0: OK - gueltiger, SHA-aktueller Review-Nachweis gefunden
# Exit 1: FAIL - kein oder veralteter/unvollstaendiger Review-Nachweis
set -e

COMMENTS_FILE="$1"
HEAD_SHA="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/review_result_parser.py"

if [ -z "$COMMENTS_FILE" ] || [ ! -f "$COMMENTS_FILE" ]; then
  echo "FAIL P-10: Keine PR-Kommentare uebergeben - Review-Agent-Nachweis kann nicht geprueft werden."
  exit 1
fi

if [ -z "$HEAD_SHA" ]; then
  echo "FAIL P-10: Kein PR-Head-SHA uebergeben - Review-Nachweis kann nicht gegen den aktuellen Commit geprueft werden."
  exit 1
fi

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

set +e
"$PYTHON_BIN" "$PARSER" "$COMMENTS_FILE" "$HEAD_SHA"
exit $?
