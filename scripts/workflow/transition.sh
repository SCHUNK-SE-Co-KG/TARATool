#!/usr/bin/env bash
# TARA-0117: Duenne CLI-Huelle um scripts/workflow/transition_engine.py.
#
# PO-Entscheidung (Issue #188, Frage 1): Dieses Skript wird AUSSCHLIESSLICH
# aus GitHub Actions aufgerufen (siehe .github/workflows/transition.yml,
# workflow_dispatch/PR-/Merge-Events) - kein interaktiver/lokaler Aufruf
# durch den Dev-Agenten. Der Dev-Agent loest einen Statuswechsel stattdessen
# per `gh workflow run transition.yml -f story=... -f to=... -f head_sha=...`
# aus (siehe agents/dev_agent/DEV_AGENT_ONBOARDING.md, Schritt 8).
#
# Usage:
#   ./scripts/workflow/transition.sh --story TARA-0117 --to inReview \
#     --head-sha abc123 [--repo owner/name]
#
# Benoetigt GH_TOKEN/gh-Login mit Schreibrechten auf das Board/Repository.
# Exit 0: Uebergang erfolgreich. Exit 1: Vorbedingung nicht erfuellt oder
# Board-Item/Mutation fehlgeschlagen (siehe Ausgabe von transition_engine.py).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"

exec "$PYTHON_BIN" "$SCRIPT_DIR/transition_engine.py" "$@"
