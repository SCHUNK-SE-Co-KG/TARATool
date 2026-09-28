#!/usr/bin/env bash
# Prueft P-25 (TARA-0110, Statusmodell B): Merge nach `development` darf erst
# erfolgen, wenn (1) ein gueltiger, SHA-aktueller Review-Nachweis (P-10)
# vorliegt UND (2) eine an die TARA-ID gebundene, zeitlich gueltige
# PO-Akzeptanz (nach dem letzten Push) vorliegt.
#
# Die eigentliche Pruef-Logik uebernimmt po_acceptance_gate.py. Dieses
# Skript ist nur ein duenner Wrapper (analog zu
# check_review_agent_invoked.sh / check_po_approval_keyword.sh), damit der
# Aufruf aus process-guard.yml unveraendert bash-basiert bleibt.
#
# Usage: check_po_acceptance_gate.sh <COMMENTS_JSON_FILE> <TARA_ID> <HEAD_SHA> <HEAD_PUSHED_AT>
#   COMMENTS_JSON_FILE: JSON-Array von {"body", "created_at", "permitted"}
#                       ("permitted" wird vom Aufrufer anhand der
#                       Schreibrechte des Kommentators gesetzt)
#   TARA_ID:            z.B. "TARA-0110"
#   HEAD_SHA:           aktueller PR-Head-Commit-SHA
#   HEAD_PUSHED_AT:       ISO-8601-Zeitstempel des letzten Pushs auf den Head
#
# Exit 0: OK - Gate erfuellt, Merge zulaessig
# Exit 1: FAIL - Gate nicht erfuellt, Merge blockieren
set -e

COMMENTS_FILE="$1"
TARA_ID="$2"
HEAD_SHA="$3"
HEAD_PUSHED_AT="$4"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/po_acceptance_gate.py"

if [ -z "$COMMENTS_FILE" ] || [ ! -f "$COMMENTS_FILE" ]; then
  echo "FAIL P-25: Keine PR-Kommentare uebergeben - PO-Akzeptanz-Gate kann nicht geprueft werden."
  exit 1
fi

if [ -z "$TARA_ID" ] || [ -z "$HEAD_SHA" ] || [ -z "$HEAD_PUSHED_AT" ]; then
  echo "FAIL P-25: TARA_ID, HEAD_SHA und HEAD_PUSHED_AT muessen angegeben werden."
  exit 1
fi

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

set +e
"$PYTHON_BIN" "$PARSER" "$COMMENTS_FILE" "$TARA_ID" "$HEAD_SHA" "$HEAD_PUSHED_AT"
exit $?
