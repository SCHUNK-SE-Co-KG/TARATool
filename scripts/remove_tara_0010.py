#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Remove single item TARA-0010 from SCHUNK project."""

import json
import subprocess

# Get all SCHUNK items
result = subprocess.run(
    ['gh', 'project', 'item-list', '4', '--owner', 'SCHUNK-SE-Co-KG', '--format', 'json'],
    capture_output=True,
    text=False,
    check=False
)

data = json.loads(result.stdout.decode('utf-8', errors='ignore'))
items = data.get('items', [])

# Find TARA-0010
tara_0010 = None
for item in items:
    if 'TARA-0010' in item.get('title', ''):
        tara_0010 = item
        break

if tara_0010:
    item_id = tara_0010['id']
    print(f"Found TARA-0010: {tara_0010['title']}")
    print(f"Item ID: {item_id}")
    print("Removing from SCHUNK project...")
    
    mutation = f'''
    mutation {{
      deleteProjectV2Item(input: {{
        projectId: "PVT_kwDOBu4dv84BfbaR"
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
    print(output)
    
    if 'errors' not in output:
        print("\n[OK] TARA-0010 removed successfully!")
    else:
        print("\n[FAIL] Error removing item")
else:
    print("TARA-0010 not found in SCHUNK project")
