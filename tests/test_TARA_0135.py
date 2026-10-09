"""
[TARA-0135] Tests: Security Goals bilingual and dynamic residual-risk textareas.
"""
import os


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SECURITY_GOALS_PATH = os.path.join(REPO_ROOT, "js", "modules", "security_goals.js")
RESIDUAL_RISK_UI_PATH = os.path.join(REPO_ROOT, "js", "residual_risk", "residual_risk_ui.js")
STYLE_PATH = os.path.join(REPO_ROOT, "css", "style.css")


def _read(path):
    with open(path, encoding="utf-8") as file:
        return file.read()


def test_security_goals_use_localized_fields_for_editing_and_saving():
    content = _read(SECURITY_GOALS_PATH)

    assert "getLocalizedField" in content
    assert "setLocalizedField(existing, 'name', name)" in content
    assert "setLocalizedField(existing, 'description', description)" in content
    assert "setLocalizedField(created, 'name', name)" in content
    assert "setLocalizedField(created, 'description', description)" in content


def test_security_goals_show_selectable_german_fallback_in_english():
    content = _read(SECURITY_GOALS_PATH)

    assert "_localizedField(goal, 'name', { raw: true })" in content
    assert "_localizedField(goal, 'description', { raw: true })" in content
    assert "syncLocalizedInputHint(nameField, goal, 'name', '')" in content
    assert "syncLocalizedInputHint(descField, goal, 'description', '')" in content
    assert "localizeParenHtml" in content


def test_residual_risk_textareas_auto_grow_on_open_and_input():
    content = _read(RESIDUAL_RISK_UI_PATH)

    assert "function rrAutoSizeTextarea(textarea)" in content
    assert "class=\"rr-note rr-textarea rr-auto-grow\"" in content
    assert "class=\"rr-security rr-textarea rr-auto-grow\"" in content
    assert "rrAutoSizeTextarea(taNote)" in content
    assert "rrAutoSizeTextarea(taSec)" in content
    assert "body.querySelectorAll('textarea.rr-auto-grow')" in content


def test_residual_risk_textareas_have_viewport_bound():
    content = _read(STYLE_PATH)

    assert ".rr-textarea.rr-auto-grow" in content
    assert "max-height: 45vh" in content
    assert "resize: none" in content