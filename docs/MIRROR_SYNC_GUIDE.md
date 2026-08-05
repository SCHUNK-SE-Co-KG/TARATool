# GitHub Project Board Mirror Sync
## Bheowulf/Project#1 ⟷ SCHUNK-SE-Co-KG/Project#4

---

## Overview

The TARATool project maintains two GitHub repositories:
- **Bheowulf/TARATool** — Primary repository and source of truth
- **SCHUNK-SE-Co-KG/TARATool** — Mirror/secondary repository

Both repositories should have synchronized project board content to maintain consistency.

---

## Project IDs

| Component | Bheowulf | SCHUNK-SE-Co-KG | Notes |
|-----------|----------|-----------------|-------|
| **Repository** | Bheowulf/TARATool | SCHUNK-SE-Co-KG/TARATool | Both contain same code |
| **Project** | Project #1 | Project #4 | Different project numbers |
| **Project ID** | `PVT_kwHOBLN4284BfLtb` | (See query below) | Different base IDs |

### Querying Project IDs

```bash
# Bheowulf Project ID
gh api repos/Bheowulf/TARATool/projects --jq '.[] | select(.name=="TARATool Überarbeitung") | .id'

# SCHUNK Project ID
gh api repos/SCHUNK-SE-Co-KG/TARATool/projects --jq '.[] | .id, .name'
```

---

## Sync Architecture

### Content Scope

**Items that sync (identical in both boards):**
- All TARA-XXXX work items (epics, stories, bugs)
- Status fields and progress
- Story points
- Labels

**Items that DON'T sync:**
- `[PROCESS-GUARD]` violation markers (Bheowulf only)
- CVE Monthly Report items (Bheowulf only)
- SCHUNK-specific administrative tasks (if any)

### Mapping Strategy

Items are matched by **TARA-ID** extracted from titles:
- Bheowulf: `[TARA-0042] STORY: Example`
- SCHUNK:   `[MIRROR] [TARA-0042] STORY: Example`

The `[MIRROR]` prefix is:
- ✅ Added automatically on SCHUNK items for clarity
- ⚠️ Not part of the sync matching logic
- 📋 Can be removed if sync is automated

---

## Automated Sync

### GitHub Workflow

File: `.github/workflows/mirror-sync.yml`

**Runs:**
- Daily at 02:00 UTC (03:00 CET)
- On manual trigger (workflow_dispatch)
- On certain issue/PR events (optional)

**What it does:**
1. Fetches items from both project boards
2. Compares TARA-ID mappings
3. Reports differences
4. Creates summary in Actions logs

**What it doesn't do:**
- ❌ Auto-modify project boards (requires GraphQL mutations)
- ❌ Auto-close issues (requires explicit code)

### Manual Sync via Script

```bash
# Analyze sync status (read-only)
python scripts/sync_project_boards.py

# Verbose output
python scripts/sync_project_boards.py --verbose

# Dry-run mode
python scripts/sync_project_boards.py --dry-run
```

**Output:**
- Lists items to ADD to SCHUNK
- Lists items to REMOVE from SCHUNK
- Shows non-TARA items (CVE reports, etc)
- Provides next steps

---

## Manual Synchronization

When the script shows items out of sync, you can manually sync using GitHub's UI or CLI.

### Option 1: GitHub UI (Recommended for occasional syncs)

1. Open Bheowulf Project: https://github.com/users/Bheowulf/projects/1
2. Open SCHUNK Project: https://github.com/orgs/SCHUNK-SE-Co-KG/projects/4
3. Side-by-side, add/remove items as needed
4. Re-run script to verify

### Option 2: GitHub CLI (gh) + GraphQL

#### Add an issue to SCHUNK project:

```bash
# Get the issue node ID
ISSUE_NODE_ID=$(gh issue view 42 --repo Bheowulf/TARATool --json id --jq .id)

# Add to SCHUNK project
gh api graphql -f query='
  mutation {
    addProjectV2ItemById(input: {
      projectId: "PVT_..." 
      contentId: "'$ISSUE_NODE_ID'"
    }) {
      item { id }
    }
  }
'
```

#### Remove an item from SCHUNK project:

```bash
# Get the project item ID from SCHUNK project
ITEM_ID="PVTI_..."

gh api graphql -f query='
  mutation {
    deleteProjectV2Item(input: {
      projectId: "PVT_..."
      itemId: "'$ITEM_ID'"
    }) {
      deletedItemId
    }
  }
'
```

#### Get SCHUNK Project ID:

```bash
gh api repos/SCHUNK-SE-Co-KG/TARATool/projects \
  --jq '.[] | select(.name | contains("TARATool")) | .id'
```

---

## Current Sync Status

Last checked: **2026-08-05 10:05 UTC+2**

**Discrepancies Found:**
- ❌ **18 items missing in SCHUNK** (TARA-0001 to TARA-0025)
- ❌ **24 items extra in SCHUNK** (TARA-0032 to TARA-0055)
- ⚠️ **[MIRROR] prefix inconsistency** (not all have it)
- ⚠️ **Item order reversed** in SCHUNK

### Why Out of Sync?

1. **Historical Content**
   - TARA-0001 to TARA-0025 existed before SCHUNK mirror was created
   - Never synced to SCHUNK initially

2. **Divergent Development**
   - TARA-0032 to TARA-0055 may have been created only in SCHUNK
   - Or created in both but with different timing

3. **Non-Mirrored Items**
   - `[PROCESS-GUARD]` markers are Bheowulf-only (workflow governance)
   - CVE Monthly Report items are Bheowulf-only (not part of backlog)

---

## Reconciliation Plan

### Phase 1: Decide on Content Scope

**Decision needed:** Should SCHUNK mirror contain:

```
Option A: Everything (all TARA-IDs, all CVE reports, [PROCESS-GUARD] items)
Option B: TARA-IDs only (no process guards, no CVE reports)
Option C: Recent items only (TARA-XXXX from cutoff date forward)
```

**Recommendation:** Option B
- SCHUNK should contain all work items (TARA-IDs)
- Process violations are Bheowulf internal process tracking
- CVE reports are advisory, not development items

### Phase 2: Execute Sync

Using script analysis:

1. **Add 18 items to SCHUNK:**
   - TARA-0001 to TARA-0025 (minus overlap)
   - Use GitHub UI or `gh api graphql`

2. **Remove 24 items from SCHUNK:**
   - TARA-0032 to TARA-0055 (or keep if they're valid)
   - Check with team first!

3. **Standardize [MIRROR] prefix:**
   - Apply consistently to all SCHUNK items
   - Or remove if moving to full automation

### Phase 3: Verify Sync

```bash
python scripts/sync_project_boards.py
```

Expected output:
```
[OK] BOARDS ARE IN SYNC!
```

---

## Troubleshooting

### Script fails with encoding errors

**Issue:** `UnicodeDecodeError` on Windows when running sync script

**Solution:**
```bash
set PYTHONIOENCODING=utf-8
python scripts/sync_project_boards.py
```

Or use wrapper batch file:
```bash
scripts/sync_project_boards.bat
```

### gh command not found

**Issue:** `gh` CLI is not installed or not in PATH

**Solution:**
```bash
# Install GitHub CLI
winget install GitHub.cli  # Windows
brew install gh            # macOS
sudo apt install gh        # Linux
```

### Permission denied

**Issue:** Cannot access SCHUNK project boards

**Solution:**
1. Ensure GitHub token has `projects:write` scope
2. Add token: `gh auth login`
3. Verify: `gh auth status`

### Items show in script but not in UI

**Issue:** Script says items are missing but GitHub UI shows them

**Solution:**
- Force refresh: `F5` in browser
- Clear gh CLI cache: `rm -rf ~/.cache/gh`
- Re-run script: `python scripts/sync_project_boards.py`

---

## Automation Roadmap

### Current (Manual + Monitoring)
- ✅ Script analyzes differences
- ✅ GitHub Workflow reports status daily
- ⚠️ Manual sync required

### Planned (Full Automation)
- 📋 GraphQL mutation for auto-add items
- 📋 GraphQL mutation for auto-remove items
- 📋 Scheduled sync running daily
- 📋 Auto-comment on issues when sync'd to SCHUNK

### Not Planned (By Design)
- 🚫 Auto-close issues
- 🚫 Auto-update status without manual review
- 🚫 Mirror deletions back to Bheowulf

---

## Git Sync

**Code Sync:** ✅ Already configured

Both repositories pull from the same source. Use git remotes:

```bash
git remote -v
# origin   → Bheowulf/TARATool
# schunk   → SCHUNK-SE-Co-KG/TARATool

# Push to both:
git push origin main
git push schunk main
```

**Project Board Sync:** ⏳ In progress (this document)

---

## References

- [GitHub Projects API Docs](https://docs.github.com/en/graphql-core/reference/mutations/addprojectv2itembyid)
- [GitHub Projects REST API](https://docs.github.com/en/rest/projects)
- [gh CLI Documentation](https://cli.github.com/)
- Sync Script: `scripts/sync_project_boards.py`
- Audit Report: `MIRROR_SYNC_AUDIT_REPORT.md`

---

**Last Updated:** 2026-08-05
**Status:** Ready for implementation
**Owner:** @NicoPeperSchunk
