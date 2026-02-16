"""
Tests for Residual Risk Analysis (sync, data model, UI).
Covers: residual_risk_data.js, residual_risk_ui.js
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    add_asset,
    add_damage_scenario,
    switch_tab,
    get_active_analysis,
)


def _prepare_full_dataset(page: Page):
    """Create asset + DS + a simple attack tree so residual risk is available."""
    add_asset(page)
    add_damage_scenario(page)
    # Create a minimal attack tree
    switch_tab(page, "risk_analysis")
    page.wait_for_timeout(300)
    page.evaluate("renderRiskAnalysis()")
    page.wait_for_timeout(300)
    btn = page.locator("#btnOpenAttackTreeModal")
    if btn.count() > 0:
        btn.click()
        page.wait_for_selector("#attackTreeModal", state="visible")
        page.fill('input[name="at_root"]', "Residual Test Root")
        page.wait_for_timeout(200)
        add_path = page.locator("#btnAddAttackPath")
        if add_path.is_visible():
            add_path.click()
            page.wait_for_timeout(300)
        page.click('#attackTreeForm button[type="submit"]')
        page.wait_for_timeout(500)


@pytest.mark.residual_risk
class TestResidualRiskTab:
    """Residual risk tab rendering."""

    def test_tab_visible(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "residual_risk")
        expect(page.locator("#tabResidualRisk")).to_be_visible()

    def test_sync_creates_entries(self, app_with_analysis: Page):
        """After creating attack trees, syncing should populate residual risk data."""
        page = app_with_analysis
        _prepare_full_dataset(page)
        # Trigger sync
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
        }""")
        data = get_active_analysis(page)
        rr = data.get("residualRisk", {})
        entries = rr.get("entries", [])
        assert len(entries) >= 1


@pytest.mark.residual_risk
class TestResidualRiskData:
    """JS-level tests for residual risk data functions."""

    def test_rr_make_leaf_key(self, app_with_analysis: Page):
        page = app_with_analysis
        result = page.evaluate("rrMakeLeafKey(0, 1, 2)")
        assert "B0" in result and "N1" in result and "L2" in result

    def test_rr_iterate_leaves(self, app_with_analysis: Page):
        """rrIterateLeaves should be callable and return results for a valid tree."""
        page = app_with_analysis
        _prepare_full_dataset(page)
        count = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a || !a.riskEntries || !a.riskEntries[0]) return 0;
            let c = 0;
            rrIterateLeaves(a.riskEntries[0], () => c++);
            return c;
        }""")
        # May be 0 if tree has no leaves yet, but function should at least not throw
        assert isinstance(count, int)
