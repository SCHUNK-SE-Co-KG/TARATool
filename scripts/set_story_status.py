#!/usr/bin/env python3
"""Set TARA items to a given status on the SCHUNK project board.

TARA-0121: "PO Accepted" und "PO Release" sind geschuetzte Board-Status
(Bearbeitungserlaubnis bzw. fachliche/releasebezogene Abnahme). Agenten und
Skripte duerfen diese beiden Status NICHT ueber dieses Skript setzen - nur
die dedizierten, PO-gebundenen GitHub-Actions-Jobs (`check-po-accepted` /
`check-po-release` in `.github/workflows/po-approve.yml`) duerfen das
(nach erfolgreicher Pruefung von P-26/P-27). Ein Versuch, sie hier direkt
zu setzen, wird deterministisch zurueckgewiesen.

Der bisherige Status Blocking entfaellt (PO-Entscheidung, TARA-0121): die
Options-ID wurde im Board zu "PO Release" umbenannt. Blockierte Items
werden seitdem ueber das Issue-Label "blocked" markiert (Board-Status
bleibt unveraendert), siehe `agents/review_agent/report_builder.py`.
"""
import json, subprocess, sys, tempfile
from pathlib import Path

PO_GATED_STATUSES = ("PO Accepted", "PO Release")

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

SK = {"project":"PVT_kwDOBu4dv84BfbaR","field":"PVTSSF_lADOBu4dv84BfbaRzhZuYME"}

STATUS_SK = {
    "Todo": "f75ad846",
    "PO Accepted": "d2d86c41",
    "In Progress": "47fc9ee4",
    "inReview": "2338665f",
    "Freigabe": "d98e05b2",
    "Accepted": "d98e05b2",
    "PO Release": "a21de5e9",
    "Done": "98236657",
}

tara_id = sys.argv[1]   # e.g. "0062"
status  = sys.argv[2]   # e.g. "inReview"

if status in PO_GATED_STATUSES:
    print(
        f"FAIL: '{status}' ist ein geschuetzter PO-Status (TARA-0121, P-26/P-27) "
        "und darf nicht direkt ueber set_story_status.py gesetzt werden. Nur die "
        "gebundenen PO-Kommandos ueber .github/workflows/po-approve.yml duerfen "
        "diesen Uebergang ausloesen."
    )
    sys.exit(1)

sk_items = fetch(['gh','project','item-list','4','--owner','SCHUNK-SE-Co-KG','--format','json','--limit','100'])['items']

sk = next((i for i in sk_items if tara_id in i.get('title','')), None)

if sk:
    set_status(SK['project'], sk['id'], SK['field'], STATUS_SK[status], f"SK TARA-{tara_id} -> {status}")
else:
    print(f"SKIP TARA-{tara_id}: not on board")

