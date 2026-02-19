/**
 * @file        config_loader.js
 * @description Loads assessment configuration from config/assessment_config.json.
 *              Must be loaded BEFORE globals.js so that all downstream modules
 *              receive their values from the configuration file rather than
 *              hardcoded constants.
 *
 *              The configuration file can be updated independently during annual
 *              reviews (scalars, thresholds, damage scenarios) without modifying
 *              any source code.
 *
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

/* global showToast */

// ── The raw parsed config object (read-only after load) ────────────
let ASSESSMENT_CONFIG = null;

/**
 * Synchronously loads and validates the assessment configuration.
 * Uses synchronous XMLHttpRequest so that all subsequent <script> tags
 * can rely on the config being available as global constants.
 *
 * @param {string} [path='config/assessment_config.json'] - Relative path to config file
 * @returns {boolean} true if config was loaded successfully
 */
function loadAssessmentConfig(path) {
    const configPath = path || 'config/assessment_config.json';

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', configPath, false); // synchronous
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.send(null);

        if (xhr.status !== 200 && xhr.status !== 0) {
            console.error(`[config_loader] Failed to load ${configPath}: HTTP ${xhr.status}`);
            return false;
        }

        const parsed = JSON.parse(xhr.responseText);

        // Basic structural validation
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

        // Validate riskThresholds is sorted descending by min
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

        ASSESSMENT_CONFIG = Object.freeze(parsed);
        console.log(`[config_loader] Assessment config v${parsed._meta?.version || '?'} loaded successfully`);
        return true;

    } catch (e) {
        console.error('[config_loader] Error loading assessment config:', e);
        return false;
    }
}

// ── Load immediately on script execution ───────────────────────────
const _configLoaded = loadAssessmentConfig();

if (!_configLoaded) {
    // Show a visible warning – config_loader runs before showToast is available,
    // so we use a simple alert as last resort
    console.warn('[config_loader] Falling back to hardcoded defaults – config file could not be loaded.');
}
