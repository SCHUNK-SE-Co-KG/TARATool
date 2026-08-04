"""Tests for TARA-0054: Clickjacking and Reverse Tabnabbing (R-27/28)."""
import sys
import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


def _make_session(page, context, app_url):
    from agents.review_agent.runtime_scanner import ReviewSession
    return ReviewSession(
        page=page,
        context=context,
        report={
            "story_id": "TARA-0054",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0054
def test_tabnabbing_detects_missing_noopener(tmp_path):
    """Scanner should detect _blank link without noopener noreferrer."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<a target="_blank" href="https://example.com">Link</a>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from agents.review_agent.clickjacking_checker import check_reverse_tabnabbing

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)
        page.wait_for_timeout(100)

        findings = check_reverse_tabnabbing(session)
        types = [f.get("type") for f in findings]

        assert "reverse_tabnabbing" in types, f"Expected reverse_tabnabbing in {types}"

        browser.close()
