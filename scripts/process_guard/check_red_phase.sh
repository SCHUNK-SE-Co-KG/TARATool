#!/usr/bin/env bash
# Prueft P-04: TDD Red-Phase bewiesen (Test-Commit vor Implementierung).
#
# Usage: check_red_phase.sh <BASE_SHA> <TESTFILE>
# Exit 0: OK oder P-04 nicht anwendbar
# Exit 1: FAIL - Implementierung im Red-Commit ODER Tests waren gruen im Red-Commit
set -e

BASE="$1"
TESTFILE="$2"

if [ ! -f "$TESTFILE" ]; then
  echo "INFO P-04: Testdatei nicht gefunden Ã¢â‚¬â€œ P-04 uebersprungen"
  exit 0
fi

# Find the FIRST commit on this branch that added the test file
FIRST_TEST_COMMIT=$(git log --diff-filter=A --format="%H" "$BASE..HEAD" -- "$TESTFILE" | tail -1)

if [ -z "$FIRST_TEST_COMMIT" ]; then
  # Test file not added on this branch -> exists from base, not a new story test
  echo "INFO P-04: Testdatei nicht auf diesem Branch hinzugefuegt Ã¢â‚¬â€œ P-04 uebersprungen"
  exit 0
fi

echo "Pruefe Red-Phase am Commit: $FIRST_TEST_COMMIT"

# Check if at FIRST_TEST_COMMIT the test file is the ONLY story-related change
# (i.e., implementation files were added later)
IMPL_IN_FIRST=$(git diff-tree --no-commit-id -r --name-only "$FIRST_TEST_COMMIT" \
  | grep -vE "^tests/|^\.github/|^docs/|^agents/|^scripts/|^README|^CONTRIBUTING|^CHANGELOG" \
  | wc -l)

if [ "$IMPL_IN_FIRST" -gt 0 ]; then
  echo "FAIL P-04: Im Red-Commit sind bereits Implementierungsdateien enthalten."
  echo "  P-04 erfordert: Test-Commit (nur tests/) VOR Implementierungs-Commit."
  echo "  Gefundene Nicht-Test-Dateien im ersten Test-Commit:"
  git diff-tree --no-commit-id -r --name-only "$FIRST_TEST_COMMIT" \
    | grep -vE "^tests/|^\.github/|^docs/|^agents/|^scripts/|^README|^CONTRIBUTING|^CHANGELOG"
  exit 1
fi

# Sicherstellen, dass lokal per --user installierte Tools (pip, pytest) auffindbar sind
# (z.B. wenn kein System-weites pip vorhanden ist, wie in manchen WSL-Umgebungen).
export PATH="$HOME/.local/bin:$PATH"

# Now verify the test actually FAILED at that commit via git worktree
WORKTREE_DIR=$(mktemp -d)

# TARA-0093: 'git worktree add' darf unter 'set -e' nicht diagnoselos abbrechen.
# Diagnoseausgabe wird bei Fehlschlag sichtbar gemacht statt unterdrueckt zu werden,
# und ein Fehlschlag fuehrt zu einer expliziten FAIL-P-04-Meldung statt zu einem
# unerklaerten Skript-Abbruch.
if ! ADD_OUTPUT=$(git worktree add "$WORKTREE_DIR" "$FIRST_TEST_COMMIT" 2>&1); then
  echo "FAIL P-04: 'git worktree add' fuer Commit $FIRST_TEST_COMMIT fehlgeschlagen:"
  echo "$ADD_OUTPUT"
  rm -rf "$WORKTREE_DIR" 2>/dev/null || true
  git worktree prune 2>/dev/null || true
  exit 1
fi

pushd "$WORKTREE_DIR" >/dev/null
python3 -m pip install --user pytest pytest-timeout --quiet 2>/dev/null
[ -f tests/requirements.txt ] && python3 -m pip install --user -r tests/requirements.txt --quiet 2>/dev/null
[ -f requirements.txt ] && python3 -m pip install --user -r requirements.txt --quiet 2>/dev/null
set +e
python3 -m pytest "$TESTFILE" --noconftest -q 2>&1
RED_EXIT=$?
set -e
popd >/dev/null

# TARA-0093: Das P-04-Verdikt (OK/FAIL) wird IMMER vor dem Worktree-Cleanup
# ausgegeben. Ein fehlschlagendes 'git worktree remove' (z.B. gesperrtes
# Worktree) darf die bereits ermittelte Red-Phase-Entscheidung nicht mehr
# verschlucken - daher '|| true' und Platzierung NACH der Ergebnis-Ausgabe.
if [ "$RED_EXIT" -ne 0 ]; then
  echo "OK P-04: Red-Phase bestaetigt Ã¢â‚¬â€œ Tests haben beim Red-Commit gefehlt"
  git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  exit 0
else
  echo "FAIL P-04: Tests waren GRUEN beim Red-Commit $FIRST_TEST_COMMIT"
  echo "  Tests muessen beim Red-Commit FEHLSCHLAGEN (Regel P-04)."
  echo "  Pruefe ob Implementierung im gleichen Commit wie Tests ist."
  exit 1
fi
