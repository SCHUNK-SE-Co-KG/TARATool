"""TARA-0052: eval() and Function() usage scanner (R-25)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def attach_eval_monitor(session: "ReviewSession") -> None:
    """Override eval/Function/setTimeout(string)/setInterval(string)."""
    raw = session.report.setdefault("raw", {})
    raw.setdefault("eval_calls", [])

    session.page.add_init_script("""
        window.__eval_calls = [];

        const origEval = window.eval;
        window.eval = function(code) {
            window.__eval_calls.push({ type: 'eval', code: String(code).substring(0, 200) });
            return origEval(code);
        };

        const OrigFunction = window.Function;
        window.Function = function(...args) {
            window.__eval_calls.push({ type: 'Function', args: args.map(String) });
            return OrigFunction(...args);
        };
        Object.setPrototypeOf(window.Function, OrigFunction);

        const origSetTimeout = window.setTimeout;
        window.setTimeout = function(fn, delay, ...rest) {
            if (typeof fn === 'string') {
                window.__eval_calls.push({ type: 'setTimeout_string', code: fn.substring(0, 200) });
            }
            return origSetTimeout(fn, delay, ...rest);
        };

        const origSetInterval = window.setInterval;
        window.setInterval = function(fn, delay, ...rest) {
            if (typeof fn === 'string') {
                window.__eval_calls.push({ type: 'setInterval_string', code: fn.substring(0, 200) });
            }
            return origSetInterval(fn, delay, ...rest);
        };
    """)


def get_eval_findings(session: "ReviewSession") -> list:
    """Collect eval usage findings."""
    raw = session.report.setdefault("raw", {})
    findings = []

    try:
        calls = session.page.evaluate("() => window.__eval_calls || []")
        raw["eval_calls"] = calls
        for call in calls:
            entry = {
                "type": "eval_usage",
                "severity": "Hoch",
                "eval_type": call.get("type"),
                "detail": call,
            }
            findings.append(entry)
            session.report["findings"].append(entry)
    except Exception:
        pass

    return findings
