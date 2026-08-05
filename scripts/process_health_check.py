#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TARATool Process Health Check
==============================
Prüft den vollständigen Prozesszustand:
  1. Dokumentenvollständigkeit (alle Pflichtdokumente vorhanden + Pflichtabschnitte)
  2. GitHub Project Board Sync (Bheowulf <-> SCHUNK)
  3. Board Status-Konsistenz (In Progress, Todo, Done stimmen überein)
  4. Offene Blocking-Issues

Exit-Codes:
  0 = alles OK
  1 = Warnungen (keine Blocker)
  2 = Blocker gefunden

Usage:
  python scripts/process_health_check.py [--verbose] [--no-board]
"""
import json
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

VERBOSE   = "--verbose" in sys.argv
NO_BOARD  = "--no-board" in sys.argv
ROOT      = Path(__file__).parent.parent

# ── Ergebnis-Sammler ──────────────────────────────────────────────────────────
errors   = []   # Blocker
warnings = []   # Warnungen
infos    = []   # Info-Zeilen


def ok(msg):    print(f"  \u2705 {msg}")
def warn(msg):  warnings.append(msg); print(f"  \u26a0\ufe0f  {msg}")
def fail(msg):  errors.append(msg);   print(f"  \u274c {msg}")
def info(msg):  infos.append(msg);    print(f"     {msg}")
def section(title): print(f"\n{'='*60}\n  {title}\n{'='*60}")


# ── Hilfsfunktionen ───────────────────────────────────────────────────────────
def safe(t: str) -> str:
    return t.encode("ascii", "replace").decode()


def fetch_board(owner: str, project: int, limit: int = 100) -> list[dict]:
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmp = f.name
    try:
        subprocess.run(
            ["gh", "project", "item-list", str(project),
             "--owner", owner, "--format", "json", "--limit", str(limit)],
            stdout=open(tmp, "wb"), stderr=subprocess.PIPE, check=False
        )
        data = json.loads(Path(tmp).read_bytes().decode("utf-8", "ignore"))
        return data.get("items", [])
    finally:
        Path(tmp).unlink(missing_ok=True)


def fetch_issues(label: str, state: str = "open") -> list[dict]:
    result = subprocess.run(
        ["gh", "issue", "list", "--repo", "Bheowulf/TARATool",
         "--label", label, "--state", state,
         "--json", "number,title,labels,state", "--limit", "50"],
        capture_output=True, check=False
    )
    if result.returncode != 0:
        return []
    return json.loads(result.stdout.decode("utf-8", "ignore") or "[]")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. DOKUMENTEN-VOLLSTÄNDIGKEIT
# ═══════════════════════════════════════════════════════════════════════════════
section("1 · Dokumentenvollständigkeit")

REQUIRED_DOCS = {
    "docs/ENTWICKLUNGSPROZESS.md": [
        "Definition of Ready",
        "Epic-Completion-Regel",
        "Hotfix-Prozess",
        "P-16",
        "P-01 bis P-16",
    ],
    "docs/GITHUB_BOARD.md": [
        "PVT_kwHOBLN4284BfLtb",   # Bheowulf Project ID
        "PVT_kwDOBu4dv84BfbaR",   # SCHUNK Project ID
        "PVTSSF_lADOBu4dv84BfbaRzhZuYME",  # SCHUNK Status field
    ],
    "agents/process_guard/PROCESS_GUARD_AGENT.md": [
        "P-16",
        "P-15",
    ],
    "agents/review_agent/REVIEW_AGENT_WORKFLOW.md": [
        "Scope-Entscheidung",
        "R-22",
        "R-30",
    ],
    "agents/dev_agent/DEV_AGENT_ONBOARDING.md": [
        "CONTRIBUTING.md",
        "feature/TARA-XXXX",
    ],
    ".github/pull_request_template.md": [
        "Definition of Ready",
        "P-16",
        "Freigabe",
    ],
    ".github/ISSUE_TEMPLATE/story.md": [
        "DoR",
        "Story Points",
    ],
    ".github/ISSUE_TEMPLATE/epic.md": [
        "Epic-Completion",
        "Child Stories",
    ],
    ".github/workflows/mirror-sync.yml": [
        "--limit 100",
    ],
    "CONTRIBUTING.md": [
        "TDD",
        "feature/TARA",
    ],
}

for rel_path, required_sections in REQUIRED_DOCS.items():
    path = ROOT / rel_path
    if not path.exists():
        fail(f"Fehlendes Dokument: {rel_path}")
        continue
    content = path.read_text(encoding="utf-8", errors="ignore")
    all_found = True
    for section_marker in required_sections:
        if section_marker not in content:
            all_found = False
            warn(f"{rel_path}: Abschnitt/ID '{section_marker}' nicht gefunden")
    if all_found:
        ok(f"{rel_path}")
    elif VERBOSE:
        for s_m in required_sections:
            if s_m not in content:
                info(f"  missing: {s_m}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. BOARD SYNC (Bheowulf <-> SCHUNK)
# ═══════════════════════════════════════════════════════════════════════════════
section("2 · Board-Sync Bheowulf <-> SCHUNK")

if NO_BOARD:
    print("  [SKIP] --no-board flag gesetzt")
else:
    SKIP_TITLES = ["CVE Monthly Report"]

    print("  Lade Bheowulf Project #1...")
    bh = fetch_board("Bheowulf", 1)
    print("  Lade SCHUNK-SE-Co-KG Project #4...")
    sk = fetch_board("SCHUNK-SE-Co-KG", 4)

    ok(f"Bheowulf: {len(bh)} Items  |  SCHUNK: {len(sk)} Items")

    bh_active = [i for i in bh if not any(s in i.get("title","") for s in SKIP_TITLES)]
    sk_norm   = {i["title"].replace("[MIRROR] ","").strip() for i in sk}
    bh_norm   = {i["title"].strip() for i in bh_active}

    # Items in BH nicht in SCHUNK
    missing_in_sk = [i for i in bh_active if i["title"].strip() not in sk_norm]
    if missing_in_sk:
        fail(f"{len(missing_in_sk)} Items in Bheowulf NICHT in SCHUNK:")
        for i in missing_in_sk[:5]:
            info(f"  [{i.get('status','?')}] {safe(i['title'])[:70]}")
        if len(missing_in_sk) > 5:
            info(f"  ... und {len(missing_in_sk)-5} weitere")
    else:
        ok("Alle Bheowulf-Items (ohne CVE Monthly Reports) in SCHUNK vorhanden")

    # ── 3. STATUS-KONSISTENZ ──────────────────────────────────────────────────
    section("3 · Board Status-Konsistenz")

    bh_by_title = {i["title"].strip(): i for i in bh_active}
    sk_by_norm  = {i["title"].replace("[MIRROR] ","").strip(): i for i in sk}

    status_mismatches = []
    for title, bh_item in bh_by_title.items():
        sk_item = sk_by_norm.get(title)
        if not sk_item:
            continue
        bh_st = bh_item.get("status") or ""
        sk_st = sk_item.get("status") or ""
        if bh_st != sk_st:
            status_mismatches.append((title, bh_st, sk_st))

    if status_mismatches:
        warn(f"{len(status_mismatches)} Status-Abweichungen BH <-> SCHUNK:")
        for title, bh_st, sk_st in status_mismatches:
            info(f"  BH={bh_st:12s} SCHUNK={sk_st:12s}  {safe(title)[:55]}")
    else:
        ok("Alle Status-Felder identisch (BH == SCHUNK)")

    # Status-Übersicht
    bh_counts = Counter(i.get("status","") for i in bh_active)
    sk_counts = Counter(i.get("status","") for i in sk)
    print()
    print(f"  {'Status':<14} {'Bheowulf':>10} {'SCHUNK':>8}")
    print(f"  {'-'*34}")
    all_statuses = sorted(set(list(bh_counts.keys()) + list(sk_counts.keys())))
    for st in all_statuses:
        b = bh_counts.get(st, 0)
        s = sk_counts.get(st, 0)
        marker = " <--" if b != s else ""
        print(f"  {st:<14} {b:>10} {s:>8}{marker}")

    # In Progress explizit prüfen
    bh_ip = [i for i in bh_active if i.get("status") == "In Progress"]
    sk_ip = [i for i in sk if i.get("status") == "In Progress"]
    print()
    if bh_ip:
        ok(f"In Progress auf Bheowulf: {len(bh_ip)}")
        for i in bh_ip:
            info(f"  {safe(i['title'])[:72]}")
    if sk_ip:
        ok(f"In Progress auf SCHUNK: {len(sk_ip)}")
        for i in sk_ip:
            info(f"  {safe(i['title'])[:72]}")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. OFFENE BLOCKING-ISSUES
# ═══════════════════════════════════════════════════════════════════════════════
section("4 · Offene Blocking-Issues")

blocking = fetch_issues("blocked")
process_findings = fetch_issues("review-finding")

if blocking:
    warn(f"{len(blocking)} offene Issues mit Label 'blocked':")
    for i in blocking:
        info(f"  #{i['number']}: {safe(i['title'])[:70]}")
else:
    ok("Keine offenen blocked-Issues")

critical_findings = [
    i for i in process_findings
    if any(word in i.get("title","").lower() for word in ["kritisch","critical","hoch","high"])
]
if critical_findings:
    fail(f"{len(critical_findings)} offene Kritisch/Hoch Review-Findings:")
    for i in critical_findings:
        info(f"  #{i['number']}: {safe(i['title'])[:70]}")
elif process_findings:
    ok(f"Keine kritischen Review-Findings offen ({len(process_findings)} gesamt offen, alle Medium/Low)")
else:
    ok("Keine offenen Review-Findings")

# ═══════════════════════════════════════════════════════════════════════════════
# ZUSAMMENFASSUNG
# ═══════════════════════════════════════════════════════════════════════════════
section("Zusammenfassung")

total_checks = len(REQUIRED_DOCS)
print(f"  Fehler   : {len(errors)}")
print(f"  Warnungen: {len(warnings)}")
print()

if errors:
    print("  \u274c PROCESS BLOCKED")
    for e in errors:
        print(f"     - {e}")
    sys.exit(2)
elif warnings:
    print("  \u26a0\ufe0f  PROCESS OK (mit Warnungen)")
    for w in warnings:
        print(f"     - {w}")
    sys.exit(1)
else:
    print("  \u2705 PROCESS OK")
    sys.exit(0)
