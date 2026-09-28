#!/usr/bin/env bash
# TARA-0108: Deterministische Pruefung von Statuswechsel-Zeitstempeln
# (P-02: "In Progress" vor erstem Commit; P-09: "inReview" vor PR-Erstellung).
#
# Ersetzt die bisherige Dev-Agent-Selbstattestierung ("Nicht automatisierbar,
# wird eigenverantwortlich eingehalten") durch einen harten, deterministischen
# Vergleich zweier unveraenderlicher GitHub-Zeitstempel: dem Audit-Trail-
# Kommentar im Issue (Pflicht seit Einfuehrung von P-02/P-09) und dem
# jeweiligen Referenzereignis (erster Commit bzw. PR-Erstellung).
#
# Usage: check_status_transition_timing.sh <COMMENTS_JSON_FILE> <PATTERN> <EVENT_ISO> <RULE_LABEL>
#   COMMENTS_JSON_FILE: JSON-Array von {"body": "...", "created_at": "..."}
#   PATTERN:            Teilstring, der im Audit-Trail-Kommentar gesucht wird
#                        (z.B. "In Progress" oder "inReview")
#   EVENT_ISO:          ISO-8601-Zeitstempel des Referenzereignisses
#   RULE_LABEL:         Regel-Kennzeichnung fuer die Ausgabe (z.B. "P-02")
#
# Exit 0: OK - Statuswechsel nachweislich vor dem Referenzereignis
# Exit 1: FAIL - kein Nachweis oder Statuswechsel nach dem Referenzereignis
set -e

COMMENTS_FILE="$1"
PATTERN="$2"
EVENT_ISO="$3"
RULE_LABEL="${4:-P-XX}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARSER="$SCRIPT_DIR/status_timing_check.py"

if [ -z "$COMMENTS_FILE" ] || [ ! -f "$COMMENTS_FILE" ]; then
  echo "FAIL $RULE_LABEL: Keine PR-/Issue-Kommentare uebergeben - Statuswechsel kann nicht geprueft werden."
  exit 1
fi

PYTHON_BIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

set +e
"$PYTHON_BIN" "$PARSER" "$COMMENTS_FILE" "$PATTERN" "$EVENT_ISO" "$RULE_LABEL"
exit $?
