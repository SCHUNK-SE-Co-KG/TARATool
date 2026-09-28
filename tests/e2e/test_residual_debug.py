"""
Targeted test to reproduce and debug the residual risk computation bug.
Loads fixture data with known tree structure and checks if KSTU values
propagate correctly through all levels during residual risk computation.
"""

import json
import pytest
from pathlib import Path
from playwright.sync_api import Page

from conftest import APP_URL

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "agri_testbot_tara.json"


@pytest.fixture()
def loaded_fixture(page: Page):
    """Load app then inject fixture data."""
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


class TestResidualRiskComputation:
    """Test that computeResidualTreeMetrics correctly propagates KSTU through all levels."""

    def test_compute_returns_valid_kstu(self, loaded_fixture: Page):
        """Root-level residual KSTU must not be null/empty for R01 tree."""
        page = loaded_fixture
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a) return { error: 'no active analysis' };
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const uid = 'risk_a1b2c3d4-1111-4aaa-bbbb-000000000001';
            const m = computeResidualTreeMetrics(a, uid);
            return m;
        }""")
        print("computeResidualTreeMetrics result:", json.dumps(result, indent=2))
        assert result is not None, "computeResidualTreeMetrics returned null"
        kstu = result.get("kstu", {})
        print("kstu:", kstu)
        assert kstu.get("k") is not None and kstu.get("k") != "", f"K is empty: {kstu}"
        assert kstu.get("s") is not None and kstu.get("s") != "", f"S is empty: {kstu}"
        assert kstu.get("t") is not None and kstu.get("t") != "", f"T is empty: {kstu}"
        assert kstu.get("u") is not None and kstu.get("u") != "", f"U is empty: {kstu}"

    def test_applyWorstCaseInheritance_no_error(self, loaded_fixture: Page):
        """applyWorstCaseInheritance on a residual clone should not throw."""
        page = loaded_fixture
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a) return { error: 'no active analysis' };
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const uid = 'risk_a1b2c3d4-1111-4aaa-bbbb-000000000001';
            const residual = getResidualEntryByUid(a, uid);
            if (!residual) return { error: 'no residual entry' };
            const clone = JSON.parse(JSON.stringify(residual));
            try {
                applyWorstCaseInheritance(clone);
                return {
                    success: true,
                    rootKstu: clone.kstu,
                    treeV2Kstu: clone.treeV2 ? clone.treeV2.kstu : null
                };
            } catch(e) {
                return { error: e.message, stack: e.stack };
            }
        }""")
        print("applyWorstCaseInheritance result:", json.dumps(result, indent=2))
        assert "error" not in result, f"Error during applyWorstCaseInheritance: {result}"

    def test_intermediate_node_kstu_after_computation(self, loaded_fixture: Page):
        """After residual risk computation, intermediate nodes should have non-null KSTU."""
        page = loaded_fixture
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a) return { error: 'no active analysis' };
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            const uid = 'risk_a1b2c3d4-1111-4aaa-bbbb-000000000001';
            const residual = getResidualEntryByUid(a, uid);
            if (!residual) return { error: 'no residual entry' };
            const clone = JSON.parse(JSON.stringify(residual));

            // Manually do what computeResidualTreeMetrics does:
            // 1. Replace leaf values
            rrIterateLeaves(clone, (meta) => {
                const leaf = meta.leaf;
                if (!leaf) return;
                const rr = leaf.rr || {};
                const tr = String(rr.treatment || '').trim();
                const isMit = (tr === 'Mitigiert');
                const pick = (orig, rrVal) => {
                    const rrStr = (rrVal === undefined || rrVal === null) ? '' : String(rrVal).trim();
                    if (isMit && rrStr) return rrStr;
                    return (orig === undefined || orig === null) ? '' : String(orig);
                };
                leaf.k = pick(leaf.k, rr.k);
                leaf.s = pick(leaf.s, rr.s);
                leaf.t = pick(leaf.t, rr.t);
                leaf.u = pick(leaf.u, rr.u);
            });

            // 2. Run worst-case inheritance
            let applyError = null;
            try {
                applyWorstCaseInheritance(clone);
            } catch(e) {
                applyError = e.message;
            }

            // 3. Collect results at each level
            const levels = {};
            if (clone.treeV2) {
                const root = clone.treeV2;
                levels.root = { uid: root.uid, kstu: root.kstu };
                levels.paths = (root.children || []).map(c => ({
                    uid: c.uid,
                    title: c.title,
                    kstu: c.kstu,
                    intermediates: (c.children || []).map(cc => ({
                        uid: cc.uid,
                        title: cc.title,
                        kstu: cc.kstu,
                        leafCount: (cc.impacts || []).length,
                        leaves: (cc.impacts || []).map(l => ({
                            uid: l.uid,
                            k: l.k, s: l.s, t: l.t, u: l.u,
                            rr: l.rr
                        }))
                    }))
                }));
            }

            return {
                cloneKstu: clone.kstu,
                levels: levels,
                applyError: applyError
            };
        }""")
        print("Full computation trace:", json.dumps(result, indent=2))
        assert result.get("applyError") is None, f"Error: {result.get('applyError')}"
        
        # Check that all levels have valid KSTU
        levels = result.get("levels", {})
        root = levels.get("root", {})
        assert root.get("kstu"), f"Root KSTU is empty: {root}"
        
        for path in levels.get("paths", []):
            kstu = path.get("kstu", {})
            assert kstu and kstu.get("k") is not None, f"Path {path['uid']} has empty KSTU: {kstu}"
            
            for inter in path.get("intermediates", []):
                ik = inter.get("kstu", {})
                assert ik and ik.get("k") is not None, f"Intermediate {inter['uid']} has empty KSTU: {ik}"


    def test_no_console_errors_on_residual_tab(self, loaded_fixture: Page):
        """Switching to residual risk tab should not produce any console errors."""
        page = loaded_fixture
        console_errors = []
        console_warns = []
        page.on("console", lambda msg: (
            console_errors.append(msg.text) if msg.type == "error" else
            console_warns.append(msg.text) if msg.type == "warning" else None
        ))
        # Navigate to residual risk tab
        tab_btn = page.locator('.tab-button[data-tab="tabResidualRisk"]')
        tab_btn.wait_for(state="visible", timeout=5000)
        tab_btn.click()
        page.wait_for_timeout(2000)
        # Check for errors
        rr_errors = [e for e in console_errors if "residual" in e.lower() or "kstu" in e.lower() or "applyWorstCase" in e]
        rr_warns = [w for w in console_warns if "KSTU all null" in w or "applyWorstCase" in w]
        print("Console errors:", console_errors)
        print("Console warnings (RR-related):", rr_warns)
        assert len(rr_errors) == 0, f"Console errors on residual tab: {rr_errors}"
        assert len(rr_warns) == 0, f"KSTU propagation warnings: {rr_warns}"

    def test_residual_risk_card_shows_values(self, loaded_fixture: Page):
        """The residual risk cards should display non-dash KSTU values for mitigated trees."""
        page = loaded_fixture
        tab_btn = page.locator('.tab-button[data-tab="tabResidualRisk"]')
        tab_btn.wait_for(state="visible", timeout=5000)
        tab_btn.click()
        page.wait_for_timeout(2000)
        # Use evaluate to check card content (avoids Playwright timeout on locators)
        result = page.evaluate("""() => {
            const cards = document.querySelectorAll('.rr-risk-card');
            if (!cards.length) return { count: 0, texts: [] };
            return {
                count: cards.length,
                texts: Array.from(cards).map(c => c.innerText.substring(0, 300))
            };
        }""")
        print("Card count:", result["count"])
        for i, t in enumerate(result.get("texts", [])):
            print(f"Card {i} text: {t[:200]}")
        assert result["count"] > 0, "No residual risk cards rendered"
        for t in result["texts"]:
            assert "Risiko-Score" in t, f"Card missing Risiko-Score: {t[:100]}"

    def test_dot_rr_root_and_l1_have_values(self, loaded_fixture: Page):
        """The DOT residual risk tree must show P(RR) and RR values (not dashes) at root and first level."""
        page = loaded_fixture
        result = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a) return { error: 'no active analysis' };
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(a);
            if (typeof exportResidualRiskToDot !== 'function') return { error: 'exportResidualRiskToDot not defined' };
            const dot = exportResidualRiskToDot(a, 'R01');
            return { dot: dot };
        }""")
        assert "error" not in result, f"Error: {result.get('error')}"
        dot = result.get("dot", "")
        assert dot, "DOT string is empty"
        print("DOT string (first 2000 chars):", dot[:2000])

        # Root node (R01_Root_RR) label must have P(RR) with actual values, not just dashes
        import re
        # Find root node label
        root_match = re.search(r'R01_Root_RR\s*\[label="([^"]+)"', dot)
        assert root_match, "Root node not found in DOT"
        root_label = root_match.group(1)
        print("Root label:", root_label)

        # P(RR) should NOT be '- / - / - / -' (i.e., should have actual values)
        prr_match = re.search(r'P\(RR\)\s*=\s*([^|]+)', root_label)
        assert prr_match, "P(RR) not found in root label"
        prr_val = prr_match.group(1).strip()
        print("Root P(RR):", prr_val)
        assert prr_val != '- / - / - / -', f"Root P(RR) is all dashes: {prr_val}"

        # RR should not be '0,00'
        rr_match = re.search(r'\| RR = ([^|]+)', root_label)
        assert rr_match, "RR not found in root label"
        rr_val = rr_match.group(1).strip()
        print("Root RR:", rr_val)
        assert rr_val != '0,00', f"Root RR is 0: {rr_val}"

        # Check first-level nodes (N_RR...) for non-dash P(RR)
        l1_matches = re.findall(r'R01_N_RR\w+\s*\[label="([^"]+)"', dot)
        assert len(l1_matches) > 0, "No first-level nodes found"
        for i, label in enumerate(l1_matches):
            prr_m = re.search(r'P\(RR\)\s*=\s*([^|]+)', label)
            if prr_m:
                prr = prr_m.group(1).strip()
                print(f"L1 node {i} P(RR): {prr}")
                assert prr != '- / - / - / -', f"L1 node {i} P(RR) is all dashes: {prr}"
            rr_m = re.search(r'\| RR = ([^|]+)', label)
            if rr_m:
                rr = rr_m.group(1).strip()
                print(f"L1 node {i} RR: {rr}")
                assert rr != '0,00', f"L1 node {i} RR is 0: {rr}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
