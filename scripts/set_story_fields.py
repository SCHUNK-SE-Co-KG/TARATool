#!/usr/bin/env python3
"""Set Story Points and link sub-issues for TARA-0063 stories."""
import json, subprocess, sys, tempfile
from pathlib import Path

def gql(q):
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
        tmp = f.name
    subprocess.run(['gh','api','graphql','-f',f'query={q}'],
                   stdout=open(tmp,'wb'), stderr=subprocess.PIPE)
    d = json.loads(Path(tmp).read_bytes().decode('utf-8','ignore'))
    Path(tmp).unlink(missing_ok=True)
    return d

def fetch(cmd):
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
        tmp = f.name
    subprocess.run(cmd, stdout=open(tmp,'wb'), stderr=subprocess.PIPE)
    d = json.loads(Path(tmp).read_bytes().decode('utf-8','ignore'))
    Path(tmp).unlink(missing_ok=True)
    return d

BH_PROJECT = "PVT_kwHOBLN4284BfLtb"
SP_FIELD_ID = "PVTF_lAHOBLN4284BfLtbzhZgbzQ"  # Story Points
REPO = "Bheowulf/TARATool"

# (issue_number, story_points, parent_issue_number)
STORIES = [
    (116, 2,  115),   # TARA-0064 → Epic 115
    (117, 3,  115),   # TARA-0065 → Epic 115
    (118, 3,  115),   # TARA-0066 → Epic 115
    (119, 2,  115),   # TARA-0067 → Epic 115
    (120, 1,  115),   # TARA-0068 → Epic 115
    (121, 3,  115),   # TARA-0069 → Epic 115
    (122, 3,  115),   # TARA-0070 → Epic 115
    (163, 2,  162),   # TARA-0076 → Epic 162
]

# Get board items
bh_items = fetch(['gh','project','item-list','1','--owner','Bheowulf',
                  '--format','json','--limit','100'])['items']
item_map = {}
for item in bh_items:
    content = item.get('content', {})
    num = content.get('number') if content else None
    if num:
        item_map[num] = item['id']

print(f"Board items loaded: {len(item_map)}")

for issue_num, sp, parent_num in STORIES:
    item_id = item_map.get(issue_num)
    if not item_id:
        print(f"SKIP #{issue_num}: not on board")
        continue

    # Set Story Points via GraphQL
    q = (f'mutation {{ updateProjectV2ItemFieldValue(input: {{'
         f' projectId: "{BH_PROJECT}" itemId: "{item_id}"'
         f' fieldId: "{SP_FIELD_ID}" value: {{ number: {sp} }}'
         f' }}) {{ projectV2Item {{ id }} }} }}')
    r = gql(q)
    if "errors" in r:
        print(f"FAIL #{issue_num} SP={sp}: {r['errors'][0]['message']}")
    else:
        print(f"OK   #{issue_num} Story Points = {sp}")

    # Link as sub-issue of parent (GitHub native sub-issues API)
    if parent_num:
        r2 = subprocess.run(
            ['gh', 'api',
             f'repos/{REPO}/issues/{parent_num}/sub_issues',
             '--method', 'POST',
             '-F', f'sub_issue_id={issue_num}'],
            capture_output=True
        )
        ok = r2.returncode == 0
        err = r2.stderr.decode('utf-8-sig')[:80] if not ok else ''
        if 'already exists' in r2.stdout.decode('utf-8-sig','ignore') or \
           'already exists' in err:
            print(f"     #{issue_num} already linked to parent #{parent_num}")
        elif ok:
            print(f"     #{issue_num} linked as sub-issue of #{parent_num}")
        else:
            print(f"     #{issue_num} sub-issue link FAIL: {err}")

print("\nDone.")
