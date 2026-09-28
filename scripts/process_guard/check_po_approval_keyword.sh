#!/usr/bin/env bash
# TARA-0109: Prueft P-15 ueber ein an eine TARA-ID GEBUNDENES Freigabe-
# Kommando (z.B. "akzeptiert TARA-0109" oder "TARA-0109 ist akzeptiert")
# statt der bisherigen losen Schluesselwort-Erkennung (TARA-0086/TARA-0096),
# die jedes eigenstaendige Vorkommen eines Keywords im Kommentar akzeptierte
# - unabhaengig davon, ob es sich inhaltlich ueberhaupt auf eine Freigabe
# bezog (Beispiel-Fehlalarm: "Der Test ist OK, aber die Story ist noch nicht
# freigegeben.").
#
# Die eigentliche Extraktion/Validierung uebernimmt po_approval_parser.py.
# Dieses Skript ist nur ein duenner Wrapper (analog zu
# check_review_agent_invoked.sh aus TARA-0107), damit der Aufruf aus
# po-approve.yml unveraendert bash-basiert bleibt.
#
# Usage: check_po_approval_keyword.sh <COMMENT_FILE>
# Exit 0: mind. eine gebundene TARA-ID gefunden - IDs werden zeilenweise auf
#         stdout ausgegeben (eine TARA-ID pro Zeile)
# Exit 1: kein gueltiges, gebundenes Freigabe-Kommando gefunden ("NO_MATCH")
set -e

COMMENT_FILE="$1"

if [ -z "$COMMENT_FILE" ] || [ ! -f "$COMMENT_FILE" ]; then
  echo "NO_MATCH"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/po_approval_parser.py"

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

set +e
"$PYTHON_BIN" "$PARSER" "$COMMENT_FILE"
exit $?
