"""
Tests for Damage Scenario management and Impact Matrix.
Covers: damage_scenarios.js, impact_matrix.js

NOTE: Every new analysis starts with 5 default damage scenarios (DS1–DS5).
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    SAMPLE_DAMAGE_SCENARIO,
    SAMPLE_ASSET,
    add_asset,
    add_damage_scenario,
    switch_tab,
    get_active_analysis,
)

DEFAULT_DS_COUNT = 5  # DS1–DS5 are always present


# ═══════════════════════════════════════════════════════════════════
# DAMAGE SCENARIOS – CRUD
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.damage_scenarios
class TestDamageScenarioCreate:
    """Creating damage scenarios."""

    def test_add_damage_scenario(self, app_with_analysis: Page):
        page = app_with_analysis
        add_damage_scenario(page)
        data = get_active_analysis(page)
        assert len(data["damageScenarios"]) == DEFAULT_DS_COUNT + 1
        names = [ds["name"] for ds in data["damageScenarios"]]
        assert SAMPLE_DAMAGE_SCENARIO["name"] in names

    def test_ds_short_stored(self, app_with_analysis: Page):
        page = app_with_analysis
        add_damage_scenario(page)
        data = get_active_analysis(page)
        # Find the added DS by name
        added = [ds for ds in data["damageScenarios"]
                 if ds["name"] == SAMPLE_DAMAGE_SCENARIO["name"]]
        assert len(added) == 1
        assert added[0]["short"] == SAMPLE_DAMAGE_SCENARIO["short"]

    def test_add_multiple_scenarios(self, app_with_analysis: Page):
        page = app_with_analysis
        add_damage_scenario(page, {"name": "DS One", "short": "DS1x", "description": ""})
        add_damage_scenario(page, {"name": "DS Two", "short": "DS2x", "description": ""})
        data = get_active_analysis(page)
        assert len(data["damageScenarios"]) == DEFAULT_DS_COUNT + 2

    def test_ds_modal_opens(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "damage_scenarios")
        page.click("#btnAddDamageScenario")
        expect(page.locator("#damageScenarioModal")).to_be_visible()

    def test_ds_modal_closes_on_x(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "damage_scenarios")
        page.click("#btnAddDamageScenario")
        page.click("#closeDamageScenarioModal")
        expect(page.locator("#damageScenarioModal")).to_be_hidden()


@pytest.mark.damage_scenarios
class TestDamageScenarioDelete:
    """Deleting a damage scenario (only custom DS can be deleted)."""

    def test_delete_scenario(self, app_with_analysis: Page):
        page = app_with_analysis
        add_damage_scenario(page)
        switch_tab(page, "damage_scenarios")
        # Only non-default DS have delete buttons; click the one that has it
        page.locator('#dsManagementContainer button:has-text("Löschen")').first.click()
        page.wait_for_selector("#confirmationModal", state="visible")
        page.click("#btnConfirmAction")
        page.wait_for_timeout(300)
        data = get_active_analysis(page)
        assert len(data["damageScenarios"]) == DEFAULT_DS_COUNT


@pytest.mark.damage_scenarios
class TestDamageScenarioOverview:
    """Overview stats reflect DS count."""

    def test_ds_count_updates(self, app_with_analysis: Page):
        page = app_with_analysis
        add_damage_scenario(page)
        switch_tab(page, "overview")
        count = page.locator("#statDSCount").inner_text()
        assert count == str(DEFAULT_DS_COUNT + 1)


# ═══════════════════════════════════════════════════════════════════
# IMPACT MATRIX
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.damage_scenarios
class TestImpactMatrix:
    """The impact matrix should render when assets and DS both exist."""

    def test_matrix_renders_with_data(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        add_damage_scenario(page)
        switch_tab(page, "damage_scenarios")
        matrix = page.locator("#dsMatrixContainer")
        expect(matrix).to_be_visible()
        # Matrix should contain at least one table/row
        cells = matrix.locator("table, select, td")
        assert cells.count() > 0

    def test_matrix_empty_without_assets(self, app_with_analysis: Page):
        page = app_with_analysis
        add_damage_scenario(page)
        switch_tab(page, "damage_scenarios")
        matrix = page.locator("#dsMatrixContainer")
        # Should either be empty or show a message
        tables = matrix.locator("table")
        # No impact matrix table without assets
        assert tables.count() == 0 or "Keine" in matrix.inner_text() or matrix.inner_text().strip() == ""

    def test_matrix_value_change_persists(self, app_with_analysis: Page):
        """Changing a value in the impact matrix should update the data model."""
        page = app_with_analysis
        add_asset(page)
        add_damage_scenario(page)
        switch_tab(page, "damage_scenarios")
        # Find first select in the matrix and change it
        selects = page.locator("#dsMatrixContainer select")
        if selects.count() > 0:
            selects.first.select_option("3")
            page.wait_for_timeout(300)
            data = get_active_analysis(page)
            matrix = data.get("impactMatrix", {})
            # At least one value should be "3" now
            has_three = any(
                v == "3" or v == 3
                for row in matrix.values()
                for v in (row.values() if isinstance(row, dict) else [row])
            )
            assert has_three
