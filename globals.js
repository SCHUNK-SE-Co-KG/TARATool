// =============================================================
// --- GLOBALE VARIABLEN UND KONSTANTEN ---
// =============================================================
const INITIAL_VERSION = '0.1'; 
const todayISO = new Date().toISOString().substring(0, 10);

// Standard-Schadensszenarien
const DEFAULT_DAMAGE_SCENARIOS = [
    { id: 'DS1', name: 'Gefahr für Leib und Leben', short: 'Fusi', description: 'Gefahr für körperliche Unversehrtheit oder Leben' },
    { id: 'DS2', name: 'Finanzieller Schaden / Sachschaden', short: 'Finanz', description: 'Unmittelbare finanzielle Verluste oder Kosten für Sachschäden' },
    { id: 'DS3', name: 'Verlust von geistigem Eigentum', short: 'IP Loss', description: 'Diebstahl oder Offenlegung von proprietärem Wissen (Intellectual Property)' },
    { id: 'DS4', name: 'Verlust an Reputation', short: 'Reputation', description: 'Schaden am öffentlichen Ansehen und Vertrauen' },
    { id: 'DS5', name: 'Verminderte Verfügbarkeit', short: 'Ausfall', description: 'Ausfallzeiten oder unzureichende Leistung von Systemen/Diensten' }
];

// NEU: Kriterien und Skalarwerte für die Eintrittswahrscheinlichkeit (P)
const PROBABILITY_CRITERIA = {
    'K': { // Komplexität (Complexity)
        label: 'Komplexität (K)',
        options: [
            { value: '0.5', text: 'Niedrig: Umfassende Kenntnisse / Spezialwerkzeuge' },
            { value: '1.0', text: 'Mittel: Gute Kenntnisse / Spezifische Tools' },
            { value: '2.0', text: 'Hoch: Einfache Recherche / Leicht verfügbare Tools' },
            { value: '3.0', text: 'Kritisch: Bekannte Schwachstelle / Keine besonderen Kenntnisse' }
        ]
    },
    'Z': { // Zugang (Access)
        label: 'Zugang (Z)',
        options: [
            { value: '0.5', text: 'Niedrig: Physischer/hochprivilegierter Zugang' },
            { value: '1.0', text: 'Mittel: Netzwerkzugang / Normaler Benutzer-Account' },
            { value: '2.0', text: 'Hoch: Kein spezifischer Zugang / Öffentliche Schnittstelle' },
            { value: '3.0', text: 'Kritisch: Kein Zugang nötig (z.B. DoS über API)' }
        ]
    },
    'E': { // Erkennung (Detection)
        label: 'Erkennung (E)',
        options: [
            { value: '0.5', text: 'Niedrig: Fast sicher erkannt / Sofortige Reaktion' },
            { value: '1.0', text: 'Mittel: Wahrscheinlich erkannt / Nicht sofort' },
            { value: '2.0', text: 'Hoch: Möglicherweise nicht erkannt / Verzögert' },
            { value: '3.0', text: 'Kritisch: Höchstwahrscheinlich nicht erkannt' }
        ]
    }
};

// --- DOM ELEMENTE & INITIALISIERUNG ---
// Main UI Elements
const analysisSelector = document.getElementById('analysisSelector'); 
const analysisNameDisplay = document.getElementById('analysisNameDisplay');
const analysisMetadata = document.getElementById('analysisMetadata');
const statusBarMessage = document.getElementById('statusBarMessage');

// Tab specific elements
const assetsCardContainer = document.getElementById('assetsCardContainer');
const dsManagementContainer = document.getElementById('dsManagementContainer');
const impactMatrixContainer = document.getElementById('impactMatrixContainer');
const riskAnalysisContainer = document.getElementById('riskAnalysisContainer');
const riskEntryList = document.getElementById('riskEntryList'); // Element in Risk Analysis Tab

// Modals & Forms
const assetModal = document.getElementById('assetModal');
const assetModalTitle = document.getElementById('assetModalTitle');
const closeAssetModal = document.getElementById('closeAssetModal');
const assetForm = document.getElementById('assetForm');
const btnAddAsset = document.getElementById('btnAddAsset');

var dsModal = document.getElementById('dsModal') || document.getElementById('damageScenarioModal');
var closeDsModal = document.getElementById('closeDsModal') || document.getElementById('closeDamageScenarioModal');
var dsForm = document.getElementById('dsForm') || document.getElementById('damageScenarioForm');
// Aliase für neuere ID-Namen (Kompatibilität)
var damageScenarioModal = dsModal;
var closeDamageScenarioModal = closeDsModal;
var damageScenarioForm = dsForm;

const dsModalTitle = document.getElementById('dsModalTitle');
const btnAddDamageScenario = document.getElementById('btnAddDamageScenario');

const riskEntryModal = document.getElementById('riskEntryModal'); // Modal für Risikoeinträge
const closeRiskEntryModal = document.getElementById('closeRiskEntryModal');
const riskEntryForm = document.getElementById('riskEntryForm');
const riskEntryModalTitle = document.getElementById('riskEntryModalTitle');
const btnAddRiskEntry = document.getElementById('btnAddRiskEntry');


// Analyse Metadaten Input Felder
const inputAnalysisName = document.getElementById('inputAnalysisName');
const inputDescription = document.getElementById('inputDescription');
const inputIntendedUse = document.getElementById('inputIntendedUse');
const inputAuthorName = document.getElementById('inputAuthorName');


// Versionskontrolle
const versionControlModal = document.getElementById('versionControlModal');
const closeVersionControlModal = document.getElementById('closeVersionControlModal');
const historyTableBody = document.getElementById('historyTableBody');
const versionCommentModal = document.getElementById('versionCommentModal');
const closeVersionCommentModal = document.getElementById('closeVersionCommentModal');
const versionCommentForm = document.getElementById('versionCommentForm');
const inputVersionComment = document.getElementById('inputVersionComment');


// Import/Export
const importAnalysisModal = document.getElementById('importAnalysisModal');
const closeImportModal = document.getElementById('closeImportModal');
const importFile = document.getElementById('importFile');
const importForm = document.getElementById('importForm');

// Globale Zustandsvariablen
var analysisData = [];
var activeAnalysisId = null;

// Standardstruktur für eine neue Analyse
const defaultAnalysis = {
    id: 'tara-001',
    name: 'TARA-Analyse Produkt A (Standard)',
    metadata: {
        version: INITIAL_VERSION,
        author: 'Max Mustermann',
        date: todayISO,
    },
    description: 'Dies ist die Standardbeschreibung für eine Beispielanalyse.',
    intendedUse: 'Der vorgesehene Einsatzzweck.',
    assets: [
        { 
             id: 'A01', 
             name: 'Steuereinheit', 
             type: 'Hardware', 
             description: 'Steuert die Hauptfunktion des Produkts.', 
             confidentiality: 'I', 
             integrity: 'II',
             authenticity: 'III',
             schutzbedarf: 'III' 
         }
    ],
    damageScenarios: JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)),
    impactMatrix: {}, 
    // NEU: Initialisierung der Felder für K, Z, E in RiskEntry
    riskEntries: [ 
        {
            id: 'R01', 
            name: 'Beispiel-Angriffspfad', 
            targetAssetId: 'A01',
            damageScenarioId: 'DS2',
            attackDescription: 'Physischer Zugriff zur Manipulation von Daten im Speicher.',
            complexity_K: '1.0', // Mittel
            access_Z: '0.5',    // Niedrig
            detection_E: '1.0',    // Mittel
            probability_P: 1.0, // max(1.0, 0.5, 1.0)
            riskScore: null,
            riskClass: null
        }
    ], 
    
    history: [
        {
            version: INITIAL_VERSION, 
            author: 'Max Mustermann',
            date: todayISO,
            comment: 'Erstanlage der Analyse.',
            state: {
                name: 'TARA-Analyse Produkt A (Standard)',
                metadata: { author: 'Max Mustermann', date: todayISO, version: INITIAL_VERSION },
                description: 'Dies ist die Standardbeschreibung für eine Beispielanalyse.',
                intendedUse: 'Der vorgesehene Einsatzzweck.',
                assets: [{ 
                    id: 'A01', 
                    name: 'Steuereinheit', 
                    type: 'Hardware', 
                    description: 'Steuert die Hauptfunktion des Produkts.', 
                    confidentiality: 'I', 
                    integrity: 'II',
                    authenticity: 'III',
                    schutzbedarf: 'III'
                }],
                damageScenarios: JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)),
                impactMatrix: {},
                riskEntries: []
            }
        }
    ]
};

// =============================================================
// --- ROBUSTE ALIAS-DEFINITIONEN (verhindert ReferenceErrors) ---
// =============================================================
var btnSave = document.getElementById('btnSave');
var btnShowVersionControl = document.getElementById('btnShowVersionControl');
var btnImportAnalysis = document.getElementById('btnImportAnalysis');
var btnExportAnalysis = document.getElementById('btnExportAnalysis');
var btnNewAnalysis = document.getElementById('btnNewAnalysis');
var newAnalysisModal = document.getElementById('newAnalysisModal');
var closeNewAnalysisModal = document.getElementById('closeNewAnalysisModal');
var newAnalysisForm = document.getElementById('newAnalysisForm');
var attackTreeModal = document.getElementById('attackTreeModal');
var closeAttackTreeModal = document.getElementById('closeAttackTreeModal');
var attackTreeForm = document.getElementById('attackTreeForm');
var atTargetAsset = document.getElementById('atTargetAsset');
var closeImportAnalysisModal = document.getElementById('closeImportAnalysisModal');
var importFileInput = document.getElementById('importFileInput');
