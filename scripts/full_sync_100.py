#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Full sync Bheowulf->SCHUNK with limit 100, add missing + fix statuses."""
import json, subprocess, sys, tempfile
from pathlib import Path
from collections import Counter

SCHUNK_PROJECT_ID = "PVT_kwDOBu4dv84BfbaR"
SCHUNK_STATUS_FIELD = "PVTSSF_lADOBu4dv84BfbaRzhZuYME"
STATUS_OPTIONS = {
    "Todo": "f75ad846", "In Progress": "47fc9ee4",
    "inReview": "2338665f", "Freigabe": "d98e05b2",
    "Blocking": "a21de5e9", "Done": "98236657",
}
SKIP = ["CVE Monthly Report"]
DRY_RUN = "--dry-run" in sys.argv


def fetch_tmp(cmd):
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    subprocess.run(cmd, stdout=open(tmp, "wb"), stderr=subprocess.PIPE, check=False)
    data = json.loads(Path(tmp).read_bytes().decode("utf-8", errors="ignore"))
    Path(tmp).unlink(missing_ok=True)
    return data


def gql(query):
    return fetch_tmp(["gh", "api", "graphql", "-f", f"query={query}"])


def all_items(owner, project, limit=100):
    d = fetch_tmp(["gh", "project", "item-list", str(project),
                   "--owner", owner, "--format", "json", "--limit", str(limit)])
    return d.get("items", [])


def norm(title):
    return title.replace("[MIRROR] ", "").strip()


def safe(title):
    return title.encode("ascii", "replace").decode()


# ── 1. Fetch ──────────────────────────────────────────────────────────────────
print("Step 1: Fetch")
bh = all_items("Bheowulf", 1)
sk = all_items("SCHUNK-SE-Co-KG", 4)
print(f"  Bheowulf: {len(bh)}   SCHUNK: {len(sk)}")

# ── 2. Build lookup: normalized title -> node_id (from GraphQL) ───────────────
print("Step 2: Fetch content node IDs from Bheowulf")
q = ('{ user(login:"Bheowulf") { projectV2(number:1) { items(first:100) { '
     'nodes { content { ... on Issue { id number title } '
     '... on DraftIssue { id title } } } } } } }')
r = gql(q)
bh_nodes = (r.get("data", {}).get("user", {}).get("projectV2", {})
            .get("items", {}).get("nodes", []))
title_to_nid = {}
for node in bh_nodes:
    c = node.get("content") or {}
    t = c.get("title", "")
    nid = c.get("id", "")
    if t and nid:
        title_to_nid[t] = nid
print(f"  Got {len(title_to_nid)} node IDs")

# ── 3. Find missing items ─────────────────────────────────────────────────────
sk_norm_set = {norm(i["title"]) for i in sk}
missing = [i for i in bh if not any(s in i["title"] for s in SKIP)
           and norm(i["title"]) not in sk_norm_set]
print(f"\nStep 3: {len(missing)} items missing in SCHUNK")

# ── 4. Add missing items ──────────────────────────────────────────────────────
added_ok = added_fail = 0
for item in missing:
    title = item["title"]
    status = item.get("status") or "Todo"
    nid = title_to_nid.get(title, "")
    print(f"  [{status}] {safe(title)[:60]}", end="")
    if not nid:
        print(" [SKIP no node_id]")
        added_fail += 1
        continue
    if DRY_RUN:
        print(" [DRY-RUN]")
        added_ok += 1
        continue
    # Add
    r2 = gql(f'mutation {{ addProjectV2ItemById(input: {{ projectId: '
             f'"{SCHUNK_PROJECT_ID}" contentId: "{nid}" }}) '
             f'{{ item {{ id }} }} }}')
    if "errors" in r2:
        print(f" [FAIL add: {r2['errors'][0].get('message','')}]")
        added_fail += 1
        continue
    item_id = r2["data"]["addProjectV2ItemById"]["item"]["id"]
    # Set status
    opt = STATUS_OPTIONS.get(status, STATUS_OPTIONS["Todo"])
    r3 = gql(f'mutation {{ updateProjectV2ItemFieldValue(input: {{ '
             f'projectId: "{SCHUNK_PROJECT_ID}" itemId: "{item_id}" '
             f'fieldId: "{SCHUNK_STATUS_FIELD}" '
             f'value: {{ singleSelectOptionId: "{opt}" }} }}) '
             f'{{ projectV2Item {{ id }} }} }}')
    if "errors" in r3:
        print(f" [ADD OK, status FAIL: {r3['errors'][0].get('message','')}]")
    else:
        print(f" [OK status={status}]")
    added_ok += 1

print(f"\n  Added: {added_ok}   Skipped: {added_fail}")

# ── 5. Verify ─────────────────────────────────────────────────────────────────
print("\nStep 5: Final verification")
bh2 = all_items("Bheowulf", 1)
sk2 = all_items("SCHUNK-SE-Co-KG", 4)
sk2_norm = {norm(i["title"]) for i in sk2}
still_miss = [i for i in bh2
              if not any(s in i["title"] for s in SKIP)
              and norm(i["title"]) not in sk2_norm]
bh_nonskip = [i for i in bh2 if not any(s in i["title"] for s in SKIP)]
print(f"  Bheowulf (excl CVE): {len(bh_nonskip)}   SCHUNK: {len(sk2)}")
if still_miss:
    print(f"  Still missing ({len(still_miss)}):")
    for i in still_miss:
        print(f"    [{i.get('status')}] {safe(i['title'])[:70]}")
else:
    print("  [OK] All non-CVE items present in SCHUNK")

print("\n  BHEOWULF status breakdown (excl CVE):")
for s, n in sorted(Counter(i.get("status", "") for i in bh_nonskip).items()):
    print(f"    {s}: {n}")
print("  SCHUNK status breakdown:")
for s, n in sorted(Counter(i.get("status", "") for i in sk2).items()):
    print(f"    {s}: {n}")
