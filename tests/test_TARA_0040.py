"""Tests for TARA-0040: Console error and warning monitor (R-13)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.mark.TARA_0040
def test_console_monitor_detects_error_warn_exception(tmp_path):
    """Scanner should detect console.error, console.warn, and uncaught exception."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
console.error("test error");
console.warn("test warning");
setTimeout(() => { throw new Error("uncaught"); }, 50);
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from agents.review_agent.runtime_scanner import ReviewSession
    from agents.review_agent.console_monitor import attach_console_monitor, get_console_findings

    import datetime

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()

        report = {
            "story_id": "TARA-0040",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        }
        session = ReviewSession(page=page, context=context, report=report, _browser=browser, _playwright=p)

        attach_console_monitor(session)
        page.goto(app_url)
        page.wait_for_timeout(200)

        findings = get_console_findings(session)

        types = [f.get("type") for f in findings]

        assert "console_error" in types, f"Expected console_error in {types}"
        assert "console_warn" in types, f"Expected console_warn in {types}"
        assert "uncaught_exception" in types, f"Expected uncaught_exception in {types}"

        for f in findings:
            if f["type"] == "console_error":
                assert f["severity"] == "Hoch"
            elif f["type"] == "console_warn":
                assert f["severity"] == "Niedrig"
            elif f["type"] == "uncaught_exception":
                assert f["severity"] == "Kritisch"

        browser.close()
