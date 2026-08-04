"""TARA-0040: Console error and warning monitor (R-13)."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def attach_console_monitor(session: "ReviewSession") -> None:
    """Register console/pageerror listeners on session.page."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("console", [])

    def on_console(msg):
        entry = {
            "type": None,
            "severity": None,
            "text": msg.text,
            "location": f"{msg.location.get('url', '')}:{msg.location.get('lineNumber', '')}",
        }
        if msg.type == "error":
            entry["type"] = "console_error"
            entry["severity"] = "Hoch"
        elif msg.type == "warning":
            entry["type"] = "console_warn"
            entry["severity"] = "Niedrig"
        else:
            return
        raw["console"].append(entry)
        session.report["findings"].append(entry)

    def on_pageerror(exc):
        entry = {
            "type": "uncaught_exception",
            "severity": "Kritisch",
            "message": str(exc),
            "stack": getattr(exc, "stack", ""),
        }
        raw["console"].append(entry)
        session.report["findings"].append(entry)

    session.page.on("console", on_console)
    session.page.on("pageerror", on_pageerror)


def get_console_findings(session: "ReviewSession") -> list:
    """Return findings from session.report['raw']['console']."""
    return session.report.get("raw", {}).get("console", [])
