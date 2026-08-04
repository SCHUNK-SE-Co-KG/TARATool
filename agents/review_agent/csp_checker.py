"""TARA-0046: CSP and unhandled rejections (R-19)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def attach_csp_monitor(session: "ReviewSession") -> None:
    """Instrument securitypolicyviolation + unhandledrejection via add_init_script."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("csp_violations", [])
    raw.setdefault("unhandled_rejections", [])
    raw.setdefault("csp_active", False)

    session.page.add_init_script("""
        window.__csp_violations = [];
        window.__unhandled_rejections = [];

        document.addEventListener('securitypolicyviolation', (e) => {
            window.__csp_violations.push({
                directive: e.violatedDirective,
                blockedURI: e.blockedURI,
                originalPolicy: e.originalPolicy,
            });
        });

        window.addEventListener('unhandledrejection', (e) => {
            window.__unhandled_rejections.push({
                reason: String(e.reason),
                stack: e.reason && e.reason.stack ? e.reason.stack : '',
            });
        });
    """)


def get_csp_findings(session: "ReviewSession") -> list:
    """Collect CSP and rejection findings after page load."""
    raw = session.report.setdefault("raw", {})

    try:
        violations = session.page.evaluate("() => window.__csp_violations || []")
        raw["csp_violations"] = violations
        for v in violations:
            entry = {
                "type": "csp_violation",
                "severity": "Kritisch",
                "directive": v.get("directive"),
                "blockedURI": v.get("blockedURI"),
            }
            session.report["findings"].append(entry)
    except Exception:
        violations = []

    try:
        rejections = session.page.evaluate("() => window.__unhandled_rejections || []")
        raw["unhandled_rejections"] = rejections
        for r in rejections:
            entry = {
                "type": "unhandled_rejection",
                "severity": "Hoch",
                "reason": r.get("reason"),
                "stack": r.get("stack"),
            }
            session.report["findings"].append(entry)
    except Exception:
        rejections = []

    return session.report.get("findings", [])
