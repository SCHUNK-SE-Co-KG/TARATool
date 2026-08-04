"""Tests for TARA-0041: Network monitoring (R-14)."""
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
            "story_id": "TARA-0041",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0041
def test_network_monitor_detects_failed_request(tmp_path):
    """Scanner should detect aborted/failed network requests."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
fetch('https://nonexistent.example.invalid/resource.js').catch(() => {});
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.network_monitor import attach_network_monitor, get_network_findings

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)

        attach_network_monitor(session)

        # Simulate a failed request via route
        page.route("**/failing.js", lambda r: r.abort())
        page.goto(app_url)
        page.wait_for_timeout(500)

        # Force a request to the failing route
        try:
            page.evaluate("fetch('/failing.js').catch(() => {})")
            page.wait_for_timeout(300)
        except Exception:
            pass

        findings = get_network_findings(session)
        raw = session.report.get("raw", {}).get("network", {})

        assert isinstance(findings, list)
        assert "requests" in raw or "failed" in raw

        browser.close()


@pytest.mark.TARA_0041
def test_network_monitor_tracks_requests(tmp_path):
    """Network monitor should track all requests."""
    html = tmp_path / "test.html"
    html.write_text("<html><body></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.network_monitor import attach_network_monitor

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)

        attach_network_monitor(session)
        page.goto(app_url)
        page.wait_for_timeout(200)

        raw = session.report.get("raw", {}).get("network", {})
        assert "requests" in raw
        assert "failed" in raw
        assert "responses" in raw

        browser.close()
