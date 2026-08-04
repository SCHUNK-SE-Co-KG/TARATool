"""Tests for TARA-0052: eval() and Function() usage scanner (R-25)."""
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
            "story_id": "TARA-0052",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0052
def test_eval_monitor_detects_eval_call(tmp_path):
    """Scanner should detect eval() usage."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
eval("1+1");
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from agents.review_agent.eval_scanner import attach_eval_monitor, get_eval_findings

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)

        attach_eval_monitor(session)
        page.goto(app_url)
        page.wait_for_timeout(200)

        findings = get_eval_findings(session)
        eval_types = [f.get("eval_type") for f in findings]

        assert "eval" in eval_types, f"Expected eval in {eval_types}"

        browser.close()
