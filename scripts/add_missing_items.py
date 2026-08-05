#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Add 3 missing items back to SCHUNK project and set status Done."""
import json, subprocess, sys, tempfile
from pathlib import Path

SCHUNK_PROJECT_ID = "PVT_kwDOBu4dv84BfbaR"
SCHUNK_STATUS_FIELD = "PVTSSF_lADOBu4dv84BfbaRzhZuYME"
DONE_OPTION_ID = "98236657"
BHEOWULF_REPO = "Bheowulf/TARATool"

MISSING_ISSUES = [
    (50, "[TARA-0004] STORY: Branch-Strategie dokumentieren"),
    (52, "[TARA-0006] STORY: parse_trivy.py / parse_trivy2.py konsolidieren"),
    (59, "[PROCESS-GUARD] TARA-0004 - Regel P-03/P-04 verletzt (TDD Red-Phase)"),
]

def run_gql(query):
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    subprocess.run(["gh", "api", "graphql", "-f", f"query={query}"],
                   stdout=open(tmp, "wb"), stderr=subprocess.PIPE, check=False)
    data = json.loads(Path(tmp).read_bytes().decode("utf-8", errors="ignore"))
    Path(tmp).unlink(missing_ok=True)
    return data

for num, title in MISSING_ISSUES:
    print(f"\n>>> Issue #{num}: {title}")
    
    # 1. Get node ID
    node_id_raw = subprocess.run(
        ["gh", "issue", "view", str(num), "--repo", BHEOWULF_REPO, "--json", "id", "--jq", ".id"],
        capture_output=True, text=False, check=False
    ).stdout.decode("utf-8", errors="ignore").strip()
    print(f"    Node ID: {node_id_raw[:30]}...")

    # 2. Add to SCHUNK project
    add_q = (f'mutation {{ addProjectV2ItemById(input: {{ projectId: "{SCHUNK_PROJECT_ID}" '
             f'contentId: "{node_id_raw}" }}) {{ item {{ id }} }} }}')
    result = run_gql(add_q)
    if "errors" in result:
        print(f"    [FAIL] Add: {result['errors']}")
        continue
    item_id = result["data"]["addProjectV2ItemById"]["item"]["id"]
    print(f"    Added item: {item_id[:30]}...")

    # 3. Set status = Done
    set_q = (f'mutation {{ updateProjectV2ItemFieldValue(input: {{ projectId: "{SCHUNK_PROJECT_ID}" '
             f'itemId: "{item_id}" fieldId: "{SCHUNK_STATUS_FIELD}" '
             f'value: {{ singleSelectOptionId: "{DONE_OPTION_ID}" }} }}) '
             f'{{ projectV2Item {{ id }} }} }}')
    result2 = run_gql(set_q)
    if "errors" in result2:
        print(f"    [FAIL] Set status: {result2['errors']}")
    else:
        print(f"    [OK] Status set to Done")

print("\n=== Done. Verifying SCHUNK total ===")
data = json.loads(subprocess.run(
    ["gh", "project", "item-list", "4", "--owner", "SCHUNK-SE-Co-KG", "--format", "json"],
    capture_output=True, text=False
).stdout.decode("utf-8", errors="ignore"))
items = data.get("items", [])
print(f"SCHUNK total items: {len(items)}")
from collections import Counter
for s, n in sorted(Counter(i.get("status","") for i in items).items()):
    print(f"  {s}: {n}")
