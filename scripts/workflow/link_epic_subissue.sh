#!/usr/bin/env bash
# TARA-0113: Verknuepft eine neu angelegte Story per nativer GitHub
# Sub-Issue-Beziehung mit ihrem Epic - ersetzt die manuelle Text-Checkliste
# im Epic-Body (alte P-24-Fassung, siehe PROCESS_GUARD_AGENT.md).
#
# PO-Entscheidung (Issue #183, TARA-0113): Diese Regel gilt NUR fuer NEU
# angelegte Epics/Stories ab dieser Story. Bestehende Epics (z.B. #176 mit
# den Stories #177-#182) behalten ihre bereits gepflegte Text-Checkliste
# unveraendert als historisches Artefakt - es findet KEINE rueckwirkende
# Migration statt.
#
# Nutzt den REST-Endpunkt POST /repos/{owner}/{repo}/issues/{epic}/sub_issues
# (GitHub Sub-Issues API), da die installierte gh-CLI (Stand TARA-0113,
# gh 2.86.0) keinen nativen `gh issue ... sub-issue`-Subbefehl anbietet.
# Der Endpunkt erwartet als `sub_issue_id` die numerische REST-Datenbank-ID
# des Story-Issues (Feld `id` der Issue-Ressource) - NICHT die sichtbare
# Issue-Nummer und NICHT die GraphQL-Node-ID (Feld `node_id`).
#
# Usage:
#   link_epic_subissue.sh --owner <owner> --repo <repo> \
#     --epic <epic_issue_number> --story <story_issue_number>
#
# Benoetigt GH_TOKEN/gh-Login mit Schreibrechten auf das Repository.
# GH_BIN kann fuer Tests auf ein Fake-Binary umgebogen werden (Default: gh).
#
# Exit 0: Sub-Issue-Verknuepfung erfolgreich erstellt
# Exit 1: Fehler (fehlende/ungueltige Argumente, gh-Aufruf fehlgeschlagen)
set -euo pipefail

GH_BIN="${GH_BIN:-gh}"
OWNER=""
REPO=""
EPIC=""
STORY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --owner)
      OWNER="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --epic)
      EPIC="$2"
      shift 2
      ;;
    --story)
      STORY="$2"
      shift 2
      ;;
    *)
      echo "FAIL: Unbekanntes Argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OWNER" || -z "$REPO" || -z "$EPIC" || -z "$STORY" ]]; then
  echo "FAIL: --owner, --repo, --epic und --story sind erforderlich." >&2
  exit 1
fi

if ! [[ "$EPIC" =~ ^[0-9]+$ ]] || ! [[ "$STORY" =~ ^[0-9]+$ ]]; then
  echo "FAIL: --epic und --story muessen numerische Issue-Nummern sein." >&2
  exit 1
fi

STORY_DB_ID=$("$GH_BIN" api "repos/$OWNER/$REPO/issues/$STORY" --jq .id)
if [[ -z "$STORY_DB_ID" ]]; then
  echo "FAIL: Konnte REST-Datenbank-ID fuer Story #$STORY nicht ermitteln." >&2
  exit 1
fi

if ! "$GH_BIN" api "repos/$OWNER/$REPO/issues/$EPIC/sub_issues" \
  -f sub_issue_id="$STORY_DB_ID" >/dev/null; then
  echo "FAIL: Sub-Issue-Verknuepfung von Story #$STORY mit Epic #$EPIC fehlgeschlagen." >&2
  exit 1
fi

echo "OK: Story #$STORY als Sub-Issue von Epic #$EPIC verknuepft (native Sub-Issue-Beziehung, P-24)."
