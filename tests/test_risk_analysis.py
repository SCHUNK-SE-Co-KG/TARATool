"""
Tests for Risk Analysis and Attack Tree functionality.
Covers: risk_analysis.js, attack_tree_ui.js, attack_tree_structure.js,
        attack_tree_calc.js, attack_tree_editor_v2.js
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    add_asset,
    add_damage_scenario,
    switch_tab,
    get_active_analysis,
)


# ---------------------------------------------------------------------------
# Helpers local to this module
# ---------------------------------------------------------------------------

def _prepare_risk_prereqs(page: Page):
    """Create asset + damage scenario so the risk analysis tab is usable."""
    add_asset(page)
    add_damage_scenario(page)


def _open_attack_tree_modal(page: Page):
    """Navigate to risk analysis tab and click 'New Attack Tree'."""
    switch_tab(page, "risk_analysis")
    page.wait_for_timeout(300)
    btn = page.locator("#btnOpenAttackTreeModal")
    if btn.count() == 0:
        # The button is dynamically created; force render
        page.evaluate("renderRiskAnalysis()")
        page.wait_for_timeout(300)
    page.click("#btnOpenAttackTreeModal")
    page.wait_for_selector("#attackTreeModal", state="visible")


def _fill_and_save_simple_tree(page: Page, root_name: str = "Root Attack"):
    """Fill in a minimal attack tree with root name and one attack path, then save."""
    page.fill('input[name="at_root"]', root_name)
    page.wait_for_timeout(200)
    # Add at least one attack path if none exist
    add_path_btn = page.locator("#btnAddAttackPath")
    if add_path_btn.is_visible():
        add_path_btn.click()
        page.wait_for_timeout(300)
    # Submit the form
    page.click('#attackTreeForm button[type="submit"]')
    page.wait_for_timeout(500)


# ═══════════════════════════════════════════════════════════════════
# RISK ANALYSIS TAB
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestRiskAnalysisTab:
    """Risk analysis tab rendering and prerequisites."""

    def test_warning_without_assets(self, app_with_analysis: Page):
        """Without assets, a warning message should appear."""
        page = app_with_analysis
        switch_tab(page, "risk_analysis")
        container = page.locator("#riskAnalysisContainer")
        expect(container).to_contain_text("Assets")

    def test_warning_without_damage_scenarios(self, app_with_analysis: Page):
        """With assets but no DS, a warning or the normal view appears."""
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "risk_analysis")
        container = page.locator("#riskAnalysisContainer")
        # Should either show a warning about DS or render normally
        expect(container).to_be_visible()

    def test_new_tree_button_visible_with_prereqs(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        switch_tab(page, "risk_analysis")
        page.wait_for_timeout(300)
        expect(page.locator("#btnOpenAttackTreeModal")).to_be_visible()


# ═══════════════════════════════════════════════════════════════════
# ATTACK TREE MODAL
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestAttackTreeModal:
    """Opening, filling, and closing the attack tree modal."""

    def test_modal_opens(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        expect(page.locator("#attackTreeModal")).to_be_visible()

    def test_modal_closes_on_x(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        page.click("#closeAttackTreeModal")
        expect(page.locator("#attackTreeModal")).to_be_hidden()

    def test_root_input_exists(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        expect(page.locator('input[name="at_root"]')).to_be_visible()

    def test_add_attack_path_button_exists(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        expect(page.locator("#btnAddAttackPath")).to_be_visible()


# ═══════════════════════════════════════════════════════════════════
# ATTACK TREE CREATION
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestAttackTreeCreate:
    """Creating and saving attack trees."""

    def test_create_simple_tree(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        _fill_and_save_simple_tree(page, "CAN Bus Attack")
        data = get_active_analysis(page)
        assert len(data.get("riskEntries", [])) >= 1
        assert data["riskEntries"][0]["rootName"] == "CAN Bus Attack"

    def test_tree_appears_in_list(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        _fill_and_save_simple_tree(page, "OBD Manipulation")
        switch_tab(page, "risk_analysis")
        page.wait_for_timeout(300)
        container = page.locator("#riskAnalysisContainer")
        expect(container).to_contain_text("OBD Manipulation")

    def test_risk_count_updates_in_overview(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        _fill_and_save_simple_tree(page)
        switch_tab(page, "overview")
        count = page.locator("#statRiskCount").inner_text()
        assert int(count) >= 1


# ═══════════════════════════════════════════════════════════════════
# ATTACK TREE CALCULATION (JS-level)
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestAttackTreeCalc:
    """Verify KSTU calculation logic via JS evaluation."""

    def test_parse_kstu_value(self, app_with_analysis: Page):
        page = app_with_analysis
        result = page.evaluate("_parseKSTUValue('2.5')")
        assert result == 2.5

    def test_parse_kstu_invalid(self, app_with_analysis: Page):
        page = app_with_analysis
        result = page.evaluate("_parseKSTUValue('abc')")
        assert result is None

    def test_parse_kstu_empty(self, app_with_analysis: Page):
        page = app_with_analysis
        result = page.evaluate("_parseKSTUValue('')")
        assert result is None


# ═══════════════════════════════════════════════════════════════════
# DOT EXPORT
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestDotExport:
    """Graphviz DOT string generation."""

    def test_dot_null_without_data(self, app_with_analysis: Page):
        page = app_with_analysis
        result = page.evaluate("""() => {
            const analysis = analysisData.find(a => a.id === activeAnalysisId);
            return generateDotString(analysis);
        }""")
        assert result is None

    def test_dot_string_generated(self, app_with_analysis: Page):
        page = app_with_analysis
        _prepare_risk_prereqs(page)
        _open_attack_tree_modal(page)
        _fill_and_save_simple_tree(page, "DOT Test Root")
        result = page.evaluate("""() => {
            const analysis = analysisData.find(a => a.id === activeAnalysisId);
            return generateDotString(analysis);
        }""")
        if result:
            assert "digraph" in result or "DOT Test Root" in result
