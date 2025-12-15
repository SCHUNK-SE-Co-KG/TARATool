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

// --- DOM ELEMENTE & INITIALISIERUNG ---
// Main UI Elements
const analysisSelector = document.getElementById('analysisSelector'); 
const analysisNameDisplay = document.getElementById('analysisNameDisplay');
const analysisMetadata = document.getElementById('analysisMetadata');
const statusBarMessage = document.getElementById('statusBarMessage');

// General Tab Elements
const inputAnalysisName = document.getElementById('inputAnalysisName');
const inputAuthorName = document.getElementById('inputAuthorName'); 
const inputDescription = document.getElementById('inputDescription');
const inputIntendedUse = document.getElementById('inputIntendedUse');
const btnSave = document.getElementById('btnSave');

// Export Button
const btnExportAnalysis = document.getElementById('btnExportAnalysis');

// Asset Tab Elements
const assetsCardContainer = document.getElementById('assetsCardContainer'); 
const btnAddAsset = document.getElementById('btnAddAsset');
const assetModal = document.getElementById('assetModal');
const closeAssetModal = document.getElementById('closeAssetModal');
const assetForm = document.getElementById('assetForm');
const assetModalTitle = document.getElementById('assetModalTitle');

// Damage Scenarios Elements
const dsManagementContainer = document.getElementById('dsManagementContainer');
const dsMatrixContainer = document.getElementById('dsMatrixContainer');
const btnAddDamageScenario = document.getElementById('btnAddDamageScenario');
const damageScenarioModal = document.getElementById('damageScenarioModal');
const closeDamageScenarioModal = document.getElementById('closeDamageScenarioModal');
const damageScenarioForm = document.getElementById('damageScenarioForm');
const dsModalTitle = document.getElementById('dsModalTitle'); 
const dsIdField = document.getElementById('dsIdField'); 

// Risk Analysis Elements
const riskAnalysisContainer = document.getElementById('riskAnalysisContainer');
// NEU: Elemente für Angriffsbaum
const attackTreeModal = document.getElementById('attackTreeModal');
const closeAttackTreeModal = document.getElementById('closeAttackTreeModal');
const attackTreeForm = document.getElementById('attackTreeForm');
const atTargetAsset = document.getElementById('atTargetAsset');

// Version Control Modal
const versionControlModal = document.getElementById('versionControlModal');
const closeVersionControlModal = document.getElementById('closeVersionControlModal');
const historyTableBody = document.getElementById('historyTableBody');
const btnCreateNewVersion = document.getElementById('btnCreateNewVersion');
const btnShowVersionControl = document.getElementById('btnShowVersionControl');

// Version Comment Modal
const versionCommentModal = document.getElementById('versionCommentModal');
const closeVersionCommentModal = document.getElementById('closeVersionCommentModal');
const versionCommentForm = document.getElementById('versionCommentForm');
const inputVersionComment = document.getElementById('inputVersionComment');

// New Analysis Modal
const newAnalysisModal = document.getElementById('newAnalysisModal');
const closeNewAnalysisModal = document.getElementById('closeNewAnalysisModal');
const newAnalysisForm = document.getElementById('newAnalysisForm');
const newAnalysisName = document.getElementById('newAnalysisName'); 

// Import Modal
const importAnalysisModal = document.getElementById('importAnalysisModal');
const closeImportAnalysisModal = document.getElementById('closeImportAnalysisModal');
const importForm = document.getElementById('importForm');
const importFileInput = document.getElementById('importFileInput');
const btnImportStart = document.querySelector('#importForm button[type="submit"]');

// Bestätigungs-Modal
const confirmationModal = document.getElementById('confirmationModal');
const closeConfirmationModal = document.getElementById('closeConfirmationModal');
const confirmationTitle = document.getElementById('confirmationTitle');
const confirmationMessage = document.getElementById('confirmationMessage');
const btnConfirmAction = document.getElementById('btnConfirmAction');
const btnCancelConfirmation = document.getElementById('btnCancelConfirmation');


// --- ANWENDUNGSZUSTAND ---
let activeAnalysisId = null;
let analysisData = []; 

// Standarddaten für eine neue Analyse
const defaultAnalysis = {
    id: 'tara-001',
    name: 'TARA-Analyse Produkt A',
    metadata: {
        author: 'Max Mustermann',
        date: todayISO,
        version: INITIAL_VERSION 
    },
    description: 'Dies ist die Standardbeschreibung.',
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
    riskEntries: [], 
    
    history: [
        {
            version: INITIAL_VERSION, 
            author: 'Max Mustermann',
            date: todayISO,
            comment: 'Erstanlage der Analyse.',
            state: {
                name: 'TARA-Analyse Produkt A',
                metadata: { author: 'Max Mustermann', date: todayISO, version: INITIAL_VERSION },
                description: 'Dies ist die Standardbeschreibung.',
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