"""Tests for TARA-0042: DOM state and event listener inspector (R-15)."""
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
            "story_id": "TARA-0042",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "app_url": app_url,
            "findings": [],
            "raw": {},
            "missing_info": [],
        },
    )


@pytest.mark.TARA_0042
def test_dom_snapshot_captures_metrics(tmp_path):
    """capture_dom_snapshot should return DOM metrics."""
    html = tmp_path / "test.html"
    html.write_text("<html><body><p>Hello</p></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.dom_inspector import capture_dom_snapshot

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)

        snapshot = capture_dom_snapshot(session)
        assert snapshot["size"] > 0
        assert snapshot["elementCount"] > 0

        browser.close()


@pytest.mark.TARA_0042
def test_detect_listener_leak(tmp_path):
    """detect_listener_leak should detect growing listener count."""
    html = tmp_path / "test_leak.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
window.__listenerCount = 0;
function addListeners() {
    document.addEventListener('click', function leaked() {});
    window.__listenerCount++;
}
window.addListeners = addListeners;
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.dom_inspector import detect_listener_leak

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)
        page.wait_for_timeout(100)

        def add_listener():
            page.evaluate("window.addListeners()")

        leak = detect_listener_leak(session, add_listener, n=5)
        assert leak is True

        browser.close()


@pytest.mark.TARA_0042
def test_no_listener_leak_for_clean_page(tmp_path):
    """detect_listener_leak should NOT flag a clean page."""
    html = tmp_path / "test_clean.html"
    html.write_text("""
<!DOCTYPE html>
<html><body>
<script>
window.__listenerCount = 0;
document.addEventListener('click', function() {});
window.__listenerCount = 1;
function noLeak() { /* nothing */ }
window.noLeak = noLeak;
</script>
</body></html>
""", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from playwright.sync_api import sync_playwright
    from tools.review_agent.dom_inspector import detect_listener_leak

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--allow-file-access-from-files"])
        context = browser.new_context()
        page = context.new_page()
        session = _make_session(page, context, app_url)
        page.goto(app_url)
        page.wait_for_timeout(100)

        def no_leak():
            page.evaluate("window.noLeak()")

        leak = detect_listener_leak(session, no_leak, n=5)
        assert leak is False

        browser.close()
