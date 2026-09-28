#!/usr/bin/env bash
# Prueft (TARA-0111), ob ausser der Story-Testdatei auch "gemeinsam genutzter
# Code" veraendert wurde und deshalb die VOLLE Regressionssuite laufen muss
# (statt nur der Story-Testdatei selbst) - PO-Entscheidung zur offenen Frage 3
# aus Issue #181: "nur bei Aenderungen an gemeinsam genutztem Code".
#
# Von der Betrachtung ausgenommen sind reine Doku-/Meta-Dateien, die pytest
# nicht beeinflussen koennen (docs/, agents/*.md, README/CONTRIBUTING/
# CHANGELOG) sowie die Story-Testdatei selbst. Alles andere (scripts/,
# weitere Testdateien, Anwendungscode, Workflow-YAML) gilt als gemeinsam
# genutzter Code und erzwingt die volle Regressionssuite.
#
# Usage: check_regression_scope.sh <BASE_SHA> <TESTFILE>
# Ausgabe: "REGRESSION_NEEDED=true" oder "REGRESSION_NEEDED=false"
# Exit 0 immer (informativer Check, kein Gate-Fail fuer sich genommen).
set -e

BASE="$1"
TESTFILE="$2"

CHANGED_FILES=$(git diff --name-only "$BASE..HEAD" 2>/dev/null || true)

SHARED_CODE_CHANGED=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  if [ "$file" = "$TESTFILE" ]; then
    continue
  fi
  if echo "$file" | grep -qE '^(docs/|README|CONTRIBUTING|CHANGELOG)|\.md$'; then
    continue
  fi
  SHARED_CODE_CHANGED=1
done <<< "$CHANGED_FILES"

if [ "$SHARED_CODE_CHANGED" -eq 1 ]; then
  echo "REGRESSION_NEEDED=true"
  echo "INFO P-06b: Gemeinsam genutzter Code (ausser $TESTFILE und Doku) wurde"
  echo "  veraendert - volle Regressionssuite erforderlich."
else
  echo "REGRESSION_NEEDED=false"
  echo "INFO P-06b: Nur Story-Testdatei und/oder Doku veraendert - volle"
  echo "  Regressionssuite nicht erforderlich, Story-Testdatei genuegt."
fi
exit 0
