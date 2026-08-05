"""TDD tests for TARA-0058: Kontrollfluss-Analyse, Race Conditions, Async-Sequenzen.

Tests written BEFORE implementation – all must fail initially.
Scenarios:
  (a) Dead code after return/throw  (R-31)
  (b) Missing await in async fn     (R-36)
  (c) Concurrent localStorage.setItem without sync (R-32)
  (d) No false-positives on correct code
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.review_agent.finding_framework import Confidence, Finding, Severity
from agents.review_agent.control_flow_analyzer import ControlFlowAnalyzer

# ─── Test snippets ────────────────────────────────────────────────────────────

DEAD_CODE_JS = """\
function calculateRisk(assetId) {
    if (assetId < 0) {
        return -1;
        console.log("never reached");  // dead code after return
    }
    return assetId * 2;
}
"""

DEAD_CODE_AFTER_THROW = """\
function validateInput(x) {
    if (!x) {
        throw new Error("invalid");
        x = 0;  // dead code after throw
    }
    return x;
}
"""

MISSING_AWAIT_JS = """\
async function saveAnalysis(data) {
    const result = fetchData(data);  // missing await
    return result;
}
"""

MISSING_AWAIT_LOOP = """\
async function processAll(items) {
    for (const item of items) {
        processItem(item);  // missing await in loop
    }
}
"""

RACE_CONDITION_JS = """\
document.getElementById('save-btn').addEventListener('click', function() {
    localStorage.setItem('taraData', JSON.stringify(state));
});

window.addEventListener('beforeunload', function() {
    localStorage.setItem('taraData', JSON.stringify(state));
});
"""

CORRECT_CODE_JS = """\
async function loadData() {
    const result = await fetchData();
    return result;
}

function processSync(x) {
    if (x > 0) {
        return x * 2;
    }
    return 0;
}
"""


# ─── Tests: R-31 Dead Code ────────────────────────────────────────────────────

def test_dead_code_after_return_detected():
    """R-31: Code nach return wird als Finding erkannt."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(DEAD_CODE_JS, file_path="js/risk.js")
    rules = [f.rule for f in findings]
    assert "R-31" in rules


def test_dead_code_after_throw_detected():
    """R-31: Code nach throw wird als Finding erkannt."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(DEAD_CODE_AFTER_THROW, file_path="js/validate.js")
    rules = [f.rule for f in findings]
    assert "R-31" in rules


def test_dead_code_finding_has_file_and_line():
    """R-31 Finding enthält Dateiname und Zeilennummer."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(DEAD_CODE_JS, file_path="js/risk.js")
    r31 = [f for f in findings if f.rule == "R-31"]
    assert len(r31) >= 1
    assert r31[0].file == "js/risk.js"
    assert r31[0].line >= 1


# ─── Tests: R-36 Missing Await ────────────────────────────────────────────────

def test_missing_await_detected():
    """R-36: Fehlendes await in async-Funktion wird erkannt."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(MISSING_AWAIT_JS, file_path="js/save.js")
    rules = [f.rule for f in findings]
    assert "R-36" in rules


def test_missing_await_finding_severity():
    """R-36 Finding hat Severity Hoch oder Mittel."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(MISSING_AWAIT_JS, file_path="js/save.js")
    r36 = [f for f in findings if f.rule == "R-36"]
    assert len(r36) >= 1
    assert r36[0].severity in (Severity.Hoch, Severity.Mittel)


# ─── Tests: R-32 Race Condition ───────────────────────────────────────────────

def test_race_condition_localstorage_detected():
    """R-32: Simultane localStorage.setItem in verschiedenen Event-Handlern erkannt."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(RACE_CONDITION_JS, file_path="js/app.js")
    rules = [f.rule for f in findings]
    assert "R-32" in rules


def test_race_condition_finding_has_evidence():
    """R-32 Finding enthält evidence (Code-Snippet)."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(RACE_CONDITION_JS, file_path="js/app.js")
    r32 = [f for f in findings if f.rule == "R-32"]
    assert len(r32) >= 1
    snippet = r32[0].evidence.get("code_snippet", "")
    assert snippet is not None
    assert len(snippet) > 0


# ─── Tests: Finding-Struktur ──────────────────────────────────────────────────

def test_all_findings_have_required_fields():
    """Jedes Finding enthält severity, confidence, file, line, rule, evidence, reasoning."""
    analyzer = ControlFlowAnalyzer()
    all_code = DEAD_CODE_JS + "\n" + MISSING_AWAIT_JS + "\n" + RACE_CONDITION_JS
    findings = analyzer.analyze_code(all_code, file_path="js/combined.js")
    for f in findings:
        assert f.severity is not None
        assert f.confidence is not None
        assert f.file is not None
        assert f.line >= 1
        assert f.rule is not None
        assert isinstance(f.evidence, dict)
        assert "code_snippet" in f.evidence
        assert f.reasoning is not None


# ─── Tests: No False Positives ────────────────────────────────────────────────

def test_no_false_positives_on_correct_code():
    """Korrekter Code erzeugt keine R-31/R-36 Findings."""
    analyzer = ControlFlowAnalyzer()
    findings = analyzer.analyze_code(CORRECT_CODE_JS, file_path="js/correct.js")
    # Keine R-31 oder R-36 Findings bei korrektem Code
    r31_r36 = [f for f in findings if f.rule in ("R-31", "R-36")]
    assert len(r31_r36) == 0


def test_analyze_returns_list_of_findings():
    """analyze_code gibt immer eine Liste zurück (auch bei leerem Code)."""
    analyzer = ControlFlowAnalyzer()
    result = analyzer.analyze_code("", file_path="empty.js")
    assert isinstance(result, list)
