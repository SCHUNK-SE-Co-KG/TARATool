"""Tests for TARA-0053: CORS header analysis (R-26)."""
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
            "story_id": "TARA-0053",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0053
def test_cors_detects_wildcard_with_credentials(tmp_path):
    """Scanner should detect ACAO: * with ACAC: true."""
    from playwright.sync_api import sync_playwright
    from tools.review_agent.cors_checker import analyze_cors_headers

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        app_url = "http://test.local/app"

        # Serve the main page via route
        html = "<html><body><script>fetch('/api/data').catch(()=>{})</script></body></html>"
        page.route("**/app", lambda r: r.fulfill(
            status=200,
            headers={"Content-Type": "text/html"},
            body=html
        ))

        session = _make_session(page, context, app_url)

        # Set up CORS finding listener BEFORE goto
        analyze_cors_headers(session)

        # Mock a response with dangerous CORS headers
        page.route("**/api/data", lambda r: r.fulfill(
            status=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
                "Content-Type": "application/json",
            },
            body='{"data": "test"}'
        ))

        page.goto(app_url)
        page.wait_for_timeout(300)

        findings = session.report.get("findings", [])
        types = [f.get("type") for f in findings]

        assert "cors_wildcard_with_credentials" in types, f"Expected cors finding in {types}"

        browser.close()
