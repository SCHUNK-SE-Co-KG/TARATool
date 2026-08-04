/**
 * @file        globals.js
 * @description Global configuration, constants, and shared data structures.
 *              All assessment scalars, thresholds and damage scenarios are loaded
 *              from config/assessment_config.json via config_loader.js.
 *              Hardcoded values below serve only as fallbacks if config loading fails.
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

/* global ASSESSMENT_CONFIG */

const INITIAL_VERSION = '0.1'; 

/**
 * Returns today's date as ISO string (YYYY-MM-DD).
 * Use this function instead of a static constant so the date stays correct
 * even when the browser tab remains open overnight.
 */
function getTodayISO() {
    return new Date().toISOString().substring(0, 10);
}

// Legacy alias – kept for backward compatibility (e.g. versioning.js top-level references).
// Prefer getTodayISO() in new code.
let todayISO = getTodayISO();

// ═════════════════════════════════════════════════════════════════════
// Configuration-driven constants – reloadable via syncGlobalsFromAssessmentConfig()
// ═════════════════════════════════════════════════════════════════════

const _FALLBACK_DAMAGE_SCENARIOS = [
    { id: 'DS1', name: 'Gefahr für Leib und Leben', name_en: 'Danger to life and limb', short: 'Safety', short_en: 'Safety', description: 'Verletzung von Personen oder lebensbedrohliche Situationen.', description_en: 'Injury to persons or life-threatening situations.' },
    { id: 'DS2', name: 'Finanzieller Schaden', name_en: 'Financial damage', short: 'Financial', short_en: 'Financial', description: 'Direkte oder indirekte finanzielle Verluste (Rückruf, Schadensersatz).', description_en: 'Direct or indirect financial losses (recall, damages).' },
    { id: 'DS3', name: 'Verlust von geistigem Eigentum', name_en: 'Loss of intellectual property', short: 'IP loss', short_en: 'IP loss', description: 'Verlust von geistigem Eigentum (Patente, Urheberrechte, etc.).', description_en: 'Loss of intellectual property (patents, copyrights, etc.).' },
    { id: 'DS4', name: 'Verlust Privatsphäre/Daten', name_en: 'Loss of privacy/data', short: 'Privacy', short_en: 'Privacy', description: 'Verlust sensibler persönlicher oder technischer Daten.', description_en: 'Loss of sensitive personal or technical data.' },
    { id: 'DS5', name: 'Rechtliche Konsequenzen', name_en: 'Legal consequences', short: 'Legal', short_en: 'Legal', description: 'Verstoß gegen Gesetze oder Vorschriften.', description_en: 'Violation of laws or regulations.' }
];

const _FALLBACK_PROBABILITY_CRITERIA = {
    'K': { label: 'K (Komplexität)', label_en: 'K (Complexity)', fullLabel: 'Komplexität (Knowledge / Complexity)',
           options: [ { value: '0.7', text: '0,7 - Bekannte Schwachstellen (z.B. CVE, Errata)', text_en: '0.7 - Known vulnerabilities (e.g. CVE, errata)' },
                      { value: '0.6', text: '0,6 - Einfache Internetrecherche (z.B. einfache Foren)', text_en: '0.6 - Simple internet research (e.g. basic forums)' },
                      { value: '0.3', text: '0,3 - Experten Recherche (z.B. spezifische Foren, Onionnet)', text_en: '0.3 - Expert research (e.g. specialised forums, onion network)' },
                      { value: '0.1', text: '0,1 - Expertenwissen', text_en: '0.1 - Expert knowledge' } ] },
    'S': { label: 'S (Skalierung)', label_en: 'S (Scaling)', fullLabel: 'Skalierung (Scaling)',
           options: [ { value: '0.5', text: '0,5 - IT-Netzwerk beim Kunden', text_en: '0.5 - Customer IT network' },
                      { value: '0.3', text: '0,3 - OT-Netzwerk beim Kunden', text_en: '0.3 - Customer OT network' },
                      { value: '0.1', text: '0,1 - Einzelprodukt/ lokale Maschine', text_en: '0.1 - Single product / local machine' } ] },
    'T': { label: 'T (Zeit)', label_en: 'T (Time)', fullLabel: 'Zeit / Aufwand (Time)',
           options: [ { value: '0.5', text: '0,5 - < 1 Woche', text_en: '0.5 - < 1 week' },
                      { value: '0.4', text: '0,4 - < 4 Wochen', text_en: '0.4 - < 4 weeks' },
                      { value: '0.2', text: '0,2 - < 3 Monate', text_en: '0.2 - < 3 months' },
                      { value: '0.1', text: '0,1 - > 3 Monate', text_en: '0.1 - > 3 months' } ] },
    'U': { label: 'U (Nutzen)', label_en: 'U (Utility)', fullLabel: 'Sichtbarer Nutzen für Angreifer (Utility)',
           options: [ { value: '0.5', text: '0,5 - Groß', text_en: '0.5 - High' },
                      { value: '0.3', text: '0,3 - Mittel', text_en: '0.3 - Medium' },
                      { value: '0.1', text: '0,1 - Klein', text_en: '0.1 - Low' } ] }
};

// var (not const) so runtime config reload can replace references
var DEFAULT_DAMAGE_SCENARIOS;
var PROBABILITY_CRITERIA;
var RISK_THRESHOLDS;
var RISK_UNKNOWN;
var VALID_IMPACT_VALUES;
var IMPACT_LABELS;
var IMPACT_CSS_CLASSES;
var SEVERITY_LEVEL_FACTORS;
var PROTECTION_LEVEL_WEIGHTS;
var PROTECTION_LEVEL_RANKING;

/**
 * Applies assessment config to all global constants (initial load + UI reload).
 * @param {object|null} cfg - Parsed assessment_config object, or null for fallbacks
 */
function syncGlobalsFromAssessmentConfig(cfg) {
    const c = cfg || {};

    DEFAULT_DAMAGE_SCENARIOS = Object.freeze(
        JSON.parse(JSON.stringify(c.defaultDamageScenarios || _FALLBACK_DAMAGE_SCENARIOS))
            .map(ds => Object.freeze(ds))
    );

    PROBABILITY_CRITERIA = JSON.parse(JSON.stringify(
        c.probabilityCriteria || _FALLBACK_PROBABILITY_CRITERIA
    ));

    RISK_THRESHOLDS = Object.freeze(
        JSON.parse(JSON.stringify(c.riskThresholds || [
            { min: 2.0, label: 'Kritisch', labelEn: 'critical', color: '#c0392b', colorRGB: [192, 57, 43] },
            { min: 1.6, label: 'Hoch',     labelEn: 'high',     color: '#e67e22', colorRGB: [230, 126, 34] },
            { min: 0.8, label: 'Mittel',   labelEn: 'medium',   color: '#f39c12', colorRGB: [243, 156, 18] },
            { min: 0,   label: 'Niedrig',  labelEn: 'low',      color: '#27ae60', colorRGB: [39, 174, 96]  }
        ])).map(t => Object.freeze(t))
    );

    RISK_UNKNOWN = Object.freeze(JSON.parse(JSON.stringify(
        c.riskUnknown || { label: 'Unbekannt', color: '#7f8c8d', colorRGB: [127, 140, 141] }
    )));

    VALID_IMPACT_VALUES = Object.freeze([...(c.impactScale?.validValues || ['N/A', '1', '2', '3'])]);

    IMPACT_LABELS = Object.freeze({ ...(c.impactScale?.labels || { 'N/A': 'N/A', '1': 'Low', '2': 'Medium', '3': 'High' }) });

    IMPACT_CSS_CLASSES = Object.freeze({ ...(c.impactScale?.cssClasses || { '3': 'impact-high', '2': 'impact-medium', '1': 'impact-low', 'N/A': 'impact-na' }) });

    SEVERITY_LEVEL_FACTORS = Object.freeze({ ...(c.severityLevelFactors || { '0': 0.0, '1': 0.3, '2': 0.6, '3': 1.0 }) });

    PROTECTION_LEVEL_WEIGHTS = Object.freeze({ ...(c.protectionLevels?.weights || { 'I': 0.6, 'II': 0.8, 'III': 1.0 }) });

    PROTECTION_LEVEL_RANKING = Object.freeze({ ...(c.protectionLevels?.ranking || { '-': 0, 'I': 1, 'II': 2, 'III': 3 }) });

    if (typeof rebuildTreeRiskLevelsFromConfig === 'function') {
        rebuildTreeRiskLevelsFromConfig();
    }
}

syncGlobalsFromAssessmentConfig(typeof ASSESSMENT_CONFIG !== 'undefined' ? ASSESSMENT_CONFIG : null);
window.syncGlobalsFromAssessmentConfig = syncGlobalsFromAssessmentConfig;

let analysisData = []; 
let activeAnalysisId = null;

/**
 * Creates a fresh default analysis object with current date.
 * Always returns a new deep-copied object.
 */
function createDefaultAnalysis() {
    const today = getTodayISO();
    const _name = (typeof t === 'function' ? t('analysis.defaultName') : 'Neue Analyse');
    const _author = (typeof t === 'function' ? t('analysis.unknownAuthor') : 'Unbekannt');
    const _initial = (typeof t === 'function' ? t('history.initial') : 'Initiale Erstellung');
    return {
        id: 'tara-001',
        name: _name,
        description: '',
        intendedUse: '',
        metadata: {
            version: INITIAL_VERSION,
            author: _author,
            date: today
        },
        history: [
            {
                version: INITIAL_VERSION,
                date: today,
                author: 'System',
                comment: _initial,
                state: null 
            }
        ],
        assets: [],
        damageScenarios: JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)),
        impactMatrix: {},
        riskEntries: [],
        securityGoals: [],
        residualRisk: { leaves: {}, entries: [], treeNotes: {} }
    };
}

// Legacy alias – some code still references defaultAnalysis directly
const defaultAnalysis = createDefaultAnalysis();

// renderActiveTab() has been extracted to js/core/tab_dispatcher.js
// to break the circular dependency where globals.js referenced render
// functions from later-loaded modules.