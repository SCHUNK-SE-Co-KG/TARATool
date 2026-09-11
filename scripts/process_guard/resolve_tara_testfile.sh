#!/usr/bin/env bash
# Einzige, gemeinsam genutzte Quelle fuer die TARA-ID/Testdatei-Ableitung
# (Branch-Name -> TARA-ID -> Testdatei-Pfad), verwendet von P-03/P-04/P-06.
#
# TARA-0094: Diese Logik war zuvor dreifach dupliziert (inline im P-04- und
# P-06-Workflow-Step sowie in check_test_file_exists.sh). Aendert sich das
# ID-Format kuenftig, muss sie nur noch an dieser einen Stelle angepasst werden.
#
# Usage: resolve_tara_testfile.sh <BRANCH_NAME>
# Bei Erfolg (TARA-ID im Branch-Namen gefunden):
#   Exit 0, stdout: 'TARA_ID=TARA-XXXX' und 'TESTFILE=tests/test_TARA_XXXX.py'
#   (per 'eval "$(...)"' im Aufrufer verwendbar)
# Ohne TARA-ID im Branch-Namen (kein Fehler, nur nicht anwendbar):
#   Exit 3, keine Ausgabe
set -e

BRANCH="$1"
TARA_ID=$(echo "$BRANCH" | grep -oE 'TARA-[0-9]{4}' | head -1)

if [ -z "$TARA_ID" ]; then
  exit 3
fi

NUM=$(echo "$TARA_ID" | grep -oE '[0-9]{4}')
TESTFILE="tests/test_TARA_${NUM}.py"

echo "TARA_ID=$TARA_ID"
echo "TESTFILE=$TESTFILE"
