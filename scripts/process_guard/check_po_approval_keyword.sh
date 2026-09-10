#!/usr/bin/env bash
# Prueft P-15: Enthaelt ein Issue-Kommentar eines der gueltigen
# PO-Freigabe-Schluesselwoerter (dokumentiert in .github/copilot-instructions.md)?
#
# Erkannte Schluesselwoerter (Gross-/Kleinschreibung egal):
#   PO-OK, Freigabe erteilt, freigegeben, akzeptiert, Accepted, Ok
#
# Die Keywords werden nur als EIGENSTAENDIGES Wort/Phrase erkannt (Wortgrenzen),
# um False-Positives bei Woertern zu vermeiden, die zufaellig die
# Buchstabenfolge "ok" enthalten (z.B. "Token", "broken", "Stock").
#
# Usage: check_po_approval_keyword.sh <COMMENT_FILE>
# Exit 0 + "MATCH" auf stdout: Kommentar enthaelt ein gueltiges Freigabe-Keyword
# Exit 1 + "NO_MATCH" auf stdout: kein Keyword gefunden
set -e

COMMENT_FILE="$1"

if [ -z "$COMMENT_FILE" ] || [ ! -f "$COMMENT_FILE" ]; then
  echo "NO_MATCH"
  exit 1
fi

PATTERN='(^|[^a-zA-Z])(po-ok|freigabe erteilt|freigegeben|akzeptiert|accepted|ok)([^a-zA-Z]|$)'

if grep -qiE "$PATTERN" "$COMMENT_FILE"; then
  echo "MATCH"
  exit 0
else
  echo "NO_MATCH"
  exit 1
fi
