"""
End-to-end workflow test: full TARA lifecycle from analysis creation to report.
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    SAMPLE_ANALYSIS,
    SAMPLE_ASSET,
    SAMPLE_DAMAGE_SCENARIO,
    SAMPLE_SECURITY_GOAL,
    create_analysis,
    switch_tab,
    add_asset,
    add_damage_scenario,
    get_active_analysis,
    get_analysis_data,
    local_storage_data,
)


@pytest.mark.e2e
class TestFullWorkflow:
    """
    Simulates a complete user workflow:
      1. Create analysis → 2. Add metadata → 3. Add assets
      → 4. Add damage scenarios → 5. Create attack tree
      → 6. Add security goal → 7. Save → 8. Verify persistence
    """

    def test_complete_tara_workflow(self, app: Page):
        page = app

        # ── Step 1: Create analysis ──────────────────────────────
        create_analysis(page, SAMPLE_ANALYSIS["name"])
        data = get_analysis_data(page)
        assert len(data) >= 2, "Should have default + new analysis"

        # ── Step 2: Fill metadata (overview tab) ─────────────────
        switch_tab(page, "overview")
        page.fill("#inputAnalysisName", SAMPLE_ANALYSIS["name"])
        page.fill("#inputAuthorName", "Nico Peper")
        page.fill("#inputDescription", SAMPLE_ANALYSIS["description"])
        page.fill("#inputIntendedUse", SAMPLE_ANALYSIS["intendedUse"])
        page.press("#inputIntendedUse", "Tab")
        page.wait_for_timeout(200)

        active = get_active_analysis(page)
        assert active["metadata"]["author"] == "Nico Peper"

        # ── Step 3: Add assets ───────────────────────────────────
        add_asset(page, SAMPLE_ASSET)
        active = get_active_analysis(page)
        assert len(active["assets"]) == 1

        # ── Step 4: Add damage scenarios ─────────────────────────
        add_damage_scenario(page, SAMPLE_DAMAGE_SCENARIO)
        active = get_active_analysis(page)
        assert len(active["damageScenarios"]) >= 1

        # ── Step 5: Create attack tree ───────────────────────────
        switch_tab(page, "risk_analysis")
        page.wait_for_timeout(300)
        btn = page.locator("#btnOpenAttackTreeModal")
        if btn.count() > 0:
            btn.click()
            page.wait_for_selector("#attackTreeModal", state="visible")
            page.fill('input[name="at_root"]', "E2E Attack Root")
            page.wait_for_timeout(200)
            add_path = page.locator("#btnAddAttackPath")
            if add_path.is_visible():
                add_path.click()
                page.wait_for_timeout(300)
            page.click('#attackTreeForm button[type="submit"]')
            page.wait_for_timeout(500)
            active = get_active_analysis(page)
            assert len(active.get("riskEntries", [])) >= 1

        # ── Step 6: Add security goal ────────────────────────────
        switch_tab(page, "security_goals")
        page.click("#btnAddSecurityGoal")
        page.wait_for_selector("#securityGoalModal", state="visible")
        page.fill("#sgName", SAMPLE_SECURITY_GOAL["name"])
        page.fill("#sgDescription", SAMPLE_SECURITY_GOAL["description"])
        page.click('#securityGoalForm button[type="submit"]')
        page.wait_for_timeout(300)
        active = get_active_analysis(page)
        assert len(active.get("securityGoals", [])) == 1

        # ── Step 7: Save ─────────────────────────────────────────
        page.click("#btnSave")
        page.wait_for_timeout(300)

        # ── Step 8: Verify persistence ───────────────────────────
        stored = local_storage_data(page)
        assert len(stored) >= 2
        names = [a["name"] for a in stored]
        assert SAMPLE_ANALYSIS["name"] in names

        # ── Step 9: Check overview statistics ────────────────────
        switch_tab(page, "overview")
        assert page.locator("#statAssetCount").inner_text() == "1"

    def test_copy_analysis_workflow(self, app: Page):
        """Create an analysis, add data, then copy it to a new one."""
        page = app
        create_analysis(page, "Original")
        add_asset(page)
        add_damage_scenario(page)
        page.click("#btnSave")
        page.wait_for_timeout(300)

        # Create a copy
        create_analysis(page, "Copy of Original", copy_from="Original")
        active = get_active_analysis(page)
        assert active["name"] == "Copy of Original"
        # Copied analysis should have the same assets
        assert len(active["assets"]) == 1

    def test_multi_analysis_isolation(self, app: Page):
        """Data in one analysis must not bleed into another."""
        page = app
        create_analysis(page, "Analysis Alpha")
        add_asset(page, {"name": "Alpha Asset", "type": "HW", "description": "",
                         "confidentiality": "I", "integrity": "I", "availability": "I"})

        create_analysis(page, "Analysis Beta")
        active = get_active_analysis(page)
        assert active["name"] == "Analysis Beta"
        assert len(active["assets"]) == 0, "New analysis should have no assets"
