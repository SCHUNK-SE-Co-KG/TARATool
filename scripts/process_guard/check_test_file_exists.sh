#!/usr/bin/env bash
# Prueft P-03: Existiert die TDD-Testdatei tests/test_TARA_<NUM>.py fuer den
# uebergebenen Branch-Namen?
#
# Usage: check_test_file_exists.sh <BRANCH_NAME>
# Exit 0: OK oder P-03 nicht anwendbar (kein TARA-ID im Branch)
# Exit 1: FAIL - Testdatei fehlt
set -e

BRANCH="$1"
TARA_ID=$(echo "$BRANCH" | grep -oE 'TARA-[0-9]{4}' | head -1)
if [ -z "$TARA_ID" ]; then
  echo "INFO P-03: Kein TARA-ID im Branch â€“ P-03 uebersprungen"
  exit 0
fi
NUM=$(echo "$TARA_ID" | grep -oE '[0-9]{4}')
TESTFILE="tests/test_TARA_${NUM}.py"
if [ -f "$TESTFILE" ]; then
  echo "OK P-03: Testdatei $TESTFILE vorhanden"
  exit 0
else
  echo "FAIL P-03: Testdatei $TESTFILE fehlt â€“ TDD nicht eingehalten"
  exit 1
fi
