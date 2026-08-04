"""Tests for TARA-0046: CSP and Promise Rejections (R-19)."""
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
            "story_id": "TARA-0046",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0046
def test_csp_monitor_detects_unhandled_rejection(tmp_path):
    """Scanner should detect unhandled Promise rejection."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
Promise.reject(new Error("test rejection"));
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from agents.review_agent.csp_checker import attach_csp_monitor, get_csp_findings

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)

        attach_csp_monitor(session)
        page.goto(app_url)
        page.wait_for_timeout(300)

        findings = get_csp_findings(session)
        rejections = session.report.get("raw", {}).get("unhandled_rejections", [])

        assert len(rejections) > 0, f"Expected unhandled rejections, got: {rejections}"

        browser.close()
