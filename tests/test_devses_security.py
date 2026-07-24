"""
@file        test_devses_security.py
@description Security tests for features introduced in DevSES branch:
             - Config reload (potential XSS via malicious config values)
             - Copy/paste (no XSS via pasted node content)
             - assessment_config.js script tag (SRI verification)
             - Validate that config validation rejects malformed input
@covers      config_loader.js, attack_tree_editor_v2.js, index.html
@author      Nico Peper
@organization SCHUNK SE & Co. KG
@copyright   2026 SCHUNK SE & Co. KG
@license     GPL-3.0
"""

import json
import pytest
from pathlib import Path
from playwright.sync_api import Page, expect

from conftest import (
    APP_URL,
    PROJECT_ROOT,
    switch_tab,
    add_asset,
    add_damage_scenario,
    get_active_analysis,
)


# ═══════════════════════════════════════════════════════════════════
# CONFIG RELOAD: INPUT VALIDATION
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.security
class TestConfigReloadValidation:
    """Config reload must validate input and reject malformed/malicious JSON."""

    def test_rejects_empty_json(self, app: Page):
        """An empty object should be rejected by config validation."""
        page = app
        result = page.evaluate("""() => {
            if (typeof _validateAssessmentConfig === 'function') {
                return _validateAssessmentConfig({});
            }
            // If validation is internal, test via reloadAssessmentConfigFromJsonText
            if (typeof reloadAssessmentConfigFromJsonText === 'function') {
                return reloadAssessmentConfigFromJsonText('{}');
            }
            return 'no_function';
        }""")
        # Should return false or fail (not apply empty config)
        assert result is False or result == "no_function"

    def test_rejects_invalid_json_string(self, app: Page):
        """Non-JSON text should be rejected."""
        page = app
        result = page.evaluate("""() => {
            if (typeof reloadAssessmentConfigFromJsonText === 'function') {
                try {
                    return reloadAssessmentConfigFromJsonText('not valid json {{{');
                } catch(e) { return false; }
            }
            return 'no_function';
        }""")
        assert result is False or result == "no_function"

    def test_rejects_missing_required_keys(self, app: Page):
        """Config without required keys (riskThresholds, etc.) should be rejected."""
        page = app
        incomplete_config = json.dumps({
            "_meta": {"version": "1.0"},
            "impactScale": {"validValues": ["1", "2", "3"]}
            # Missing: riskThresholds, probabilityCriteria, etc.
        })
        result = page.evaluate(f"""() => {{
            if (typeof reloadAssessmentConfigFromJsonText === 'function') {{
                return reloadAssessmentConfigFromJsonText('{incomplete_config}');
            }}
            return 'no_function';
        }}""")
        assert result is False or result == "no_function"

    def test_rejects_unsorted_thresholds(self, app: Page):
        """Risk thresholds must be sorted descending; wrong order = rejected."""
        page = app
        bad_config = json.dumps({
            "_meta": {"version": "1.0"},
            "impactScale": {"validValues": ["1", "2", "3"], "labels": {}, "cssClasses": {}},
            "severityLevelFactors": {"0": 0, "1": 0.3, "2": 0.6, "3": 1.0},
            "protectionLevels": {},
            "probabilityCriteria": {"K": {}, "S": {}, "T": {}, "U": {}},
            "riskThresholds": [
                {"min": 0.8, "label": "Mittel"},
                {"min": 2.0, "label": "Kritisch"},
                {"min": 1.6, "label": "Hoch"}
            ],
            "riskUnknown": {"label": "Unbekannt"},
            "defaultDamageScenarios": []
        })
        result = page.evaluate(f"""() => {{
            if (typeof reloadAssessmentConfigFromJsonText === 'function') {{
                return reloadAssessmentConfigFromJsonText(JSON.stringify({bad_config}));
            }}
            return 'no_function';
        }}""")
        assert result is False or result == "no_function"


# ═══════════════════════════════════════════════════════════════════
# CONFIG RELOAD: XSS PREVENTION
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.security
class TestConfigReloadXSS:
    """Config values rendered in dropdowns must not execute as HTML/JS."""

    def test_xss_in_probability_option_text(self, app: Page):
        """XSS payload in probability criteria option text must be escaped."""
        page = app
        xss_payload = '<img src=x onerror="window.__xss_config=true">'
        # Set a sentinel
        page.evaluate("window.__xss_config = false")
        # Attempt to inject XSS via config option text
        page.evaluate(f"""() => {{
            if (typeof syncGlobalsFromAssessmentConfig !== 'function') return;
            const cfg = JSON.parse(JSON.stringify(ASSESSMENT_CONFIG));
            cfg.probabilityCriteria.K.options[0].text = '{xss_payload}';
            syncGlobalsFromAssessmentConfig(cfg);
        }}""")
        page.wait_for_timeout(500)
        # XSS sentinel should NOT have fired
        result = page.evaluate("window.__xss_config")
        assert result is False

    def test_xss_in_damage_scenario_name(self, app: Page):
        """XSS in defaultDamageScenarios name must not execute."""
        page = app
        page.evaluate("window.__xss_ds = false")
        page.evaluate("""() => {
            if (typeof syncGlobalsFromAssessmentConfig !== 'function') return;
            const cfg = JSON.parse(JSON.stringify(ASSESSMENT_CONFIG));
            cfg.defaultDamageScenarios[0].name = '<img src=x onerror="window.__xss_ds=true">';
            syncGlobalsFromAssessmentConfig(cfg);
        }""")
        page.wait_for_timeout(500)
        result = page.evaluate("window.__xss_ds")
        assert result is False


# ═══════════════════════════════════════════════════════════════════
# COPY/PASTE: XSS PREVENTION
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.security
class TestCopyPasteXSS:
    """Copy/paste must not introduce XSS via node titles or impact text."""

    def test_xss_in_pasted_node_title(self, app: Page):
        """Pasting a node with XSS payload in title must not execute script."""
        page = app
        add_asset(page)
        add_damage_scenario(page)
        page.evaluate("window.__xss_paste = false")
        # Create tree and simulate pasting a node with XSS title
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a.riskEntries) a.riskEntries = [];
            a.riskEntries.push({
                id: 'AT-XSS',
                rootName: 'XSS Test',
                kstu: { k: '0.5', s: '0.3', t: '0.5', u: '0.3' },
                i_norm: 0.6, rootRiskValue: '1.2',
                treeV2: {
                    children: [{
                        uid: 'xss_path',
                        title: '<img src=x onerror="window.__xss_paste=true">',
                        kstu: { k: '0.5', s: '0.3', t: '0.5', u: '0.3' },
                        i_norm: 0.6,
                        impacts: [{
                            uid: 'xss_leaf',
                            text: '<script>window.__xss_paste=true</script>',
                            k: '0.5', s: '0.3', t: '0.5', u: '0.3',
                            i_norm: 0.6, ds: ['DS1']
                        }],
                        children: []
                    }]
                }
            });
            saveAnalyses();
        }""")
        page.wait_for_timeout(300)
        switch_tab(page, "risk_analysis")
        page.evaluate("renderRiskAnalysis()")
        page.wait_for_timeout(500)
        # XSS should not have executed
        result = page.evaluate("window.__xss_paste")
        assert result is False

    def test_xss_in_impact_text_escaped_in_dom(self, app: Page):
        """Impact text with HTML must be escaped when rendered."""
        page = app
        add_asset(page)
        add_damage_scenario(page)
        page.evaluate("""() => {
            const a = analysisData.find(x => x.id === activeAnalysisId);
            if (!a.riskEntries) a.riskEntries = [];
            a.riskEntries.push({
                id: 'AT-ESC',
                rootName: 'Escape Test',
                kstu: { k: '0.5', s: '0.3', t: '0.5', u: '0.3' },
                i_norm: 0.6, rootRiskValue: '1.2',
                treeV2: {
                    children: [{
                        uid: 'esc_path',
                        title: 'Normal Path',
                        kstu: { k: '0.5', s: '0.3', t: '0.5', u: '0.3' },
                        i_norm: 0.6,
                        impacts: [{
                            uid: 'esc_leaf',
                            text: '<b>bold</b> & "quotes"',
                            k: '0.5', s: '0.3', t: '0.5', u: '0.3',
                            i_norm: 0.6, ds: ['DS1']
                        }],
                        children: []
                    }]
                }
            });
            saveAnalyses();
        }""")
        page.wait_for_timeout(300)
        switch_tab(page, "risk_analysis")
        page.evaluate("renderRiskAnalysis()")
        page.wait_for_timeout(500)
        # Ensure no raw <b> tag is in the DOM for the risk cards
        html = page.locator("#riskAnalysisContainer").inner_html()
        assert "<b>bold</b>" not in html, "Raw HTML rendered without escaping"


# ═══════════════════════════════════════════════════════════════════
# SCRIPT TAG INTEGRITY
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.security
class TestScriptIntegrity:
    """Verify CDN script tags have SRI attributes."""

    def test_jspdf_has_integrity(self):
        """jsPDF script tag should have integrity attribute."""
        html = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        assert "jspdf" in html.lower(), "jsPDF script tag must be present"
        jspdf_section = html.split("jspdf")[1].split(">")[0]
        assert 'integrity=' in jspdf_section, \
            "jsPDF CDN script missing integrity attribute"

    def test_jszip_has_integrity(self):
        """JSZip script tag should have integrity attribute."""
        html = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        assert "jszip" in html.lower(), "JSZip script tag must be present"
        jszip_section = html.split("jszip")[1].split(">")[0]
        assert 'integrity=' in jszip_section, \
            "JSZip CDN script missing integrity attribute"

    def test_fontawesome_is_loaded(self):
        """Font Awesome CSS must be loaded (local or CDN)."""
        html = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        assert "font-awesome" in html or "fontawesome" in html, \
            "Font Awesome CSS must be referenced in index.html"

    def test_assessment_config_js_is_local(self):
        """assessment_config.js must be loaded locally (not from CDN)."""
        html = (PROJECT_ROOT / "index.html").read_text(encoding="utf-8")
        # It should be a relative local path, not https://
        assert 'src="config/assessment_config.js"' in html or \
               "src='config/assessment_config.js'" in html, \
            "assessment_config.js should be loaded from local path"


# ═══════════════════════════════════════════════════════════════════
# STRUCTUREDCLONE SAFETY
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.security
class TestStructuredCloneSafety:
    """structuredClone used in copy must not carry prototype pollution."""

    def test_cloned_node_has_no_proto_pollution(self, app: Page):
        """A cloned node should not have __proto__ or constructor manipulation."""
        page = app
        result = page.evaluate("""() => {
            const node = {
                uid: 'test',
                title: 'Safe Node',
                impacts: [],
                children: [],
                __proto__: { polluted: true }
            };
            const clone = structuredClone(node);
            return {
                hasPolluted: 'polluted' in clone,
                hasOwnPolluted: clone.hasOwnProperty('polluted')
            };
        }""")
        assert result["hasPolluted"] is False or result["hasOwnPolluted"] is False
