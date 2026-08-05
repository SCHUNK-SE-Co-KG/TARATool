"""TDD tests for TARA-0060: Zustandsinkonsistenzen und Event-Listener-Leaks.

Tests written BEFORE implementation – all must fail initially.
Scenarios:
  (a) localStorage.setItem ohne UI-Refresh (R-37)
  (b) addEventListener in render* Funktion ohne Guard (R-38)
  (c) Korrekte init-Funktion → kein Finding
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.review_agent.finding_framework import Severity
from agents.review_agent.state_consistency_analyzer import StateConsistencyAnalyzer

# ─── Test snippets ────────────────────────────────────────────────────────────

SETITEM_NO_REFRESH_JS = """\
function saveAnalysis(analysis) {
    const data = JSON.stringify(analysis);
    localStorage.setItem('taraAnalyses', data);
    return true;
}
"""

SETITEM_WITH_REFRESH_JS = """\
function saveAndRender(analysis) {
    const data = JSON.stringify(analysis);
    localStorage.setItem('taraAnalyses', data);
    renderActiveTab();
    return true;
}
"""

LISTENER_IN_RENDER_JS = """\
function renderAnalysisList(analyses) {
    const list = document.getElementById('analysis-list');
    list.innerHTML = '';
    list.addEventListener('click', function(e) {
        selectAnalysis(e.target.dataset.id);
    });
    analyses.forEach(a => renderItem(a, list));
}
"""

LISTENER_IN_INIT_JS = """\
function initEventHandlers() {
    document.getElementById('save-btn').addEventListener('click', function() {
        saveAnalysis();
    });
}
"""

COMBINED_PROBLEMS_JS = """\
function updateState(key, value) {
    localStorage.setItem(key, value);
}

function renderDashboard() {
    document.getElementById('btn').addEventListener('click', handleClick);
    loadData();
}
"""

CORRECT_CODE_JS = """\
function saveAndRefresh(analysis) {
    localStorage.setItem('taraAnalyses', JSON.stringify(analysis));
    getActiveAnalysis();
    renderActiveTab();
}

function initHandlers() {
    if (window._handlersInitialized) return;
    window._handlersInitialized = true;
    document.addEventListener('click', handleGlobal);
}
"""


# ─── Tests: R-37 Zustandsinkonsistenz ────────────────────────────────────────

def test_setitem_without_refresh_detected():
    """R-37: localStorage.setItem ohne UI-Refresh-Aufruf wird erkannt."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(SETITEM_NO_REFRESH_JS, file_path="js/save.js")
    rules = [f.rule for f in findings]
    assert "R-37" in rules


def test_setitem_with_refresh_no_finding():
    """R-37: setItem mit nachfolgendem Refresh erzeugt kein Finding."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(SETITEM_WITH_REFRESH_JS, file_path="js/save.js")
    r37 = [f for f in findings if f.rule == "R-37"]
    assert len(r37) == 0


def test_r37_finding_has_evidence():
    """R-37 Finding enthält code_snippet mit dem setItem-Aufruf."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(SETITEM_NO_REFRESH_JS, file_path="js/save.js")
    r37 = [f for f in findings if f.rule == "R-37"]
    assert len(r37) >= 1
    assert "code_snippet" in r37[0].evidence


# ─── Tests: R-38 Event-Listener-Leaks ────────────────────────────────────────

def test_listener_in_render_detected():
    """R-38: addEventListener in render*-Funktion ohne Guard erkannt."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(LISTENER_IN_RENDER_JS, file_path="js/render.js")
    rules = [f.rule for f in findings]
    assert "R-38" in rules


def test_listener_in_init_no_finding():
    """R-38: addEventListener in init*-Funktion erzeugt kein Finding."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(LISTENER_IN_INIT_JS, file_path="js/init.js")
    r38 = [f for f in findings if f.rule == "R-38"]
    assert len(r38) == 0


def test_r38_finding_has_function_name():
    """R-38 Finding enthält den Funktionsnamen im evidence."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(LISTENER_IN_RENDER_JS, file_path="js/render.js")
    r38 = [f for f in findings if f.rule == "R-38"]
    assert len(r38) >= 1
    snippet = r38[0].evidence.get("code_snippet", "")
    assert "render" in snippet.lower() or "addEventListener" in snippet


# ─── Tests: Kombiniert und Qualität ──────────────────────────────────────────

def test_combined_problems_detected():
    """Beide Regeln R-37 und R-38 werden im kombinierten Code erkannt."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(COMBINED_PROBLEMS_JS, file_path="js/app.js")
    rules = {f.rule for f in findings}
    assert "R-37" in rules
    assert "R-38" in rules


def test_all_findings_have_required_fields():
    """Alle Findings haben severity, confidence, file, line, rule, evidence, reasoning."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(COMBINED_PROBLEMS_JS, file_path="js/app.js")
    for f in findings:
        assert f.severity is not None
        assert f.confidence is not None
        assert f.file is not None
        assert f.line >= 1
        assert f.rule is not None
        assert isinstance(f.evidence, dict)
        assert f.reasoning is not None


def test_no_false_positives_on_correct_code():
    """Korrekter Code erzeugt keine R-37/R-38 Findings."""
    analyzer = StateConsistencyAnalyzer()
    findings = analyzer.analyze_code(CORRECT_CODE_JS, file_path="js/correct.js")
    bad = [f for f in findings if f.rule in ("R-37", "R-38")]
    assert len(bad) == 0
