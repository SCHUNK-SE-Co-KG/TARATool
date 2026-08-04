"""TARA-0053: CORS header analysis (R-26)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def analyze_cors_headers(session: "ReviewSession") -> list:
    """Capture CORS response headers from all cross-origin responses."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("cors_responses", [])
    findings = []

    def on_response(resp):
        try:
            headers = resp.all_headers()
        except Exception:
            return
        acao = headers.get("access-control-allow-origin", "")
        acac = headers.get("access-control-allow-credentials", "").lower()
        if acao:
            entry = {"url": resp.url, "acao": acao, "acac": acac}
            raw["cors_responses"].append(entry)
            if acao == "*" and acac == "true":
                finding = {
                    "type": "cors_wildcard_with_credentials",
                    "severity": "Kritisch",
                    "url": resp.url,
                    "acao": acao,
                    "acac": acac,
                }
                findings.append(finding)
                session.report["findings"].append(finding)
            elif acao == "*":
                finding = {
                    "type": "cors_wildcard",
                    "severity": "Mittel",
                    "url": resp.url,
                    "acao": acao,
                }
                findings.append(finding)
                session.report["findings"].append(finding)

    session.page.on("response", on_response)
    return findings
