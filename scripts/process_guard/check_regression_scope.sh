#!/usr/bin/env bash
# Prueft (TARA-0111, neu gefasst in TARA-0125), ob ausser der Story-Testdatei
# auch "gemeinsam genutzter Code" veraendert wurde, und ob darunter
# RISIKOBASIERTE Pfade sind, die IMMER sofort eine volle Regressionssuite
# auslösen (P-06c, unabhaengig von Option A/B/C - siehe Issue #208/TARA-0125).
#
# Von der Betrachtung ausgenommen sind reine Doku-/Meta-Dateien, die pytest
# nicht beeinflussen koennen (docs/, agents/*.md, README/CONTRIBUTING/
# CHANGELOG) sowie die Story-Testdatei selbst.
#
# Seit TARA-0125 wird NICHT mehr jede sonstige Code-Aenderung sofort mit
# einer vollen Regressionssuite "bestraft" (das war der urspruengliche
# Flaschenhals, Issue #208): nur Aenderungen an den in
# scripts/process_guard/regression_risk_paths.txt gelisteten Risikopfaden
# loesen SOFORT (REGRESSION_NEEDED=true) die volle Suite aus. Alle anderen
# gemeinsam genutzten Code-Aenderungen werden als SHARED_CODE_CHANGED=true
# markiert, aber die volle Regression wird auf den naechsten Epic-Batch
# (Option B, epic-batch-gate.yml) bzw. den monatlichen Lauf auf main
# (Option C, monthly-regression.yml) verschoben - die Story-Testdatei selbst
# muss in jedem Fall gruen sein (P-06).
#
# Usage: check_regression_scope.sh <BASE_SHA> <TESTFILE> [RISK_PATHS_FILE]
# Ausgabe:
#   SHARED_CODE_CHANGED=true|false
#   REGRESSION_NEEDED=true|false   (= sofortige volle Suite noetig, Risikopfad)
# Exit 0 immer (informativer Check, kein Gate-Fail fuer sich genommen).
set -e

BASE="$1"
TESTFILE="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RISK_PATHS_FILE="${3:-$SCRIPT_DIR/regression_risk_paths.txt}"

CHANGED_FILES=$(git diff --name-only "$BASE..HEAD" 2>/dev/null || true)

# Risiko-Patterns einmalig vorfiltern (Kommentare/Leerzeilen raus), damit
# die Pruefung je Datei ein einfaches `grep -f` gegen eine saubere
# Pattern-Liste bleibt.
RISK_PATTERNS_FILTERED=""
if [ -f "$RISK_PATHS_FILE" ]; then
  RISK_PATTERNS_FILTERED=$(grep -vE '^\s*(#.*)?$' "$RISK_PATHS_FILE" || true)
fi

SHARED_CODE_CHANGED=0
RISK_PATH_HIT=0
RISK_HITS=""

while IFS= read -r file; do
  [ -z "$file" ] && continue
  if [ "$file" = "$TESTFILE" ]; then
    continue
  fi
  if echo "$file" | grep -qE '^(docs/|README([./]|$)|CONTRIBUTING([./]|$)|CHANGELOG([./]|$))|\.md$'; then
    continue
  fi
  SHARED_CODE_CHANGED=1
  if [ -n "$RISK_PATTERNS_FILTERED" ] && echo "$file" | grep -qE -f <(echo "$RISK_PATTERNS_FILTERED"); then
    RISK_PATH_HIT=1
    RISK_HITS="$RISK_HITS $file"
  fi
done <<< "$CHANGED_FILES"

if [ "$SHARED_CODE_CHANGED" -eq 1 ]; then
  echo "SHARED_CODE_CHANGED=true"
else
  echo "SHARED_CODE_CHANGED=false"
fi

if [ "$RISK_PATH_HIT" -eq 1 ]; then
  echo "REGRESSION_NEEDED=true"
  echo "INFO P-06c: Risikobasierte Pfad(e) veraendert (${RISK_HITS# }) -"
  echo "  volle Regressionssuite SOFORT erforderlich (unabhaengig von Epic-Batch/Monatslauf)."
elif [ "$SHARED_CODE_CHANGED" -eq 1 ]; then
  echo "REGRESSION_NEEDED=false"
  echo "INFO P-06b: Gemeinsam genutzter Code (kein Risikopfad) veraendert -"
  echo "  volle Regressionssuite wird auf Epic-Batch (Option B) bzw. den"
  echo "  monatlichen Lauf auf main (Option C) verschoben, Story-Tests genuegen jetzt."
else
  echo "REGRESSION_NEEDED=false"
  echo "INFO P-06b: Nur Story-Testdatei und/oder Doku veraendert - volle"
  echo "  Regressionssuite nicht erforderlich, Story-Testdatei genuegt."
fi
exit 0
