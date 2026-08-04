"""TARA-0042: DOM state and event listener inspector (R-15)."""
from __future__ import annotations
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def capture_dom_snapshot(session: "ReviewSession", label: str = "initial") -> dict:
    """Capture DOM snapshot."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("dom_snapshots", {})
    content = session.page.content()
    metrics = session.page.evaluate("""() => ({
        elementCount: document.querySelectorAll('*').length,
        scriptCount: document.scripts.length,
    })""")
    snapshot = {"label": label, "size": len(content), **metrics}
    raw["dom_snapshots"][label] = snapshot
    return snapshot


def measure_listener_count(session: "ReviewSession") -> int:
    """Count event listeners via CDP."""
    try:
        client = session.page.context.new_cdp_session(session.page)
        client.send("DOM.enable")
        client.send("DOMDebugger.enable")
        result = client.send("DOMDebugger.getEventListeners", {"objectId": "1"})
        return len(result.get("listeners", []))
    except Exception:
        pass
    try:
        count = session.page.evaluate("""() => {
            let total = 0;
            const elements = document.querySelectorAll('*');
            elements.forEach(el => {
                if (el._listenerCount) total += el._listenerCount;
            });
            return window.__listenerCount || total;
        }""")
        return int(count)
    except Exception:
        return 0


def detect_listener_leak(
    session: "ReviewSession", action: Callable, n: int = 5
) -> bool:
    """Execute action n times, check if listener count grows > 20%."""
    before = measure_listener_count(session)
    for _ in range(n):
        action()
    after = measure_listener_count(session)
    if before == 0:
        return after > 0
    growth = (after - before) / before
    return growth > 0.20
