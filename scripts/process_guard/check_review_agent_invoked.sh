#!/usr/bin/env bash
# Prueft P-10: Der Review-Agent muss vor dem Merge fuer den PR aktiviert
# worden sein. Da der Review-Agent (agents/review_agent/) kein automatisierter
# GitHub-Actions-Workflow ist, sondern ein manuell durch den Dev-Agenten
# aktivierter Copilot-Sub-Agent, gibt es kein technisches Artefakt, das seine
# Ausfuehrung von sich aus erzeugt. Dieses Skript erzwingt daher ein
# maschinenlesbares Nachweisformat als PR-Kommentar:
#
#   "Review-Agent: OK - keine Findings"
#     -> Review durchgefuehrt, keine Findings gefunden.
#   "Review-Agent: Findings siehe #<NNN>"
#     -> Review durchgefuehrt, Findings als Issue(s) mit Label review-finding
#        angelegt (NNN = eines der Finding-Issues).
#
# Usage: check_review_agent_invoked.sh <PR_COMMENTS_FILE>
# Der PR_COMMENTS_FILE enthaelt die konkatenierten Kommentar-Bodies des PRs
# (ein Kommentar pro Zeile(n)-Block, Reihenfolge irrelevant).
#
# Exit 0: OK - Nachweis gefunden
# Exit 1: FAIL - kein Nachweis gefunden
set -e

COMMENTS_FILE="$1"

if [ -z "$COMMENTS_FILE" ] || [ ! -f "$COMMENTS_FILE" ]; then
  echo "FAIL P-10: Keine PR-Kommentare uebergeben - Review-Agent-Nachweis kann nicht geprueft werden."
  exit 1
fi

OK_PATTERN='Review-Agent:[[:space:]]*OK[[:space:]]*-[[:space:]]*keine[[:space:]]+Findings'
FINDINGS_PATTERN='Review-Agent:[[:space:]]*Findings[[:space:]]+siehe[[:space:]]+#[0-9]+'

if grep -qiE "$OK_PATTERN" "$COMMENTS_FILE"; then
  echo "OK P-10: Review-Agent-Nachweis gefunden (keine Findings)"
  exit 0
elif grep -qiE "$FINDINGS_PATTERN" "$COMMENTS_FILE"; then
  echo "OK P-10: Review-Agent-Nachweis gefunden (Findings dokumentiert)"
  exit 0
else
  echo "FAIL P-10: Kein Review-Agent-Nachweis im PR gefunden."
  echo "  Erwartet einen PR-Kommentar mit 'Review-Agent: OK - keine Findings'"
  echo "  oder 'Review-Agent: Findings siehe #<NNN>'."
  exit 1
fi
