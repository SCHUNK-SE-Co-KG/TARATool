"""TARA-0054: Clickjacking and Reverse Tabnabbing checker (R-27/28)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def check_clickjacking(session: "ReviewSession") -> list:
    """Check X-Frame-Options / CSP frame-ancestors response headers."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("frame_headers", {})
    findings = []

    def on_response(resp):
        try:
            headers = resp.all_headers()
        except Exception:
            return
        xfo = headers.get("x-frame-options", "")
        csp = headers.get("content-security-policy", "")
        raw["frame_headers"] = {"x-frame-options": xfo, "csp": csp}
        if not xfo and "frame-ancestors" not in csp:
            entry = {
                "type": "missing_clickjacking_protection",
                "severity": "Hoch",
                "url": resp.url,
                "detail": "Neither X-Frame-Options nor CSP frame-ancestors present",
            }
            findings.append(entry)
            session.report["findings"].append(entry)

    session.page.on("response", on_response)
    return findings


def check_reverse_tabnabbing(session: "ReviewSession") -> list:
    """Check all <a target='_blank'> for rel='noopener noreferrer'."""
    raw = session.report.setdefault("raw", {})
    findings = []

    links = session.page.query_selector_all("a[target='_blank']")
    problematic = []
    for link in links:
        rel = session.page.evaluate("(el) => el.getAttribute('rel') || ''", link)
        href = session.page.evaluate("(el) => el.href || ''", link)
        if "noopener" not in rel or "noreferrer" not in rel:
            problematic.append({"href": href, "rel": rel})

    raw["tabnabbing_links"] = problematic
    for item in problematic:
        entry = {
            "type": "reverse_tabnabbing",
            "severity": "Mittel",
            "href": item["href"],
            "rel": item["rel"],
            "detail": "Link with target=_blank missing rel='noopener noreferrer'",
        }
        findings.append(entry)
        session.report["findings"].append(entry)

    return findings
