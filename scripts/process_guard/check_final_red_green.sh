#!/usr/bin/env bash
# Prueft P-04b (TARA-0111): Finaler Red-Green-Nachweis.
#
# P-04 (check_red_phase.sh) beweist nur, dass IRGENDEINE fruehe Version der
# Testdatei am Anfang des Branches fehlgeschlagen ist. Das beweist NICHT,
# dass der FINALE Teststand (PR-Head, aktueller Workdir-Inhalt) tatsaechlich
# sinnvoll etwas prueft - ein Test koennte spaeter durch einen inhaltsleeren
# Test ersetzt worden sein, der schon am Basis-Code besteht.
#
# Dieses Skript nimmt den AKTUELLEN Inhalt der Testdatei (PR-Head-Stand,
# so wie er im Arbeitsverzeichnis vorliegt) und fuehrt ihn zusaetzlich gegen
# den Code des Basis-Branches aus:
#   1. Mindestens ein Test muss beim Basis-Branch-Code fehlschlagen.
#   2. Derselbe (finale) Testinhalt muss beim PR-Head-Code bestehen.
#
# Usage: check_final_red_green.sh <BASE_SHA> <TESTFILE>
# Exit 0: OK oder P-04b nicht anwendbar (Testdatei fehlt)
# Exit 1: FAIL - finaler Test besteht bereits am Basis-Code ODER schlaegt am
#         PR-Head fehl
set -e

BASE="$1"
TESTFILE="$2"

if [ ! -f "$TESTFILE" ]; then
  echo "INFO P-04b: Testdatei nicht gefunden - P-04b uebersprungen"
  exit 0
fi

# Sicherstellen, dass lokal per --user installierte Tools (pip, pytest)
# auffindbar sind (z.B. wenn kein System-weites pip vorhanden ist).
export PATH="$HOME/.local/bin:$PATH"

# 1) Finalen Testinhalt (aktueller Workdir-Stand) sichern.
FINAL_TEST_CONTENT=$(mktemp)
cp "$TESTFILE" "$FINAL_TEST_CONTENT"

# 2) Worktree beim Basis-Branch-Code aufbauen und den finalen Testinhalt
#    dort hineinkopieren, um ihn gegen den Ausgangszustand des Codes
#    laufen zu lassen.
WORKTREE_DIR=$(mktemp -d)

if ! ADD_OUTPUT=$(git worktree add "$WORKTREE_DIR" "$BASE" 2>&1); then
  echo "FAIL P-04b: 'git worktree add' fuer Basis-Commit $BASE fehlgeschlagen:"
  echo "$ADD_OUTPUT"
  rm -rf "$WORKTREE_DIR" 2>/dev/null || true
  git worktree prune 2>/dev/null || true
  exit 1
fi

# TARA-0111 Review-Finding (Medium): Ein 'trap' stellt sicher, dass das
# Worktree-Verzeichnis auch dann bereinigt wird, wenn ein nachfolgender
# Befehl (z.B. ein fehlschlagendes 'pip install') unter 'set -e' das
# Skript vorzeitig beendet, statt den Cleanup-Code am Skriptende zu
# erreichen.
cleanup_worktree() {
  git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  git worktree prune 2>/dev/null || true
}
trap cleanup_worktree EXIT

mkdir -p "$(dirname "$WORKTREE_DIR/$TESTFILE")"
cp "$FINAL_TEST_CONTENT" "$WORKTREE_DIR/$TESTFILE"

pushd "$WORKTREE_DIR" >/dev/null
# TARA-0111 Review-Finding (Medium): pip-Installationen duerfen das Skript
# unter 'set -e' nicht vorzeitig abbrechen (z.B. bei Netzwerkfehlern) -
# explizit mit '|| true' abgesichert, analog zu check_red_phase.sh.
python3 -m pip install --user pytest pytest-timeout --quiet 2>/dev/null || true
[ -f tests/requirements.txt ] && { python3 -m pip install --user -r tests/requirements.txt --quiet 2>/dev/null || true; }
[ -f requirements.txt ] && { python3 -m pip install --user -r requirements.txt --quiet 2>/dev/null || true; }
set +e
python3 -m pytest "$TESTFILE" --noconftest -q 2>&1
BASE_EXIT=$?
set -e
popd >/dev/null

cleanup_worktree
trap - EXIT
rm -f "$FINAL_TEST_CONTENT"

if [ "$BASE_EXIT" -eq 0 ]; then
  echo "FAIL P-04b: Der finale Teststand ($TESTFILE) besteht bereits am Code des"
  echo "  Basis-Branches - kein echter Nachweis, dass die Story-Implementierung"
  echo "  etwas Neues bewirkt (z.B. inhaltsleerer oder falsch ersetzter Test)."
  exit 1
fi

# 3) Denselben (finalen) Testinhalt gegen den PR-Head-Code (aktuelles
#    Arbeitsverzeichnis) ausfuehren - er muss dort bestehen.
set +e
python3 -m pytest "$TESTFILE" --noconftest -q 2>&1
HEAD_EXIT=$?
set -e

if [ "$HEAD_EXIT" -ne 0 ]; then
  echo "FAIL P-04b: Der finale Teststand ($TESTFILE) schlaegt auch am PR-Head fehl."
  exit 1
fi

echo "OK P-04b: Finaler Red-Green-Nachweis bestaetigt - Test schlaegt am Basis-Code"
echo "  fehl und besteht am PR-Head."
exit 0
