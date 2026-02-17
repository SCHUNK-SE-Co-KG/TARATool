"""
@file        conftest.py
@description Shared fixtures, helper functions, and configuration for all
             Playwright-based E2E tests of the TARATool application.
@author      Nico Peper
@organization SCHUNK SE & Co. KG
@copyright   2026 SCHUNK SE & Co. KG
@license     GPL-3.0
"""

import json
import pytest
from pathlib import Path
from playwright.sync_api import Page, BrowserContext, expect

# Prevent pytest from collecting non-Python files matching test_* patterns
collect_ignore_glob = ["*.txt", "*.html", "*.json", "*.bat"]

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Resolve the project root (one level up from /tests)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_URL = f"file:///{PROJECT_ROOT.as_posix()}/index.html"

# DOM-ID constants used across many tests
TAB_IDS = {
    "overview":          "tabOverview",
    "assets":            "tabAssets",
    "damage_scenarios":  "tabDamageScenarios",
    "risk_analysis":     "tabRiskAnalysis",
    "security_goals":    "tabSecurityGoals",
    "residual_risk":     "tabResidualRisk",
}

# ---------------------------------------------------------------------------
# Sample data factories
# ---------------------------------------------------------------------------

SAMPLE_ANALYSIS = {
    "name":        "Test Analysis",
    "author":      "Test Author",
    "description": "Automated test analysis",
    "intendedUse": "Testing purposes only",
}

SAMPLE_ASSET = {
    "name":            "ECU Gateway",
    "type":            "Hardware",
    "description":     "Central ECU for vehicle network",
    "confidentiality": "III",
    "integrity":       "II",
    "availability":    "III",
}

SAMPLE_DAMAGE_SCENARIO = {
    "name":        "Data breach via CAN bus",
    "short":       "DS-CAN",
    "description": "Unauthorized CAN bus message injection leading to data leak",
}

SAMPLE_SECURITY_GOAL = {
    "name":        "Protect ECU integrity",
    "description": "Ensure no unauthorized firmware modifications",
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Grant file:// permissions and set viewport."""
    return {
        **browser_context_args,
        "viewport": {"width": 1400, "height": 900},
    }


@pytest.fixture()
def app(page: Page):
    """
    Navigate to TARATool. Each test gets a fresh browser context
    (Playwright default), so localStorage is already empty.
    The app auto-creates a default analysis on first load.
    Returns the Playwright ``Page`` object.
    """
    page.goto(APP_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    return page


@pytest.fixture()
def app_with_analysis(app: Page):
    """
    Provide an app instance with the default analysis already active.
    The default analysis name is 'Neue Analyse' (created automatically).
    Returns the Page object.
    """
    return app


# ---------------------------------------------------------------------------
# Helper functions (importable by test modules)
# ---------------------------------------------------------------------------

def create_analysis(page: Page, name: str, copy_from: str | None = None):
    """Click 'New Analysis', fill the name, and submit."""
    page.click("#btnNewAnalysis")
    page.wait_for_selector("#newAnalysisModal", state="visible")
    page.fill("#newAnalysisName", name)
    if copy_from:
        page.click("#btnToggleCopyExistingAnalysis")
        page.select_option("#copyExistingAnalysisSelect", label=copy_from)
    page.click('#newAnalysisForm button[type="submit"]')
    page.wait_for_timeout(300)


def switch_tab(page: Page, tab_key: str):
    """Switch to one of the main tabs by key (e.g. 'assets', 'risk_analysis')."""
    tab_id = TAB_IDS[tab_key]
    page.click(f'.tab-button[data-tab="{tab_id}"]')
    page.wait_for_timeout(200)


def add_asset(page: Page, asset: dict | None = None):
    """Open the asset modal, fill the form, and save."""
    data = asset or SAMPLE_ASSET
    switch_tab(page, "assets")
    page.click("#btnAddAsset")
    page.wait_for_selector("#assetModal", state="visible")
    page.fill("#assetName", data["name"])
    page.fill("#assetType", data.get("type", ""))
    page.fill("#assetDescription", data.get("description", ""))
    # CIA radio buttons
    for criterion in ("confidentiality", "integrity"):
        val = data.get(criterion, "I")
        page.click(f'input[name="{criterion}"][value="{val}"]')
    # "authenticity" is the radio-group name for availability in the UI
    avail = data.get("availability", "I")
    page.click(f'input[name="authenticity"][value="{avail}"]')
    page.click('#assetForm button[type="submit"]')
    page.wait_for_timeout(300)


def add_damage_scenario(page: Page, ds: dict | None = None):
    """Open the damage scenario modal, fill the form, and save."""
    data = ds or SAMPLE_DAMAGE_SCENARIO
    switch_tab(page, "damage_scenarios")
    page.click("#btnAddDamageScenario")
    page.wait_for_selector("#damageScenarioModal", state="visible")
    page.fill("#dsName", data["name"])
    page.fill("#dsShort", data["short"])
    page.fill("#dsDescription", data.get("description", ""))
    page.click('#damageScenarioForm button[type="submit"]')
    page.wait_for_timeout(300)


def get_analysis_data(page: Page) -> list[dict]:
    """Read the full analysisData array from the browser context."""
    return page.evaluate("() => JSON.parse(JSON.stringify(analysisData))")


def get_active_analysis(page: Page) -> dict:
    """Return the currently active analysis object."""
    return page.evaluate("""() => {
        const a = analysisData.find(x => x.id === activeAnalysisId);
        return a ? JSON.parse(JSON.stringify(a)) : null;
    }""")


def count_cards(page: Page, container_id: str) -> int:
    """Count the number of .asset-card elements inside a container."""
    return page.locator(f"#{container_id} .asset-card").count()


def get_toast_text(page: Page) -> str:
    """Return text of the most recent toast notification (if visible)."""
    toast = page.locator("#toastContainer .toast").last
    if toast.is_visible():
        return toast.inner_text()
    return ""


def local_storage_data(page: Page) -> list[dict]:
    """Read the persisted analyses from localStorage."""
    raw = page.evaluate("() => localStorage.getItem('taraAnalyses')")
    return json.loads(raw) if raw else []
