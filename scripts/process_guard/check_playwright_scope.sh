#!/usr/bin/env bash
# TARA-0134: Entscheidet, ob die (teure, ~9,7 Minuten) Playwright-UI-Testsuite
# in ci-tests.yml fuer den aktuellen PR tatsaechlich benoetigt wird, oder ob
# sie uebersprungen werden kann, weil keine UI-/Browser-relevanten Dateien
# veraendert wurden (siehe Issue #230, P-06d).
#
# Diese Pruefung betrifft NUR den PR-Fall (schnelles Feedback). Bei push auf
# development/main (z.B. nach einem Merge) bleibt der Playwright-Job IMMER
# aktiv - das ist das Sicherheitsnetz, damit uebersprungene UI-Tests nicht
# dauerhaft ungeprueft bleiben (siehe ci-tests.yml).
#
# Usage: check_playwright_scope.sh <BASE_SHA> [RISK_PATHS_UI_FILE]
# Ausgabe:
#   PLAYWRIGHT_NEEDED=true|false
# Exit 0 immer (informativer Check, kein Gate-Fail fuer sich genommen).
set -e

BASE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RISK_PATHS_UI_FILE="${2:-$SCRIPT_DIR/regression_risk_paths_ui.txt}"

CHANGED_FILES=$(git diff --name-only "$BASE..HEAD" 2>/dev/null || true)

RISK_PATTERNS_FILTERED=""
if [ -f "$RISK_PATHS_UI_FILE" ]; then
  RISK_PATTERNS_FILTERED=$(grep -vE '^\s*(#.*)?$' "$RISK_PATHS_UI_FILE" || true)
fi

PLAYWRIGHT_NEEDED=0
RISK_HITS=""

if [ -n "$RISK_PATTERNS_FILTERED" ]; then
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if echo "$file" | grep -qE -f <(echo "$RISK_PATTERNS_FILTERED"); then
      PLAYWRIGHT_NEEDED=1
      RISK_HITS="$RISK_HITS $file"
    fi
  done <<< "$CHANGED_FILES"
fi

if [ "$PLAYWRIGHT_NEEDED" -eq 1 ]; then
  echo "PLAYWRIGHT_NEEDED=true"
  echo "INFO P-06d: UI-/Browser-relevante Pfad(e) veraendert (${RISK_HITS# }) -"
  echo "  Playwright-UI-Tests werden ausgefuehrt."
else
  echo "PLAYWRIGHT_NEEDED=false"
  echo "INFO P-06d: Keine UI-/Browser-relevanten Pfade veraendert -"
  echo "  Playwright-UI-Tests werden fuer diesen PR uebersprungen (laufen als"
  echo "  Sicherheitsnetz weiterhin bei push auf development/main sowie im"
  echo "  Epic-Batch und Monatslauf)."
fi
exit 0
