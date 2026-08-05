#!/usr/bin/env python3
"""Set TARA items to a given status on both boards."""
import json, subprocess, sys, tempfile
from pathlib import Path

def gql(q):
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
        tmp = f.name
    subprocess.run(['gh','api','graphql','-f',f'query={q}'], stdout=open(tmp,'wb'), stderr=subprocess.PIPE)
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

def set_status(project_id, item_id, field_id, option_id, label):
    q = (f'mutation {{ updateProjectV2ItemFieldValue(input: {{'
         f' projectId: "{project_id}" itemId: "{item_id}"'
         f' fieldId: "{field_id}" value: {{ singleSelectOptionId: "{option_id}" }}'
         f' }}) {{ projectV2Item {{ id }} }} }}')
    r = gql(q)
    if "errors" in r:
        print(f"  FAIL {label}: {r['errors'][0]['message']}")
    else:
        print(f"  OK {label}")

BH = {"project":"PVT_kwHOBLN4284BfLtb","field":"PVTSSF_lAHOBLN4284BfLtbzhZgYuI"}
SK = {"project":"PVT_kwDOBu4dv84BfbaR","field":"PVTSSF_lADOBu4dv84BfbaRzhZuYME"}

STATUS_BH = {"Todo":"f75ad846","In Progress":"47fc9ee4","inReview":"bbeb708d","Freigabe":"d2e53e50","Done":"98236657"}
STATUS_SK = {"Todo":"f75ad846","In Progress":"47fc9ee4","inReview":"2338665f","Freigabe":"d98e05b2","Done":"98236657"}

tara_id = sys.argv[1]   # e.g. "0062"
status  = sys.argv[2]   # e.g. "inReview"

bh_items = fetch(['gh','project','item-list','1','--owner','Bheowulf','--format','json','--limit','100'])['items']
sk_items = fetch(['gh','project','item-list','4','--owner','SCHUNK-SE-Co-KG','--format','json','--limit','100'])['items']

bh = next((i for i in bh_items if tara_id in i.get('title','')), None)
sk = next((i for i in sk_items if tara_id in i.get('title','')), None)

if bh:
    set_status(BH['project'], bh['id'], BH['field'], STATUS_BH[status], f"BH TARA-{tara_id} -> {status}")
if sk:
    set_status(SK['project'], sk['id'], SK['field'], STATUS_SK[status], f"SK TARA-{tara_id} -> {status}")
