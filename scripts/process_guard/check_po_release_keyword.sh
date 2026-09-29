#!/usr/bin/env bash
# TARA-0121 (P-27): Prueft ein an eine TARA-ID GEBUNDENES "PO Release"-
# Kommando (z.B. "PO Release TARA-0121" oder "TARA-0121 PO Release").
# Autorisiert den kritischen Uebergang Accepted -> PO Release -> Done
# (fachliche/releasebezogene Abnahme, nach erfolgtem Merge). Die alten,
# losen Freigabe-Keywords (siehe check_po_approval_keyword.sh) loesen dies
# bewusst NICHT aus.
#
# Duenner Wrapper (analog check_po_approval_keyword.sh) - die eigentliche
# Extraktion/Validierung uebernimmt po_approval_parser.py (Modus "release").
#
# Usage: check_po_release_keyword.sh <COMMENT_FILE>
# Exit 0: mind. eine gebundene TARA-ID gefunden - IDs werden zeilenweise auf
#         stdout ausgegeben (eine TARA-ID pro Zeile)
# Exit 1: kein gueltiges, gebundenes "PO Release"-Kommando gefunden
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
"$PYTHON_BIN" "$PARSER" --mode release "$COMMENT_FILE"
exit $?
