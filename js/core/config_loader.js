/**
 * @file        config_loader.js
 * @description Loads assessment configuration for TARA Tool.
 *
 *              Load order at startup (portable, no web server):
 *              1. config/assessment_config.js  (script tag, works with file://)
 *              2. config/assessment_config.json (XHR, works with http:// only)
 *
 *              Runtime reload: button "Bewertungsconfig laden" on overview tab
 *              (file picker → assessment_config.json, no .bat required).
 *
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

// ── The raw parsed config object (read-only after load) ────────────
let ASSESSMENT_CONFIG = null;
let _lastConfigSource = 'none';

/**
 * Validates parsed config structure.
 * @param {object} parsed
 * @returns {boolean}
 */
function _validateAssessmentConfig(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;

    const requiredKeys = [
        'impactScale',
        'severityLevelFactors',
        'protectionLevels',
        'probabilityCriteria',
        'riskThresholds',
        'riskUnknown',
        'defaultDamageScenarios'
    ];

    const missing = requiredKeys.filter(k => !(k in parsed));
    if (missing.length > 0) {
        console.error(`[config_loader] Missing required keys in config: ${missing.join(', ')}`);
        return false;
    }

    const thresholds = parsed.riskThresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0) {
        console.error('[config_loader] riskThresholds must be a non-empty array');
        return false;
    }
    for (let i = 1; i < thresholds.length; i++) {
        if (thresholds[i].min > thresholds[i - 1].min) {
            console.error('[config_loader] riskThresholds must be sorted descending by "min"');
            return false;
        }
    }

    return true;
}

/**
 * @param {object} parsed
 * @param {string} sourceLabel
 * @returns {boolean}
 */
function _applyAssessmentConfig(parsed, sourceLabel) {
    if (!_validateAssessmentConfig(parsed)) return false;
    ASSESSMENT_CONFIG = Object.freeze(parsed);
    window.ASSESSMENT_CONFIG = ASSESSMENT_CONFIG;
    _lastConfigSource = sourceLabel || 'unknown';
    console.log(`[config_loader] Assessment config v${parsed._meta?.version || '?'} loaded from ${_lastConfigSource}`);

    if (typeof syncGlobalsFromAssessmentConfig === 'function') {
        syncGlobalsFromAssessmentConfig(parsed);
    }
    return true;
}

/**
 * Reload config from parsed JSON object (e.g. after file picker).
 * @param {object} parsed
 * @param {string} [sourceLabel]
 * @returns {boolean}
 */
function reloadAssessmentConfigFromObject(parsed, sourceLabel) {
    if (!_applyAssessmentConfig(parsed, sourceLabel || 'user file')) return false;
    if (typeof onAssessmentConfigReloaded === 'function') {
        try { onAssessmentConfigReloaded(); } catch (e) { console.warn('[config_loader] UI refresh:', e); }
    }
    return true;
}

/**
 * Reload config from JSON text.
 * @param {string} jsonText
 * @param {string} [sourceLabel]
 * @returns {boolean}
 */
function reloadAssessmentConfigFromJsonText(jsonText, sourceLabel) {
    try {
        const parsed = JSON.parse(jsonText);
        return reloadAssessmentConfigFromObject(parsed, sourceLabel || 'JSON text');
    } catch (e) {
        console.error('[config_loader] Invalid JSON:', e);
        if (typeof showToast === 'function') showToast('Ungültige JSON-Datei: ' + (e.message || e), 'error');
        return false;
    }
}

/** Opens hidden file input for assessment_config.json */
function promptReloadAssessmentConfig() {
    const input = document.getElementById('assessmentConfigFileInput');
    if (!input) {
        if (typeof showToast === 'function') showToast('Dateiauswahl nicht verfügbar.', 'error');
        return;
    }
    input.value = '';
    input.click();
}

window.reloadAssessmentConfigFromObject = reloadAssessmentConfigFromObject;
window.reloadAssessmentConfigFromJsonText = reloadAssessmentConfigFromJsonText;
window.promptReloadAssessmentConfig = promptReloadAssessmentConfig;

/**
 * Synchronously loads JSON via XHR (http:// or legacy file:// with browser flags).
 * @param {string} configPath
 * @returns {boolean}
 */
function loadAssessmentConfigFromJson(configPath) {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', configPath, false);
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send(null);

        if (xhr.status !== 200 && xhr.status !== 0) {
            console.warn(`[config_loader] JSON not loaded (${configPath}): HTTP ${xhr.status}`);
            return false;
        }

        const parsed = JSON.parse(xhr.responseText);
        return _applyAssessmentConfig(parsed, configPath);
    } catch (e) {
        console.warn('[config_loader] JSON load failed:', e.message || e);
        return false;
    }
}

/**
 * Main loader: preload (.js) first, then JSON fallback.
 * @returns {boolean}
 */
function loadAssessmentConfig() {
    try {
        if (typeof window.__ASSESSMENT_CONFIG_PRELOAD__ !== 'undefined'
            && window.__ASSESSMENT_CONFIG_PRELOAD__ !== null) {
            const pre = window.__ASSESSMENT_CONFIG_PRELOAD__;
            delete window.__ASSESSMENT_CONFIG_PRELOAD__;
            if (_applyAssessmentConfig(pre, 'config/assessment_config.js')) return true;
        }
    } catch (e) {
        console.warn('[config_loader] Preload parse failed:', e.message || e);
    }

    if (loadAssessmentConfigFromJson('config/assessment_config.json')) return true;

    return false;
}

// ── Load immediately on script execution ───────────────────────────
const _configLoaded = loadAssessmentConfig();

if (!_configLoaded) {
    console.warn('[config_loader] Falling back to hardcoded defaults – config could not be loaded.');
    console.warn('[config_loader] Nutze auf der Übersicht „Bewertungsconfig laden“ oder tools/sync_assessment_config.bat');
} else {
    window.ASSESSMENT_CONFIG = ASSESSMENT_CONFIG;
}

/** Debug helper – call in F12 console: taraConfigStatus() */
function taraConfigStatus() {
    const fromJs = ASSESSMENT_CONFIG !== null;
    const sOpts = (typeof PROBABILITY_CRITERIA !== 'undefined' && PROBABILITY_CRITERIA.S)
        ? PROBABILITY_CRITERIA.S.options.map(o => o.text)
        : '(PROBABILITY_CRITERIA not ready – run after full page load)';
    return {
        configLoaded: fromJs,
        source: _lastConfigSource,
        pageUrl: location.href,
        sScalingOptions: sOpts
    };
}
window.taraConfigStatus = taraConfigStatus;
