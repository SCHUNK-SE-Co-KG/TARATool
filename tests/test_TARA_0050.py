"""Tests for TARA-0050: DOM-XSS sink scanner (R-22)."""
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
            "story_id": "TARA-0050",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0050
def test_find_dangerous_sinks_detects_innerhtml(tmp_path):
    """Scanner should find innerHTML assignment in page source."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<div id="out"></div>
<script>
document.getElementById("out").innerHTML = document.location.hash.substr(1);
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from agents.review_agent.dom_xss_scanner import find_dangerous_sinks

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)

        findings = find_dangerous_sinks(session)
        types = [f.get("type") for f in findings]

        assert "dangerous_sink" in types, f"Expected dangerous_sink in {types}"

        browser.close()
