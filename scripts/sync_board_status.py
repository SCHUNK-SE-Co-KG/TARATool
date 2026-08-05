#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sync project board STATUS fields: Bheowulf -> SCHUNK.

Fetches status from both boards, identifies mismatches,
and updates SCHUNK items to match Bheowulf status.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

BHEOWULF_PROJECT = 1
BHEOWULF_OWNER = "Bheowulf"
SCHUNK_PROJECT = 4
SCHUNK_OWNER = "SCHUNK-SE-Co-KG"
SCHUNK_PROJECT_ID = "PVT_kwDOBu4dv84BfbaR"

DRY_RUN = "--dry-run" in sys.argv
VERBOSE = "--verbose" in sys.argv


def run_json(cmd: list[str]) -> dict | list:
    """Run command, write to temp file, read back as JSON."""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    try:
        r = subprocess.run(cmd, stdout=open(tmp, "wb"), stderr=subprocess.PIPE, check=False)
        if r.returncode != 0:
            raise RuntimeError(r.stderr.decode("utf-8", errors="ignore"))
        with open(tmp, encoding="utf-8") as f:
            return json.load(f)
    finally:
        Path(tmp).unlink(missing_ok=True)


def run_graphql(query: str) -> dict:
    """Run a GraphQL query via gh api."""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    try:
        r = subprocess.run(
            ["gh", "api", "graphql", "-f", f"query={query}"],
            stdout=open(tmp, "wb"),
            stderr=subprocess.PIPE,
            check=False,
        )
        out = Path(tmp).read_bytes().decode("utf-8", errors="ignore")
        if VERBOSE:
            print(f"  [GQL] {out[:200]}")
        return json.loads(out) if out else {}
    finally:
        Path(tmp).unlink(missing_ok=True)


def extract_tara_id(title: str) -> str | None:
    m = re.search(r"TARA-\d+", title)
    return m.group(0) if m else None


def fetch_items(owner: str, project: int) -> list[dict]:
    print(f"  [+] Fetching {owner}/Project#{project}...")
    data = run_json(["gh", "project", "item-list", str(project), "--owner", owner, "--format", "json"])
    items = data.get("items", [])
    print(f"    {len(items)} items found")
    return items


def get_schunk_status_field_and_options() -> tuple[str, dict[str, str]]:
    """Return (field_id, {option_name: option_id}) for SCHUNK Status field."""
    print("  [+] Querying SCHUNK Status field IDs...")

    # Use user-level workaround: list items with full details via GraphQL
    q = """
    {
      user(login: "Bheowulf") {
        projectV2(number: 1) {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
    """
    # Get Bheowulf field IDs first to understand the pattern
    result = run_graphql(q)
    bh_fields = result.get("data", {}).get("user", {}).get("projectV2", {}).get("fields", {}).get("nodes", [])
    bh_status = next((f for f in bh_fields if f.get("name") == "Status"), None)
    if bh_status:
        print(f"    Bheowulf Status field ID: {bh_status['id']}")
        for o in bh_status.get("options", []):
            print(f"      Option: {o['name']} => {o['id']}")

    # Now get SCHUNK fields
    q2 = """
    {
      organization(login: "SCHUNK-SE-Co-KG") {
        projectV2(number: 4) {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
    """
    result2 = run_graphql(q2)

    if VERBOSE:
        print(f"  GQL result2: {json.dumps(result2)[:300]}")

    schunk_fields = (
        result2.get("data", {})
        .get("organization", {})
        .get("projectV2", {})
        .get("fields", {})
        .get("nodes", [])
    )

    status_field = next((f for f in schunk_fields if f.get("name") == "Status"), None)
    if not status_field:
        raise RuntimeError(f"Status field not found in SCHUNK project. Fields: {[f.get('name') for f in schunk_fields]}")

    field_id = status_field["id"]
    options = {o["name"]: o["id"] for o in status_field.get("options", [])}
    print(f"    SCHUNK Status field ID: {field_id}")
    print(f"    Options: {options}")
    return field_id, options


def get_schunk_item_ids() -> dict[str, str]:
    """Return {tara_id: project_item_id} for all SCHUNK items."""
    print("  [+] Fetching SCHUNK item IDs via GraphQL...")
    q = """
    {
      organization(login: "SCHUNK-SE-Co-KG") {
        projectV2(number: 4) {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { title number }
                ... on DraftIssue { title }
              }
            }
          }
        }
      }
    }
    """
    result = run_graphql(q)
    nodes = (
        result.get("data", {})
        .get("organization", {})
        .get("projectV2", {})
        .get("items", {})
        .get("nodes", [])
    )

    item_ids = {}
    for node in nodes:
        content = node.get("content", {})
        title = content.get("title", "") if content else ""
        tara = extract_tara_id(title)
        if tara:
            item_ids[tara] = node["id"]

    print(f"    Found {len(item_ids)} items with TARA-IDs")
    return item_ids


def set_status(project_id: str, item_id: str, field_id: str, option_id: str) -> bool:
    """Set status of a project item."""
    mutation = (
        f'mutation {{'
        f'  updateProjectV2ItemFieldValue(input: {{'
        f'    projectId: "{project_id}"'
        f'    itemId: "{item_id}"'
        f'    fieldId: "{field_id}"'
        f'    value: {{ singleSelectOptionId: "{option_id}" }}'
        f'  }}) {{'
        f'    projectV2Item {{ id }}'
        f'  }}'
        f'}}'
    )
    result = run_graphql(mutation)
    if "errors" in result:
        print(f"    [!] Error: {result['errors']}")
        return False
    return True


def main() -> int:
    print("=" * 70)
    print("[STATUS-SYNC] Sync Project Board Status: Bheowulf -> SCHUNK")
    print("=" * 70)
    if DRY_RUN:
        print("\n[!] DRY-RUN MODE\n")

    # 1. Fetch items
    print("\nStep 1: Fetching items")
    print("-" * 70)
    bh_items = fetch_items(BHEOWULF_OWNER, BHEOWULF_PROJECT)
    schunk_items = fetch_items(SCHUNK_OWNER, SCHUNK_PROJECT)

    # Build Bheowulf status map by TARA-ID
    bh_status: dict[str, str] = {}
    for item in bh_items:
        tara = extract_tara_id(item.get("title", ""))
        if tara:
            bh_status[tara] = item.get("status", "Todo") or "Todo"

    print(f"\n  Bheowulf status summary:")
    from collections import Counter
    counts = Counter(bh_status.values())
    for s, c in sorted(counts.items()):
        print(f"    {s}: {c}")

    # 2. Get SCHUNK Status field + option IDs
    print("\nStep 2: Getting SCHUNK Status field metadata")
    print("-" * 70)
    try:
        field_id, options = get_schunk_status_field_and_options()
    except Exception as e:
        print(f"  [FAIL] {e}")
        return 1

    # 3. Get SCHUNK item IDs
    print("\nStep 3: Getting SCHUNK item node IDs")
    print("-" * 70)
    schunk_item_ids = get_schunk_item_ids()

    # Build SCHUNK current status map
    schunk_current: dict[str, str] = {}
    for item in schunk_items:
        raw = item.get("title", "").replace("[MIRROR] ", "")
        tara = extract_tara_id(raw)
        if tara:
            schunk_current[tara] = item.get("status", "Todo") or "Todo"

    # 4. Find mismatches
    print("\nStep 4: Identifying status mismatches")
    print("-" * 70)
    mismatches = []
    for tara, bh_stat in bh_status.items():
        schunk_stat = schunk_current.get(tara, "Todo")
        if bh_stat != schunk_stat:
            mismatches.append((tara, bh_stat, schunk_stat))
            print(f"  MISMATCH {tara}: Bheowulf={bh_stat}  SCHUNK={schunk_stat}")

    if not mismatches:
        print("  [OK] All statuses already match!")
        return 0

    print(f"\n  Total mismatches: {len(mismatches)}")

    # 5. Apply fixes
    print("\nStep 5: Applying status updates to SCHUNK")
    print("-" * 70)
    ok = 0
    fail = 0
    for tara, target_status, current_status in mismatches:
        item_id = schunk_item_ids.get(tara)
        option_id = options.get(target_status)

        if not item_id:
            print(f"  [!] {tara}: No item ID found in SCHUNK (item may not be linked)")
            fail += 1
            continue
        if not option_id:
            print(f"  [!] {tara}: Status '{target_status}' not found in SCHUNK options")
            fail += 1
            continue

        print(f"  [{tara}] {current_status} -> {target_status}", end="")
        if DRY_RUN:
            print(" [DRY-RUN]")
            ok += 1
        else:
            success = set_status(SCHUNK_PROJECT_ID, item_id, field_id, option_id)
            if success:
                print(" [OK]")
                ok += 1
            else:
                print(" [FAIL]")
                fail += 1

    print(f"\n{'=' * 70}")
    print(f"[RESULT] Updated: {ok}  Failed: {fail}")
    print(f"{'=' * 70}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
