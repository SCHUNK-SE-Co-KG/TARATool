"""Tests for TARA-0055: Storage deep scan + XSSI (R-29/30)."""
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
            "story_id": "TARA-0055",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0055
def test_sri_checker_detects_missing_integrity(tmp_path):
    """Scanner should detect external scripts without SRI."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><head>
<script src="https://example.com/lib.js"></script>
</head><body></body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from agents.review_agent.storage_deep_scanner import check_sri_completeness

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)
        page.wait_for_timeout(200)

        findings = check_sri_completeness(session)
        types = [f.get("type") for f in findings]

        assert "missing_sri" in types, f"Expected missing_sri in {types}"

        browser.close()
