#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sync GitHub Project Board Items: Bheowulf (source) -> SCHUNK (mirror).

This script analyzes board content and provides sync recommendations.
For actual item management, use GitHub CLI with GraphQL API.

Usage:
  python scripts/sync_project_boards.py [--dry-run] [--verbose]
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

# Configuration
BHEOWULF_OWNER = "Bheowulf"
BHEOWULF_PROJECT = 1
SCHUNK_OWNER = "SCHUNK-SE-Co-KG"
SCHUNK_PROJECT = 4

DRY_RUN = False
VERBOSE = False
ITEM_LIMIT = 100  # fetch up to N items per board (default 30 is too low)


def run_command(cmd: list[str]) -> str:
    """Run shell command with UTF-8 handling for Windows."""
    if VERBOSE:
        print(f"  [CMD] {' '.join(cmd)}")
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=False,
        check=False,
    )
    
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed: {' '.join(cmd)}\n"
            f"stderr: {result.stderr.decode('utf-8', errors='ignore')}"
        )
    
    # Decode with error handling for Windows UTF-8 issues
    return result.stdout.decode('utf-8', errors='ignore').strip()


def fetch_project_items(owner: str, project_num: int) -> list[dict]:
    """Fetch items from project, save to temp file, read back."""
    print(f"[+] Fetching items from {owner}/Project#{project_num}...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        temp_file = f.name
    
    try:
        # Write to temp file to avoid encoding issues
        cmd = [
            'gh', 'project', 'item-list', str(project_num),
            '--owner', owner,
            '--format', 'json',
            '--limit', str(ITEM_LIMIT),
        ]
        
        result = subprocess.run(
            cmd,
            stdout=open(temp_file, 'wb'),
            stderr=subprocess.PIPE,
            check=False
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"gh failed: {result.stderr.decode('utf-8', errors='ignore')}")
        
        # Read JSON from file
        with open(temp_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        items = data.get('items', [])
        print(f"  [OK] Found {len(items)} items")
        return items
        
    finally:
        Path(temp_file).unlink(missing_ok=True)


def extract_tara_id(title: str) -> str | None:
    """Extract TARA-XXXX ID from title."""
    import re
    match = re.search(r'TARA-(\d+)', title)
    return match.group(0) if match else None


def safe_title(title: str) -> str:
    """Convert title to safe ASCII output."""
    return title.encode('ascii', errors='replace').decode('ascii')


def analyze_sync(
    bheowulf_items: list[dict],
    schunk_items: list[dict],
) -> dict:
    """Analyze what needs to sync."""
    print("\n[->] Analyzing sync differences...")
    
    # Build indexes by TARA-ID
    bh_by_tara = {}
    for item in bheowulf_items:
        tara = extract_tara_id(item.get('title', ''))
        if tara:
            bh_by_tara[tara] = item
    
    schunk_by_tara = {}
    for item in schunk_items:
        title = item.get('title', '').replace('[MIRROR] ', '')
        tara = extract_tara_id(title)
        if tara:
            schunk_by_tara[tara] = item
    
    # Find differences
    to_add = []  # In Bheowulf, not in SCHUNK
    to_remove = []  # In SCHUNK, not in Bheowulf
    non_tara_items = []  # Bheowulf items without TARA-ID
    
    for tara, bh_item in bh_by_tara.items():
        if tara not in schunk_by_tara:
            to_add.append((tara, bh_item))
    
    for tara, schunk_item in schunk_by_tara.items():
        if tara not in bh_by_tara:
            to_remove.append((tara, schunk_item))
    
    for bh_item in bheowulf_items:
        if not extract_tara_id(bh_item.get('title', '')):
            non_tara_items.append(bh_item)
    
    print(f"  [+] {len(to_add)} items to ADD to SCHUNK")
    print(f"  [-] {len(to_remove)} items to REMOVE from SCHUNK")
    print(f"  [*] {len(non_tara_items)} non-TARA items in Bheowulf")
    
    return {
        'to_add': to_add,
        'to_remove': to_remove,
        'non_tara': non_tara_items,
        'bh_by_tara': bh_by_tara,
        'schunk_by_tara': schunk_by_tara,
    }


def print_sync_report(analysis: dict) -> None:
    """Print detailed sync report."""
    to_add = analysis['to_add']
    to_remove = analysis['to_remove']
    non_tara = analysis['non_tara']
    
    print("\n" + "=" * 70)
    print("[SYNC] Detailed Sync Plan")
    print("=" * 70)
    
    if to_add:
        print(f"\n[*] Items to ADD to SCHUNK ({len(to_add)} total):")
        for tara, item in to_add[:10]:
            title = safe_title(item.get('title', 'N/A'))
            print(f"    + {tara}: {title}")
        if len(to_add) > 10:
            print(f"    ... and {len(to_add) - 10} more")
    
    if to_remove:
        print(f"\n[*] Items to REMOVE from SCHUNK ({len(to_remove)} total):")
        for tara, item in to_remove[:10]:
            title = safe_title(item.get('title', 'N/A'))
            title = title.replace('[MIRROR] ', '')
            print(f"    - {tara}: {title}")
        if len(to_remove) > 10:
            print(f"    ... and {len(to_remove) - 10} more")
    
    if non_tara:
        print(f"\n[*] Non-TARA items (Bheowulf only, {len(non_tara)} total):")
        for item in non_tara[:5]:
            title = safe_title(item.get('title', 'N/A'))
            print(f"    * {title}")
        if len(non_tara) > 5:
            print(f"    ... and {len(non_tara) - 5} more")
    
    # Status check
    print("\n" + "=" * 70)
    if to_add or to_remove:
        print("[!] BOARDS NOT IN SYNC")
        print()
        print("Next Steps:")
        if to_add:
            print(f"  1. Add {len(to_add)} items to SCHUNK project")
            print("     - Use GitHub UI or gh api graphql")
        if to_remove:
            print(f"  2. Remove {len(to_remove)} items from SCHUNK project")
            print("     - Use GitHub UI or gh api graphql")
        print("  3. Re-run this script to verify")
    else:
        print("[OK] BOARDS ARE IN SYNC!")
    print("=" * 70)


def main() -> int:
    """Main routine."""
    global DRY_RUN, VERBOSE, ITEM_LIMIT
    DRY_RUN = '--dry-run' in sys.argv
    VERBOSE = '--verbose' in sys.argv
    for arg in sys.argv:
        if arg.startswith('--limit='):
            ITEM_LIMIT = int(arg.split('=', 1)[1])
        elif arg == '--limit' and sys.argv.index(arg) + 1 < len(sys.argv):
            ITEM_LIMIT = int(sys.argv[sys.argv.index(arg) + 1])
    
    print("=" * 70)
    print("[SYNC] GitHub Project Board Mirror Analysis")
    print("        Bheowulf/Project#1 -> SCHUNK-SE-Co-KG/Project#4")
    print("=" * 70)
    print()
    
    try:
        # Fetch items
        print("Step 1: Fetching project items")
        print("-" * 70)
        bheowulf_items = fetch_project_items(BHEOWULF_OWNER, BHEOWULF_PROJECT)
        schunk_items = fetch_project_items(SCHUNK_OWNER, SCHUNK_PROJECT)
        
        # Analyze
        print("\nStep 2: Analyzing differences")
        print("-" * 70)
        analysis = analyze_sync(bheowulf_items, schunk_items)
        
        # Report
        print("\nStep 3: Generating report")
        print("-" * 70)
        print_sync_report(analysis)
        
        return 0
        
    except Exception as e:
        print(f"\n[FAIL] Sync analysis failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
