"""TARA-0041: Network monitoring (R-14)."""
from __future__ import annotations
from urllib.parse import urlparse
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession

KNOWN_CDN_DOMAINS = [
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "fontawesome.com",
    "unpkg.com",
    "kroki.io",
    "quickchart.io",
]


def attach_network_monitor(session: "ReviewSession") -> None:
    """Register request/response/requestfailed listeners."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("network", {"requests": [], "failed": [], "responses": []})

    def on_request(req):
        raw["network"]["requests"].append({"url": req.url, "method": req.method})

    def on_response(resp):
        status = resp.status
        if status >= 400:
            entry = {
                "type": "http_error",
                "severity": "Hoch",
                "url": resp.url,
                "status": status,
            }
            raw["network"]["responses"].append(entry)
            session.report["findings"].append(entry)
        else:
            raw["network"]["responses"].append({"url": resp.url, "status": status})

    def on_requestfailed(req):
        url = req.url
        parsed = urlparse(url)
        domain = parsed.netloc
        is_known_cdn = any(domain.endswith(cdn) for cdn in KNOWN_CDN_DOMAINS)
        severity = "Hoch" if is_known_cdn else "Kritisch"
        entry = {
            "type": "request_failed",
            "severity": severity,
            "url": url,
            "failure": req.failure,
        }
        raw["network"]["failed"].append(entry)
        session.report["findings"].append(entry)

    session.page.on("request", on_request)
    session.page.on("response", on_response)
    session.page.on("requestfailed", on_requestfailed)


def get_network_findings(session: "ReviewSession") -> list:
    network = session.report.get("raw", {}).get("network", {})
    return network.get("failed", []) + [
        r for r in network.get("responses", []) if isinstance(r, dict) and r.get("type") == "http_error"
    ]
