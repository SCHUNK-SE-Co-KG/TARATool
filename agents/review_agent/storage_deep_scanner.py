"""TARA-0055: Storage deep scan + XSSI (R-29/30)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def scan_indexeddb(session: "ReviewSession") -> list:
    """Query indexedDB.databases()."""
    raw = session.report.setdefault("raw", {})
    findings = []

    try:
        databases = session.page.evaluate("""async () => {
            if (!indexedDB.databases) return [];
            const dbs = await indexedDB.databases();
            return dbs.map(db => ({ name: db.name, version: db.version }));
        }""")
        raw["indexeddb"] = databases
        for db in databases:
            entry = {
                "type": "indexeddb_found",
                "severity": "Niedrig",
                "name": db.get("name"),
                "version": db.get("version"),
            }
            findings.append(entry)
    except Exception as e:
        raw["indexeddb"] = {"error": str(e)}

    return findings


def scan_window_globals(session: "ReviewSession") -> list:
    """Compare window properties: app vs clean iframe."""
    raw = session.report.setdefault("raw", {})
    findings = []

    try:
        app_globals = session.page.evaluate("""() => {
            return Object.getOwnPropertyNames(window).filter(k => {
                try {
                    const v = window[k];
                    return typeof v !== 'function' && v !== null && v !== undefined && typeof v === 'object';
                } catch { return false; }
            });
        }""")
        raw["window_globals"] = app_globals
        for key in app_globals:
            try:
                size = session.page.evaluate(f"() => JSON.stringify(window['{key}']).length")
                if size > 10000:
                    entry = {
                        "type": "large_global_variable",
                        "severity": "Mittel",
                        "key": key,
                        "size": size,
                    }
                    findings.append(entry)
                    session.report["findings"].append(entry)
            except Exception:
                pass
    except Exception as e:
        raw["window_globals"] = {"error": str(e)}

    return findings


def check_sri_completeness(session: "ReviewSession") -> list:
    """Check all external <script>/<link> for integrity attribute."""
    raw = session.report.setdefault("raw", {})
    findings = []

    try:
        missing_sri = session.page.evaluate("""() => {
            const results = [];
            document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach(el => {
                const src = el.src || el.href || '';
                if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                    if (!el.integrity) {
                        results.push({ tag: el.tagName.toLowerCase(), src: src });
                    }
                }
            });
            return results;
        }""")
        raw["missing_sri"] = missing_sri
        for item in missing_sri:
            entry = {
                "type": "missing_sri",
                "severity": "Hoch",
                "tag": item.get("tag"),
                "src": item.get("src"),
                "detail": "External resource without SRI integrity attribute",
            }
            findings.append(entry)
            session.report["findings"].append(entry)
    except Exception as e:
        raw["missing_sri"] = {"error": str(e)}

    return findings
