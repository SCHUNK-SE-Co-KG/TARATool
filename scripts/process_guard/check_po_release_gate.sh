#!/usr/bin/env bash
# TARA-0121: Prueft P-27 (PO-Release-Gate): Uebergang Accepted -> PO Release
# darf erst erfolgen, wenn (1) der aktuelle Board-Status "Accepted" ist UND
# (2) eine an die TARA-ID gebundene, zeitlich gueltige "PO Release"-Freigabe
# vorliegt (nach dem Erreichen von "Accepted").
#
# Die eigentliche Pruef-Logik uebernimmt po_release_gate.py. Dieses Skript
# ist nur ein duenner Wrapper (analog check_po_acceptance_gate.sh).
#
# Usage: check_po_release_gate.sh <COMMENTS_JSON_FILE> <TARA_ID> <CURRENT_STATUS> <ACCEPTED_AT>
#   COMMENTS_JSON_FILE: JSON-Array von {"body", "created_at", "permitted"}
#   TARA_ID:            z.B. "TARA-0121"
#   CURRENT_STATUS:     aktueller Board-Status des Items, z.B. "Accepted"
#   ACCEPTED_AT:        ISO-8601-Zeitstempel, seit wann der Status "Accepted" ist
#
# Exit 0: OK - Gate erfuellt, Uebergang nach "PO Release" zulaessig
# Exit 1: FAIL - Gate nicht erfuellt
set -e

COMMENTS_FILE="$1"
TARA_ID="$2"
CURRENT_STATUS="$3"
ACCEPTED_AT="$4"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/po_release_gate.py"

if [ -z "$COMMENTS_FILE" ] || [ ! -f "$COMMENTS_FILE" ]; then
  echo "FAIL P-27: Keine Kommentare uebergeben - PO-Release-Gate kann nicht geprueft werden."
  exit 1
fi

if [ -z "$TARA_ID" ] || [ -z "$CURRENT_STATUS" ] || [ -z "$ACCEPTED_AT" ]; then
  echo "FAIL P-27: TARA_ID, CURRENT_STATUS und ACCEPTED_AT muessen angegeben werden."
  exit 1
fi

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

set +e
"$PYTHON_BIN" "$PARSER" "$COMMENTS_FILE" "$TARA_ID" "$CURRENT_STATUS" "$ACCEPTED_AT"
exit $?
