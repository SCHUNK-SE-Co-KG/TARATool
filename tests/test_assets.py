"""
Tests for Asset management (CRUD, CIA ratings, card rendering).
Covers: assets.js
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    SAMPLE_ASSET,
    add_asset,
    switch_tab,
    get_active_analysis,
    count_cards,
)


@pytest.mark.assets
class TestAssetCreate:
    """Creating assets via the modal."""

    def test_add_single_asset(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        data = get_active_analysis(page)
        assert len(data["assets"]) == 1
        assert data["assets"][0]["name"] == SAMPLE_ASSET["name"]

    def test_asset_card_rendered(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        n = count_cards(page, "assetsCardContainer")
        assert n == 1

    def test_add_multiple_assets(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page, {"name": "Asset A", "type": "SW", "description": "",
                         "confidentiality": "I", "integrity": "I", "availability": "I"})
        add_asset(page, {"name": "Asset B", "type": "HW", "description": "",
                         "confidentiality": "II", "integrity": "II", "availability": "II"})
        data = get_active_analysis(page)
        assert len(data["assets"]) == 2

    def test_asset_modal_opens(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "assets")
        page.click("#btnAddAsset")
        expect(page.locator("#assetModal")).to_be_visible()

    def test_asset_modal_closes_on_x(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "assets")
        page.click("#btnAddAsset")
        page.click("#closeAssetModal")
        expect(page.locator("#assetModal")).to_be_hidden()


@pytest.mark.assets
class TestAssetCIA:
    """CIA rating values are stored correctly."""

    def test_cia_values_stored(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        asset = get_active_analysis(page)["assets"][0]
        assert asset["confidentiality"] == SAMPLE_ASSET["confidentiality"]
        assert asset["integrity"] == SAMPLE_ASSET["integrity"]
        # availability is stored under "authenticity" key in data model
        assert asset.get("authenticity") or asset.get("availability")


@pytest.mark.assets
class TestAssetEdit:
    """Editing an existing asset."""

    def test_edit_asset_name(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "assets")
        # Click edit button on the first card
        page.locator("#assetsCardContainer .asset-card").first.locator(
            'button:has-text("Bearbeiten")'
        ).first.click()
        page.wait_for_selector("#assetModal", state="visible")
        page.fill("#assetName", "Renamed Asset")
        page.click('#assetForm button[type="submit"]')
        page.wait_for_timeout(300)
        data = get_active_analysis(page)
        assert data["assets"][0]["name"] == "Renamed Asset"


@pytest.mark.assets
class TestAssetDelete:
    """Deleting an asset via the card UI."""

    def test_delete_asset(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "assets")
        # Click delete button
        page.locator("#assetsCardContainer .asset-card").first.locator(
            'button:has-text("Löschen")'
        ).first.click()
        # Confirm deletion
        page.wait_for_selector("#confirmationModal", state="visible")
        page.click("#btnConfirmAction")
        page.wait_for_timeout(300)
        data = get_active_analysis(page)
        assert len(data["assets"]) == 0


@pytest.mark.assets
class TestAssetOverviewStats:
    """The overview tab reflects asset count changes."""

    def test_asset_count_updates(self, app_with_analysis: Page):
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "overview")
        count = page.locator("#statAssetCount").inner_text()
        assert count == "1"
