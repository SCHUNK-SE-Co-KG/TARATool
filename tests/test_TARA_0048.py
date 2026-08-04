"""Tests for TARA-0048: Browser permissions (R-21)."""
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
            "story_id": "TARA-0048",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0048
def test_permissions_monitor_detects_geolocation(tmp_path):
    """Scanner should detect geolocation API call."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
navigator.geolocation.getCurrentPosition(function() {}, function() {});
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.permissions_checker import attach_permissions_monitor, get_permissions_findings

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)

        attach_permissions_monitor(session)
        page.goto(app_url)
        page.wait_for_timeout(200)

        findings = get_permissions_findings(session)
        apis = [f.get("api") for f in findings]

        assert "geolocation.getCurrentPosition" in apis, f"Expected geolocation in {apis}"

        browser.close()
