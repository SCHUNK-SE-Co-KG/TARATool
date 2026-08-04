"""TARA-0050: DOM-XSS sink scanner (R-22)."""
from __future__ import annotations
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession

XSS_PAYLOADS = [
    '<img src=x onerror="window.__xss_fired=1">',
    '<script>window.__xss_fired=1</script>',
    'javascript:window.__xss_fired=1',
]

DANGEROUS_SINK_PATTERNS = [
    r'\.innerHTML\s*=',
    r'\.outerHTML\s*=',
    r'document\.write\s*\(',
    r'document\.writeln\s*\(',
]


def scan_dom_xss(session: "ReviewSession") -> list:
    """Inject XSS payloads into input fields and check window.__xss_fired."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("xss_scan", [])
    findings = []

    inputs = session.page.query_selector_all("input[type=text], input:not([type]), textarea")
    for inp in inputs:
        for payload in XSS_PAYLOADS:
            try:
                session.page.evaluate("() => { window.__xss_fired = 0; }")
                inp.fill(payload)
                inp.press("Enter")
                fired = session.page.evaluate("() => window.__xss_fired || 0")
                if fired:
                    entry = {
                        "type": "xss_payload_executed",
                        "severity": "Kritisch",
                        "payload": payload,
                        "element": session.page.evaluate(
                            "(el) => el.outerHTML.substring(0, 100)", inp
                        ),
                    }
                    findings.append(entry)
                    session.report["findings"].append(entry)
                    raw["xss_scan"].append(entry)
            except Exception:
                pass

    return findings


def find_dangerous_sinks(session: "ReviewSession") -> list:
    """Find innerHTML/outerHTML/document.write in page content."""
    content = session.page.content()
    raw = session.report.setdefault("raw", {})
    raw.setdefault("dangerous_sinks", [])
    findings = []

    for pattern in DANGEROUS_SINK_PATTERNS:
        matches = re.findall(pattern, content)
        if matches:
            entry = {
                "type": "dangerous_sink",
                "severity": "Hoch",
                "pattern": pattern,
                "matches": len(matches),
            }
            findings.append(entry)
            session.report["findings"].append(entry)
            raw["dangerous_sinks"].append(entry)

    return findings
