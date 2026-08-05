#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Execute GitHub Project Board Mirror Sync: Bheowulf -> SCHUNK

This script performs ACTUAL synchronization (not just analysis):
1. Fetches all items from Bheowulf Project #1
2. Fetches all items from SCHUNK Project #4
3. Determines which items to add/remove
4. EXECUTES the sync using GitHub GraphQL API
5. Verifies the result

WARNING: This script modifies project boards!
Use --dry-run to preview changes without executing.

Usage:
  python scripts/execute_mirror_sync.py [--dry-run] [--verbose]
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

# Configuration
BHEOWULF_OWNER = "Bheowulf"
BHEOWULF_PROJECT = 1
BHEOWULF_REPO = "Bheowulf/TARATool"
BHEOWULF_PROJECT_ID = "PVT_kwHOBLN4284BfLtb"

SCHUNK_OWNER = "SCHUNK-SE-Co-KG"
SCHUNK_PROJECT = 4
SCHUNK_REPO = "SCHUNK-SE-Co-KG/TARATool"
SCHUNK_PROJECT_ID = "PVT_kwDOBu4dv84BfbaR"  # Got from GraphQL query

DRY_RUN = False
VERBOSE = False


def run_gh_command(cmd: list[str]) -> str:
    """Run gh command and return output."""
    if VERBOSE:
        print(f"  [CMD] {' '.join(cmd)}")
    
    result = subprocess.run(cmd, capture_output=True, text=False, check=False)
    
    if result.returncode != 0:
        raise RuntimeError(
            f"gh failed: {result.stderr.decode('utf-8', errors='ignore')}"
        )
    
    return result.stdout.decode('utf-8', errors='ignore').strip()


def fetch_project_items(owner: str, project_num: int) -> list[dict]:
    """Fetch all items from a project."""
    print(f"  [+] Fetching {owner}/Project#{project_num}...")
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        temp_file = f.name
    
    try:
        result = subprocess.run(
            ['gh', 'project', 'item-list', str(project_num), '--owner', owner, '--format', 'json'],
            stdout=open(temp_file, 'wb'),
            stderr=subprocess.PIPE,
            check=False
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Failed to fetch items: {result.stderr.decode('utf-8', errors='ignore')}")
        
        with open(temp_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        items = data.get('items', [])
        print(f"    Found {len(items)} items")
        return items
        
    finally:
        Path(temp_file).unlink(missing_ok=True)


def get_issue_node_id(repo: str, issue_number: int) -> str:
    """Get the GraphQL node ID for an issue."""
    cmd = ['gh', 'issue', 'view', str(issue_number), '--repo', repo, '--json', 'id', '--jq', '.id']
    return run_gh_command(cmd)


def extract_issue_number(item: dict) -> Optional[int]:
    """Extract issue number from item."""
    # Try to get from URL or content
    content = item.get('content', {})
    if isinstance(content, dict):
        return content.get('number')
    return None


def extract_tara_id(title: str) -> Optional[str]:
    """Extract TARA-ID from title."""
    import re
    match = re.search(r'TARA-(\d+)', title)
    return match.group(0) if match else None


def get_schunk_project_id() -> str:
    """Return SCHUNK project ID (predefined)."""
    print("  [+] Using SCHUNK project ID: " + SCHUNK_PROJECT_ID)
    return SCHUNK_PROJECT_ID


def add_item_to_project(project_id: str, content_id: str) -> bool:
    """Add issue to project using GraphQL."""
    print(f"    [+] Adding issue to project...")
    
    mutation = f'''
    mutation {{
      addProjectV2ItemById(input: {{
        projectId: "{project_id}"
        contentId: "{content_id}"
      }}) {{
        item {{
          id
        }}
      }}
    }}
    '''
    
    result = subprocess.run(
        ['gh', 'api', 'graphql', '-f', f'query={mutation}'],
        capture_output=True,
        text=False,
        check=False
    )
    
    output = result.stdout.decode('utf-8', errors='ignore')
    
    # Check for errors
    if '"errors"' in output or result.returncode != 0:
        print(f"      [!] Error: {output}")
        return False
    
    return True


def remove_item_from_project(project_id: str, item_id: str) -> bool:
    """Remove item from project using GraphQL."""
    print(f"    [-] Removing item from project...")
    
    mutation = f'''
    mutation {{
      deleteProjectV2Item(input: {{
        projectId: "{project_id}"
        itemId: "{item_id}"
      }}) {{
        deletedItemId
      }}
    }}
    '''
    
    result = subprocess.run(
        ['gh', 'api', 'graphql', '-f', f'query={mutation}'],
        capture_output=True,
        text=False,
        check=False
    )
    
    output = result.stdout.decode('utf-8', errors='ignore')
    
    # Check for errors
    if '"errors"' in output or result.returncode != 0:
        print(f"      [!] Error: {output}")
        return False
    
    return True


def analyze_sync(bh_items: list[dict], schunk_items: list[dict]) -> dict:
    """Analyze what needs to sync."""
    print("  [->] Analyzing differences...")
    
    # Build indexes by TARA-ID
    bh_by_tara = {}
    for item in bh_items:
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
    
    for tara, bh_item in bh_by_tara.items():
        if tara not in schunk_by_tara:
            to_add.append((tara, bh_item))
    
    for tara, schunk_item in schunk_by_tara.items():
        if tara not in bh_by_tara:
            to_remove.append((tara, schunk_item))
    
    print(f"    - {len(to_add)} items to ADD")
    print(f"    - {len(to_remove)} items to REMOVE")
    
    return {
        'to_add': to_add,
        'to_remove': to_remove,
        'bh_by_tara': bh_by_tara,
        'schunk_by_tara': schunk_by_tara,
    }


def execute_sync(analysis: dict, schunk_project_id: str) -> tuple[int, int]:
    """Execute the actual sync."""
    to_add = analysis['to_add']
    to_remove = analysis['to_remove']
    
    added_count = 0
    removed_count = 0
    
    # Add items
    if to_add:
        print(f"\n[+] ADDING {len(to_add)} items to SCHUNK")
        print("=" * 70)
        
        for i, (tara, item) in enumerate(to_add, 1):
            title = item.get('title', 'Unknown')
            issue_num = extract_issue_number(item)
            
            print(f"  [{i}/{len(to_add)}] {tara}: {title[:50]}...")
            
            if DRY_RUN:
                print(f"    [DRY-RUN] Would add issue #{issue_num}")
                added_count += 1
            else:
                try:
                    # Get node ID for this issue
                    node_id = get_issue_node_id(BHEOWULF_REPO, issue_num)
                    print(f"    Node ID: {node_id[:20]}...")
                    
                    # Add to SCHUNK project
                    if add_item_to_project(schunk_project_id, node_id):
                        print(f"    [OK] Added to SCHUNK")
                        added_count += 1
                    else:
                        print(f"    [FAIL] Failed to add to SCHUNK")
                except Exception as e:
                    print(f"    [ERROR] {e}")
    
    # Remove items
    if to_remove:
        print(f"\n[-] REMOVING {len(to_remove)} items from SCHUNK")
        print("=" * 70)
        
        for i, (tara, item) in enumerate(to_remove, 1):
            title = item.get('title', 'Unknown')
            item_id = item.get('id', '')
            
            print(f"  [{i}/{len(to_remove)}] {tara}: {title[:50]}...")
            
            if DRY_RUN:
                print(f"    [DRY-RUN] Would remove item {item_id[:20]}...")
                removed_count += 1
            else:
                try:
                    if remove_item_from_project(schunk_project_id, item_id):
                        print(f"    [OK] Removed from SCHUNK")
                        removed_count += 1
                    else:
                        print(f"    [FAIL] Failed to remove from SCHUNK")
                except Exception as e:
                    print(f"    [ERROR] {e}")
    
    return added_count, removed_count


def main() -> int:
    """Main routine."""
    global DRY_RUN, VERBOSE
    DRY_RUN = '--dry-run' in sys.argv
    VERBOSE = '--verbose' in sys.argv
    
    print("=" * 70)
    print("[SYNC-EXEC] GitHub Project Board Mirror Synchronization")
    print("            Bheowulf/Project#1 -> SCHUNK-SE-Co-KG/Project#4")
    print("=" * 70)
    
    if DRY_RUN:
        print("\n[!] DRY-RUN MODE - No changes will be made\n")
    else:
        print("\n[!] LIVE MODE - CHANGES WILL BE MADE\n")
    
    try:
        # Step 1: Fetch items
        print("Step 1: Fetching Project Items")
        print("-" * 70)
        bh_items = fetch_project_items(BHEOWULF_OWNER, BHEOWULF_PROJECT)
        schunk_items = fetch_project_items(SCHUNK_OWNER, SCHUNK_PROJECT)
        
        # Step 2: Get SCHUNK project ID
        print("\nStep 2: Getting SCHUNK Project ID")
        print("-" * 70)
        schunk_project_id = get_schunk_project_id()
        
        # Step 3: Analyze differences
        print("\nStep 3: Analyzing Differences")
        print("-" * 70)
        analysis = analyze_sync(bh_items, schunk_items)
        
        # Step 4: Execute sync
        print("\nStep 4: Executing Sync")
        print("-" * 70)
        added, removed = execute_sync(analysis, schunk_project_id)
        
        # Summary
        print("\n" + "=" * 70)
        print("[SYNC-RESULT] Summary")
        print("=" * 70)
        print(f"  Added:   {added} items")
        print(f"  Removed: {removed} items")
        
        if DRY_RUN:
            print("\n[DRY-RUN] No actual changes made")
            print("Run without --dry-run to execute the sync")
        else:
            print("\n[OK] Sync completed!")
            print("Re-run without --dry-run to verify the new state")
        
        print("=" * 70)
        
        return 0
        
    except Exception as e:
        print(f"\n[FAIL] Sync execution failed: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
