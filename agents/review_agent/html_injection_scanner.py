"""TARA-0051: HTML Injection scanner (R-23/24)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession

HTML_PAYLOADS = ["<b>INJECTED</b>", "<h1>TEST</h1>", "<a href=x>LINK</a>"]


def scan_html_injection(session: "ReviewSession") -> list:
    """Inject HTML payloads into input fields, check if rendered."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("html_injection", [])
    findings = []

    inputs = session.page.query_selector_all("input[type=text], input:not([type]), textarea")
    for inp in inputs:
        for payload in HTML_PAYLOADS:
            try:
                inp.fill(payload)
                inp.press("Enter")
                # Check if rendered HTML tags appear in the DOM (not escaped)
                tag = payload.split(">")[0].lstrip("<").split(" ")[0]
                elements = session.page.query_selector_all(tag)
                rendered = any(
                    session.page.evaluate("(el) => el.textContent", el).strip()
                    in ["INJECTED", "TEST", "LINK"]
                    for el in elements
                )
                if rendered:
                    entry = {
                        "type": "html_injection",
                        "severity": "Hoch",
                        "payload": payload,
                    }
                    findings.append(entry)
                    session.report["findings"].append(entry)
                    raw["html_injection"].append(entry)
            except Exception:
                pass

    return findings


def scan_resource_manipulation(session: "ReviewSession", external_urls: list) -> list:
    """Check if user data flows URL-encoded into external URLs."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("resource_manipulation", [])
    findings = []

    content = session.page.content()
    for url in external_urls:
        import urllib.parse
        parsed = urllib.parse.urlparse(url)
        if parsed.query:
            entry = {
                "type": "resource_manipulation",
                "severity": "Mittel",
                "url": url,
                "detail": "External URL contains query parameters",
            }
            findings.append(entry)
            session.report["findings"].append(entry)
            raw["resource_manipulation"].append(entry)

    return findings
