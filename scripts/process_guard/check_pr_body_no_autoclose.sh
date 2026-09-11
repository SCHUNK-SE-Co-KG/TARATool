#!/usr/bin/env bash
# Prueft P-19: Der PR-Body darf kein "Closes/Fixes/Resolves #NNN" enthalten.
#
# GitHub schliesst das referenzierte Issue beim Merge automatisch, wenn eines
# dieser Schluesselwoerter direkt vor einer Issue-Referenz steht. Das
# unterlaeuft P-11/P-15: Nach dem Merge soll der Status zunaechst "Freigabe"
# sein und erst nach explizitem PO-OK-Kommentar auf "Done" wechseln.
#
# Usage: check_pr_body_no_autoclose.sh <PR_BODY_FILE>
# Exit 0: OK oder P-19 nicht anwendbar (kein Body vorhanden)
# Exit 1: FAIL - verbotenes Schluesselwort + Issue-Referenz gefunden
set -e

BODY_FILE="$1"

if [ -z "$BODY_FILE" ] || [ ! -f "$BODY_FILE" ]; then
  echo "INFO P-19: Kein PR-Body vorhanden â€“ P-19 uebersprungen"
  exit 0
fi

PATTERN='\b(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s*:?\s*#[0-9]+'

if grep -qiE "$PATTERN" "$BODY_FILE"; then
  echo "FAIL P-19: PR-Body enthaelt ein verbotenes 'Closes/Fixes/Resolves #NNN'."
  echo "  Dies wuerde das Issue beim Merge automatisch schliessen und P-11/P-15 verletzen."
  echo "  Bitte durch 'Bezug: #NNN' ersetzen. Fundstellen:"
  grep -inE "$PATTERN" "$BODY_FILE"
  exit 1
else
  echo "OK P-19: PR-Body enthaelt kein automatisches Issue-Closing-Schluesselwort"
  exit 0
fi
