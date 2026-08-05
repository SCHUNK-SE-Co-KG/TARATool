#!/usr/bin/env python3
import json, subprocess, tempfile
from pathlib import Path

def fetch(cmd):
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
        tmp = f.name
    subprocess.run(cmd, stdout=open(tmp,'wb'), stderr=subprocess.PIPE)
    d = json.loads(Path(tmp).read_bytes().decode('utf-8','ignore'))
    Path(tmp).unlink(missing_ok=True)
    return d

def s(t): return t.encode('ascii','replace').decode()

bh = fetch(['gh','project','item-list','1','--owner','Bheowulf','--format','json','--limit','100'])['items']
sk = fetch(['gh','project','item-list','4','--owner','SCHUNK-SE-Co-KG','--format','json','--limit','100'])['items']

bh_todo = [i for i in bh if i.get('status') == 'Todo']
sk_todo  = [i for i in sk if i.get('status') == 'Todo']
sk_norm  = {i['title'].replace('[MIRROR] ','') for i in sk}

print("=== BHEOWULF Todo ===")
for i in bh_todo:
    print(f"  {s(i['title'])[:80]}")

print("\n=== SCHUNK Todo ===")
for i in sk_todo:
    print(f"  {s(i['title'])[:80]}")

print("\n=== Items in BH Todo NOT in SCHUNK (any status) ===")
found = False
for i in bh_todo:
    norm = i['title'].replace('[MIRROR] ','')
    if norm not in sk_norm:
        print(f"  MISSING: {s(norm)[:80]}")
        found = True
if not found:
    print("  All BH-Todo items are present in SCHUNK")

bh_ip = [i for i in bh if i.get('status') == 'In Progress']
sk_ip  = [i for i in sk if i.get('status') == 'In Progress']
print(f"\n=== In Progress: BH={len(bh_ip)} SCHUNK={len(sk_ip)} ===")
for i in bh_ip:
    print(f"  BH:    {s(i['title'])[:80]}")
for i in sk_ip:
    print(f"  SCHUNK:{s(i['title'])[:80]}")
