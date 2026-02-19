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
// Configuration-driven constants (loaded from config/assessment_config.json)
// If the config file could not be loaded, hardcoded fallbacks are used.
// ═════════════════════════════════════════════════════════════════════
const _cfg = ASSESSMENT_CONFIG || {};

// Default damage scenarios
const DEFAULT_DAMAGE_SCENARIOS = Object.freeze(
    (_cfg.defaultDamageScenarios || [
        { id: 'DS1', name: 'Gefahr für Leib und Leben', short: 'Safety', description: 'Verletzung von Personen oder lebensbedrohliche Situationen.' },
        { id: 'DS2', name: 'Finanzieller Schaden', short: 'Financial', description: 'Direkte oder indirekte finanzielle Verluste (Rückruf, Schadensersatz).' },
        { id: 'DS3', name: 'Verlust von geistigem Eigentum', short: 'IP loss', description: 'Verlust von geistigem Eigentum (Patente, Urheberrechte, etc.).' },
        { id: 'DS4', name: 'Verlust Privatsphäre/Daten', short: 'Privacy', description: 'Verlust sensibler persönlicher oder technischer Daten.' },
        { id: 'DS5', name: 'Rechtliche Konsequenzen', short: 'Legal', description: 'Verstoß gegen Gesetze oder Vorschriften.' }
    ]).map(ds => Object.freeze(ds))
);

// Probability criteria scalars (K, S, T, U)
const PROBABILITY_CRITERIA = _cfg.probabilityCriteria || {
    'K': { label: 'K (Komplexität)', fullLabel: 'Komplexität (Knowledge / Complexity)',
           options: [ { value: '0.7', text: '0,7 - Bekannte Schwachstellen (z.B. CVE, Errata)' },
                      { value: '0.6', text: '0,6 - Einfache Internetrecherche (z.B. einfache Foren)' },
                      { value: '0.3', text: '0,3 - Experten Recherche (z.B. spezifische Foren, Onionnet)' },
                      { value: '0.1', text: '0,1 - Expertenwissen' } ] },
    'S': { label: 'S (Skalierung)', fullLabel: 'Skalierung (Scaling)',
           options: [ { value: '0.5', text: '0,5 - Produktportfolio (z.B. BKE)' },
                      { value: '0.3', text: '0,3 - Produktfamilie (z.B. EGU / EGK)' },
                      { value: '0.1', text: '0,1 - Einzelprodukt (z.B. einzelner Greifer)' } ] },
    'T': { label: 'T (Zeit)', fullLabel: 'Zeit / Aufwand (Time)',
           options: [ { value: '0.5', text: '0,5 - < 1 Woche' },
                      { value: '0.4', text: '0,4 - < 4 Wochen' },
                      { value: '0.2', text: '0,2 - < 3 Monate' },
                      { value: '0.1', text: '0,1 - > 3 Monate' } ] },
    'U': { label: 'U (Nutzen)', fullLabel: 'Sichtbarer Nutzen für Angreifer (Utility)',
           options: [ { value: '0.5', text: '0,5 - Groß' },
                      { value: '0.3', text: '0,3 - Mittel' },
                      { value: '0.1', text: '0,1 - Klein' } ] }
};

// Risk classification thresholds (single source of truth)
const RISK_THRESHOLDS = Object.freeze(
    (_cfg.riskThresholds || [
        { min: 2.0, label: 'Kritisch', color: '#c0392b', colorRGB: [192, 57, 43] },
        { min: 1.6, label: 'Hoch',     color: '#e67e22', colorRGB: [230, 126, 34] },
        { min: 0.8, label: 'Mittel',   color: '#f39c12', colorRGB: [243, 156, 18] },
        { min: 0,   label: 'Niedrig',  color: '#27ae60', colorRGB: [39, 174, 96]  }
    ]).map(t => Object.freeze(t))
);

const RISK_UNKNOWN = Object.freeze(
    _cfg.riskUnknown || { label: 'Unbekannt', color: '#7f8c8d', colorRGB: [127, 140, 141] }
);

// Valid values for impact score selects
const VALID_IMPACT_VALUES = Object.freeze(
    _cfg.impactScale?.validValues || ['N/A', '1', '2', '3']
);

// Impact scale labels (used by impact_matrix.js for dropdown rendering)
const IMPACT_LABELS = Object.freeze(
    _cfg.impactScale?.labels || { 'N/A': 'N/A', '1': 'Low', '2': 'Medium', '3': 'High' }
);

// Impact scale CSS classes (used by impact_matrix.js for color coding)
const IMPACT_CSS_CLASSES = Object.freeze(
    _cfg.impactScale?.cssClasses || { '3': 'impact-high', '2': 'impact-medium', '1': 'impact-low', 'N/A': 'impact-na' }
);

// Severity level factors for impact normalization (I_norm calculation)
const SEVERITY_LEVEL_FACTORS = Object.freeze(
    _cfg.severityLevelFactors || { '0': 0.0, '1': 0.3, '2': 0.6, '3': 1.0 }
);

// Protection level weights (Schutzbedarf) for impact normalization
const PROTECTION_LEVEL_WEIGHTS = Object.freeze(
    _cfg.protectionLevels?.weights || { 'I': 0.6, 'II': 0.8, 'III': 1.0 }
);

// Protection level ranking for determining max Schutzbedarf from CIA
const PROTECTION_LEVEL_RANKING = Object.freeze(
    _cfg.protectionLevels?.ranking || { '-': 0, 'I': 1, 'II': 2, 'III': 3 }
);

let analysisData = []; 
let activeAnalysisId = null;

/**
 * Creates a fresh default analysis object with current date.
 * Always returns a new deep-copied object.
 */
function createDefaultAnalysis() {
    const today = getTodayISO();
    return {
        id: 'tara-001',
        name: 'Neue Analyse',
        description: '',
        intendedUse: '',
        metadata: {
            version: INITIAL_VERSION,
            author: 'Unbekannt',
            date: today
        },
        history: [
            {
                version: INITIAL_VERSION,
                date: today,
                author: 'System',
                comment: 'Initiale Erstellung',
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