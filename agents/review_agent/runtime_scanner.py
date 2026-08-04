"""TARA-0039: Playwright Runtime Infrastructure for Review Agent."""
from __future__ import annotations

import argparse
import datetime
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional


@dataclass
class ReviewSession:
    page: object
    context: object
    report: dict = field(default_factory=dict)
    _browser: object = field(default=None, repr=False)
    _playwright: object = field(default=None, repr=False)


def start_review_session(
    app_url: str, page_setup: Optional[Callable] = None
) -> ReviewSession:
    """Start Chromium headless, load app_url, return ReviewSession."""
    from playwright.sync_api import sync_playwright

    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=True,
        args=["--allow-file-access-from-files", "--disable-web-security"],
    )
    context = browser.new_context()
    page = context.new_page()

    report = {
        "story_id": "",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "app_url": app_url,
        "findings": [],
        "raw": {},
        "missing_info": [],
    }

    session = ReviewSession(
        page=page,
        context=context,
        report=report,
        _browser=browser,
        _playwright=pw,
    )

    if page_setup:
        page_setup(session)

    page.goto(app_url)

    return session


def stop_review_session(session: ReviewSession) -> None:
    """Close browser and persist report if output_path set."""
    output_path = session.report.get("_output_path")
    if output_path:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        clean = {k: v for k, v in session.report.items() if not k.startswith("_")}
        path.write_text(json.dumps(clean, indent=2, ensure_ascii=False), encoding="utf-8")

    try:
        session._browser.close()
    except Exception:
        pass
    try:
        session._playwright.stop()
    except Exception:
        pass


def _run_cli(story_id: str, app_url: str, full: bool = False) -> None:
    """CLI entry point."""
    import importlib

    session = start_review_session(app_url)
    session.report["story_id"] = story_id

    reports_dir = Path(__file__).parent.parent.parent / "security" / "reports"
    filename = f"review_runtime_{story_id}.json"
    session.report["_output_path"] = str(reports_dir / filename)

    if full:
        modules = [
            "tools.review_agent.console_monitor",
            "tools.review_agent.network_monitor",
            "tools.review_agent.dom_inspector",
            "tools.review_agent.storage_inspector",
            "tools.review_agent.performance_monitor",
            "tools.review_agent.accessibility_checker",
            "tools.review_agent.csp_checker",
            "tools.review_agent.service_worker_checker",
            "tools.review_agent.permissions_checker",
            "tools.review_agent.dom_xss_scanner",
            "tools.review_agent.html_injection_scanner",
            "tools.review_agent.eval_scanner",
            "tools.review_agent.cors_checker",
            "tools.review_agent.clickjacking_checker",
            "tools.review_agent.storage_deep_scanner",
        ]
        for mod_name in modules:
            try:
                mod = importlib.import_module(mod_name)
                if hasattr(mod, "attach_" + mod_name.split(".")[-1].replace("_checker", "").replace("_monitor", "").replace("_scanner", "") + "_monitor"):
                    pass
            except Exception as e:
                session.report["missing_info"].append(str(e))

    stop_review_session(session)
    print(f"Report saved: {session.report.get('_output_path')}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TARATool Review Agent Runtime Scanner")
    parser.add_argument("--story", required=True, help="Story ID e.g. TARA-0039")
    parser.add_argument("--url", required=True, help="App URL e.g. file:///...")
    parser.add_argument("--full", action="store_true", help="Run full scan")
    args = parser.parse_args()
    _run_cli(args.story, args.url, args.full)
