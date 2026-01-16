// =============================================================
// --- GLOBALES.JS: KONFIGURATION & DATENSTRUKTUR ---
// =============================================================

const INITIAL_VERSION = '0.1'; 
const todayISO = new Date().toISOString().substring(0, 10);

// Standard-Schadensszenarien
const DEFAULT_DAMAGE_SCENARIOS = [
    { id: 'DS1', name: 'Gefahr für Leib und Leben', short: 'Safety', description: 'Verletzung von Personen oder lebensbedrohliche Situationen.' },
    { id: 'DS2', name: 'Finanzieller Schaden', short: 'Financial', description: 'Direkte oder indirekte finanzielle Verluste (Rückruf, Schadensersatz).' },
    { id: 'DS3', name: 'Verlust von geistigem Eigentum', short: 'IP loss', description: 'Verlust von geistigem Eigentum (Patente, Urheberrechte, etc.).' },
    { id: 'DS4', name: 'Verlust Privatsphäre/Daten', short: 'Privacy', description: 'Verlust sensibler persönlicher oder technischer Daten.' },
    { id: 'DS5', name: 'Rechtliche Konsequenzen', short: 'Legal', description: 'Verstoß gegen Gesetze oder Vorschriften.' }
];

// KORRIGIERTE SKALARE (Wahrscheinlichkeit) gemäß Methodendatei
// Sortierung: Hohes Risiko (hoher Wert) -> Niedriges Risiko (niedriger Wert)

const PROBABILITY_CRITERIA = {
    'K': { 
        label: 'K (Komplexität)', 
        fullLabel: 'Komplexität (Knowledge / Complexity)',
        options: [
            // Hohes Risiko (einfacher Angriff)
            { value: '0.7', text: '0,7 - Bekannte Schwachstellen (z.B. CVE, Errata)' },
            { value: '0.6', text: '0,6 - Einfache Internetrecherche (z.B. einfache Foren)' },
            { value: '0.3', text: '0,3 - Experten Recherche (z.B. spezifische Foren, Onionnet)' },
            { value: '0.1', text: '0,1 - Expertenwissen' }
            // Niedriges Risiko (schwerer Angriff)
        ]
    },
    'S': { 
        label: 'S (Skalierung)',
        fullLabel: 'Skalierung (Scaling)',
        options: [
            // Hohes Risiko (Breite Auswirkung)
            { value: '0.5', text: '0,5 - Produktportfolio (z.B. BKE)' },
            { value: '0.3', text: '0,3 - Produktfamilie (z.B. EGU / EGK)' },
            { value: '0.1', text: '0,1 - Einzelprodukt (z.B. einzelner Greifer)' }
        ]
    },
    'T': { 
        label: 'T (Zeit)',
        fullLabel: 'Zeit / Aufwand (Time)',
        options: [
            // Hohes Risiko (Wenig Zeitaufwand)
            { value: '0.5', text: '0,5 - < 1 Woche' },
            { value: '0.4', text: '0,4 - < 4 Wochen' },
            { value: '0.2', text: '0,2 - < 3 Monate' },
            { value: '0,1', text: '0,1 - > 3 Monate' } // Achtung: im JS Code nutzen wir '.' für Dezimalzahlen in Berechnungen, Anzeige ',' ist okay im Text
        ].map(o => ({...o, value: o.value.replace(',', '.')})) // Sicherstellen, dass values Punkte nutzen
    },
    'U': { 
        label: 'U (Nutzen)',
        fullLabel: 'Sichtbarer Nutzen für Angreifer (Utility)',
        options: [
            // Hohes Risiko (Hoher Nutzen)
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
    riskEntries: []
};