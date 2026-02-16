// =============================================================
// --- GLOBALS.JS: CONFIGURATION & DATA STRUCTURES ---
// =============================================================

const INITIAL_VERSION = '0.1'; 
const todayISO = new Date().toISOString().substring(0, 10);

// Default damage scenarios
const DEFAULT_DAMAGE_SCENARIOS = [
    { id: 'DS1', name: 'Gefahr für Leib und Leben', short: 'Safety', description: 'Verletzung von Personen oder lebensbedrohliche Situationen.' },
    { id: 'DS2', name: 'Finanzieller Schaden', short: 'Financial', description: 'Direkte oder indirekte finanzielle Verluste (Rückruf, Schadensersatz).' },
    { id: 'DS3', name: 'Verlust von geistigem Eigentum', short: 'IP loss', description: 'Verlust von geistigem Eigentum (Patente, Urheberrechte, etc.).' },
    { id: 'DS4', name: 'Verlust Privatsphäre/Daten', short: 'Privacy', description: 'Verlust sensibler persönlicher oder technischer Daten.' },
    { id: 'DS5', name: 'Rechtliche Konsequenzen', short: 'Legal', description: 'Verstoß gegen Gesetze oder Vorschriften.' }
];

// Corrected scalars (probability) according to methodology document
// Sorting: High risk (high value) -> Low risk (low value)

const PROBABILITY_CRITERIA = {
    'K': { 
        label: 'K (Komplexität)', 
        fullLabel: 'Komplexität (Knowledge / Complexity)',
        options: [
            // High risk (simple attack)
            { value: '0.7', text: '0,7 - Bekannte Schwachstellen (z.B. CVE, Errata)' },
            { value: '0.6', text: '0,6 - Einfache Internetrecherche (z.B. einfache Foren)' },
            { value: '0.3', text: '0,3 - Experten Recherche (z.B. spezifische Foren, Onionnet)' },
            { value: '0.1', text: '0,1 - Expertenwissen' }
            // Low risk (difficult attack)
        ]
    },
    'S': { 
        label: 'S (Skalierung)',
        fullLabel: 'Skalierung (Scaling)',
        options: [
            // High risk (broad impact)
            { value: '0.5', text: '0,5 - Produktportfolio (z.B. BKE)' },
            { value: '0.3', text: '0,3 - Produktfamilie (z.B. EGU / EGK)' },
            { value: '0.1', text: '0,1 - Einzelprodukt (z.B. einzelner Greifer)' }
        ]
    },
    'T': { 
        label: 'T (Zeit)',
        fullLabel: 'Zeit / Aufwand (Time)',
        options: [
            // High risk (low time investment)
            { value: '0.5', text: '0,5 - < 1 Woche' },
            { value: '0.4', text: '0,4 - < 4 Wochen' },
            { value: '0.2', text: '0,2 - < 3 Monate' },
            { value: '0,1', text: '0,1 - > 3 Monate' } // Note: JS code uses '.' for decimal numbers in calculations, display ',' is fine in text
        ].map(o => ({...o, value: o.value.replace(',', '.')})) // Ensure values use dots
    },
    'U': { 
        label: 'U (Nutzen)',
        fullLabel: 'Sichtbarer Nutzen für Angreifer (Utility)',
        options: [
            // High risk (high utility)
            { value: '0.5', text: '0,5 - Groß' },
            { value: '0.3', text: '0,3 - Mittel' },
            { value: '0.1', text: '0,1 - Klein' }
        ]
    }
};

let analysisData = []; 
let activeAnalysisId = null;

const defaultAnalysis = {
    id: 'tara-001',
    name: 'Neue Analyse',
    description: '',
    intendedUse: '',
    metadata: {
        version: INITIAL_VERSION,
        author: 'Unbekannt',
        date: todayISO
    },
    history: [
        {
            version: INITIAL_VERSION,
            date: todayISO,
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