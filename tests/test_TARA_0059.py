"""TDD tests for TARA-0059: Fehlerbehandlung, Defaultwerte und Null/Undefined-Probleme.

Tests written BEFORE implementation – all must fail initially.
Scenarios:
  (a) Leerer catch-Block und catch mit nur console.log  (R-33)
  (b) JSON.parse ohne try/catch                         (R-33, Hoch)
  (c) || wo ?? korrekt wäre (0/false/'' Falsy-Problem)  (R-34)
  (d) Mehrstufige Property-Chain ohne Guard             (R-35)
  (e) Korrekter Code → keine False-Positives
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.review_agent.finding_framework import Confidence, Finding, Severity
from agents.review_agent.error_handler_analyzer import ErrorHandlerAnalyzer

# ─── Test snippets ────────────────────────────────────────────────────────────

EMPTY_CATCH_JS = """\
function loadData() {
    try {
        return JSON.parse(localStorage.getItem('data'));
    } catch (e) {
    }
}
"""

CONSOLE_ONLY_CATCH_JS = """\
function saveData(data) {
    try {
        localStorage.setItem('data', JSON.stringify(data));
    } catch (err) {
        console.log(err);
    }
}
"""

JSON_PARSE_NO_TRY_JS = """\
function parseConfig(raw) {
    const config = JSON.parse(raw);
    return config;
}
"""

OR_INSTEAD_OF_NULLISH_JS = """\
function getCount(options) {
    const count = options.count || 10;
    const enabled = options.enabled || true;
    return count;
}
"""

NULL_CHAIN_JS = """\
function getCity(user) {
    return user.address.city;
}
"""

CORRECT_CODE_JS = """\
function loadSafe(raw) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('Parse failed:', e);
        return null;
    }
}

function getCount(options) {
    const count = options.count ?? 10;
    return count;
}

function getCity(user) {
    return user?.address?.city;
}
"""


# ─── Tests: R-33 Fehlerbehandlung ────────────────────────────────────────────

def test_empty_catch_detected():
    """R-33: Leerer catch-Block wird erkannt."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(EMPTY_CATCH_JS, file_path="js/load.js")
    rules = [f.rule for f in findings]
    assert "R-33" in rules


def test_console_only_catch_detected():
    """R-33: catch mit nur console.log wird erkannt."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(CONSOLE_ONLY_CATCH_JS, file_path="js/save.js")
    rules = [f.rule for f in findings]
    assert "R-33" in rules


def test_json_parse_without_try_detected():
    """R-33: JSON.parse ohne try/catch wird als Hoch erkannt."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(JSON_PARSE_NO_TRY_JS, file_path="js/config.js")
    r33 = [f for f in findings if f.rule == "R-33"]
    assert len(r33) >= 1
    assert any(f.severity == Severity.Hoch for f in r33)


# ─── Tests: R-34 Defaultwerte ────────────────────────────────────────────────

def test_or_instead_of_nullish_detected():
    """R-34: || statt ?? bei potenziell falsy-Werten wird erkannt."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(OR_INSTEAD_OF_NULLISH_JS, file_path="js/opts.js")
    rules = [f.rule for f in findings]
    assert "R-34" in rules


def test_r34_finding_has_reasoning():
    """R-34 Finding erklärt warum || problematisch ist."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(OR_INSTEAD_OF_NULLISH_JS, file_path="js/opts.js")
    r34 = [f for f in findings if f.rule == "R-34"]
    assert len(r34) >= 1
    assert r34[0].reasoning is not None
    assert len(r34[0].reasoning) > 10


# ─── Tests: R-35 Null/Undefined ──────────────────────────────────────────────

def test_null_chain_detected():
    """R-35: user.address.city ohne Guard wird erkannt."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(NULL_CHAIN_JS, file_path="js/user.js")
    rules = [f.rule for f in findings]
    assert "R-35" in rules


def test_r35_finding_has_evidence():
    """R-35 Finding enthält code_snippet als Evidence."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(NULL_CHAIN_JS, file_path="js/user.js")
    r35 = [f for f in findings if f.rule == "R-35"]
    assert len(r35) >= 1
    assert "code_snippet" in r35[0].evidence


# ─── Tests: Finding-Qualität ─────────────────────────────────────────────────

def test_all_findings_have_required_fields():
    """Alle Findings haben severity, confidence, file, line, rule, evidence, reasoning."""
    analyzer = ErrorHandlerAnalyzer()
    all_code = EMPTY_CATCH_JS + "\n" + JSON_PARSE_NO_TRY_JS + "\n" + OR_INSTEAD_OF_NULLISH_JS
    findings = analyzer.analyze_code(all_code, file_path="js/combined.js")
    for f in findings:
        assert f.severity is not None
        assert f.confidence is not None
        assert f.file is not None
        assert f.line >= 1
        assert f.rule is not None
        assert isinstance(f.evidence, dict)
        assert f.reasoning is not None


# ─── Tests: No False Positives ────────────────────────────────────────────────

def test_no_false_positives_on_correct_code():
    """Korrekter Code erzeugt keine R-33/R-34/R-35 Findings."""
    analyzer = ErrorHandlerAnalyzer()
    findings = analyzer.analyze_code(CORRECT_CODE_JS, file_path="js/correct.js")
    target_rules = {f.rule for f in findings} & {"R-33", "R-34", "R-35"}
    assert len(target_rules) == 0
