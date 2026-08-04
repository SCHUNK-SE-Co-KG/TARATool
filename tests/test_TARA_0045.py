"""Tests for TARA-0045: Accessibility checker (R-18)."""
import sys
import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


def _make_session(page, context, app_url):
    from tools.review_agent.runtime_scanner import ReviewSession
    return ReviewSession(
        page=page,
        context=context,
        report={
            "story_id": "TARA-0045",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0045
def test_accessibility_detects_unnamed_button(tmp_path):
    """Scanner should find button without accessible name."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<button></button>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.accessibility_checker import check_accessibility, get_accessibility_findings

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)
        page.wait_for_timeout(100)

        check_accessibility(session)
        findings = get_accessibility_findings(session)

        types = [f.get("type") for f in findings]
        assert "missing_accessible_name" in types, f"Expected missing_accessible_name in {types}"

        browser.close()
