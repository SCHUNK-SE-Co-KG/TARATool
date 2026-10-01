#!/usr/bin/env python3
"""Set TARA items to a given status on the SCHUNK project board.

TARA-0121: "PO Accepted" und "PO Release" sind geschuetzte Board-Status
(Bearbeitungserlaubnis bzw. fachliche/releasebezogene Abnahme). Agenten und
Skripte duerfen diese beiden Status NICHT ueber dieses Skript setzen - nur
die dedizierten, PO-gebundenen GitHub-Actions-Jobs (`check-po-accepted` /
`check-po-release` in `.github/workflows/po-approve.yml`) duerfen das
(nach erfolgreicher Pruefung von P-26/P-27). Ein Versuch, sie hier direkt
zu setzen, wird deterministisch zurueckgewiesen.

TARA-0117 (P-18): "In Progress" und "inReview" sind ebenfalls NICHT mehr
ueber dieses Skript setzbar - diese beiden Uebergaenge liefen bisher OHNE
jede Vorbedingungspruefung (der Dev-Agent haette hier jeden beliebigen
Statuswechsel ausloesen koennen). Sie laufen jetzt ausschliesslich ueber
die vorbedingungsgepruefte, atomare Transition-API
(`scripts/workflow/transition_engine.py`), angestossen per
`gh workflow run transition.yml -f story=<TARA-ID> -f to=<Status>
-f head_sha=<SHA>` (.github/workflows/transition.yml). Die eigentliche
GraphQL-Mutation wird ausschliesslich in transition_engine.py ausgefuehrt
(kein Duplikat mehr hier) - siehe tests/test_TARA_0117.py,
test_no_other_python_script_calls_the_mutation_directly.

Der bisherige Status Blocking entfaellt (PO-Entscheidung, TARA-0121): die
Options-ID wurde im Board zu "PO Release" umbenannt. Blockierte Items
werden seitdem ueber das Issue-Label "blocked" markiert (Board-Status
bleibt unveraendert), siehe `agents/review_agent/report_builder.py`.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "workflow"))
from transition_engine import STATUS_OPTION_IDS, mutate_status_via_gh  # noqa: E402

PO_GATED_STATUSES = ("PO Accepted", "PO Release")
TRANSITION_API_STATUSES = ("In Progress", "inReview")

STATUS_SK = dict(STATUS_OPTION_IDS)
STATUS_SK["Freigabe"] = STATUS_SK["Accepted"]  # historischer Alias, TARA-0110


def fetch(cmd):
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    subprocess.run(cmd, stdout=open(tmp, "wb"), stderr=subprocess.PIPE)
    d = json.loads(Path(tmp).read_bytes().decode("utf-8", "ignore"))
    Path(tmp).unlink(missing_ok=True)
    return d


def set_status(item_id, option_id, label):
    if mutate_status_via_gh(item_id, option_id):
        print(f"  OK {label}")
    else:
        print(f"  FAIL {label}: Mutation fehlgeschlagen")


tara_id = sys.argv[1]  # e.g. "0062"
status = sys.argv[2]  # e.g. "Accepted"

if status in PO_GATED_STATUSES:
    print(
        f"FAIL: '{status}' ist ein geschuetzter PO-Status (TARA-0121, P-26/P-27) "
        "und darf nicht direkt ueber set_story_status.py gesetzt werden. Nur die "
        "gebundenen PO-Kommandos ueber .github/workflows/po-approve.yml duerfen "
        "diesen Uebergang ausloesen."
    )
    sys.exit(1)

if status in TRANSITION_API_STATUSES:
    print(
        f"FAIL: '{status}' darf nicht direkt ueber set_story_status.py gesetzt "
        "werden (TARA-0117, P-18) - keine Vorbedingungspruefung hier. Stattdessen: "
        f'gh workflow run transition.yml -f story=TARA-{tara_id} -f to="{status}" '
        "-f head_sha=<SHA>"
    )
    sys.exit(1)

sk_items = fetch(
    ["gh", "project", "item-list", "4", "--owner", "SCHUNK-SE-Co-KG", "--format", "json", "--limit", "100"]
)["items"]

sk = next((i for i in sk_items if tara_id in i.get("title", "")), None)

if sk:
    set_status(sk["id"], STATUS_SK[status], f"SK TARA-{tara_id} -> {status}")
else:
    print(f"SKIP TARA-{tara_id}: not on board")

