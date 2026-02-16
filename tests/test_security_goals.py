"""
Tests for Security Goals (CRUD, attack tree referencing).
Covers: security_goals.js
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import (
    SAMPLE_SECURITY_GOAL,
    switch_tab,
    get_active_analysis,
    count_cards,
)


@pytest.mark.security_goals
class TestSecurityGoalCreate:
    """Creating security goals via modal."""

    def test_add_security_goal(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "security_goals")
        page.click("#btnAddSecurityGoal")
        page.wait_for_selector("#securityGoalModal", state="visible")
        page.fill("#sgName", SAMPLE_SECURITY_GOAL["name"])
        page.fill("#sgDescription", SAMPLE_SECURITY_GOAL["description"])
        page.click('#securityGoalForm button[type="submit"]')
        page.wait_for_timeout(300)
        data = get_active_analysis(page)
        assert len(data.get("securityGoals", [])) == 1
        assert data["securityGoals"][0]["name"] == SAMPLE_SECURITY_GOAL["name"]

    def test_security_goal_card_rendered(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "security_goals")
        page.click("#btnAddSecurityGoal")
        page.wait_for_selector("#securityGoalModal", state="visible")
        page.fill("#sgName", "Test Goal")
        page.click('#securityGoalForm button[type="submit"]')
        page.wait_for_timeout(300)
        n = count_cards(page, "securityGoalsCardContainer")
        assert n >= 1

    def test_modal_opens_and_closes(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "security_goals")
        page.click("#btnAddSecurityGoal")
        expect(page.locator("#securityGoalModal")).to_be_visible()
        page.click("#closeSecurityGoalModal")
        expect(page.locator("#securityGoalModal")).to_be_hidden()


@pytest.mark.security_goals
class TestSecurityGoalDelete:
    """Deleting a security goal."""

    def test_delete_goal(self, app_with_analysis: Page):
        page = app_with_analysis
        switch_tab(page, "security_goals")
        # Create one first
        page.click("#btnAddSecurityGoal")
        page.wait_for_selector("#securityGoalModal", state="visible")
        page.fill("#sgName", "Temp Goal")
        page.click('#securityGoalForm button[type="submit"]')
        page.wait_for_timeout(300)
        assert len(get_active_analysis(page).get("securityGoals", [])) == 1
        # Delete it
        page.locator("#securityGoalsCardContainer .asset-card").first.locator(
            'button:has-text("Löschen")'
        ).first.click()
        page.wait_for_selector("#confirmationModal", state="visible")
        page.click("#btnConfirmAction")
        page.wait_for_timeout(300)
        assert len(get_active_analysis(page).get("securityGoals", [])) == 0
