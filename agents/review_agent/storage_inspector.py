"""TARA-0043: Storage analysis (R-16)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def inspect_storage(session: "ReviewSession") -> dict:
    """Read localStorage, sessionStorage, cookies."""
    raw = session.report.setdefault("raw", {})

    local_storage = session.page.evaluate("""() => {
        const result = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            result[k] = localStorage.getItem(k).length;
        }
        return result;
    }""")

    session_storage = session.page.evaluate("""() => {
        const result = {};
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            result[k] = sessionStorage.getItem(k).length;
        }
        return result;
    }""")

    cookies = session.context.cookies()

    storage = {
        "localStorage": local_storage,
        "sessionStorage": session_storage,
        "cookies": [
            {
                "name": c["name"],
                "value": c["value"],
                "secure": c.get("secure", False),
                "httpOnly": c.get("httpOnly", False),
                "sameSite": c.get("sameSite", ""),
            }
            for c in cookies
        ],
    }
    raw["storage"] = storage
    return storage


def get_storage_findings(session: "ReviewSession") -> list:
    """Analyze storage for security issues."""
    storage = session.report.get("raw", {}).get("storage")
    if not storage:
        storage = inspect_storage(session)

    findings = []
    for cookie in storage.get("cookies", []):
        if not cookie.get("secure") and cookie.get("value"):
            entry = {
                "type": "insecure_cookie",
                "severity": "Hoch",
                "name": cookie["name"],
                "detail": "Cookie ohne secure-Flag",
            }
            findings.append(entry)
            session.report["findings"].append(entry)
    return findings
