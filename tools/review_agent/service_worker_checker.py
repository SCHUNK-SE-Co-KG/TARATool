"""TARA-0047: Service Worker and Cross-Origin (R-20)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def check_service_workers(session: "ReviewSession") -> list:
    """Check navigator.serviceWorker.getRegistrations()."""
    raw = session.report.setdefault("raw", {})
    try:
        registrations = session.page.evaluate("""async () => {
            if (!navigator.serviceWorker) return [];
            const regs = await navigator.serviceWorker.getRegistrations();
            return regs.map(r => ({ scope: r.scope, state: r.active ? r.active.state : 'none' }));
        }""")
        raw["service_workers"] = registrations
        findings = []
        for reg in registrations:
            entry = {
                "type": "service_worker_registered",
                "severity": "Kritisch",
                "scope": reg.get("scope"),
                "state": reg.get("state"),
            }
            findings.append(entry)
            session.report["findings"].append(entry)
        return findings
    except Exception as e:
        raw["service_workers"] = {"error": str(e)}
        return []


def attach_postmessage_monitor(session: "ReviewSession") -> None:
    """Instrument window.postMessage via add_init_script."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("postmessage_calls", [])

    session.page.add_init_script("""
        window.__postmessage_calls = [];
        const originalPostMessage = window.postMessage.bind(window);
        window.postMessage = function(message, targetOrigin, ...args) {
            window.__postmessage_calls.push({ message: String(message), targetOrigin: String(targetOrigin) });
            return originalPostMessage(message, targetOrigin, ...args);
        };
    """)


def get_service_worker_findings(session: "ReviewSession") -> list:
    """Collect postMessage and service worker findings."""
    raw = session.report.setdefault("raw", {})
    findings = []

    try:
        calls = session.page.evaluate("() => window.__postmessage_calls || []")
        raw["postmessage_calls"] = calls
        for call in calls:
            if call.get("targetOrigin") == "*":
                entry = {
                    "type": "postmessage_wildcard",
                    "severity": "Hoch",
                    "message": call.get("message"),
                    "targetOrigin": "*",
                }
                findings.append(entry)
                session.report["findings"].append(entry)
    except Exception:
        pass

    return findings
