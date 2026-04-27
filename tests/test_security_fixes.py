"""
@file        test_security_fixes.py
@description Tests for security and data-integrity fixes identified in code review.
             These tests are written BEFORE the fixes so they initially FAIL (red),
             confirming the bugs exist, then PASS (green) once fixes are applied.

             Covers:
               Finding 1: XSS in fillAnalysisForm() via metadata fields
               Finding 2: XSS in deleteActiveAnalysis() via analysis.name
               Finding 3: reindexRiskIDs() breaks security goal rootRefs
               Finding 4: Node UID collision in residual_risk_data.js treeV2 traversal
               Finding 5: Hardcoded DS fallback IDs in attack_tree_editor_v2.js
               Finding 6: CDN scripts without SRI integrity attribute

@author      Nico Peper
@organization SCHUNK SE & Co. KG
@copyright   2026 SCHUNK SE & Co. KG
@license     GPL-3.0
"""

import re
import pytest
from pathlib import Path
from playwright.sync_api import Page, expect

from conftest import (
    APP_URL,
    PROJECT_ROOT,
    create_analysis,
    switch_tab,
    add_asset,
    add_damage_scenario,
    get_active_analysis,
    get_analysis_data,
)


# ═══════════════════════════════════════════════════════════════════
# FINDING 1 & 2: XSS PREVENTION
# ═══════════════════════════════════════════════════════════════════

XSS_PAYLOADS = [
    '<img src=x onerror="alert(1)">',
    '<script>alert("xss")</script>',
    '"><svg onload=alert(1)>',
]


@pytest.mark.core
class TestXSSFillAnalysisForm:
    """Finding 1: Metadata fields (author, version, date) must be escaped
    in fillAnalysisForm() to prevent XSS via imported .tara files."""

    @pytest.mark.parametrize("payload", XSS_PAYLOADS, ids=["img_onerror", "script_tag", "svg_onload"])
    def test_metadata_author_escaped(self, app: Page, payload: str):
        """Injecting HTML into metadata.author must NOT create live DOM elements."""
        page = app
        # Directly inject malicious metadata into the active analysis
        page.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.metadata.author = {repr(payload)};
            fillAnalysisForm(a);
        }}""")
        page.wait_for_timeout(200)
        el = page.locator("#analysisMetadata")
        html = el.inner_html()
        # The raw payload tags must NOT be present as live HTML
        assert "<img" not in html.lower() or "onerror" not in html.lower(), \
            f"XSS payload rendered as live HTML in metadata: {html}"
        assert "<script>" not in html.lower(), \
            f"Script tag rendered in metadata: {html}"
        assert "<svg" not in html.lower() or "onload" not in html.lower(), \
            f"SVG onload payload rendered in metadata: {html}"

    @pytest.mark.parametrize("field", ["author", "version", "date"])
    def test_metadata_field_html_entities(self, app: Page, field: str):
        """Each metadata field must contain escaped HTML entities, not raw tags."""
        page = app
        payload = '<b>test</b>'
        page.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.metadata.{field} = '<b>test</b>';
            fillAnalysisForm(a);
        }}""")
        page.wait_for_timeout(200)
        el = page.locator("#analysisMetadata")
        html = el.inner_html()
        # Should contain escaped entities, not raw <b> tags
        assert "&lt;b&gt;" in html or "\\u003c" in html or "<b>test</b>" not in html, \
            f"Field '{field}' not escaped: raw <b> tag found in innerHTML"

    def test_metadata_no_script_execution(self, app: Page):
        """A script payload in metadata must never execute."""
        page = app
        # Set a sentinel that would be changed by XSS
        page.evaluate("window.__xss_sentinel = false")
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.metadata.author = '<img src=x onerror="window.__xss_sentinel=true">';
            fillAnalysisForm(a);
        }""")
        page.wait_for_timeout(500)
        assert page.evaluate("window.__xss_sentinel") is False, \
            "XSS payload executed in fillAnalysisForm!"


@pytest.mark.core
class TestXSSDeleteAnalysis:
    """Finding 2: analysis.name must be escaped in the delete confirmation
    dialog to prevent XSS."""

    def test_delete_dialog_escapes_name(self, app: Page):
        """Analysis name with HTML must be escaped in the delete confirmation."""
        page = app
        payload = '<img src=x onerror="alert(1)">'
        # Set malicious analysis name
        page.evaluate(f"""() => {{
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.name = {repr(payload)};
        }}""")
        # Trigger the delete dialog
        page.evaluate("deleteActiveAnalysis()")
        page.wait_for_timeout(300)
        modal = page.locator("#confirmationModal")
        expect(modal).to_be_visible()
        msg_html = page.locator("#confirmationMessage").inner_html()
        # The raw <img> tag must not be live HTML
        assert "<img" not in msg_html.lower() or "onerror" not in msg_html.lower(), \
            f"XSS payload in delete confirmation: {msg_html}"

    def test_delete_dialog_no_script_execution(self, app: Page):
        """Script injection via analysis name must not execute."""
        page = app
        page.evaluate("window.__xss_sentinel = false")
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.name = '<img src=x onerror="window.__xss_sentinel=true">';
            deleteActiveAnalysis();
        }""")
        page.wait_for_timeout(500)
        assert page.evaluate("window.__xss_sentinel") is False, \
            "XSS payload executed in deleteActiveAnalysis!"


# ═══════════════════════════════════════════════════════════════════
# FINDING 3: reindexRiskIDs MUST UPDATE SECURITY GOAL rootRefs
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
@pytest.mark.security_goals
class TestReindexRiskIDsRootRefs:
    """Finding 3: When reindexRiskIDs() renumbers entries after deletion,
    security goal rootRefs must be updated to match the new IDs."""

    def _setup_trees_and_goals(self, page: Page):
        """Create 3 attack trees and a security goal referencing R02 and R03."""
        add_asset(page)
        add_damage_scenario(page)
        switch_tab(page, "risk_analysis")
        page.wait_for_timeout(300)

        # Create 3 attack trees
        for name in ["Tree Alpha", "Tree Beta", "Tree Gamma"]:
            page.evaluate("renderRiskAnalysis()")
            page.wait_for_timeout(200)
            page.click("#btnOpenAttackTreeModal")
            page.wait_for_selector("#attackTreeModal", state="visible")
            page.fill('input[name="at_root"]', name)
            page.wait_for_timeout(200)
            add_path = page.locator("#btnAddAttackPath")
            if add_path.is_visible():
                add_path.click()
                page.wait_for_timeout(300)
            page.click('#attackTreeForm button[type="submit"]')
            page.wait_for_timeout(500)

        # Verify 3 entries exist as R01, R02, R03
        data = get_active_analysis(page)
        entries = data.get("riskEntries", [])
        assert len(entries) == 3
        assert entries[0]["id"] == "R01"
        assert entries[1]["id"] == "R02"
        assert entries[2]["id"] == "R03"

        # Create a security goal referencing R02 and R03
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a.securityGoals) a.securityGoals = [];
            a.securityGoals.push({
                id: 'SO01',
                name: 'Test Goal',
                description: 'References trees',
                rootRefs: ['R02', 'R03']
            });
            saveAnalyses();
        }""")
        page.wait_for_timeout(200)

    def test_rootrefs_updated_after_delete_first_tree(self, app_with_analysis: Page):
        """After deleting R01, the old R02→R01 and R03→R02.
        Security goal rootRefs must update from ['R02','R03'] to ['R01','R02']."""
        page = app_with_analysis
        self._setup_trees_and_goals(page)

        # Delete R01 (first tree)
        switch_tab(page, "risk_analysis")
        page.wait_for_timeout(200)
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.riskEntries = a.riskEntries.filter(r => r.id !== 'R01');
            reindexRiskIDs(a);
            saveAnalyses();
        }""")
        page.wait_for_timeout(300)

        data = get_active_analysis(page)
        entries = data.get("riskEntries", [])
        assert len(entries) == 2
        assert entries[0]["id"] == "R01"  # was R02 (Tree Beta)
        assert entries[1]["id"] == "R02"  # was R03 (Tree Gamma)

        # Verify rootRefs are updated
        sg = data["securityGoals"][0]
        refs = sg["rootRefs"]
        assert "R01" in refs, f"rootRefs should contain R01 (formerly R02): {refs}"
        assert "R02" in refs, f"rootRefs should contain R02 (formerly R03): {refs}"
        assert "R03" not in refs, f"rootRefs should NOT still contain R03: {refs}"

    def test_rootrefs_updated_after_delete_middle_tree(self, app_with_analysis: Page):
        """After deleting R02, R03→R02. rootRefs ['R02','R03'] → ['R02'] 
        (R02 target is deleted, R03 becomes R02)."""
        page = app_with_analysis
        self._setup_trees_and_goals(page)

        # Build old→new ID mapping manually, then verify code does it
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.riskEntries = a.riskEntries.filter(r => r.id !== 'R02');
            reindexRiskIDs(a);
            saveAnalyses();
        }""")
        page.wait_for_timeout(300)

        data = get_active_analysis(page)
        entries = data.get("riskEntries", [])
        assert len(entries) == 2
        assert entries[0]["id"] == "R01"  # Tree Alpha (unchanged)
        assert entries[1]["id"] == "R02"  # was R03 (Tree Gamma)

        sg = data["securityGoals"][0]
        refs = sg["rootRefs"]
        # R02 was deleted → should be removed from refs
        # R03 became R02 → should be in refs as R02
        assert "R02" in refs, f"rootRefs should contain R02 (formerly R03): {refs}"
        assert "R03" not in refs, f"rootRefs should NOT still contain stale R03: {refs}"

    def test_rootrefs_empty_when_all_referenced_deleted(self, app_with_analysis: Page):
        """Deleting all referenced trees should clear rootRefs."""
        page = app_with_analysis
        self._setup_trees_and_goals(page)

        # Delete R02 and R03 (the referenced ones), keep R01
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            a.riskEntries = a.riskEntries.filter(r => r.id === 'R01');
            reindexRiskIDs(a);
            saveAnalyses();
        }""")
        page.wait_for_timeout(300)

        data = get_active_analysis(page)
        sg = data["securityGoals"][0]
        refs = sg["rootRefs"]
        assert len(refs) == 0, f"rootRefs should be empty after deleting referenced trees: {refs}"


# ═══════════════════════════════════════════════════════════════════
# FINDING 4: NODE UID COLLISION IN rrIterateLeaves (treeV2)
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.residual_risk
class TestRRNodeUIDCollision:
    """Finding 4: rrIterateLeaves must generate unique leaf keys even when
    multiple nodes lack UIDs. Fallback to 'node' for all causes collisions."""

    def test_unique_leaf_keys_without_node_uid(self, app: Page):
        """Two nodes without UID in the same branch must produce different leaf keys."""
        page = app
        result = page.evaluate("""() => {
            // Create a treeV2 with two child nodes, neither having a UID
            const entry = {
                treeV2: {
                    title: 'Root',
                    children: [
                        {
                            title: 'Path1',
                            uid: '',
                            children: [
                                {
                                    title: 'NodeA',
                                    uid: '',   // no UID
                                    impacts: [{ uid: 'leaf1', ds: [] }],
                                    children: []
                                },
                                {
                                    title: 'NodeB',
                                    uid: '',   // no UID either
                                    impacts: [{ uid: 'leaf2', ds: [] }],
                                    children: []
                                }
                            ],
                            impacts: []
                        }
                    ]
                }
            };
            const keys = [];
            rrIterateLeaves(entry, (info) => {
                keys.push(info.leafKey);
            });
            return keys;
        }""")
        # All leaf keys must be unique
        assert len(result) == 2, f"Expected 2 leaves, got {len(result)}: {result}"
        assert result[0] != result[1], \
            f"Leaf keys must be unique but both are '{result[0]}'"

    def test_unique_leaf_keys_without_any_uids(self, app: Page):
        """Nodes and leaves without any UID must still produce unique keys."""
        page = app
        result = page.evaluate("""() => {
            const entry = {
                treeV2: {
                    title: 'Root',
                    children: [
                        {
                            title: 'Path1',
                            children: [
                                {
                                    title: 'NodeA',
                                    impacts: [{ ds: [] }, { ds: [] }],
                                    children: []
                                },
                                {
                                    title: 'NodeB',
                                    impacts: [{ ds: [] }],
                                    children: []
                                }
                            ],
                            impacts: []
                        }
                    ]
                }
            };
            const keys = [];
            rrIterateLeaves(entry, (info) => {
                keys.push(info.leafKey);
            });
            return { keys, uniqueKeys: [...new Set(keys)] };
        }""")
        keys = result["keys"]
        unique = result["uniqueKeys"]
        assert len(keys) == 3, f"Expected 3 leaves, got {len(keys)}"
        assert len(keys) == len(unique), \
            f"Duplicate leaf keys found: {keys}"


# ═══════════════════════════════════════════════════════════════════
# FINDING 5: HARDCODED DS FALLBACK IDS
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestDSFallbackIDs:
    """Finding 5: The attack tree editor should use actual damage scenario IDs
    from the analysis, never hardcoded fallback IDs."""

    def test_getAllDamageScenarioIds_is_available(self, app: Page):
        """The global function getAllDamageScenarioIds must exist."""
        page = app
        result = page.evaluate("typeof getAllDamageScenarioIds")
        assert result == "function", \
            "getAllDamageScenarioIds must be globally available"

    def test_ds_ids_match_analysis(self, app_with_analysis: Page):
        """DS checkboxes in the editor must match actual DS IDs, not hardcoded ones."""
        page = app_with_analysis
        add_asset(page)
        # Add 2 custom damage scenarios
        add_damage_scenario(page, {
            "name": "Custom DS Alpha", "short": "DS-A", "description": "First"
        })
        add_damage_scenario(page, {
            "name": "Custom DS Beta", "short": "DS-B", "description": "Second"
        })

        # Get actual DS IDs from the analysis
        actual_ids = page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            return getAllDamageScenarioIds(a);
        }""")
        assert len(actual_ids) >= 2, f"Expected at least 2 DS IDs, got {len(actual_ids)}"

        # The returned IDs must reflect the real analysis, not a hardcoded set
        hardcoded = ["DS1", "DS2", "DS3", "DS4", "DS5"]
        assert actual_ids != hardcoded, \
            "getAllDamageScenarioIds returned the old hardcoded fallback list"

    def test_no_hardcoded_fallback_in_source(self, app: Page):
        """The fallback array ["DS1","DS2","DS3","DS4","DS5"] should not exist
        in attack_tree_editor_v2.js after the fix."""
        source_file = PROJECT_ROOT / "js" / "attack_tree" / "attack_tree_editor_v2.js"
        content = source_file.read_text(encoding="utf-8")
        # After fix, the hardcoded array should be replaced with []
        assert '["DS1","DS2","DS3","DS4","DS5"]' not in content, \
            "Hardcoded DS fallback IDs still present in attack_tree_editor_v2.js"


# ═══════════════════════════════════════════════════════════════════
# FINDING 6: CDN SCRIPTS WITHOUT SRI INTEGRITY ATTRIBUTE
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.core
class TestCDNSubresourceIntegrity:
    """Finding 6: All external CDN scripts must have integrity (SRI) and
    crossorigin attributes to prevent supply-chain attacks."""

    @pytest.fixture(autouse=True)
    def _load_html(self):
        """Load the index.html content for static analysis."""
        self.html_path = PROJECT_ROOT / "index.html"
        self.html_content = self.html_path.read_text(encoding="utf-8")

    def _find_external_scripts(self) -> list[dict]:
        """Find all <script> tags with external src (http/https)."""
        # Match <script ... src="https://..."> tags
        pattern = re.compile(
            r'<script\b([^>]*)src=["\']'
            r'(https?://[^"\']+)'
            r'["\']([^>]*)>',
            re.IGNORECASE
        )
        results = []
        for m in pattern.finditer(self.html_content):
            attrs = m.group(1) + m.group(3)
            results.append({
                "url": m.group(2),
                "attrs": attrs,
                "full_match": m.group(0),
            })
        return results

    def _find_external_imports(self) -> list[dict]:
        """Find ES module imports from external URLs."""
        pattern = re.compile(
            r'import\s+\{[^}]+\}\s+from\s+["\']'
            r'(https?://[^"\']+)'
            r'["\']',
            re.IGNORECASE
        )
        results = []
        for m in pattern.finditer(self.html_content):
            results.append({
                "url": m.group(1),
                "full_match": m.group(0),
            })
        return results

    def test_all_cdn_scripts_have_integrity(self):
        """Every external <script src="https://..."> must have an integrity attribute."""
        scripts = self._find_external_scripts()
        assert len(scripts) > 0, "Expected at least one external CDN script"
        for s in scripts:
            assert "integrity=" in s["attrs"].lower(), \
                f"Missing integrity attribute on CDN script: {s['url']}"

    def test_all_cdn_scripts_have_crossorigin(self):
        """Every external <script> with integrity must also have crossorigin."""
        scripts = self._find_external_scripts()
        for s in scripts:
            assert "crossorigin=" in s["attrs"].lower(), \
                f"Missing crossorigin attribute on CDN script: {s['url']}"

    def test_integrity_hash_format(self):
        """Integrity hashes must use sha256, sha384, or sha512."""
        pattern = re.compile(r'integrity=["\']?(sha(?:256|384|512)-[A-Za-z0-9+/=]+)')
        scripts = self._find_external_scripts()
        for s in scripts:
            full_tag = s["full_match"]
            match = pattern.search(full_tag)
            assert match is not None, \
                f"Integrity hash missing or malformed for: {s['url']}"

    def test_es_module_import_has_integrity_comment(self):
        """External ES module imports should be documented with integrity info.
        (ES modules via import cannot use SRI directly in all browsers,
        but should at minimum be pinned to exact version.)"""
        imports = self._find_external_imports()
        for imp in imports:
            url = imp["url"]
            # At minimum, the URL must be version-pinned (contain @version or /version/)
            has_version = bool(re.search(r'@\d+\.\d+|/\d+\.\d+', url))
            assert has_version, \
                f"External ES module import not version-pinned: {url}"


# ═══════════════════════════════════════════════════════════════════
# CROSS-CUTTING: escapeHtml UTILITY
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.core
class TestEscapeHtmlUtility:
    """Verify the escapeHtml utility properly neutralizes all dangerous characters."""

    @pytest.mark.parametrize("input_val,expected_substr", [
        ("<script>", "&lt;script&gt;"),
        ('"onclick="', "&quot;onclick=&quot;"),
        ("'onfocus='", "&#039;onfocus=&#039;"),
        ("&amp;", "&amp;amp;"),
        ("<img src=x onerror=alert(1)>", "&lt;img"),
    ])
    def test_escapeHtml_output(self, app: Page, input_val: str, expected_substr: str):
        result = app.evaluate(f"escapeHtml({repr(input_val)})")
        assert expected_substr in result, \
            f"escapeHtml({input_val!r}) = {result!r}, expected to contain {expected_substr!r}"

    def test_escapeHtml_null_safe(self, app: Page):
        """escapeHtml(null) and escapeHtml(undefined) must not throw."""
        assert app.evaluate("escapeHtml(null)") == ""
        assert app.evaluate("escapeHtml(undefined)") == ""
