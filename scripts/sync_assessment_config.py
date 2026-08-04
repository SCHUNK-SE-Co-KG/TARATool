#!/usr/bin/env python3
"""Sync assessment_config.json -> assessment_config.js for portable file:// usage."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "config" / "assessment_config.json"
JS_PATH = ROOT / "config" / "assessment_config.js"

HEADER = """/**
 * @file assessment_config.js
 * @description Portable assessment config for file:// usage (no web server).
 *              AUTO-GENERATED from assessment_config.json – do not edit by hand.
 *              After changing the JSON, run: tools/sync_assessment_config.bat
 */
window.__ASSESSMENT_CONFIG_PRELOAD__ = """


def main() -> int:
    if not JSON_PATH.is_file():
        print(f"ERROR: missing {JSON_PATH}", file=sys.stderr)
        return 1
    try:
        data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON in {JSON_PATH}: {exc}", file=sys.stderr)
        return 1

    body = json.dumps(data, ensure_ascii=False, indent=2)
    JS_PATH.write_text(f"{HEADER}{body};\n", encoding="utf-8")
    print(f"OK: {JSON_PATH.name} -> {JS_PATH.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
