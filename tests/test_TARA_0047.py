"""Tests for TARA-0047: Service Worker and Cross-Origin (R-20)."""
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
            "story_id": "TARA-0047",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0047
def test_postmessage_monitor_detects_wildcard(tmp_path):
    """Scanner should detect postMessage with wildcard origin."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
window.postMessage("sensitive data", "*");
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.service_worker_checker import attach_postmessage_monitor, get_service_worker_findings

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)

        attach_postmessage_monitor(session)
        page.goto(app_url)
        page.wait_for_timeout(200)

        findings = get_service_worker_findings(session)
        types = [f.get("type") for f in findings]

        assert "postmessage_wildcard" in types, f"Expected postmessage_wildcard in {types}"

        browser.close()
