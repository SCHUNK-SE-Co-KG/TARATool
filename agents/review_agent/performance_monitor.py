"""TARA-0044: Performance and memory monitoring (R-17)."""
from __future__ import annotations
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def measure_performance(session: "ReviewSession") -> dict:
    """Navigation timing + resource timing."""
    timing = session.page.evaluate("""() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        return {
            loadEventEnd: nav.loadEventEnd || 0,
            domContentLoadedEventEnd: nav.domContentLoadedEventEnd || 0,
            responseEnd: nav.responseEnd || 0,
        };
    }""")
    raw = session.report.setdefault("raw", {})
    raw["performance"] = timing
    return timing


def measure_memory(session: "ReviewSession", label: str = "") -> dict:
    """JSHeapUsedSize via CDP Performance.getMetrics()."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("memory", [])
    try:
        client = session.page.context.new_cdp_session(session.page)
        client.send("Performance.enable")
        result = client.send("Performance.getMetrics")
        metrics = {m["name"]: m["value"] for m in result.get("metrics", [])}
        heap = metrics.get("JSHeapUsedSize", 0)
        entry = {"label": label, "heap": heap, "metrics": metrics}
        raw["memory"].append(entry)
        return entry
    except Exception as e:
        entry = {"label": label, "heap": 0, "error": str(e)}
        raw["memory"].append(entry)
        return entry


def detect_memory_leak(
    session: "ReviewSession",
    action: Callable,
    n: int = 5,
    threshold: float = 0.20,
) -> bool:
    """Return True if memory continuously increases > threshold% over n iterations."""
    measurements = []
    for i in range(n):
        action()
        m = measure_memory(session, label=f"iter_{i}")
        measurements.append(m.get("heap", 0))

    if len(measurements) < 2:
        return False

    if all(m == 0 for m in measurements):
        return False  # Memory APIs not available

    increases = sum(
        1 for i in range(1, len(measurements)) if measurements[i] > measurements[i - 1]
    )
    majority = increases >= (len(measurements) - 1) // 2 + 1

    total_growth = (measurements[-1] - measurements[0]) / max(measurements[0], measurements[-1], 1)
    return majority and total_growth > threshold
