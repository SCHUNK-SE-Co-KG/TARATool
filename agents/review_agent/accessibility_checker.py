"""TARA-0045: Accessibility tree checker (R-18)."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession


def check_accessibility(session: "ReviewSession") -> dict:
    """Capture accessibility info via CDP AXTree or DOM fallback."""
    raw = session.report.setdefault("raw", {})
    try:
        client = session.page.context.new_cdp_session(session.page)
        result = client.send("Accessibility.getFullAXTree")
        nodes = result.get("nodes", [])
        snapshot = {"nodes": nodes, "source": "cdp"}
        raw["accessibility"] = snapshot
        return snapshot
    except Exception:
        pass
    # DOM-based fallback
    try:
        elements = session.page.evaluate("""() => {
            const selectors = 'button, a, input[type=checkbox], input[type=radio], input[type=text], input:not([type]), select, textarea';
            return Array.from(document.querySelectorAll(selectors)).map(el => ({
                tag: el.tagName.toLowerCase(),
                type: el.type || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                ariaLabelledBy: el.getAttribute('aria-labelledby') || '',
                textContent: (el.textContent || '').trim(),
                value: el.value || '',
                title: el.getAttribute('title') || '',
                id: el.id || '',
                name: el.getAttribute('name') || '',
            }));
        }""")
        snapshot = {"elements": elements, "source": "dom"}
        raw["accessibility"] = snapshot
        return snapshot
    except Exception as e:
        raw["accessibility"] = {"error": str(e)}
        return {}


def _find_unnamed_interactive(node: dict, results: list) -> None:
    if not node:
        return
    role = node.get("role", "")
    name = node.get("name", "")
    if role in ("button", "link", "checkbox", "radio", "textbox", "combobox") and not name:
        results.append({"role": role, "node": node})
    for child in node.get("children", []):
        _find_unnamed_interactive(child, results)


def get_accessibility_findings(session: "ReviewSession") -> list:
    """Find accessibility issues."""
    raw = session.report.setdefault("raw", {})
    snapshot = raw.get("accessibility")
    if not snapshot:
        snapshot = check_accessibility(session)

    findings = []

    # CDP-based analysis
    if snapshot.get("source") == "cdp":
        for node in snapshot.get("nodes", []):
            role_val = node.get("role", {})
            role = role_val.get("value", "") if isinstance(role_val, dict) else str(role_val)
            name_val = node.get("name", {})
            name = name_val.get("value", "") if isinstance(name_val, dict) else str(name_val)
            if role in ("button", "link", "checkbox", "radio", "textbox", "combobox") and not name.strip():
                entry = {
                    "type": "missing_accessible_name",
                    "severity": "Mittel",
                    "role": role,
                    "detail": f"Interactive element <{role}> has no accessible name",
                }
                findings.append(entry)
                session.report["findings"].append(entry)
    elif snapshot.get("source") == "dom":
        for el in snapshot.get("elements", []):
            tag = el.get("tag", "")
            has_name = (
                el.get("ariaLabel")
                or el.get("ariaLabelledBy")
                or el.get("textContent")
                or el.get("title")
                or (tag in ("input", "select", "textarea") and el.get("name"))
            )
            if not has_name and tag in ("button", "a", "select"):
                role_map = {"button": "button", "a": "link", "select": "combobox"}
                role = role_map.get(tag, tag)
                entry = {
                    "type": "missing_accessible_name",
                    "severity": "Mittel",
                    "role": role,
                    "detail": f"Interactive element <{role}> has no accessible name",
                }
                findings.append(entry)
                session.report["findings"].append(entry)

    return findings
