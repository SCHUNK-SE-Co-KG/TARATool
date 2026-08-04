"""Tests for TARA-0044: Performance and memory monitoring (R-17)."""
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
            "story_id": "TARA-0044",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0044
def test_measure_performance_returns_timing(tmp_path):
    """measure_performance should return plausible timing values."""
    html = tmp_path / "test.html"
    html.write_text("<html><body><p>Hello</p></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.performance_monitor import measure_performance

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)
        page.wait_for_load_state("networkidle")

        timing = measure_performance(session)
        assert "loadEventEnd" in timing
        assert timing["loadEventEnd"] >= 0

        browser.close()


@pytest.mark.TARA_0044
def test_measure_memory_returns_number(tmp_path):
    """measure_memory should return a non-negative heap size."""
    html = tmp_path / "test.html"
    html.write_text("<html><body></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.performance_monitor import measure_memory

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)

        mem = measure_memory(session)
        assert mem["heap"] >= 0

        browser.close()


@pytest.mark.TARA_0044
def test_detect_memory_leak(tmp_path):
    """detect_memory_leak should detect growing heap."""
    html = tmp_path / "test.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
window.__leak = [];
function growMemory() {
    for (let i = 0; i < 10000; i++) {
        window.__leak.push(new Array(100).fill('x'));
    }
}
window.growMemory = growMemory;
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.performance_monitor import detect_memory_leak

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)

        def grow():
            page.evaluate("window.growMemory()")

        leak = detect_memory_leak(session, grow, n=5, threshold=0.05)
        assert leak is True

        browser.close()
