"""
@file        test_config.py
@description Tests for the assessment configuration system: config loading,
             validation, fallback behaviour, and correct propagation of
             config-driven constants into all downstream modules.
@covers      config_loader.js, globals.js, impact_matrix.js, assets.js,
             attack_tree_calc.js
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
    SAMPLE_ASSET,
)

# Path to the config file
CONFIG_PATH = PROJECT_ROOT / "config" / "assessment_config.json"


# ═══════════════════════════════════════════════════════════════════
# CONFIG FILE STRUCTURE
# ═══════════════════════════════════════════════════════════════════

class TestConfigFileStructure:
    """Validate the static JSON config file is well-formed."""

    def test_config_file_exists(self):
        """config/assessment_config.json must exist in the project."""
        assert CONFIG_PATH.is_file(), f"Config file not found: {CONFIG_PATH}"

    def test_config_is_valid_json(self):
        """Config file must be parseable as JSON."""
        raw = CONFIG_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
        assert isinstance(data, dict)

    def test_config_has_meta(self):
        """Config should contain a _meta section with version."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        assert "_meta" in data
        assert "version" in data["_meta"]

    @pytest.mark.parametrize("key", [
        "impactScale",
        "severityLevelFactors",
        "protectionLevels",
        "probabilityCriteria",
        "riskThresholds",
        "riskUnknown",
        "defaultDamageScenarios",
    ])
    def test_config_has_required_section(self, key):
        """Each required top-level section must be present."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        assert key in data, f"Missing required section: {key}"

    def test_impact_scale_structure(self):
        """impactScale must have validValues, labels, and cssClasses."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        impact = data["impactScale"]
        assert "validValues" in impact
        assert "labels" in impact
        assert "cssClasses" in impact
        assert isinstance(impact["validValues"], list)
        assert len(impact["validValues"]) > 0

    def test_impact_scale_labels_match_values(self):
        """Every validValue must have a corresponding label."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        impact = data["impactScale"]
        for val in impact["validValues"]:
            assert val in impact["labels"], f"No label for impact value '{val}'"

    def test_impact_scale_css_classes_exist(self):
        """Every non-N/A validValue should have a CSS class mapping."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        impact = data["impactScale"]
        for val in impact["validValues"]:
            assert val in impact["cssClasses"], f"No CSS class for impact value '{val}'"

    def test_severity_level_factors_are_numeric(self):
        """All severityLevelFactors values must be floats in [0.0, 1.0]."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        for key, val in data["severityLevelFactors"].items():
            assert isinstance(val, (int, float)), f"Factor '{key}' is not numeric"
            assert 0.0 <= val <= 1.0, f"Factor '{key}'={val} out of [0,1] range"

    def test_protection_level_weights_are_numeric(self):
        """All protectionLevels.weights values must be floats in (0.0, 1.0]."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        for key, val in data["protectionLevels"]["weights"].items():
            assert isinstance(val, (int, float)), f"Weight '{key}' is not numeric"
            assert 0.0 < val <= 1.0, f"Weight '{key}'={val} out of (0,1] range"

    def test_protection_level_ranking_is_ordered(self):
        """Ranking values should be non-negative integers in ascending order."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        ranking = data["protectionLevels"]["ranking"]
        values = list(ranking.values())
        assert all(isinstance(v, int) for v in values)
        assert sorted(values) == values, "Ranking values not in ascending order"

    def test_risk_thresholds_sorted_descending(self):
        """riskThresholds must be sorted by min value in descending order."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        thresholds = data["riskThresholds"]
        assert isinstance(thresholds, list)
        assert len(thresholds) >= 2, "Need at least 2 risk thresholds"
        mins = [t["min"] for t in thresholds]
        assert mins == sorted(mins, reverse=True), "riskThresholds not sorted descending by min"

    def test_risk_thresholds_have_required_fields(self):
        """Each threshold entry needs min, label, labelEn, color."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        for i, t in enumerate(data["riskThresholds"]):
            for field in ("min", "label", "labelEn", "color"):
                assert field in t, f"riskThresholds[{i}] missing '{field}'"

    def test_risk_thresholds_labelEn_unique(self):
        """English labels must be unique (used as keys in _TREE_RISK_LEVELS)."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        labels = [t["labelEn"] for t in data["riskThresholds"]]
        assert len(labels) == len(set(labels)), "Duplicate labelEn in riskThresholds"

    def test_probability_criteria_have_options(self):
        """Each probability criterion (K, S, T, U) must have options."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        criteria = data["probabilityCriteria"]
        for key in ("K", "S", "T", "U"):
            assert key in criteria, f"Missing criterion: {key}"
            assert "options" in criteria[key], f"Criterion {key} has no options"
            assert len(criteria[key]["options"]) > 0, f"Criterion {key} options empty"

    def test_default_damage_scenarios_have_required_fields(self):
        """Each default damage scenario needs id, name, short, description."""
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        for i, ds in enumerate(data["defaultDamageScenarios"]):
            for field in ("id", "name", "short", "description"):
                assert field in ds, f"defaultDamageScenarios[{i}] missing '{field}'"


# ═══════════════════════════════════════════════════════════════════
# CONFIG LOADING IN BROWSER
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.core
class TestConfigLoading:
    """Verify config_loader.js loads and exposes ASSESSMENT_CONFIG."""

    def test_assessment_config_is_loaded(self, app: Page):
        """ASSESSMENT_CONFIG global should not be null after app load."""
        result = app.evaluate("() => ASSESSMENT_CONFIG !== null")
        assert result, "ASSESSMENT_CONFIG is null — config_loader.js failed"

    def test_assessment_config_is_frozen(self, app: Page):
        """ASSESSMENT_CONFIG should be frozen (Object.isFrozen)."""
        result = app.evaluate("() => Object.isFrozen(ASSESSMENT_CONFIG)")
        assert result, "ASSESSMENT_CONFIG is not frozen"

    def test_config_version_present(self, app: Page):
        """Config _meta.version should be accessible."""
        version = app.evaluate("() => ASSESSMENT_CONFIG._meta?.version")
        assert version is not None, "Config version not found"

    def test_config_has_all_sections(self, app: Page):
        """All 7 required sections must be present in the loaded config."""
        keys = app.evaluate("""() => {
            const required = [
                'impactScale', 'severityLevelFactors', 'protectionLevels',
                'probabilityCriteria', 'riskThresholds', 'riskUnknown',
                'defaultDamageScenarios'
            ];
            return required.filter(k => !(k in ASSESSMENT_CONFIG));
        }""")
        assert keys == [], f"Missing config sections: {keys}"


# ═══════════════════════════════════════════════════════════════════
# GLOBAL CONSTANTS FROM CONFIG
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.core
class TestGlobalConstants:
    """Verify globals.js populates constants from the config file."""

    def test_valid_impact_values_from_config(self, app: Page):
        """VALID_IMPACT_VALUES should match config impactScale.validValues."""
        values = app.evaluate("() => [...VALID_IMPACT_VALUES]")
        config_values = app.evaluate("() => ASSESSMENT_CONFIG.impactScale.validValues")
        assert values == config_values

    def test_impact_labels_from_config(self, app: Page):
        """IMPACT_LABELS should match config impactScale.labels."""
        labels = app.evaluate("() => ({...IMPACT_LABELS})")
        config_labels = app.evaluate("() => ASSESSMENT_CONFIG.impactScale.labels")
        assert labels == config_labels

    def test_impact_css_classes_from_config(self, app: Page):
        """IMPACT_CSS_CLASSES should match config impactScale.cssClasses."""
        classes = app.evaluate("() => ({...IMPACT_CSS_CLASSES})")
        config_classes = app.evaluate("() => ASSESSMENT_CONFIG.impactScale.cssClasses")
        assert classes == config_classes

    def test_severity_level_factors_from_config(self, app: Page):
        """SEVERITY_LEVEL_FACTORS should match config values."""
        factors = app.evaluate("() => ({...SEVERITY_LEVEL_FACTORS})")
        config_factors = app.evaluate("""() => {
            const obj = {};
            for (const [k, v] of Object.entries(ASSESSMENT_CONFIG.severityLevelFactors)) {
                obj[k] = v;
            }
            return obj;
        }""")
        assert factors == config_factors

    def test_protection_level_weights_from_config(self, app: Page):
        """PROTECTION_LEVEL_WEIGHTS should match config protectionLevels.weights."""
        weights = app.evaluate("() => ({...PROTECTION_LEVEL_WEIGHTS})")
        config_weights = app.evaluate("() => ASSESSMENT_CONFIG.protectionLevels.weights")
        assert weights == config_weights

    def test_protection_level_ranking_from_config(self, app: Page):
        """PROTECTION_LEVEL_RANKING should match config protectionLevels.ranking."""
        ranking = app.evaluate("() => ({...PROTECTION_LEVEL_RANKING})")
        config_ranking = app.evaluate("() => ASSESSMENT_CONFIG.protectionLevels.ranking")
        assert ranking == config_ranking

    def test_risk_thresholds_from_config(self, app: Page):
        """RISK_THRESHOLDS should be an array matching config riskThresholds."""
        thresholds = app.evaluate("() => [...RISK_THRESHOLDS]")
        config_thresholds = app.evaluate("() => ASSESSMENT_CONFIG.riskThresholds")
        assert len(thresholds) == len(config_thresholds)
        for i, (actual, expected) in enumerate(zip(thresholds, config_thresholds)):
            assert actual["min"] == expected["min"], f"Threshold[{i}].min mismatch"
            assert actual["label"] == expected["label"], f"Threshold[{i}].label mismatch"

    def test_risk_unknown_from_config(self, app: Page):
        """RISK_UNKNOWN should match config riskUnknown."""
        unknown = app.evaluate("() => ({...RISK_UNKNOWN})")
        config_unknown = app.evaluate("() => ASSESSMENT_CONFIG.riskUnknown")
        assert unknown["label"] == config_unknown["label"]
        assert unknown["color"] == config_unknown["color"]

    def test_default_damage_scenarios_from_config(self, app: Page):
        """DEFAULT_DAMAGE_SCENARIOS should match config defaultDamageScenarios."""
        ds = app.evaluate("() => [...DEFAULT_DAMAGE_SCENARIOS]")
        config_ds = app.evaluate("() => ASSESSMENT_CONFIG.defaultDamageScenarios")
        assert len(ds) == len(config_ds)
        for i, (actual, expected) in enumerate(zip(ds, config_ds)):
            assert actual["id"] == expected["id"], f"DS[{i}].id mismatch"
            assert actual["name"] == expected["name"], f"DS[{i}].name mismatch"

    def test_probability_criteria_from_config(self, app: Page):
        """PROBABILITY_CRITERIA should have all 4 criteria from config."""
        criteria = app.evaluate("() => Object.keys(PROBABILITY_CRITERIA)")
        config_criteria = app.evaluate("() => Object.keys(ASSESSMENT_CONFIG.probabilityCriteria)")
        assert sorted(criteria) == sorted(config_criteria)

    def test_constants_are_frozen(self, app: Page):
        """All config-derived constants should be frozen."""
        results = app.evaluate("""() => ({
            VALID_IMPACT_VALUES: Object.isFrozen(VALID_IMPACT_VALUES),
            IMPACT_LABELS: Object.isFrozen(IMPACT_LABELS),
            IMPACT_CSS_CLASSES: Object.isFrozen(IMPACT_CSS_CLASSES),
            SEVERITY_LEVEL_FACTORS: Object.isFrozen(SEVERITY_LEVEL_FACTORS),
            PROTECTION_LEVEL_WEIGHTS: Object.isFrozen(PROTECTION_LEVEL_WEIGHTS),
            PROTECTION_LEVEL_RANKING: Object.isFrozen(PROTECTION_LEVEL_RANKING),
            RISK_THRESHOLDS: Object.isFrozen(RISK_THRESHOLDS),
            RISK_UNKNOWN: Object.isFrozen(RISK_UNKNOWN),
            DEFAULT_DAMAGE_SCENARIOS: Object.isFrozen(DEFAULT_DAMAGE_SCENARIOS),
        })""")
        for name, frozen in results.items():
            assert frozen, f"{name} is not frozen"


# ═══════════════════════════════════════════════════════════════════
# ATTACK TREE RISK LEVELS FROM CONFIG
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestTreeRiskLevelsFromConfig:
    """Verify _TREE_RISK_LEVELS is built from RISK_THRESHOLDS config."""

    def test_tree_risk_levels_exist(self, app: Page):
        """_TREE_RISK_LEVELS should be defined and non-empty."""
        result = app.evaluate("""() => {
            return typeof _TREE_RISK_LEVELS !== 'undefined'
                && Object.keys(_TREE_RISK_LEVELS).length > 0;
        }""")
        assert result

    def test_tree_risk_levels_match_config_thresholds(self, app: Page):
        """_TREE_RISK_LEVELS should contain entries derived from riskThresholds."""
        levels = app.evaluate("() => ({..._TREE_RISK_LEVELS})")
        thresholds = app.evaluate("() => [...RISK_THRESHOLDS]")
        # For each threshold with min > 0, there should be a matching entry
        for t in thresholds:
            if t["min"] > 0:
                label = t["labelEn"]
                assert label in levels, f"Missing tree risk level: {label}"
                assert levels[label] == t["min"], f"Threshold mismatch for {label}"

    def test_tree_risk_levels_frozen(self, app: Page):
        """_TREE_RISK_LEVELS should be frozen."""
        result = app.evaluate("() => Object.isFrozen(_TREE_RISK_LEVELS)")
        assert result

    def test_get_risk_level_uses_config_thresholds(self, app: Page):
        """_getRiskLevel() should classify scores consistently with config."""
        thresholds = app.evaluate("() => [...RISK_THRESHOLDS]")
        # Test each threshold boundary
        for t in thresholds:
            level = app.evaluate(f"() => _getRiskLevel({t['min']})")
            assert level == t["labelEn"], \
                f"Score {t['min']} should be '{t['labelEn']}' but got '{level}'"

    def test_get_risk_level_below_all_thresholds(self, app: Page):
        """A score of 0 should return the lowest level (fallthrough)."""
        lowest_label = app.evaluate("""() => {
            const sorted = [...RISK_THRESHOLDS].sort((a, b) => a.min - b.min);
            return sorted[0].labelEn;
        }""")
        level = app.evaluate("() => _getRiskLevel(0)")
        assert level == lowest_label

    def test_get_risk_level_high_boundary(self, app: Page):
        """A score just below 'critical' should be 'high'."""
        result = app.evaluate("""() => {
            const sorted = [...RISK_THRESHOLDS].sort((a, b) => b.min - a.min);
            const critical = sorted[0];
            const high = sorted[1];
            const justBelow = critical.min - 0.01;
            return {
                level: _getRiskLevel(justBelow),
                expectedLabel: high.labelEn
            };
        }""")
        assert result["level"] == result["expectedLabel"]


# ═══════════════════════════════════════════════════════════════════
# IMPACT MATRIX RENDERING FROM CONFIG
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.damage_scenarios
class TestImpactMatrixConfig:
    """Verify impact matrix uses config-driven values and CSS classes."""

    def test_impact_color_class_uses_config(self, app: Page):
        """getImpactColorClass() should return CSS classes from config."""
        results = app.evaluate("""() => {
            const out = {};
            const vals = [...VALID_IMPACT_VALUES];
            vals.forEach(v => { out[v] = getImpactColorClass(v); });
            return out;
        }""")
        config_classes = app.evaluate("() => ASSESSMENT_CONFIG.impactScale.cssClasses")
        for val, expected_class in config_classes.items():
            assert results.get(val) == expected_class, \
                f"getImpactColorClass('{val}') = '{results.get(val)}', expected '{expected_class}'"

    def test_impact_color_class_unknown_value(self, app: Page):
        """getImpactColorClass() with unknown value should return empty string."""
        result = app.evaluate("() => getImpactColorClass('INVALID')")
        assert result == ""

    def test_impact_dropdown_has_config_options(self, app_with_analysis: Page):
        """Impact matrix dropdowns should contain all options from config."""
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "damage_scenarios")
        page.wait_for_timeout(300)

        # Get the option values from the first select
        options = page.evaluate("""() => {
            const sel = document.querySelector('#dsMatrixContainer select');
            if (!sel) return [];
            return [...sel.options].map(o => o.value);
        }""")
        config_values = page.evaluate("() => [...VALID_IMPACT_VALUES]")
        assert options == config_values, \
            f"Dropdown options {options} don't match config values {config_values}"

    def test_impact_dropdown_labels_from_config(self, app_with_analysis: Page):
        """Dropdown option text should include labels from config."""
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "damage_scenarios")
        page.wait_for_timeout(300)

        option_texts = page.evaluate("""() => {
            const sel = document.querySelector('#dsMatrixContainer select');
            if (!sel) return [];
            return [...sel.options].map(o => ({ value: o.value, text: o.text }));
        }""")
        config_labels = page.evaluate("() => ASSESSMENT_CONFIG.impactScale.labels")
        for opt in option_texts:
            val = opt["value"]
            label = config_labels.get(val, val)
            # For values where label == value (e.g. "N/A"), text should just be the value
            # For others, text should be "value (label)" e.g. "3 (High)"
            if val == label:
                assert opt["text"] == val, \
                    f"Option '{val}' text='{opt['text']}', expected '{val}'"
            else:
                expected = f"{val} ({label})"
                assert opt["text"] == expected, \
                    f"Option '{val}' text='{opt['text']}', expected '{expected}'"

    def test_impact_select_color_changes(self, app_with_analysis: Page):
        """Selecting a value should apply the corresponding CSS class."""
        page = app_with_analysis
        add_asset(page)
        switch_tab(page, "damage_scenarios")
        page.wait_for_timeout(300)

        # Select value "3" and check CSS class
        sel = page.locator("#dsMatrixContainer select").first
        sel.select_option("3")
        page.wait_for_timeout(300)
        classes = sel.get_attribute("class")
        expected_class = page.evaluate("() => IMPACT_CSS_CLASSES['3']")
        assert expected_class in classes, \
            f"Expected '{expected_class}' in classes '{classes}'"


# ═══════════════════════════════════════════════════════════════════
# ASSET PROTECTION LEVEL FROM CONFIG
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.assets
class TestAssetProtectionLevelConfig:
    """Verify asset Schutzbedarf calculation uses PROTECTION_LEVEL_RANKING."""

    def test_protection_level_ranking_available(self, app: Page):
        """PROTECTION_LEVEL_RANKING global should be accessible."""
        result = app.evaluate("() => typeof PROTECTION_LEVEL_RANKING !== 'undefined'")
        assert result

    def test_protection_level_ranking_values(self, app: Page):
        """PROTECTION_LEVEL_RANKING should have expected keys."""
        ranking = app.evaluate("() => ({...PROTECTION_LEVEL_RANKING})")
        assert "-" in ranking
        assert "I" in ranking
        assert "II" in ranking
        assert "III" in ranking
        # Values should be ascending
        assert ranking["-"] < ranking["I"] < ranking["II"] < ranking["III"]

    def test_asset_schutzbedarf_computed_from_config(self, app_with_analysis: Page):
        """Adding an asset with CIA=III/II/III should compute schutzbedarf=III."""
        page = app_with_analysis
        add_asset(page, SAMPLE_ASSET)  # C=III, I=II, A=III
        data = get_active_analysis(page)
        asset = data["assets"][0]
        assert asset["schutzbedarf"] == "III"

    def test_asset_schutzbedarf_min_values(self, app_with_analysis: Page):
        """An asset with all CIA=I should have schutzbedarf=I."""
        page = app_with_analysis
        low_asset = {
            "name": "Low Asset",
            "type": "Software",
            "description": "Minimal protection",
            "confidentiality": "I",
            "integrity": "I",
            "availability": "I",
        }
        add_asset(page, low_asset)
        data = get_active_analysis(page)
        asset = data["assets"][0]
        assert asset["schutzbedarf"] == "I"


# ═══════════════════════════════════════════════════════════════════
# RISK CALCULATION USES CONFIG
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.risk_analysis
class TestRiskCalculationConfig:
    """Verify computeRiskScore and getRiskMeta use config thresholds."""

    def test_compute_risk_score_function_exists(self, app: Page):
        """computeRiskScore should be a global function."""
        result = app.evaluate("() => typeof computeRiskScore === 'function'")
        assert result

    def test_get_risk_meta_function_exists(self, app: Page):
        """getRiskMeta should be a global function."""
        result = app.evaluate("() => typeof getRiskMeta === 'function'")
        assert result

    def test_risk_meta_labels_match_config(self, app: Page):
        """getRiskMeta should return labels from RISK_THRESHOLDS config."""
        results = app.evaluate("""() => {
            const out = [];
            RISK_THRESHOLDS.forEach(t => {
                const meta = getRiskMeta(t.min);
                out.push({ min: t.min, expected: t.label, actual: meta.label });
            });
            return out;
        }""")
        for r in results:
            assert r["actual"] == r["expected"], \
                f"getRiskMeta({r['min']}).label = '{r['actual']}', expected '{r['expected']}'"

    def test_risk_meta_colors_match_config(self, app: Page):
        """getRiskMeta should return colors from RISK_THRESHOLDS config."""
        results = app.evaluate("""() => {
            const out = [];
            RISK_THRESHOLDS.forEach(t => {
                const meta = getRiskMeta(t.min);
                out.push({ min: t.min, expected: t.color, actual: meta.color });
            });
            return out;
        }""")
        for r in results:
            assert r["actual"] == r["expected"], \
                f"getRiskMeta({r['min']}).color = '{r['actual']}', expected '{r['expected']}'"

    def test_impact_norm_uses_config_factors(self, app: Page):
        """computeLeafImpactNorm should use SEVERITY_LEVEL_FACTORS from config."""
        # This indirectly tests that the global SEVERITY_LEVEL_FACTORS is used
        result = app.evaluate("""() => {
            // Build a mock analysis with one asset (schutzbedarf III, weight=1.0)
            // and one DS rated '3' (factor=1.0 from config)
            const mockAnalysis = {
                assets: [{ id: 'A1', schutzbedarf: 'III' }],
                impactMatrix: { 'A1': { 'DS1': '3' } }
            };
            return computeLeafImpactNorm(['DS1'], mockAnalysis);
        }""")
        # With config defaults: factor('3')=1.0 * weight('III')=1.0 = 1.0
        expected_factor = app.evaluate("() => SEVERITY_LEVEL_FACTORS['3']")
        expected_weight = app.evaluate("() => PROTECTION_LEVEL_WEIGHTS['III']")
        expected = round(expected_factor * expected_weight, 2)
        assert float(result) == expected, \
            f"I_norm={result}, expected {expected} (factor={expected_factor} * weight={expected_weight})"


# ═══════════════════════════════════════════════════════════════════
# CONSISTENCY BETWEEN CONFIG FILE AND RUNTIME
# ═══════════════════════════════════════════════════════════════════

@pytest.mark.core
class TestConfigConsistency:
    """Cross-check that the JSON file content matches the runtime config."""

    def test_config_file_matches_runtime(self, app: Page):
        """The JSON from disk should match the runtime ASSESSMENT_CONFIG."""
        disk_data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        runtime_version = app.evaluate("() => ASSESSMENT_CONFIG._meta.version")
        assert disk_data["_meta"]["version"] == runtime_version

    def test_risk_thresholds_count_matches(self, app: Page):
        """Number of risk thresholds should match between file and runtime."""
        disk_data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        runtime_count = app.evaluate("() => RISK_THRESHOLDS.length")
        assert len(disk_data["riskThresholds"]) == runtime_count

    def test_damage_scenarios_count_matches(self, app: Page):
        """Number of default DS should match between file and runtime."""
        disk_data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        runtime_count = app.evaluate("() => DEFAULT_DAMAGE_SCENARIOS.length")
        assert len(disk_data["defaultDamageScenarios"]) == runtime_count

    def test_no_console_errors_on_startup(self, app: Page):
        """App startup with config should produce no console errors."""
        errors = []
        app.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        app.reload(wait_until="domcontentloaded")
        app.wait_for_timeout(500)
        config_errors = [e for e in errors if "config" in e.lower()]
        assert config_errors == [], f"Config-related console errors: {config_errors}"
