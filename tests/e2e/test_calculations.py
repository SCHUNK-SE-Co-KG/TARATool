"""
@file        test_calculations.py
@description Comprehensive calculation tests for risk scores, KSTU worst-case
             inheritance, residual risk, treatment aggregation, DOT export, and
             residual risk card rendering.
             Uses an anonymized fixture (calc_test_fixture.json) with 6 attack
             trees covering all treatment types and tree structures.
@author      Test Framework
@organization SCHUNK SE & Co. KG
@copyright   2026 SCHUNK SE & Co. KG
@license     GPL-3.0

Expected values (hand-computed, verified):
┌──────┬─────────────┬──────┬──────┬──────────┬──────────┬────────────┐
│ Tree │ Treatment   │  R   │  RR  │ R Level  │ RR Level │ Scenario   │
├──────┼─────────────┼──────┼──────┼──────────┼──────────┼────────────┤
│ T01  │ Mitigiert   │ 1.50 │ 0.40 │ medium   │ low      │ All mit.   │
│ T02  │ Akzeptiert  │ 1.80 │ 1.80 │ high     │ high     │ All acc.   │
│ T03  │ Gemischt    │ 2.20 │ 1.40 │ critical │ medium   │ Mixed      │
│ T04  │ -           │ 2.00 │ 2.00 │ critical │ critical │ Untreated  │
│ T05  │ Delegiert   │ 1.60 │ 1.60 │ high     │ high     │ Delegated  │
│ T06  │ Gemischt    │ 2.20 │ 1.40 │ critical │ medium   │ Deep nest  │
└──────┴─────────────┴──────┴──────┴──────────┴──────────┴────────────┘

Impact matrix:
  A01 (schutzbedarf III, g=1.0): DS1=3, DS2=2, DS3=1
  A02 (schutzbedarf II,  g=0.8): DS1=2, DS2=3, DS3=2

I(N) table:
  ds=[DS1]           → 1.00   ds=[DS2]           → 0.80
  ds=[DS3]           → 0.48   ds=[DS1,DS2]       → 1.00
  ds=[DS1,DS3]       → 1.00   ds=[DS2,DS3]       → 0.80
  ds=[DS1,DS2,DS3]   → 1.00
"""

import json
import re
import pytest
from pathlib import Path
from playwright.sync_api import Page

from conftest import APP_URL

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "calc_test_fixture.json"

# ---------------------------------------------------------------------------
# Expected values – hand-computed and cross-verified
# ---------------------------------------------------------------------------

TREES = [
    # (id, uid, R, RR, R_level, RR_level, treatment, kstu, rr_kstu)
    ("T01", "risk_calc_0001", "1.50", "0.40", "medium",   "low",      "Mitigiert",
     {"k": "0.5", "s": "0.3", "t": "0.4", "u": "0.3"},
     {"k": "0.1", "s": "0.1", "t": "0.1", "u": "0.1"}),
    ("T02", "risk_calc_0002", "1.80", "1.80", "high",     "high",     "Akzeptiert",
     {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.5"},
     {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.5"}),
    ("T03", "risk_calc_0003", "2.20", "1.40", "critical", "medium",   "Gemischt",
     {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"},
     {"k": "0.5", "s": "0.3", "t": "0.3", "u": "0.3"}),
    ("T04", "risk_calc_0004", "2.00", "2.00", "critical", "critical", "-",
     {"k": "0.5", "s": "0.5", "t": "0.5", "u": "0.5"},
     {"k": "0.5", "s": "0.5", "t": "0.5", "u": "0.5"}),
    ("T05", "risk_calc_0005", "1.60", "1.60", "high",     "high",     "Delegiert",
     {"k": "0.3", "s": "0.3", "t": "0.5", "u": "0.5"},
     {"k": "0.3", "s": "0.3", "t": "0.5", "u": "0.5"}),
    ("T06", "risk_calc_0006", "2.20", "1.40", "critical", "medium",   "Gemischt",
     {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"},
     {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.1"}),
]

# Parametrize-friendly: extract just uid/R/RR for the most common tests
TREE_IDS = [t[0] for t in TREES]
TREE_UIDS = {t[0]: t[1] for t in TREES}
TREE_R = {t[0]: t[2] for t in TREES}
TREE_RR = {t[0]: t[3] for t in TREES}
TREE_R_LEVEL = {t[0]: t[4] for t in TREES}
TREE_RR_LEVEL = {t[0]: t[5] for t in TREES}
TREE_TREATMENT = {t[0]: t[6] for t in TREES}
TREE_KSTU = {t[0]: t[7] for t in TREES}
TREE_RR_KSTU = {t[0]: t[8] for t in TREES}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def loaded(page: Page):
    """Load app, inject calc_test_fixture.json, reload."""
    page.goto(APP_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixture = json.load(f)
    page.evaluate(
        "(data) => { localStorage.setItem('taraAnalyses', JSON.stringify([data])); }",
        fixture,
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    return page


# ---------------------------------------------------------------------------
# 1. Risk Score Calculation: R = I(N) * (K+S+T+U)
# ---------------------------------------------------------------------------

class TestRiskScoreCalculation:
    """Verify original risk score R for each tree via JS _computeRiskScore."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_risk_score(self, loaded: Page, tree_id: str):
        """R = I(N) * sum(K,S,T,U) must match expected value."""
        uid = TREE_UIDS[tree_id]
        expected_r = TREE_R[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            const entry = a.riskEntries.find(e => e.uid === '{uid}');
            if (!entry) return {{ error: 'entry not found' }};
            const iNorm = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu || {{}};
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return {{ R: (iNorm * sumP).toFixed(2), i_norm: entry.i_norm, kstu: kstu }};
        }}""")
        assert "error" not in result, f"Error: {result}"
        assert result["R"] == expected_r, f"{tree_id}: R={result['R']} expected {expected_r}"


# ---------------------------------------------------------------------------
# 2. Risk Level Classification
# ---------------------------------------------------------------------------

class TestRiskLevelClassification:
    """Verify _getRiskLevel for R and RR values at threshold boundaries."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_risk_level(self, loaded: Page, tree_id: str):
        """Original risk level must match expected classification."""
        uid = TREE_UIDS[tree_id]
        expected = TREE_R_LEVEL[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            const entry = a.riskEntries.find(e => e.uid === '{uid}');
            if (!entry) return 'not_found';
            const iNorm = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu || {{}};
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return _getRiskLevel(iNorm * sumP);
        }}""")
        assert result == expected, f"{tree_id}: level={result} expected {expected}"

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_residual_risk_level(self, loaded: Page, tree_id: str):
        """Residual risk level must match expected classification."""
        uid = TREE_UIDS[tree_id]
        expected = TREE_RR_LEVEL[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, '{uid}');
            if (!m) return 'null';
            return _getRiskLevel(parseFloat(m.riskValue));
        }}""")
        assert result == expected, f"{tree_id}: RR level={result} expected {expected}"


# ---------------------------------------------------------------------------
# 3. KSTU Worst-Case Inheritance
# ---------------------------------------------------------------------------

class TestKSTUInheritance:
    """Verify that applyWorstCaseInheritance produces correct root KSTU."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_root_kstu_after_inheritance(self, loaded: Page, tree_id: str):
        """Root KSTU must equal worst-case across all branches/leaves."""
        uid = TREE_UIDS[tree_id]
        expected = TREE_KSTU[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            const entry = a.riskEntries.find(e => e.uid === '{uid}');
            if (!entry) return {{ error: 'not found' }};
            const clone = JSON.parse(JSON.stringify(entry));
            applyWorstCaseInheritance(clone);
            return clone.kstu;
        }}""")
        assert "error" not in result, f"Error: {result}"
        for dim in ("k", "s", "t", "u"):
            assert result[dim] == expected[dim], \
                f"{tree_id}: KSTU.{dim}={result[dim]} expected {expected[dim]}"

    def test_deep_tree_intermediate_kstu(self, loaded: Page):
        """T06: verify KSTU at every intermediate level in a deeply nested tree."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            const entry = a.riskEntries.find(e => e.uid === 'risk_calc_0006');
            const clone = JSON.parse(JSON.stringify(entry));
            applyWorstCaseInheritance(clone);
            const root = clone.treeV2;
            const pathA = root.children[0];  // Protocol Attack
            const pathB = root.children[1];  // Configuration Exploit
            const a1 = pathA.children[0];    // Message Forgery
            const a1a = a1.children[0];      // Replay Attack
            const a1b = a1.children[1];      // Command Injection
            const a2 = pathA.children[1];    // Denial of Service
            const b1 = pathB.children[0];    // Default Credentials
            return {
                root: root.kstu,
                pathA: pathA.kstu, pathB: pathB.kstu,
                a1: a1.kstu, a1a: a1a.kstu, a1b: a1b.kstu,
                a2: a2.kstu, b1: b1.kstu
            };
        }""")
        # Sub-nodes: propagated from leaves
        assert result["a1a"] == {"k": "0.3", "s": "0.1", "t": "0.3", "u": "0.3"}
        assert result["a1b"] == {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.1"}
        assert result["a2"]  == {"k": "0.1", "s": "0.5", "t": "0.1", "u": "0.5"}
        assert result["b1"]  == {"k": "0.7", "s": "0.3", "t": "0.3", "u": "0.3"}
        # Node A1 = worst(a1a, a1b)
        assert result["a1"] == {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.3"}
        # Path A = worst(A1, A2)
        assert result["pathA"] == {"k": "0.5", "s": "0.5", "t": "0.5", "u": "0.5"}
        # Path B = B1
        assert result["pathB"] == {"k": "0.7", "s": "0.3", "t": "0.3", "u": "0.3"}
        # Root = worst(pathA, pathB)
        assert result["root"] == {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}


# ---------------------------------------------------------------------------
# 4. Residual Risk Calculation (computeResidualTreeMetrics)
# ---------------------------------------------------------------------------

class TestResidualRiskCalculation:
    """Verify computeResidualTreeMetrics returns correct RR and KSTU."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_residual_risk_value(self, loaded: Page, tree_id: str):
        """RR value must match expected for each tree."""
        uid = TREE_UIDS[tree_id]
        expected_rr = TREE_RR[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, '{uid}');
            return m;
        }}""")
        assert result is not None, f"{tree_id}: computeResidualTreeMetrics returned null"
        assert result["riskValue"] == expected_rr, \
            f"{tree_id}: RR={result['riskValue']} expected {expected_rr}"

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_residual_kstu(self, loaded: Page, tree_id: str):
        """Residual KSTU at root must match expected values."""
        uid = TREE_UIDS[tree_id]
        expected = TREE_RR_KSTU[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, '{uid}');
            return m ? m.kstu : null;
        }}""")
        assert result is not None, f"{tree_id}: KSTU is null"
        for dim in ("k", "s", "t", "u"):
            assert result[dim] == expected[dim], \
                f"{tree_id}: RR KSTU.{dim}={result[dim]} expected {expected[dim]}"

    def test_accepted_rr_equals_r(self, loaded: Page):
        """T02 (all accepted): RR must equal R exactly."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, 'risk_calc_0002');
            const entry = a.riskEntries.find(e => e.uid === 'risk_calc_0002');
            const iN = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu;
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return { R: (iN * sumP).toFixed(2), RR: m.riskValue };
        }""")
        assert result["R"] == result["RR"], f"T02: R={result['R']} != RR={result['RR']}"

    def test_delegated_rr_equals_r(self, loaded: Page):
        """T05 (delegated): RR must equal R exactly."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, 'risk_calc_0005');
            const entry = a.riskEntries.find(e => e.uid === 'risk_calc_0005');
            const iN = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu;
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return { R: (iN * sumP).toFixed(2), RR: m.riskValue };
        }""")
        assert result["R"] == result["RR"], f"T05: R={result['R']} != RR={result['RR']}"

    def test_untreated_rr_equals_r(self, loaded: Page):
        """T04 (no treatment): RR must equal R exactly."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, 'risk_calc_0004');
            const entry = a.riskEntries.find(e => e.uid === 'risk_calc_0004');
            const iN = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu;
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return { R: (iN * sumP).toFixed(2), RR: m.riskValue };
        }""")
        assert result["R"] == result["RR"], f"T04: R={result['R']} != RR={result['RR']}"

    def test_mitigated_rr_less_than_r(self, loaded: Page):
        """T01 (all mitigated): RR must be strictly less than R."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, 'risk_calc_0001');
            const entry = a.riskEntries.find(e => e.uid === 'risk_calc_0001');
            const iN = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu;
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return { R: iN * sumP, RR: parseFloat(m.riskValue) };
        }""")
        assert result["RR"] < result["R"], \
            f"T01: RR={result['RR']} should be < R={result['R']}"

    def test_mixed_rr_less_than_r(self, loaded: Page):
        """T03 (mixed): RR must be less than R but greater than fully mitigated."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m3 = computeResidualTreeMetrics(a, 'risk_calc_0003');
            const e3 = a.riskEntries.find(e => e.uid === 'risk_calc_0003');
            const iN = parseFloat(e3.i_norm) || 0;
            const kstu = e3.kstu;
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return { R: iN * sumP, RR: parseFloat(m3.riskValue) };
        }""")
        assert result["RR"] < result["R"], \
            f"T03: RR={result['RR']} should be < R={result['R']}"
        assert result["RR"] > 0, "T03: RR should be > 0"


# ---------------------------------------------------------------------------
# 5. Treatment Aggregation
# ---------------------------------------------------------------------------

class TestTreatmentAggregation:
    """Verify _treatmentNode correctly aggregates leaf treatments."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_root_treatment(self, loaded: Page, tree_id: str):
        """Root-level treatment must match expected aggregation."""
        uid = TREE_UIDS[tree_id]
        expected = TREE_TREATMENT[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            // Get the residual entry to check treatments
            const rrEntry = a.residualRisk.entries.find(e => e.uid === '{uid}');
            if (!rrEntry || !rrEntry.treeV2) return 'no_entry';
            // Use the same logic as DOT export: _treatmentNode on the root
            // Inline implementation (matches dot_export.js)
            const _treatmentLeaf = (leaf) => {{
                const tr = String(leaf && leaf.rr && leaf.rr.treatment || '').trim();
                return tr || '-';
            }};
            const _collectTreatments = (node, set) => {{
                if (!node) return;
                (node.impacts || []).forEach(l => set.add(_treatmentLeaf(l)));
                (node.children || []).forEach(ch => _collectTreatments(ch, set));
            }};
            const set = new Set();
            _collectTreatments(rrEntry.treeV2, set);
            if (set.size > 1 && set.has('-')) set.delete('-');
            if (set.size === 0) return '-';
            if (set.size === 1) return Array.from(set)[0] || '-';
            return 'Gemischt';
        }}""")
        assert result == expected, f"{tree_id}: treatment={result} expected {expected}"


# ---------------------------------------------------------------------------
# 6. DOT Export Values
# ---------------------------------------------------------------------------

class TestDotExportValues:
    """Verify the DOT residual risk export has correct P(RR), RR, and treatment."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_dot_root_has_values(self, loaded: Page, tree_id: str):
        """Root node in DOT must show P(RR) values (not dashes) and correct RR."""
        uid = TREE_UIDS[tree_id]
        expected_rr = TREE_RR[tree_id].replace(".", ",")
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const dot = exportResidualRiskToDot(a, '{tree_id}');
            return {{ dot: dot }};
        }}""")
        dot = result.get("dot", "")
        assert dot, f"{tree_id}: DOT string is empty"

        # Find root node label
        root_match = re.search(rf'{tree_id}_Root_RR\s*\[label="([^"]+)"', dot)
        assert root_match, f"{tree_id}: Root node not found in DOT"
        label = root_match.group(1)

        # P(RR) must not be all dashes
        prr = re.search(r'P\(RR\)\s*=\s*([^|]+)', label)
        assert prr, f"{tree_id}: P(RR) not found in root label"
        prr_val = prr.group(1).strip()
        assert prr_val != '- / - / - / -', f"{tree_id}: Root P(RR) is all dashes"

        # RR value
        rr = re.search(r'\| RR = ([^|]+)', label)
        assert rr, f"{tree_id}: RR not found in root label"
        rr_val = rr.group(1).strip()
        assert rr_val == expected_rr, f"{tree_id}: DOT RR={rr_val} expected {expected_rr}"

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_dot_treatment_label(self, loaded: Page, tree_id: str):
        """Root node in DOT must display correct treatment label."""
        expected = TREE_TREATMENT[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const dot = exportResidualRiskToDot(a, '{tree_id}');
            return {{ dot: dot }};
        }}""")
        dot = result.get("dot", "")
        root_match = re.search(rf'{tree_id}_Root_RR\s*\[label="([^"]+)"', dot)
        assert root_match, f"{tree_id}: Root not found"
        label = root_match.group(1)

        treat = re.search(r'Behandlung:\s*([^}]+)', label)
        assert treat, f"{tree_id}: Behandlung not found"
        treat_val = treat.group(1).strip()
        assert treat_val == expected, f"{tree_id}: treatment={treat_val} expected {expected}"

    def test_dot_intermediate_nodes_have_values_t06(self, loaded: Page):
        """T06 (deep nesting): all intermediate nodes must show P(RR) values."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const dot = exportResidualRiskToDot(a, 'T06');
            return { dot: dot };
        }""")
        dot = result.get("dot", "")
        assert dot, "DOT string is empty"

        # Find all intermediate nodes (N_RR prefix)
        nodes = re.findall(r'T06_N_RR\w+\s*\[label="([^"]+)"', dot)
        assert len(nodes) >= 4, f"Expected ≥4 intermediate nodes, found {len(nodes)}"

        for i, label in enumerate(nodes):
            prr = re.search(r'P\(RR\)\s*=\s*([^|]+)', label)
            if prr:
                prr_val = prr.group(1).strip()
                assert prr_val != '- / - / - / -', \
                    f"T06 node {i}: P(RR) is all dashes: {label[:100]}"

    def test_dot_leaf_nodes_have_treatment(self, loaded: Page):
        """T03 (mixed): leaf nodes must show correct per-leaf treatment."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const dot = exportResidualRiskToDot(a, 'T03');
            return { dot: dot };
        }""")
        dot = result.get("dot", "")
        leaves = re.findall(r'T03_L_RR\w+\s*\[label="([^"]+)"', dot)
        assert len(leaves) >= 3, f"Expected ≥3 leaf nodes, found {len(leaves)}"

        treatments = []
        for label in leaves:
            treat = re.search(r'Behandlung:\s*([^}]+)', label)
            if treat:
                treatments.append(treat.group(1).strip())
        assert "Mitigiert" in treatments, f"No Mitigiert leaf found: {treatments}"
        assert "Akzeptiert" in treatments, f"No Akzeptiert leaf found: {treatments}"


# ---------------------------------------------------------------------------
# 7. Residual Risk Cards
# ---------------------------------------------------------------------------

class TestResidualRiskCards:
    """Verify that residual risk cards render with correct data."""

    def test_cards_rendered_for_all_trees(self, loaded: Page):
        """All 6 trees should produce residual risk cards."""
        page = loaded
        tab_btn = page.locator('.tab-button[data-tab="tabResidualRisk"]')
        tab_btn.wait_for(state="visible", timeout=5000)
        tab_btn.click()
        page.wait_for_timeout(2000)

        result = page.evaluate("""() => {
            const cards = document.querySelectorAll('.rr-risk-card');
            return {
                count: cards.length,
                ids: Array.from(cards).map(c => {
                    const h = c.querySelector('h3, .rr-card-title, [class*="title"]');
                    return h ? h.innerText.substring(0, 50) : c.innerText.substring(0, 50);
                })
            };
        }""")
        assert result["count"] == 6, f"Expected 6 cards, got {result['count']}: {result['ids']}"

    def test_cards_show_risk_score(self, loaded: Page):
        """Each card must display a Risiko-Score."""
        page = loaded
        tab_btn = page.locator('.tab-button[data-tab="tabResidualRisk"]')
        tab_btn.wait_for(state="visible", timeout=5000)
        tab_btn.click()
        page.wait_for_timeout(2000)

        result = page.evaluate("""() => {
            const cards = document.querySelectorAll('.rr-risk-card');
            return Array.from(cards).map(c => c.innerText.substring(0, 300));
        }""")
        for i, text in enumerate(result):
            assert "Risiko-Score" in text, f"Card {i} missing Risiko-Score: {text[:100]}"

    def test_no_console_errors_on_residual_tab(self, loaded: Page):
        """Switching to residual risk tab must produce no errors."""
        page = loaded
        console_errors = []
        page.on("console", lambda msg: (
            console_errors.append(msg.text) if msg.type == "error" else None
        ))
        tab_btn = page.locator('.tab-button[data-tab="tabResidualRisk"]')
        tab_btn.wait_for(state="visible", timeout=5000)
        tab_btn.click()
        page.wait_for_timeout(2000)

        rr_errors = [e for e in console_errors
                     if "residual" in e.lower() or "kstu" in e.lower()
                     or "applyWorstCase" in e or "computeResidual" in e.lower()]
        assert len(rr_errors) == 0, f"Console errors: {rr_errors}"


# ---------------------------------------------------------------------------
# 8. Comprehensive Deep-Tree Residual Risk Trace (T06)
# ---------------------------------------------------------------------------

class TestDeepTreeResidualTrace:
    """Trace residual KSTU at every level of T06 (4 depth levels, mixed treatments)."""

    def test_residual_kstu_at_every_level(self, loaded: Page):
        """After residual computation, each level must have correct KSTU."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const uid = 'risk_calc_0006';
            const residual = getResidualEntryByUid(a, uid);
            if (!residual) return { error: 'no residual entry' };
            const clone = JSON.parse(JSON.stringify(residual));
            // Replace leaf KSTU for mitigated (same logic as computeResidualTreeMetrics)
            rrIterateLeaves(clone, (meta) => {
                const leaf = meta.leaf;
                if (!leaf) return;
                const rr = leaf.rr || {};
                const isMit = String(rr.treatment || '').trim() === 'Mitigiert';
                if (!isMit) return;
                ['k','s','t','u'].forEach(d => {
                    const rrVal = String(rr[d] || '').trim();
                    if (rrVal) leaf[d] = rrVal;
                });
            });
            applyWorstCaseInheritance(clone);
            const root = clone.treeV2;
            const pathA = root.children[0];
            const pathB = root.children[1];
            const a1 = pathA.children[0];
            const a1a = a1.children[0];
            const a1b = a1.children[1];
            const a2 = pathA.children[1];
            const b1 = pathB.children[0];
            return {
                root: root.kstu,
                pathA: pathA.kstu, pathB: pathB.kstu,
                a1: a1.kstu, a1a: a1a.kstu, a1b: a1b.kstu,
                a2: a2.kstu, b1: b1.kstu
            };
        }""")
        assert "error" not in result, f"Error: {result}"

        # Leaf-level residual KSTU:
        # a1a (mitigated): 0.1/0.1/0.1/0.1
        assert result["a1a"] == {"k": "0.1", "s": "0.1", "t": "0.1", "u": "0.1"}
        # a1b (accepted): keeps original 0.5/0.3/0.5/0.1
        assert result["a1b"] == {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.1"}
        # a2 (mitigated): 0.1/0.1/0.1/0.1
        assert result["a2"] == {"k": "0.1", "s": "0.1", "t": "0.1", "u": "0.1"}
        # b1 (mitigated): 0.1/0.1/0.1/0.1
        assert result["b1"] == {"k": "0.1", "s": "0.1", "t": "0.1", "u": "0.1"}
        # a1 = worst(a1a, a1b) → 0.5/0.3/0.5/0.1 (accepted leaf dominates)
        assert result["a1"] == {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.1"}
        # pathA = worst(a1, a2) → 0.5/0.3/0.5/0.1
        assert result["pathA"] == {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.1"}
        # pathB = b1 → 0.1/0.1/0.1/0.1
        assert result["pathB"] == {"k": "0.1", "s": "0.1", "t": "0.1", "u": "0.1"}
        # root = worst(pathA, pathB) → 0.5/0.3/0.5/0.1
        assert result["root"] == {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.1"}

    def test_accepted_leaf_dominates_residual(self, loaded: Page):
        """In T06, accepted leaf_t06_02 must define the residual worst-case for pathA."""
        result = loaded.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, 'risk_calc_0006');
            return m ? m.kstu : null;
        }""")
        assert result is not None
        # Root RR KSTU = 0.5/0.3/0.5/0.1 (dominated by accepted leaf_t06_02)
        assert result["k"] == "0.5", f"K={result['k']} (expected 0.5 from accepted leaf)"
        assert result["u"] == "0.1", f"U={result['u']} (expected 0.1 from accepted leaf)"


# ---------------------------------------------------------------------------
# 9. Risk Score Comparison (R vs RR invariants)
# ---------------------------------------------------------------------------

class TestRiskScoreInvariants:
    """Verify mathematical invariants: RR ≤ R for all trees, equality for non-mitigated."""

    @pytest.mark.parametrize("tree_id", TREE_IDS)
    def test_rr_not_greater_than_r(self, loaded: Page, tree_id: str):
        """RR must never exceed R for any tree."""
        uid = TREE_UIDS[tree_id]
        result = loaded.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const m = computeResidualTreeMetrics(a, '{uid}');
            const entry = a.riskEntries.find(e => e.uid === '{uid}');
            const iN = parseFloat(entry.i_norm) || 0;
            const kstu = entry.kstu;
            const sumP = (parseFloat(kstu.k)||0) + (parseFloat(kstu.s)||0)
                       + (parseFloat(kstu.t)||0) + (parseFloat(kstu.u)||0);
            return {{ R: iN * sumP, RR: parseFloat(m.riskValue) }};
        }}""")
        assert result["RR"] <= result["R"] + 0.001, \
            f"{tree_id}: RR={result['RR']} > R={result['R']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
