"""TDD tests for TARA-0057: Change-Scope und Impact-Analyse.

Tests written BEFORE implementation – all must fail initially.
Scenario: 2 changed functions with 3 callers, 1 signature change (contract violation).
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.review_agent.change_scope_analyzer import (
    CallerInfo,
    ChangedFile,
    ChangedFunction,
    ChangeScopeAnalyzer,
    ContractViolation,
    ScopeReport,
)

# ─── Mock data: simulated git diff output (2 changed functions) ──────────────

MOCK_DIFF = """\
diff --git a/js/riskCalculator.js b/js/riskCalculator.js
index abc1234..def5678 100644
--- a/js/riskCalculator.js
+++ b/js/riskCalculator.js
@@ -10,7 +10,7 @@ const VERSION = "1.0";
-function calculateRisk(assetId, threatLevel) {
+function calculateRisk(assetId, threatLevel, mitigationFactor = 1.0) {
     return assetId * threatLevel;
 }
@@ -30,6 +30,8 @@ function calculateRisk(assetId, threatLevel) {
-function getRiskSummary(risks) {
+function getRiskSummary(risks, includeMetadata = false) {
     return risks.reduce((a, b) => a + b, 0);
 }
diff --git a/js/reportGenerator.js b/js/reportGenerator.js
index 111aaaa..222bbbb 100644
--- a/js/reportGenerator.js
+++ b/js/reportGenerator.js
@@ -5,3 +5,3 @@
-function generateReport(data) {
+function generateReport(data, template = "default") {
     return JSON.stringify(data);
 }
"""

# Mock grep output: 3 callers across 2 files
MOCK_GREP_RESULTS = {
    "calculateRisk": [
        "js/taraApp.js:42:  const r = calculateRisk(asset.id, threat.level);",
        "js/batchAnalyzer.js:18:  results.push(calculateRisk(id, lvl));",
    ],
    "getRiskSummary": [
        "js/dashboard.js:77:  const total = getRiskSummary(allRisks);",
    ],
    "generateReport": [],
}


def _make_mock_runner(grep_map: dict) -> "callable":
    """Returns a mock grep runner that returns preset results per function name."""

    def runner(function_name: str, search_root: str) -> list[str]:
        return grep_map.get(function_name, [])

    return runner


# ─── Tests ───────────────────────────────────────────────────────────────────


def test_scope_report_is_dataclass():
    """ScopeReport can be instantiated with required fields."""
    report = ScopeReport(
        changed_files=[],
        changed_functions=[],
        caller_graph={},
        contract_violations=[],
        missing_context=[],
    )
    assert report.changed_files == []
    assert report.caller_graph == {}


def test_changed_function_dataclass():
    """ChangedFunction captures file, name, and signature_changed flag."""
    fn = ChangedFunction(
        file_path="js/riskCalculator.js",
        name="calculateRisk",
        signature_changed=True,
    )
    assert fn.signature_changed is True
    assert fn.name == "calculateRisk"


def test_caller_info_dataclass():
    """CallerInfo captures file, line number and calling context."""
    caller = CallerInfo(
        file_path="js/taraApp.js",
        line_number=42,
        function_name="calculateRisk",
    )
    assert caller.line_number == 42


def test_contract_violation_dataclass():
    """ContractViolation records function, type and detail."""
    cv = ContractViolation(
        function_name="calculateRisk",
        violation_type="signature_change",
        detail="New parameter 'mitigationFactor' added",
    )
    assert cv.violation_type == "signature_change"


def test_parse_diff_finds_two_changed_functions():
    """Analyzer detects 2 changed functions from mock diff."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    fn_names = [f.name for f in report.changed_functions]
    assert "calculateRisk" in fn_names
    assert "getRiskSummary" in fn_names


def test_caller_graph_contains_all_three_callers():
    """Caller graph for the 2 changed functions has 3 total caller entries."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    total_callers = sum(len(v) for v in report.caller_graph.values())
    assert total_callers == 3


def test_caller_graph_keys_match_function_names():
    """Caller graph keys match the names of changed functions."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    assert "calculateRisk" in report.caller_graph
    assert "getRiskSummary" in report.caller_graph


def test_contract_violations_detected_for_signature_changes():
    """Functions with changed signatures produce ContractViolation entries."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    violated_fns = [cv.function_name for cv in report.contract_violations]
    # All 3 functions changed signature → all 3 should appear
    assert "calculateRisk" in violated_fns
    assert "getRiskSummary" in violated_fns


def test_missing_context_flagged_when_callers_present():
    """missing_context is populated when a changed function has active callers."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    # calculateRisk has 2 callers and signature changed → flagged as missing context
    assert len(report.missing_context) >= 1


def test_to_dict_is_json_serializable():
    """ScopeReport.to_dict() produces a JSON-serializable dict."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    d = report.to_dict()
    serialized = json.dumps(d)
    assert isinstance(serialized, str)
    parsed = json.loads(serialized)
    assert "changed_functions" in parsed
    assert "caller_graph" in parsed
    assert "contract_violations" in parsed
    assert "missing_context" in parsed


def test_to_dict_structure_matches_schema():
    """to_dict() output matches canonical schema with required top-level keys."""
    analyzer = ChangeScopeAnalyzer(grep_runner=_make_mock_runner(MOCK_GREP_RESULTS))
    report = analyzer.analyze_from_diff(MOCK_DIFF, search_root="js/")
    d = report.to_dict()
    assert isinstance(d["changed_functions"], list)
    assert isinstance(d["caller_graph"], dict)
    assert isinstance(d["contract_violations"], list)
    assert isinstance(d["missing_context"], list)
    # Each changed_function entry has required fields
    if d["changed_functions"]:
        fn = d["changed_functions"][0]
        assert "name" in fn
        assert "file_path" in fn
        assert "signature_changed" in fn
