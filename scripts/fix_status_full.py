#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Full status sync: fetch ALL SCHUNK item IDs via GraphQL, match to Bheowulf status, update all.
Also handles deduplication.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SCHUNK_PROJECT_ID = "PVT_kwDOBu4dv84BfbaR"
SCHUNK_STATUS_FIELD = "PVTSSF_lADOBu4dv84BfbaRzhZuYME"
SCHUNK_STATUS_OPTIONS = {
    "Todo": "f75ad846",
    "In Progress": "47fc9ee4",
    "inReview": "2338665f",
    "Freigabe": "d98e05b2",
    "Blocking": "a21de5e9",
    "Done": "98236657",
}

DRY_RUN = "--dry-run" in sys.argv


def run_graphql(query: str) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    try:
        r = subprocess.run(
            ["gh", "api", "graphql", "-f", f"query={query}"],
            stdout=open(tmp, "wb"), stderr=subprocess.PIPE, check=False,
        )
        return json.loads(Path(tmp).read_bytes().decode("utf-8", errors="ignore"))
    finally:
        Path(tmp).unlink(missing_ok=True)


def fetch_json(cmd: list[str]) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    try:
        subprocess.run(cmd, stdout=open(tmp, "wb"), stderr=subprocess.PIPE, check=False)
        return json.loads(Path(tmp).read_bytes().decode("utf-8", errors="ignore"))
    finally:
        Path(tmp).unlink(missing_ok=True)


def tara(title: str) -> str | None:
    m = re.search(r"TARA-\d+", title)
    return m.group(0) if m else None


def set_status(item_id: str, status_name: str) -> bool:
    option_id = SCHUNK_STATUS_OPTIONS[status_name]
    mutation = (
        f'mutation {{ updateProjectV2ItemFieldValue(input: {{'
        f'projectId: "{SCHUNK_PROJECT_ID}" itemId: "{item_id}" '
        f'fieldId: "{SCHUNK_STATUS_FIELD}" '
        f'value: {{ singleSelectOptionId: "{option_id}" }}'
        f'}}) {{ projectV2Item {{ id }} }} }}'
    )
    result = run_graphql(mutation)
    return "errors" not in result


def delete_item(item_id: str) -> bool:
    mutation = (
        f'mutation {{ deleteProjectV2Item(input: {{'
        f'projectId: "{SCHUNK_PROJECT_ID}" itemId: "{item_id}"'
        f'}}) {{ deletedItemId }} }}'
    )
    result = run_graphql(mutation)
    return "errors" not in result


# ─── 1. Bheowulf status map ───────────────────────────────────────────────────
print("Step 1: Build Bheowulf status map")
bh_data = fetch_json(["gh", "project", "item-list", "1", "--owner", "Bheowulf", "--format", "json"])
bh_status: dict[str, str] = {}
for item in bh_data.get("items", []):
    t = tara(item.get("title", ""))
    if t:
        bh_status[t] = item.get("status") or "Todo"

print(f"  {len(bh_status)} TARA items in Bheowulf")
for s, n in sorted(((s, sum(1 for v in bh_status.values() if v == s)) for s in set(bh_status.values())), key=lambda x: x[0]):
    print(f"    {s}: {n}")

# ─── 2. Fetch ALL SCHUNK items via GraphQL (with actual project item IDs) ─────
print("\nStep 2: Fetch SCHUNK items (with node IDs) via GraphQL")
q = """
{
  organization(login: "SCHUNK-SE-Co-KG") {
    projectV2(number: 4) {
      items(first: 100) {
        nodes {
          id
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
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
print(f"  {len(nodes)} total items from GraphQL")

# Parse each node into {item_id, tara_id, current_status, title}
schunk_items: list[dict] = []
for node in nodes:
    content = node.get("content") or {}
    title = content.get("title", "")
    t = tara(title)
    # Extract current status from field values
    status = "Todo"
    for fv in node.get("fieldValues", {}).get("nodes", []):
        if fv.get("field", {}).get("name") == "Status":
            status = fv.get("name", "Todo") or "Todo"
    schunk_items.append({"id": node["id"], "tara": t, "status": status, "title": title})

# ─── 3. Dedup: if same TARA-ID appears twice, keep the one WITHOUT [MIRROR] ──
print("\nStep 3: Check for duplicates")
by_tara: dict[str, list[dict]] = {}
for item in schunk_items:
    t = item["tara"]
    if t:
        by_tara.setdefault(t, []).append(item)

dups = {t: items for t, items in by_tara.items() if len(items) > 1}
if dups:
    print(f"  Found {len(dups)} duplicate TARA-IDs: {', '.join(sorted(dups))}")
    for t, items in dups.items():
        # Prefer the Bheowulf-sourced item (title does NOT start with [MIRROR])
        keep = next((i for i in items if not i["title"].startswith("[MIRROR]")), items[0])
        to_del = [i for i in items if i["id"] != keep["id"]]
        for d in to_del:
            print(f"  [-] Removing dup {t}: '{d['title'][:50]}...' ", end="")
            if DRY_RUN:
                print("[DRY-RUN]")
            else:
                ok = delete_item(d["id"])
                print("[OK]" if ok else "[FAIL]")
                # Remove from schunk_items list too
                schunk_items = [i for i in schunk_items if i["id"] != d["id"]]
else:
    print("  No duplicates found")

# ─── 4. Find & fix status mismatches ─────────────────────────────────────────
print("\nStep 4: Fix status mismatches")
updates_ok = 0
updates_fail = 0
no_match = 0

for item in schunk_items:
    t = item["tara"]
    if not t:
        continue
    target = bh_status.get(t)
    if not target:
        no_match += 1
        continue
    current = item["status"]
    if current == target:
        continue  # Already correct

    print(f"  [{t}] '{current}' -> '{target}'  title={item['title'][:50]}", end="")
    if DRY_RUN:
        print(" [DRY-RUN]")
        updates_ok += 1
    else:
        if set_status(item["id"], target):
            print(" [OK]")
            updates_ok += 1
        else:
            print(" [FAIL]")
            updates_fail += 1

print(f"\n  Updated: {updates_ok}  Failed: {updates_fail}  No Bheowulf match: {no_match}")

# ─── 5. Verify ────────────────────────────────────────────────────────────────
if not DRY_RUN:
    print("\nStep 5: Verification")
    sk_data = fetch_json(["gh", "project", "item-list", "4", "--owner", "SCHUNK-SE-Co-KG", "--format", "json"])
    sk_items = sk_data.get("items", [])
    mismatch = 0
    for item in sk_items:
        t = tara(item.get("title", ""))
        if not t:
            continue
        s = item.get("status") or "Todo"
        expected = bh_status.get(t)
        if expected and s != expected:
            mismatch += 1
            print(f"  [!] Still wrong: {t} = '{s}' (expected '{expected}')")
    if mismatch == 0:
        print("  [OK] All statuses match Bheowulf!")
    else:
        print(f"  [!] {mismatch} items still not matching")

print("\nDone.")
