#!/usr/bin/env bash
# Sync assessment_config.json -> assessment_config.js (Linux / macOS)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "ERROR: Python 3 nicht gefunden (python3 / python)." >&2
  exit 1
fi

"$PY" "$ROOT/tools/sync_assessment_config.py"
echo "Fertig. index.html neu laden (F5)."
