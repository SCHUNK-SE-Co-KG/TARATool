#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TARATool Process Health Check
==============================
Prüft den vollständigen Prozesszustand:
  1. Dokumentenvollständigkeit (alle Pflichtdokumente vorhanden + Pflichtabschnitte)
  2. Board Status-Uebersicht (SCHUNK Project Board)
  3. Offene Blocking-Issues

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
        ["gh", "issue", "list", "--repo", "SCHUNK-SE-Co-KG/TARATool",
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
# 2. BOARD STATUS-UEBERSICHT (SCHUNK)
# ═══════════════════════════════════════════════════════════════════════════════
section("2 · Board Status-Uebersicht (SCHUNK)")

if NO_BOARD:
    print("  [SKIP] --no-board flag gesetzt")
else:
    SKIP_TITLES = ["CVE Monthly Report"]

    print("  Lade SCHUNK-SE-Co-KG Project #4...")
    sk = fetch_board("SCHUNK-SE-Co-KG", 4)
    sk_active = [i for i in sk if not any(s in i.get("title","") for s in SKIP_TITLES)]

    ok(f"SCHUNK: {len(sk_active)} Items")

    # Status-Übersicht
    sk_counts = Counter(i.get("status","") for i in sk_active)
    print()
    print(f"  {'Status':<14} {'SCHUNK':>8}")
    print(f"  {'-'*24}")
    for st in sorted(sk_counts.keys()):
        print(f"  {st:<14} {sk_counts[st]:>8}")

    # In Progress explizit prüfen
    sk_ip = [i for i in sk_active if i.get("status") == "In Progress"]
    print()
    if sk_ip:
        ok(f"In Progress auf SCHUNK: {len(sk_ip)}")
        for i in sk_ip:
            info(f"  {safe(i['title'])[:72]}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. OFFENE BLOCKING-ISSUES
# ═══════════════════════════════════════════════════════════════════════════════
section("3 · Offene Blocking-Issues")

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
