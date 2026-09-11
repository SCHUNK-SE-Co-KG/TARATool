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
# TARA-0096: Zusaetzlich wird eine unmittelbar vorausgehende Negation
# ("nicht ", "kein ", "keine ", "not ") per PCRE-Negativ-Lookbehind
# ausgeschlossen, damit ablehnende Kommentare wie "Nicht ok" oder
# "das ist NICHT OK fuer mich" nicht faelschlich als Freigabe gewertet werden.
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

PATTERN='\b(?<!nicht )(?<!kein )(?<!keine )(?<!not )(po-ok|freigabe erteilt|freigegeben|akzeptiert|accepted|ok)\b'

if grep -Pqi "$PATTERN" "$COMMENT_FILE"; then
  echo "MATCH"
  exit 0
else
  echo "NO_MATCH"
  exit 1
fi
