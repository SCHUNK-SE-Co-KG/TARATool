"""
@file        test_backward_compat.py
@description Critical regression tests for backward compatibility, data structure
             integrity, and calculation correctness. Designed to catch breaking
             changes in:
             - Data migration (migrateAnalysis)
             - Risk score formula: R = I(N) × (K + S + T + U)
             - Impact normalization: I(N) = max(severity_factor × protection_weight)
             - KSTU worst-case inheritance across tree formats
             - Risk level threshold boundaries
             - Save/load roundtrip fidelity (no data loss)
             - Legacy branches[] format compatibility
             - Impact matrix change cascading to risk scores
@covers      utils.js, globals.js, attack_tree_calc.js, residual_risk_data.js,
             impact_matrix.js, config_loader.js
@author      Test Framework
@organization SCHUNK SE & Co. KG
@copyright   2026 SCHUNK SE & Co. KG
@license     GPL-3.0
"""

import json
import pytest
from pathlib import Path
from playwright.sync_api import Page

from conftest import APP_URL

FIXTURE_DIR = Path(__file__).parent / "fixtures"
AGRI_FIXTURE = FIXTURE_DIR / "agri_testbot_tara.json"
CALC_FIXTURE = FIXTURE_DIR / "calc_test_fixture.json"


@pytest.fixture()
def page_with_app(page: Page):
    """Load app with clean state."""
    page.goto(APP_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    return page


@pytest.fixture()
def page_with_agri(page: Page):
    """Load app with agri_testbot fixture (has both treeV2 and branches)."""
    page.goto(APP_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    with open(AGRI_FIXTURE, "r", encoding="utf-8") as f:
        fixture = json.load(f)
    page.evaluate(
        "(data) => { localStorage.setItem('taraAnalyses', JSON.stringify([data])); }",
        fixture,
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    return page


@pytest.fixture()
def page_with_calc(page: Page):
    """Load app with calc_test_fixture."""
    page.goto(APP_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(500)
    with open(CALC_FIXTURE, "r", encoding="utf-8") as f:
        fixture = json.load(f)
    page.evaluate(
        "(data) => { localStorage.setItem('taraAnalyses', JSON.stringify([data])); }",
        fixture,
    )
    page.reload(wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    return page


# ═══════════════════════════════════════════════════════════════════════════
# 1. DATA MIGRATION: migrateAnalysis() must handle old and new formats
# ═══════════════════════════════════════════════════════════════════════════

class TestMigrateAnalysis:
    """Verify migrateAnalysis() correctly initializes missing fields."""

    def test_missing_residual_risk_gets_created(self, page_with_app: Page):
        """An analysis without residualRisk field must get one after load."""
        page = page_with_app
        result = page.evaluate("""() => {
            const bare = {
                id: 'test-bare', name: 'Bare', description: '',
                intendedUse: '', metadata: {version:'0.1', author:'x', date:'2026-01-01'},
                history: [], assets: [], damageScenarios: [],
                impactMatrix: {}, riskEntries: [], securityGoals: []
            };
            // No residualRisk field!
            localStorage.setItem('taraAnalyses', JSON.stringify([bare]));
            loadAnalyses();
            const a = analysisData[0];
            return {
                hasRR: !!a.residualRisk,
                hasLeaves: !!a.residualRisk?.leaves,
                hasEntries: Array.isArray(a.residualRisk?.entries),
                hasTreeNotes: !!a.residualRisk?.treeNotes
            };
        }""")
        assert result["hasRR"], "residualRisk must be created"
        assert result["hasLeaves"], "residualRisk.leaves must be created"
        assert result["hasEntries"], "residualRisk.entries must be array"
        assert result["hasTreeNotes"], "residualRisk.treeNotes must be created"

    def test_missing_damage_scenarios_gets_defaults(self, page_with_app: Page):
        """An analysis without damageScenarios must get DEFAULT_DAMAGE_SCENARIOS."""
        page = page_with_app
        result = page.evaluate("""() => {
            const bare = {
                id: 'test-ds', name: 'No DS', description: '',
                intendedUse: '', metadata: {version:'0.1', author:'x', date:'2026-01-01'},
                history: [], assets: [], impactMatrix: {},
                riskEntries: [], securityGoals: [],
                residualRisk: { leaves: {}, entries: [], treeNotes: {} }
            };
            localStorage.setItem('taraAnalyses', JSON.stringify([bare]));
            loadAnalyses();
            const a = analysisData[0];
            return {
                count: a.damageScenarios.length,
                firstId: a.damageScenarios[0]?.id
            };
        }""")
        assert result["count"] == 5, f"Expected 5 default DS, got {result['count']}"
        assert result["firstId"] == "DS1"

    def test_risk_entries_get_uid_assigned(self, page_with_app: Page):
        """Risk entries without uid must get one during migration."""
        page = page_with_app
        result = page.evaluate("""() => {
            const bare = {
                id: 'test-uid', name: 'UID Test', description: '',
                intendedUse: '', metadata: {version:'0.1', author:'x', date:'2026-01-01'},
                history: [], assets: [], damageScenarios: [],
                impactMatrix: {},
                riskEntries: [
                    { id: 'R01', rootName: 'Test', treeV2: { uid:'n1', title:'T', children:[], impacts:[] } },
                    { id: 'R02', rootName: 'Test2', treeV2: { uid:'n2', title:'T2', children:[], impacts:[] } }
                ],
                securityGoals: [],
                residualRisk: { leaves: {}, entries: [], treeNotes: {} }
            };
            localStorage.setItem('taraAnalyses', JSON.stringify([bare]));
            loadAnalyses();
            const a = analysisData[0];
            return a.riskEntries.map(e => ({ id: e.id, hasUid: !!e.uid, uidPrefix: (e.uid||'').substring(0,4) }));
        }""")
        for entry in result:
            assert entry["hasUid"], f"Entry {entry['id']} missing uid"
            assert entry["uidPrefix"] == "risk", f"Entry {entry['id']} uid should start with 'risk'"

    def test_corrupt_localstorage_creates_fresh(self, page_with_app: Page):
        """Corrupted localStorage data must not crash – fallback to default."""
        page = page_with_app
        result = page.evaluate("""() => {
            localStorage.setItem('taraAnalyses', '{invalid json!!!');
            loadAnalyses();
            return { count: analysisData.length, id: analysisData[0]?.id };
        }""")
        assert result["count"] == 1
        assert result["id"] == "tara-001"


# ═══════════════════════════════════════════════════════════════════════════
# 2. RISK SCORE FORMULA: R = I(N) × (K + S + T + U)
# ═══════════════════════════════════════════════════════════════════════════

class TestRiskScoreFormula:
    """Unit-level tests for computeRiskScore – the single source of truth."""

    @pytest.mark.parametrize("i_norm,kstu,expected", [
        # Normal cases
        (1.0, {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}, 2.20),
        (1.0, {"k": "0.5", "s": "0.3", "t": "0.4", "u": "0.3"}, 1.50),
        (0.8, {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.5"}, 1.44),
        # Zero impact → R = 0
        (0.0, {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}, 0.0),
        # Zero probability → R = 0
        (1.0, {"k": "0", "s": "0", "t": "0", "u": "0"}, 0.0),
        # Single criterion only
        (1.0, {"k": "0.7", "s": "0", "t": "0", "u": "0"}, 0.70),
        # Maximum possible: I(N)=1.0, all KSTU max
        (1.0, {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}, 2.20),
        # String parsing
        ("1.00", {"k": "0.5", "s": "0.3", "t": "0.5", "u": "0.5"}, 1.80),
    ])
    def test_compute_risk_score(self, page_with_app: Page, i_norm, kstu, expected):
        """computeRiskScore must produce correct R value."""
        page = page_with_app
        result = page.evaluate(f"""() => {{
            const R = computeRiskScore({json.dumps(i_norm)}, {json.dumps(kstu)});
            return parseFloat(R.toFixed(2));
        }}""")
        assert result == expected, f"R={result} expected {expected}"

    def test_null_kstu_returns_zero(self, page_with_app: Page):
        """Null/undefined KSTU must return 0, not NaN or crash."""
        page = page_with_app
        result = page.evaluate("""() => {
            const r1 = computeRiskScore(1.0, null);
            const r2 = computeRiskScore(1.0, undefined);
            const r3 = computeRiskScore(1.0, {});
            return [r1, r2, r3];
        }""")
        for r in result:
            assert r == 0, f"Expected 0 for null/empty KSTU, got {r}"

    def test_nan_values_treated_as_zero(self, page_with_app: Page):
        """NaN or non-numeric strings in KSTU must be treated as 0."""
        page = page_with_app
        result = page.evaluate("""() => {
            const R = computeRiskScore(1.0, { k: 'abc', s: null, t: undefined, u: '0.5' });
            return parseFloat(R.toFixed(2));
        }""")
        assert result == 0.5, f"Only u=0.5 is valid, R should be 0.5, got {result}"


# ═══════════════════════════════════════════════════════════════════════════
# 3. IMPACT NORMALIZATION: I(N) = max(sFactor × gFactor)
# ═══════════════════════════════════════════════════════════════════════════

class TestImpactNormalization:
    """Verify computeLeafImpactNorm uses correct formula against config values."""

    @pytest.mark.parametrize("ds_list,expected_i_norm", [
        # From calc_test_fixture: A01 (III, g=1.0): DS1=3, DS2=2, DS3=1
        #                          A02 (II, g=0.8): DS1=2, DS2=3, DS3=2
        # DS1 only: max(1.0*1.0, 0.6*0.8) = max(1.0, 0.48) = 1.00
        (["DS1"], "1.00"),
        # DS2 only: max(0.6*1.0, 1.0*0.8) = max(0.6, 0.8) = 0.80
        (["DS2"], "0.80"),
        # DS3 only: max(0.3*1.0, 0.6*0.8) = max(0.3, 0.48) = 0.48
        (["DS3"], "0.48"),
        # DS1+DS2: max of all combinations = max(1.0, 0.6, 0.48, 0.8) = 1.00
        (["DS1", "DS2"], "1.00"),
        # DS2+DS3: max(0.6, 0.3, 0.8, 0.48) = 0.80
        (["DS2", "DS3"], "0.80"),
        # All DS: max across all = 1.00
        (["DS1", "DS2", "DS3"], "1.00"),
        # Empty DS list → empty string
        ([], ""),
    ])
    def test_leaf_impact_norm(self, page_with_calc: Page, ds_list, expected_i_norm):
        """computeLeafImpactNorm must produce correct I(N) for given DS list."""
        page = page_with_calc
        result = page.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            return computeLeafImpactNorm({json.dumps(ds_list)}, a);
        }}""")
        assert result == expected_i_norm, f"I(N)={result} expected {expected_i_norm} for ds={ds_list}"

    def test_nonexistent_ds_ignored(self, page_with_calc: Page):
        """DS IDs not in impactMatrix must not contribute to I(N)."""
        page = page_with_calc
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            return computeLeafImpactNorm(["DS_NONEXISTENT"], a);
        }""")
        assert result == "", f"Non-existent DS should return '', got '{result}'"

    def test_no_assets_returns_empty(self, page_with_app: Page):
        """With no assets, I(N) must be empty string."""
        page = page_with_app
        result = page.evaluate("""() => {
            const a = { assets: [], impactMatrix: {} };
            return computeLeafImpactNorm(["DS1"], a);
        }""")
        assert result == ""


# ═══════════════════════════════════════════════════════════════════════════
# 4. RISK LEVEL THRESHOLD BOUNDARIES
# ═══════════════════════════════════════════════════════════════════════════

class TestRiskLevelBoundaries:
    """Test exact boundary values for _getRiskLevel classification."""

    @pytest.mark.parametrize("score,expected_level", [
        # Critical: >= 2.0
        (2.0, "critical"),
        (2.001, "critical"),
        (3.5, "critical"),
        # High: >= 1.6, < 2.0
        (1.6, "high"),
        (1.99, "high"),
        (1.999, "high"),
        # Medium: >= 0.8, < 1.6
        (0.8, "medium"),
        (1.59, "medium"),
        (1.0, "medium"),
        # Low: < 0.8
        (0.79, "low"),
        (0.0, "low"),
        (0.5, "low"),
        # Edge: exactly at boundary
        (1.5999, "medium"),
        (0.7999, "low"),
    ])
    def test_risk_level_boundary(self, page_with_app: Page, score, expected_level):
        """_getRiskLevel must classify scores at exact boundaries correctly."""
        page = page_with_app
        result = page.evaluate(f"() => _getRiskLevel({score})")
        assert result == expected_level, f"score={score}: got '{result}' expected '{expected_level}'"

    def test_negative_score_is_low(self, page_with_app: Page):
        """Negative values must classify as low."""
        page = page_with_app
        result = page.evaluate("() => _getRiskLevel(-0.5)")
        assert result == "low"

    def test_nan_score_is_low(self, page_with_app: Page):
        """NaN must classify as low (parseFloat returns 0)."""
        page = page_with_app
        result = page.evaluate("() => _getRiskLevel(NaN)")
        assert result == "low"


# ═══════════════════════════════════════════════════════════════════════════
# 5. SAVE/LOAD ROUNDTRIP FIDELITY
# ═══════════════════════════════════════════════════════════════════════════

class TestSaveLoadRoundtrip:
    """Verify save → load preserves all data without loss or corruption."""

    def test_full_analysis_roundtrip(self, page_with_agri: Page):
        """Load agri fixture, save, reload – all data must be preserved."""
        page = page_with_agri
        result = page.evaluate("""() => {
            const before = JSON.parse(JSON.stringify(analysisData[0]));
            saveAnalyses();
            loadAnalyses();
            const after = analysisData[0];
            
            // Compare critical fields
            const checks = {
                name: before.name === after.name,
                assetCount: before.assets.length === after.assets.length,
                dsCount: before.damageScenarios.length === after.damageScenarios.length,
                riskCount: before.riskEntries.length === after.riskEntries.length,
                sgCount: before.securityGoals.length === after.securityGoals.length,
                version: before.metadata.version === after.metadata.version,
                historyCount: before.history.length === after.history.length,
                impactMatrixKeys: Object.keys(before.impactMatrix).length === Object.keys(after.impactMatrix).length,
                rrEntryCount: (before.residualRisk?.entries||[]).length === (after.residualRisk?.entries||[]).length,
            };
            
            // Deep check: risk UIDs preserved
            const beforeUids = before.riskEntries.map(e => e.uid).sort();
            const afterUids = after.riskEntries.map(e => e.uid).sort();
            checks.riskUidsMatch = JSON.stringify(beforeUids) === JSON.stringify(afterUids);
            
            // Deep check: asset data preserved
            checks.assetNamesMatch = JSON.stringify(before.assets.map(a=>a.name).sort()) === 
                                     JSON.stringify(after.assets.map(a=>a.name).sort());
            
            return checks;
        }""")
        for key, value in result.items():
            assert value, f"Roundtrip check failed: {key}"

    def test_residual_risk_leaves_preserved(self, page_with_agri: Page):
        """Residual risk leaf data (treatments, notes) must survive save/load."""
        page = page_with_agri
        result = page.evaluate("""() => {
            const before = JSON.parse(JSON.stringify(analysisData[0].residualRisk));
            saveAnalyses();
            loadAnalyses();
            const after = analysisData[0].residualRisk;
            
            const beforeLeafCount = Object.keys(before.leaves || {}).length;
            const afterLeafCount = Object.keys(after.leaves || {}).length;
            
            // Check that at least one leaf with treatment data survived
            let treatmentCount = 0;
            Object.values(after.leaves || {}).forEach(v => {
                if (v && v.treatment) treatmentCount++;
            });
            
            return {
                beforeLeafCount,
                afterLeafCount,
                leafCountMatch: beforeLeafCount === afterLeafCount,
                treatmentCount,
                hasTreatments: treatmentCount > 0
            };
        }""")
        assert result["leafCountMatch"], \
            f"Leaf count changed: {result['beforeLeafCount']} → {result['afterLeafCount']}"
        assert result["hasTreatments"], "Treatments were lost during save/load"

    def test_kstu_values_preserved_as_strings(self, page_with_agri: Page):
        """KSTU values must remain strings after save/load (not coerced to numbers)."""
        page = page_with_agri
        result = page.evaluate("""() => {
            saveAnalyses();
            loadAnalyses();
            const entry = analysisData[0].riskEntries[0];
            const kstu = entry.kstu;
            return {
                kType: typeof kstu.k,
                sType: typeof kstu.s,
                tType: typeof kstu.t,
                uType: typeof kstu.u,
                kVal: kstu.k,
                sVal: kstu.s
            };
        }""")
        for dim in ("k", "s", "t", "u"):
            assert result[f"{dim}Type"] == "string", \
                f"KSTU.{dim} type should be 'string', got '{result[f'{dim}Type']}'"


# ═══════════════════════════════════════════════════════════════════════════
# 6. LEGACY BRANCHES[] FORMAT COMPATIBILITY
# ═══════════════════════════════════════════════════════════════════════════

class TestLegacyBranchesFormat:
    """Verify the app still works with the old branches[] tree format."""

    def test_legacy_depth1_worst_case(self, page_with_app: Page):
        """A depth=1 tree using branches[] must compute correct worst-case KSTU."""
        page = page_with_app
        result = page.evaluate("""() => {
            const entry = {
                id: 'legacy1', uid: 'risk_legacy_001',
                rootName: 'Legacy Test',
                treeDepth: 1,
                branches: [
                    {
                        name: 'Branch A',
                        leaves: [
                            { text: 'L1', ds: ['DS1'], k: '0.3', s: '0.1', t: '0.2', u: '0.3' },
                            { text: 'L2', ds: ['DS2'], k: '0.5', s: '0.3', t: '0.4', u: '0.1' }
                        ]
                    },
                    {
                        name: 'Branch B',
                        leaves: [
                            { text: 'L3', ds: ['DS1'], k: '0.1', s: '0.5', t: '0.1', u: '0.5' }
                        ]
                    }
                ],
                kstu: {}
            };
            applyWorstCaseInheritance(entry);
            return {
                root: entry.kstu,
                branchA: entry.branches[0].kstu,
                branchB: entry.branches[1].kstu
            };
        }""")
        # Branch A = worst(L1, L2) = { k:0.5, s:0.3, t:0.4, u:0.3 }
        assert result["branchA"] == {"k": "0.5", "s": "0.3", "t": "0.4", "u": "0.3"}
        # Branch B = L3 = { k:0.1, s:0.5, t:0.1, u:0.5 }
        assert result["branchB"] == {"k": "0.1", "s": "0.5", "t": "0.1", "u": "0.5"}
        # Root = worst(A, B) = { k:0.5, s:0.5, t:0.4, u:0.5 }
        assert result["root"] == {"k": "0.5", "s": "0.5", "t": "0.4", "u": "0.5"}

    def test_legacy_depth2_parallel_intermediate(self, page_with_app: Page):
        """A depth=2 tree with l2_nodes[] must propagate KSTU correctly."""
        page = page_with_app
        result = page.evaluate("""() => {
            const entry = {
                id: 'legacy2', uid: 'risk_legacy_002',
                rootName: 'Depth2 Test',
                treeDepth: 2,
                branches: [
                    {
                        name: 'Branch A',
                        l2_nodes: [
                            {
                                name: 'Node A1',
                                leaves: [
                                    { text: 'L1', ds: ['DS1'], k: '0.3', s: '0.3', t: '0.3', u: '0.3' },
                                    { text: 'L2', ds: ['DS2'], k: '0.7', s: '0.1', t: '0.1', u: '0.1' }
                                ]
                            },
                            {
                                name: 'Node A2',
                                leaves: [
                                    { text: 'L3', ds: ['DS1'], k: '0.1', s: '0.5', t: '0.5', u: '0.5' }
                                ]
                            }
                        ]
                    }
                ],
                kstu: {}
            };
            applyWorstCaseInheritance(entry);
            return {
                root: entry.kstu,
                branchA: entry.branches[0].kstu,
                nodeA1: entry.branches[0].l2_nodes[0].kstu,
                nodeA2: entry.branches[0].l2_nodes[1].kstu
            };
        }""")
        # Node A1 = worst(L1, L2) = { k:0.7, s:0.3, t:0.3, u:0.3 }
        assert result["nodeA1"] == {"k": "0.7", "s": "0.3", "t": "0.3", "u": "0.3"}
        # Node A2 = L3 = { k:0.1, s:0.5, t:0.5, u:0.5 }
        assert result["nodeA2"] == {"k": "0.1", "s": "0.5", "t": "0.5", "u": "0.5"}
        # Branch A = worst(A1, A2) = { k:0.7, s:0.5, t:0.5, u:0.5 }
        assert result["branchA"] == {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}
        # Root = Branch A (only branch)
        assert result["root"] == {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}

    def test_legacy_single_l2_node_migration(self, page_with_app: Page):
        """Old format with l2_node (singular) must be migrated to l2_nodes[]."""
        page = page_with_app
        result = page.evaluate("""() => {
            const entry = {
                id: 'legacy3', uid: 'risk_legacy_003',
                rootName: 'Single L2 Test',
                treeDepth: 2,
                branches: [
                    {
                        name: 'Branch A',
                        l2_node: { name: 'Old Node' },
                        leaves: [
                            { text: 'L1', ds: ['DS1'], k: '0.6', s: '0.3', t: '0.2', u: '0.1' }
                        ]
                    }
                ],
                kstu: {}
            };
            applyWorstCaseInheritance(entry);
            return {
                root: entry.kstu,
                hasL2Nodes: Array.isArray(entry.branches[0].l2_nodes),
                l2NodeCount: (entry.branches[0].l2_nodes || []).length
            };
        }""")
        # After normalization, l2_nodes should exist
        assert result["hasL2Nodes"], "l2_node should be migrated to l2_nodes[]"
        assert result["l2NodeCount"] == 1
        assert result["root"] == {"k": "0.6", "s": "0.3", "t": "0.2", "u": "0.1"}

    def test_treeV2_takes_precedence_over_branches(self, page_with_app: Page):
        """When both treeV2 and branches exist, treeV2 must be used for calculation."""
        page = page_with_app
        result = page.evaluate("""() => {
            const entry = {
                id: 'dual', uid: 'risk_dual_001',
                rootName: 'Dual Format',
                treeV2: {
                    uid: 'root', title: 'Root', depth: 0,
                    kstu: {}, impacts: [],
                    children: [{
                        uid: 'path1', title: 'Path', depth: 1,
                        kstu: {}, impacts: [
                            { text: 'Leaf', ds: ['DS1'], k: '0.3', s: '0.3', t: '0.3', u: '0.3' }
                        ],
                        children: []
                    }]
                },
                branches: [
                    {
                        name: 'Wrong Branch',
                        leaves: [
                            { text: 'L1', ds: ['DS1'], k: '0.7', s: '0.7', t: '0.7', u: '0.7' }
                        ]
                    }
                ],
                treeDepth: 1, kstu: {}
            };
            applyWorstCaseInheritance(entry);
            return entry.treeV2.kstu;
        }""")
        # treeV2 leaf has k=0.3, branches leaf has k=0.7
        # If treeV2 takes precedence, root KSTU should be from treeV2
        assert result["k"] == "0.3", "treeV2 should take precedence over branches"


# ═══════════════════════════════════════════════════════════════════════════
# 7. IMPACT MATRIX CHANGE CASCADING
# ═══════════════════════════════════════════════════════════════════════════

class TestImpactMatrixCascade:
    """Verify that impact matrix changes cascade to all risk scores."""

    def test_matrix_change_updates_risk_score(self, page_with_calc: Page):
        """Changing impact matrix must recalculate rootRiskValue on all entries."""
        page = page_with_calc
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            // Get initial risk score for T01
            const before = a.riskEntries.find(e => e.uid === 'risk_calc_0001');
            const rBefore = before.rootRiskValue;
            
            // Change impact matrix: set A01/DS1 from '3' to '1'
            a.impactMatrix['A01']['DS1'] = '1';
            
            // Trigger recalc
            _recalcAllRiskEntries(a);
            
            const rAfter = a.riskEntries.find(e => e.uid === 'risk_calc_0001').rootRiskValue;
            
            // Restore original
            a.impactMatrix['A01']['DS1'] = '3';
            _recalcAllRiskEntries(a);
            
            return { before: rBefore, after: rAfter, changed: rBefore !== rAfter };
        }""")
        assert result["changed"], \
            f"Risk score should change when impact matrix changes. Before={result['before']}, After={result['after']}"

    def test_matrix_zero_impact_zeroes_risk(self, page_with_calc: Page):
        """Setting all impacts to N/A should make risk score 0 or empty."""
        page = page_with_calc
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            // Save original
            const origMatrix = JSON.parse(JSON.stringify(a.impactMatrix));
            
            // Zero out all impacts
            Object.keys(a.impactMatrix).forEach(assetId => {
                Object.keys(a.impactMatrix[assetId]).forEach(dsId => {
                    a.impactMatrix[assetId][dsId] = 'N/A';
                });
            });
            
            _recalcAllRiskEntries(a);
            const scores = a.riskEntries.map(e => parseFloat(e.rootRiskValue) || 0);
            
            // Restore
            a.impactMatrix = origMatrix;
            _recalcAllRiskEntries(a);
            
            return { scores, allZero: scores.every(s => s === 0) };
        }""")
        assert result["allZero"], f"All risk scores should be 0 with N/A impacts: {result['scores']}"


# ═══════════════════════════════════════════════════════════════════════════
# 8. KSTU WORST-CASE EDGE CASES
# ═══════════════════════════════════════════════════════════════════════════

class TestKSTUEdgeCases:
    """Edge cases for _kstuWorstCase that could break calculations."""

    def test_empty_leaves_returns_null_kstu(self, page_with_app: Page):
        """Empty leaves array must produce null KSTU (not zeros)."""
        page = page_with_app
        result = page.evaluate("""() => {
            return _kstuWorstCase([]);
        }""")
        assert result == {"k": None, "s": None, "t": None, "u": None}

    def test_single_leaf_passes_through(self, page_with_app: Page):
        """Single leaf must pass through its values unchanged."""
        page = page_with_app
        result = page.evaluate("""() => {
            return _kstuWorstCase([{ k: '0.3', s: '0.1', t: '0.5', u: '0.3' }]);
        }""")
        assert result == {"k": "0.3", "s": "0.1", "t": "0.5", "u": "0.3"}

    def test_null_values_in_leaves_ignored(self, page_with_app: Page):
        """Leaves with null/undefined KSTU values must be skipped."""
        page = page_with_app
        result = page.evaluate("""() => {
            return _kstuWorstCase([
                { k: null, s: '0.3', t: '0.1', u: '0.1' },
                { k: '0.5', s: null, t: '0.3', u: '0.5' }
            ]);
        }""")
        assert result == {"k": "0.5", "s": "0.3", "t": "0.3", "u": "0.5"}

    def test_string_zero_not_confused_with_null(self, page_with_app: Page):
        """The value '0' is valid (means assessed, lowest probability), not null."""
        page = page_with_app
        result = page.evaluate("""() => {
            return _kstuWorstCase([
                { k: '0', s: '0.3', t: '0', u: '0.1' }
            ]);
        }""")
        # '0' is a legitimate value, should pass through (not become null)
        assert result["k"] == "0", f"'0' should be preserved, got {result['k']}"
        assert result["t"] == "0", f"'0' should be preserved, got {result['t']}"

    def test_kstu_sub_object_preferred(self, page_with_app: Page):
        """When item has a .kstu sub-object, those values take precedence."""
        page = page_with_app
        result = page.evaluate("""() => {
            return _kstuWorstCase([
                { k: '0.1', s: '0.1', t: '0.1', u: '0.1', kstu: { k: '0.7', s: '0.5', t: '0.5', u: '0.5' } }
            ]);
        }""")
        # kstu sub-object values should win
        assert result == {"k": "0.7", "s": "0.5", "t": "0.5", "u": "0.5"}


# ═══════════════════════════════════════════════════════════════════════════
# 9. AGRI FIXTURE FULL CALCULATION VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

class TestAgriFixtureCalculations:
    """End-to-end calculation validation using the agri_testbot fixture."""

    def test_all_risk_entries_have_valid_scores(self, page_with_agri: Page):
        """All 5 risk entries must have non-zero rootRiskValue after load."""
        page = page_with_agri
        result = page.evaluate("""() => {
            const a = analysisData[0];
            return a.riskEntries.map(e => ({
                id: e.id,
                rootRiskValue: e.rootRiskValue,
                hasKstu: !!e.kstu && !!e.kstu.k,
                hasINorm: !!e.i_norm
            }));
        }""")
        for entry in result:
            assert entry["hasKstu"], f"{entry['id']} missing KSTU"
            assert entry["hasINorm"], f"{entry['id']} missing i_norm"
            score = float(entry["rootRiskValue"])
            assert score > 0, f"{entry['id']} has zero risk score"

    def test_recalc_matches_stored_values(self, page_with_agri: Page):
        """Recalculating from scratch must produce same scores as stored."""
        page = page_with_agri
        result = page.evaluate("""() => {
            const a = analysisData[0];
            const results = [];
            a.riskEntries.forEach(entry => {
                const stored = entry.rootRiskValue;
                // Recalculate from inheritance
                const clone = JSON.parse(JSON.stringify(entry));
                applyImpactInheritance(clone, a);
                applyWorstCaseInheritance(clone);
                const recalced = _computeRiskScore(clone.kstu, clone.i_norm).toFixed(2);
                results.push({ id: entry.id, stored, recalced, match: stored === recalced });
            });
            return results;
        }""")
        for r in result:
            assert r["match"], \
                f"{r['id']}: stored={r['stored']} != recalced={r['recalced']}"

    def test_residual_risk_sync_preserves_treatments(self, page_with_agri: Page):
        """syncResidualRiskFromRiskAnalysis must preserve existing treatments."""
        page = page_with_agri
        result = page.evaluate("""() => {
            const a = analysisData[0];
            // Count treatments before sync
            let beforeCount = 0;
            (a.residualRisk?.entries || []).forEach(entry => {
                rrIterateLeaves(entry, ({leaf}) => {
                    if (leaf?.rr?.treatment) beforeCount++;
                });
            });
            
            // Force re-sync
            syncResidualRiskFromRiskAnalysis(a, false);
            
            // Count treatments after sync
            let afterCount = 0;
            (a.residualRisk?.entries || []).forEach(entry => {
                rrIterateLeaves(entry, ({leaf}) => {
                    if (leaf?.rr?.treatment) afterCount++;
                });
            });
            
            return { before: beforeCount, after: afterCount, preserved: beforeCount === afterCount };
        }""")
        assert result["preserved"], \
            f"Treatments lost during re-sync: {result['before']} → {result['after']}"

    def test_treeV2_structure_intact_after_load(self, page_with_agri: Page):
        """treeV2 node structure must survive load (children, impacts, uid)."""
        page = page_with_agri
        result = page.evaluate("""() => {
            const a = analysisData[0];
            const entry = a.riskEntries[0];
            const root = entry.treeV2;
            if (!root) return { error: 'no treeV2' };
            
            const walkCount = (node) => {
                let count = { nodes: 1, impacts: (node.impacts || []).length };
                (node.children || []).forEach(ch => {
                    const sub = walkCount(ch);
                    count.nodes += sub.nodes;
                    count.impacts += sub.impacts;
                });
                return count;
            };
            
            const counts = walkCount(root);
            return {
                hasUid: !!root.uid,
                hasTitle: !!root.title,
                hasChildren: Array.isArray(root.children),
                childCount: root.children.length,
                totalNodes: counts.nodes,
                totalImpacts: counts.impacts
            };
        }""")
        assert "error" not in result, result.get("error")
        assert result["hasUid"], "Root node must have uid"
        assert result["hasTitle"], "Root node must have title"
        assert result["hasChildren"], "Root must have children array"
        assert result["childCount"] > 0, "Root must have at least one path"
        assert result["totalImpacts"] > 0, "Tree must have at least one impact (leaf)"


# ═══════════════════════════════════════════════════════════════════════════
# 10. PROTECTION LEVEL & SEVERITY FACTOR CONFIG INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════

class TestConfigIntegrity:
    """Verify runtime config constants match expected mathematical model."""

    def test_severity_factors_loaded(self, page_with_app: Page):
        """SEVERITY_LEVEL_FACTORS must have entries for 0, 1, 2, 3."""
        page = page_with_app
        result = page.evaluate("""() => {
            return {
                s0: SEVERITY_LEVEL_FACTORS['0'],
                s1: SEVERITY_LEVEL_FACTORS['1'],
                s2: SEVERITY_LEVEL_FACTORS['2'],
                s3: SEVERITY_LEVEL_FACTORS['3'],
            };
        }""")
        assert result["s0"] == 0.0
        assert result["s1"] == 0.3
        assert result["s2"] == 0.6
        assert result["s3"] == 1.0

    def test_protection_weights_loaded(self, page_with_app: Page):
        """PROTECTION_LEVEL_WEIGHTS must have entries for I, II, III."""
        page = page_with_app
        result = page.evaluate("""() => {
            return {
                w1: PROTECTION_LEVEL_WEIGHTS['I'],
                w2: PROTECTION_LEVEL_WEIGHTS['II'],
                w3: PROTECTION_LEVEL_WEIGHTS['III'],
            };
        }""")
        assert result["w1"] == 0.6
        assert result["w2"] == 0.8
        assert result["w3"] == 1.0

    def test_risk_thresholds_loaded_correctly(self, page_with_app: Page):
        """RISK_THRESHOLDS must have 4 levels in correct order."""
        page = page_with_app
        result = page.evaluate("""() => {
            return RISK_THRESHOLDS.map(t => ({ min: t.min, label: t.label }));
        }""")
        assert len(result) == 4
        mins = [t["min"] for t in result]
        assert mins == sorted(mins, reverse=True), "Thresholds must be sorted descending"
        assert result[0]["min"] == 2.0  # Critical
        assert result[1]["min"] == 1.6  # High
        assert result[2]["min"] == 0.8  # Medium
        assert result[3]["min"] == 0    # Low

    def test_severity_monotonically_increasing(self, page_with_app: Page):
        """Higher impact values must map to higher severity factors."""
        page = page_with_app
        result = page.evaluate("""() => {
            const s = SEVERITY_LEVEL_FACTORS;
            return { 
                ordering: s['0'] < s['1'] && s['1'] < s['2'] && s['2'] <= s['3'],
                values: [s['0'], s['1'], s['2'], s['3']]
            };
        }""")
        assert result["ordering"], \
            f"Severity factors not monotonically increasing: {result['values']}"

    def test_protection_weights_monotonically_increasing(self, page_with_app: Page):
        """Higher protection levels must map to higher weights."""
        page = page_with_app
        result = page.evaluate("""() => {
            const w = PROTECTION_LEVEL_WEIGHTS;
            return { 
                ordering: w['I'] < w['II'] && w['II'] <= w['III'],
                values: [w['I'], w['II'], w['III']]
            };
        }""")
        assert result["ordering"], \
            f"Protection weights not monotonically increasing: {result['values']}"
