// =============================================================
// --- GLOBALE VARIABLEN UND KONSTANTEN ---
// =============================================================
const INITIAL_VERSION = '0.1'; 
const todayISO = new Date().toISOString().substring(0, 10);

// NEU: Standard-Schadensszenarien
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

// NEU: Damage Scenarios Elements
const dsManagementContainer = document.getElementById('dsManagementContainer');
const dsMatrixContainer = document.getElementById('dsMatrixContainer');
const btnAddDamageScenario = document.getElementById('btnAddDamageScenario');
const damageScenarioModal = document.getElementById('damageScenarioModal');
const closeDamageScenarioModal = document.getElementById('closeDamageScenarioModal');
const damageScenarioForm = document.getElementById('damageScenarioForm');
const dsModalTitle = document.getElementById('dsModalTitle'); 
const dsIdField = document.getElementById('dsIdField'); 

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

// Import Modal
const importAnalysisModal = document.getElementById('importAnalysisModal');
const closeImportAnalysisModal = document.getElementById('closeImportAnalysisModal');
// Import Formular-Elemente
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
             id: 'a-001', 
             name: 'Steuereinheit', 
             type: 'Hardware', 
             description: 'Steuert die Hauptfunktion des Produkts.', 
             confidentiality: 'I', 
             integrity: 'II',
             authenticity: 'III',
             schutzbedarf: 'III' 
         }
    ],
    // NEU: Damage Scenarios und Impact Matrix
    damageScenarios: JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)),
    impactMatrix: {}, // Key: assetId, Value: { dsId: score (1-3) }
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
                    id: 'a-001', 
                    name: 'Steuereinheit', 
                    type: 'Hardware', 
                    description: 'Steuert die Hauptfunktion des Produkts.', 
                    confidentiality: 'I', 
                    integrity: 'II',
                    authenticity: 'III',
                    schutzbedarf: 'III'
                }],
                // NEU: Damage Scenarios und Impact Matrix im State
                damageScenarios: JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)),
                impactMatrix: {},
                riskEntries: []
            }
        }
    ]
};

// =============================================================
// --- SPEICHER & LADEFUNKTIONEN ---
// =============================================================

function saveAnalyses() {
    try {
        localStorage.setItem('taraAnalyses', JSON.stringify(analysisData));
    } catch (e) {
        showToast('FEHLER: Speichern im Browser-Speicher fehlgeschlagen.', 'error');
        console.error('Speicherfehler:', e);
    }
}

function loadAnalyses() {
    const data = localStorage.getItem('taraAnalyses');
    if (data) {
        analysisData = JSON.parse(data);
        
        // Sicherstellen, dass neue Felder (damageScenarios, impactMatrix) existieren
        analysisData.forEach(analysis => {
            if (!analysis.damageScenarios) {
                analysis.damageScenarios = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
            }
            if (!analysis.impactMatrix) {
                analysis.impactMatrix = {};
            }
        });

    } else {
        analysisData = [defaultAnalysis];
    }
}

function saveCurrentAnalysisState() {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    analysis.name = inputAnalysisName.value.trim();
    analysis.description = inputDescription.value.trim();
    analysis.intendedUse = inputIntendedUse.value.trim();
    analysis.metadata.author = inputAuthorName.value.trim(); 
}


// =============================================================
// --- EXPORT FUNKTION ---
// =============================================================

function handleExport() {
    // 1. Speichere den aktuellen Zustand der aktiven Analyse
    saveCurrentAnalysisState();
    
    // 2. Datenquelle ist nun der GESAMTE Array.
    const dataToExport = analysisData; 
    
    if (dataToExport.length === 0) {
        showToast('Keine Analysen zum Exportieren vorhanden.', 'info');
        return;
    }

    const filename = `TARA_Alle_Analysen_Backup_${todayISO}.json`;
    const dataStr = JSON.stringify(dataToExport, null, 2);
    
    const tempLink = document.createElement('a');
    tempLink.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(dataStr);
    tempLink.download = filename;
    
    tempLink.click();
    
    showToast(`Alle ${dataToExport.length} Analysen in "${filename}" exportiert.`, 'success');
}

// =============================================================
// --- IMPORT FUNKTIONEN ---
// =============================================================

function handleImportWarningConfirmed() {
    // Setzt das Feld zurück
    if (importForm) importForm.reset();
    
    // 1. Das Haupt-Import-Modal öffnen
    importAnalysisModal.style.display = 'block';
    
    // 2. Das Formular aktivieren
    if (importFileInput) importFileInput.disabled = false;
    if (btnImportStart) btnImportStart.disabled = false;

    // 3. Listener für den eigentlichen Import hinzufügen
    if (importForm) {
        importForm.onsubmit = handleImportFile;
    }
}

// KRITISCHE KORREKTUR: Syntaxfehler im try...catch Block behoben.
function handleImportFile(e) {
    e.preventDefault();
    
    const file = importFileInput.files[0];
    if (!file) {
        showToast('Bitte wählen Sie eine Datei aus.', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // Plausibilitätsprüfung
            if (Array.isArray(importedData) && importedData.every(item => item.id && item.name)) {
                // Daten ersetzen und speichern
                analysisData = importedData;
                saveAnalyses();
                
                // UI neu laden
                const firstId = analysisData.length > 0 ? analysisData[0].id : null;
                if (firstId) {
                    activateAnalysis(firstId);
                } else {
                    loadAnalyses(); 
                }
                
                // Modal schließen und Erfolgsmeldung
                importAnalysisModal.style.display = 'none';
                showToast(`Erfolgreich ${analysisData.length} Analysen importiert.`, 'success');
            }
        } catch (error) { // <-- Fehlerbehebung: catch muss direkt dem try folgen, nicht im if-Block verschachtelt sein.
            console.error('Importfehler:', error);
            showToast('Importfehler: Ungültiges JSON-Format in der Datei.', 'error');
        }
    };
    reader.onerror = () => {
        showToast('Fehler beim Lesen der Datei.', 'error');
    };

    reader.readAsText(file);
}


// =============================================================
// --- UI UPDATES & ALLGEMEINE FUNKTIONEN ---
// =============================================================

// Aktualisiert den Dropdown-Selektor
function renderAnalysisSelector() {
    if (!analysisSelector) return;
    analysisSelector.innerHTML = '';
    
    if (analysisData.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Keine Analysen vorhanden';
        option.value = '';
        analysisSelector.appendChild(option);
        return;
    }

    analysisData.forEach(analysis => {
        const option = document.createElement('option');
        option.textContent = analysis.name;
        option.value = analysis.id;

        if (analysis.id === activeAnalysisId) {
            option.selected = true;
        }
        analysisSelector.appendChild(option);
    });
}

// Befüllt die Formularfelder mit den Daten der aktiven Analyse
function fillAnalysisForm(analysis) {
    analysisNameDisplay.textContent = analysis.name;
    
    inputAnalysisName.value = analysis.name;
    inputDescription.value = analysis.description;
    inputIntendedUse.value = analysis.intendedUse;
    inputAuthorName.value = analysis.metadata.author; 
    
    // Metadaten im Header aktualisieren
    analysisMetadata.innerHTML = `
        <span>Version: ${analysis.metadata.version}</span> | 
        <span>Autor: ${analysis.metadata.author}</span> | 
        <span>Datum: ${analysis.metadata.date}</span>
    `;

    // Felder aktivieren/deaktivieren
    const disable = !analysis || !activeAnalysisId;
    document.querySelectorAll('.main-content input, .main-content textarea, .main-content select, #btnSave, #btnShowVersionControl').forEach(el => {
        el.disabled = disable;
    });
    // Export Button aktivieren
    if (btnExportAnalysis) {
        btnExportAnalysis.disabled = disable;
    }
}

// Wechselt zur aktiven Analyse
function activateAnalysis(id) {
    if (activeAnalysisId) {
        saveCurrentAnalysisState();
    }
    
    activeAnalysisId = id;
    const analysis = analysisData.find(a => a.id === id);

    if (analysis) {
        fillAnalysisForm(analysis);
        renderAnalysisSelector(); 
        saveAnalyses();
        statusBarMessage.textContent = `Analyse "${analysis.name}" geladen.`;
        showToast(`Analyse "${analysis.name}" geladen.`, 'info');
        
        const firstTabButton = document.querySelector('.tab-navigation .tab-button');
        if(firstTabButton) firstTabButton.click();
    } else {
        activeAnalysisId = null;
        fillAnalysisForm(defaultAnalysis); 
        renderAnalysisSelector();
        statusBarMessage.textContent = 'Bereit.';
    }
}

// Statusmeldung anzeigen
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        const parent = toast.parentElement; 
        if (parent && parent.contains(toast)) {
             setTimeout(() => {
                 try {
                     parent.removeChild(toast);
                 } catch (e) {
                     // console.warn('Toast removeChild abgefangen:', e);
                 }
             }, 500);
        }
    }, 4000);
}


// =============================================================
// --- ASSET LOGIK (CRUD) ---
// =============================================================

// Rendert die Asset-Tabelle (JETZT ALS KARTEN)
function renderAssets(analysis) {
    if (!assetsCardContainer) return; // Verwende den neuen Container
    assetsCardContainer.innerHTML = '';

    if (!analysis.assets || analysis.assets.length === 0) {
        assetsCardContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 40px;">Noch keine Assets erfasst.</p>';
        return;
    }

    analysis.assets.forEach(asset => {
        const card = document.createElement('div');
        card.classList.add('asset-card');
        card.dataset.id = asset.id;
        
        // Anzeige des höchsten Schutzziel-Scores im Header (zum schnellen Überblick)
        const highestCIA = asset.schutzbedarf;

        // Logik: Name oben, Beschreibung, Typ und CIA-Werte im Body, Gesamtschutzbedarf und Buttons im Footer
        card.innerHTML = `
            <div class="asset-card-header">
                ${asset.name} 
            </div>
            <div class="asset-card-body">
                <p class="type">Typ: ${asset.type}</p>
                <p style="margin-top: 10px; font-weight: 600;">Beschreibung:</p>
                <p>${asset.description || '— Keine Beschreibung erfasst —'}</p>
                
                <hr style="border: 0; border-top: 1px dashed #eee; margin: 10px 0;">

                <p style="font-weight: 600;">CIA-Anforderungen:</p>
                <ul style="list-style: none; padding: 0; margin: 5px 0 0 0;">
                    <li><strong title="Confidentiality">C (Confidentiality):</strong> ${asset.confidentiality}</li>
                    <li><strong title="Integrity">I (Integrity):</strong> ${asset.integrity}</li>
                    <li><strong title="Authenticity">A (Availability):</strong> ${asset.authenticity}</li> 
                </ul>
            </div>
            <div class="asset-card-footer">
                <span class="protection-level" title="Höchster Wert von C, I, A">Gesamtschutzbedarf: ${highestCIA}</span>
                <div class="asset-card-actions">
                    <button onclick="window.editAsset('${asset.id}')" class="action-button small">Bearbeiten</button>
                    <button onclick="window.deleteAsset('${asset.id}')" class="action-button small dangerous">Löschen</button>
                </div>
            </div>
        `;
        assetsCardContainer.appendChild(card);
    });
}

// --- MODAL & FORMULAR LOGIK ---
if (btnAddAsset) {
    btnAddAsset.onclick = () => {
        if (!activeAnalysisId) {
            showToast('Bitte wählen Sie zuerst eine aktive Analyse aus.', 'info');
            return;
        }
        if (assetForm) assetForm.reset();
        document.getElementById('assetIdField').value = '';
        assetModalTitle.textContent = 'Neues Asset erfassen';
        
        // Setze Standardwerte für CIA (WICHTIG: Ersten Radio-Button 'I' vorselektieren)
        // Verwende querySelector, um die Radio-Buttons zu selektieren
        document.querySelector('input[name="confidentiality"][value="I"]').checked = true;
        document.querySelector('input[name="integrity"][value="I"]').checked = true;
        document.querySelector('input[name="authenticity"][value="I"]').checked = true;
        
        if (assetModal) assetModal.style.display = 'block';
    };
}

if (closeAssetModal) {
    closeAssetModal.onclick = () => { if (assetModal) assetModal.style.display = 'none'; };
}

if (assetForm) {
    assetForm.onsubmit = (e) => {
        e.preventDefault();
        saveAsset();
    };
}

// --- SPEICHERN ---
function saveAsset() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const idField = document.getElementById('assetIdField');
    const assetId = idField ? idField.value : '';

    // NEUE WERTE auslesen (Ausgewählter Radio-Button)
    // Überprüfe, ob Radio-Buttons ausgewählt sind, bevor .value aufgerufen wird
    const cEl = document.querySelector('input[name="confidentiality"]:checked');
    const iEl = document.querySelector('input[name="integrity"]:checked');
    const aEl = document.querySelector('input[name="authenticity"]:checked');

    if (!cEl || !iEl || !aEl) {
        showToast('Fehler: Bitte wählen Sie einen Schutzbedarf für alle drei CIA-Ziele aus.', 'error');
        return;
    }
    
    const cVal = cEl.value;
    const iVal = iEl.value;
    const aVal = aEl.value;
    
    // Gesamtschutzbedarf als Maximum der CIA-Werte berechnen
    const scoreMap = { 'I': 1, 'II': 2, 'III': 3 };
    const maxScore = Math.max(scoreMap[cVal], scoreMap[iVal], scoreMap[aVal]);
    const overallSchutzbedarf = Object.keys(scoreMap).find(key => scoreMap[key] === maxScore);

    const newAssetData = {
        name: document.getElementById('assetName').value.trim(),
        type: document.getElementById('assetType').value.trim(),
        description: document.getElementById('assetDescription').value.trim(), 
        confidentiality: cVal, 
        integrity: iVal, 
        authenticity: aVal, 
        schutzbedarf: overallSchutzbedarf 
    };

    if (assetId) {
        // Bearbeiten
        const index = analysis.assets.findIndex(a => a.id === assetId);
        if (index !== -1) {
            analysis.assets[index] = { ...newAssetData, id: assetId };
            showToast('Asset aktualisiert.', 'success');
        }
    } else {
        // Neu erstellen
        const newAssetIndex = analysis.assets.length > 0 ? 
            Math.max(...analysis.assets.map(a => parseInt(a.id.split('-')[1])).filter(n => !isNaN(n))) + 1 : 1;
        const newId = 'a-' + newAssetIndex.toString().padStart(3, '0');
        
        analysis.assets.push({ ...newAssetData, id: newId });
        showToast('Neues Asset hinzugefügt.', 'success');
    }

    if (assetModal) assetModal.style.display = 'none';
    saveCurrentAnalysisState();
    saveAnalyses();
    renderAssets(analysis);
    
    // NEU: Impact Matrix aktualisieren, falls der Tab aktiv ist (um neue Assets sofort zu sehen)
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab && activeTab.dataset.tab === 'tabDamageScenarios') {
        renderImpactMatrix();
    }
}

// --- BEARBEITEN (Globale Funktion) ---
window.editAsset = (assetId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const asset = analysis.assets.find(a => a.id === assetId);
    if (!asset) return;

    document.getElementById('assetIdField').value = asset.id;
    assetModalTitle.textContent = 'Asset bearbeiten';
    
    // Allgemeine Details
    document.getElementById('assetName').value = asset.name;
    document.getElementById('assetType').value = asset.type;
    document.getElementById('assetDescription').value = asset.description || ''; 

    // CIA-Werte laden (Auswahl der Radio-Buttons)
    // C
    const cRadio = document.querySelector(`input[name="confidentiality"][value="${asset.confidentiality}"]`);
    if(cRadio) cRadio.checked = true;
    // I
    const iRadio = document.querySelector(`input[name="integrity"][value="${asset.integrity}"]`);
    if(iRadio) iRadio.checked = true;
    // A
    const aRadio = document.querySelector(`input[name="authenticity"][value="${asset.authenticity}"]`);
    if(aRadio) aRadio.checked = true;

    if (assetModal) assetModal.style.display = 'block';
};

// --- LÖSCHEN (Globale Funktion) ---
// **KORRIGIERT: Ersetzt confirm() durch custom confirmationModal**
window.deleteAsset = (assetId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const asset = analysis.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    // 1. Konfigurieren des Modals
    confirmationTitle.textContent = 'Asset löschen bestätigen';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie das Asset <b>${asset.name} (${assetId})</b> löschen möchten? Alle zugehörigen Impact-Bewertungen gehen verloren.`;
    
    btnConfirmAction.textContent = 'Ja, Asset löschen';
    btnConfirmAction.classList.add('dangerous'); 
    
    // 2. Das Modal anzeigen
    confirmationModal.style.display = 'block';

    // 3. WICHTIG: Alte Event-Listener entfernen
    btnConfirmAction.onclick = null; 
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;
    
    // 4. Bestätigungs-Listener hinzufügen
    btnConfirmAction.onclick = () => {
        // Deletion logic
        analysis.assets = analysis.assets.filter(a => a.id !== assetId);
        
        // NEU: Zugehörige Impact-Scores löschen
        delete analysis.impactMatrix[assetId];

        saveCurrentAnalysisState();
        saveAnalyses();
        renderAssets(analysis);
        renderImpactMatrix(); 
        
        confirmationModal.style.display = 'none'; // Bestätigungs-Modal schließen
        showToast(`Asset ${assetId} gelöscht.`, 'success');
    };
    
    // 5. Abbruch-Listener hinzufügen
    btnCancelConfirmation.onclick = () => {
        confirmationModal.style.display = 'none';
    };
    
    closeConfirmationModal.onclick = () => {
        confirmationModal.style.display = 'none';
    };
};

// =============================================================
// --- DAMAGE SCENARIO LOGIK (CRUD & MATRIX) ---
// =============================================================

// Rendert die Liste der Damage Scenarios
function renderDamageScenarios() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsManagementContainer) return;

    let html = '<h4>Definierte Schadens-Szenarien:</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Verwalten Sie die Damage Scenarios (DS), die zur Bewertung der Assets verwendet werden.</p>';
    
    // NEU: Verwendung eines Flex-Containers zur besseren Kontrolle der Zeilenumbrüche
    html += '<ul class="ds-list">'; 
    
    analysis.damageScenarios.forEach(ds => {
        const isDefault = DEFAULT_DAMAGE_SCENARIOS.some(defaultDs => defaultDs.id === ds.id);
        
        // KORRIGIERT: Flex-Container für die Zeile, um die Beschreibung in eine neue "Zeile" zu zwingen
        html += `<li data-id="${ds.id}">
            <div class="ds-row-header">
                <div class="ds-col-id-name">
                    ${ds.id}: <strong>${ds.name}</strong> 
                    <span style="font-weight: 400; color: #7f8c8d;">(${ds.short})</span>
                    ${isDefault ? `<span class="small" style="color: #2ecc71;">(Standard)</span>` : ''}
                </div>
                <div class="ds-actions">
                    <button onclick="window.editDamageScenario('${ds.id}')" class="action-button small">Bearbeiten</button>
                    <button onclick="window.removeDamageScenario('${ds.id}')" class="action-button small dangerous">Entfernen</button>
                </div>
            </div>
            <div class="ds-col-description">
                ${ds.description}
            </div>
        </li>`;
    });

    html += '</ul>';
    dsManagementContainer.innerHTML = html;
    
    // --- ACHTUNG: CSS muss auch angepasst werden, um die Darstellung zu korrigieren. ---
    // (Da ich keinen Zugriff auf style.css habe, sollte der Nutzer die folgenden Anpassungen vornehmen)
    /* .ds-list li { 
        display: flex; 
        flex-direction: column; 
        border: 1px solid #ddd;
        padding: 10px;
        margin-bottom: 10px;
    }
    .ds-row-header { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-bottom: 5px;
    }
    .ds-col-id-name {
        font-weight: 600;
        flex-grow: 1; 
    }
    .ds-col-description {
        font-size: 0.9em;
        color: #555;
    }
    */
}

// Fügt ein neues Damage Scenario hinzu ODER aktualisiert ein bestehendes
function saveDamageScenario(e) {
    if (e) e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const dsId = document.getElementById('dsIdField').value; // Abruf der ID (wichtig für Edit)
    const name = document.getElementById('dsName').value.trim();
    const short = document.getElementById('dsShort').value.trim();
    const description = document.getElementById('dsDescription').value.trim();

    if (!name || !short) {
        showToast('Name und Kurzbezeichnung sind erforderlich.', 'warning');
        return;
    }
    
    if (dsId) {
        // EDITIEREN
        const index = analysis.damageScenarios.findIndex(ds => ds.id === dsId);
        if (index !== -1) {
            analysis.damageScenarios[index] = { id: dsId, name, short, description };
            showToast(`Schadensszenario ${dsId} aktualisiert.`, 'success');
        }
    } else {
        // NEU ERSTELLEN
        const existingIds = analysis.damageScenarios.map(ds => parseInt(ds.id.replace('DS', ''))).filter(n => !isNaN(n));
        const newIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newId = 'DS' + newIndex;

        analysis.damageScenarios.push({ id: newId, name, short, description });
        showToast(`Schadensszenario ${newId} hinzugefügt.`, 'success');
    }

    saveAnalyses();
    renderDamageScenarios();
    renderImpactMatrix();
    damageScenarioModal.style.display = 'none';
}

// Bearbeitet ein Damage Scenario (Globale Funktion)
window.editDamageScenario = (dsId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const ds = analysis.damageScenarios.find(d => d.id === dsId);
    if (!ds) return;
    
    // KORRIGIERT: Modal-Titel mit ID setzen
    if (dsModalTitle) dsModalTitle.textContent = `Schadensszenario ${ds.id} bearbeiten`;
    if (dsIdField) dsIdField.value = ds.id; 

    // Formularfelder befüllen
    document.getElementById('dsName').value = ds.name;
    document.getElementById('dsShort').value = ds.short;
    document.getElementById('dsDescription').value = ds.description;

    if (damageScenarioModal) damageScenarioModal.style.display = 'block';
};

// Entfernt ein Damage Scenario
// **KORRIGIERT: Ersetzt confirm() durch custom confirmationModal und entfernt die Sperre für Standard-DS**
window.removeDamageScenario = (dsId) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    const ds = analysis.damageScenarios.find(d => d.id === dsId);
    if (!ds) return;
    
    // 1. Konfigurieren des Modals
    confirmationTitle.textContent = 'Schadensszenario löschen bestätigen';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie das Schadensszenario <b>${ds.name} (${dsId})</b> löschen möchten? Alle zugehörigen Impact-Bewertungen gehen verloren.`;
    
    btnConfirmAction.textContent = 'Ja, DS löschen';
    btnConfirmAction.classList.add('dangerous'); 
    
    // 2. Das Modal anzeigen
    confirmationModal.style.display = 'block';

    // 3. WICHTIG: Alte Event-Listener entfernen
    btnConfirmAction.onclick = null; 
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;
    
    // 4. Bestätigungs-Listener hinzufügen
    btnConfirmAction.onclick = () => {
        // Deletion logic
        analysis.damageScenarios = analysis.damageScenarios.filter(d => d.id !== dsId);
        
        // Lösche zugehörige Impact-Scores aus der Matrix
        for (const assetId in analysis.impactMatrix) {
            delete analysis.impactMatrix[assetId][dsId];
        }

        saveAnalyses();
        renderDamageScenarios();
        renderImpactMatrix();
        confirmationModal.style.display = 'none'; // Bestätigungs-Modal schließen
        showToast(`Schadensszenario ${dsId} gelöscht.`, 'success');
    };

    // 5. Abbruch-Listener hinzufügen
    btnCancelConfirmation.onclick = () => { confirmationModal.style.display = 'none'; };
    closeConfirmationModal.onclick = () => { confirmationModal.style.display = 'none'; };
}

// Aktualisiert den Impact Score in der Matrix
window.updateImpactScore = (assetId, dsId, score) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    if (!analysis.impactMatrix[assetId]) {
        analysis.impactMatrix[assetId] = {};
    }
    
    analysis.impactMatrix[assetId][dsId] = score;
    saveAnalyses();
    showToast(`Impact für ${assetId}/${dsId} auf ${score} gesetzt.`, 'info');
}

// Rendert die Impact Matrix Tabelle
function renderImpactMatrix() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsMatrixContainer) return;

    if (analysis.assets.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte legen Sie zuerst Assets im Reiter "Assets" an.</p>';
        return;
    }

    if (analysis.damageScenarios.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte definieren Sie zuerst Schadensszenarien.</p>';
        return;
    }
    
    let html = '<h4>Schadensauswirkungsmatrix (Assets vs. Damage Scenarios)</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Bewerten Sie die Auswirkung (Impact) jedes Schadensszenarios auf jedes Asset (1=Low, 3=High, N/A=Nicht anwendbar).</p>';
    html += '<div style="overflow-x: auto;"><table class="impact-matrix-table">';
    
    // Table Header
    html += '<thead><tr>';
    html += '<th class="asset-col">Asset Name (ID)</th>';
    
    // Vertical DS Headers
    analysis.damageScenarios.forEach(ds => {
        html += `<th class="ds-col" title="${ds.name}: ${ds.description}">
            <div class="vertical-text">${ds.id} (${ds.short})</div>
        </th>`;
    });
    
    html += '</tr></thead>';

    // Table Body (Assets as rows)
    html += '<tbody>';
    analysis.assets.forEach(asset => {
        // Sicherstellen, dass für jedes Asset ein Eintrag in der Impact Matrix existiert
        if (!analysis.impactMatrix[asset.id]) {
            analysis.impactMatrix[asset.id] = {};
        }

        html += '<tr>';
        html += `<td class="asset-col"><strong>${asset.name}</strong> (${asset.id})</td>`;
        
        analysis.damageScenarios.forEach(ds => {
            const currentScore = analysis.impactMatrix[asset.id][ds.id] || 'N/A';
            
            html += '<td class="score-cell">';
            // Beachte: onchange ruft die globale window.updateImpactScore auf
            html += `<select 
                data-asset-id="${asset.id}" 
                data-ds-id="${ds.id}" 
                onchange="window.updateImpactScore('${asset.id}', '${ds.id}', this.value)"
                class="impact-select">
                <option value="N/A" ${currentScore === 'N/A' ? 'selected' : ''}>N/A</option>
                <option value="1" ${currentScore === '1' ? 'selected' : ''}>1 (Low)</option>
                <option value="2" ${currentScore === '2' ? 'selected' : ''}>2 (Medium)</option>
                <option value="3" ${currentScore === '3' ? 'selected' : ''}>3 (High)</option>
            </select>`;
            html += '</td>';
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table></div>'; // Div für horizontalen Scroll bei vielen Spalten
    dsMatrixContainer.innerHTML = html;
}

// =============================================================
// --- VERSIONSKONTROLLE LOGIK ---
// =============================================================

function renderHistoryTable(analysis) {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

    const currentVersion = analysis.metadata.version;
    const history = analysis.history;
    
    // 1. Historie chronologisch sortieren, um Indexierung zu gewährleisten
    history.sort((a, b) => {
        const [aMajor, aMinor] = a.version.split('.').map(Number);
        const [bMajor, bMinor] = b.version.split('.').map(Number);
        if (aMajor !== bMajor) return aMajor - bMajor;
        return aMinor - bMinor;
    });

    const currentVersionIndex = history.findIndex(entry => entry.version === currentVersion);
    
    let tempMinorVersions = []; 
    let finalBaseline = null;
    
    // 2. Iteriere von der Version VOR der aktuellen rückwärts
    for (let i = currentVersionIndex - 1; i >= 0; i--) {
        const entry = history[i];
        
        // Definition Baseline: Version X.0 (z.B. 1.0, 2.0).
        const isX0Baseline = entry.version.endsWith('.0') && entry.version !== INITIAL_VERSION;

        if (isX0Baseline) {
            // Baseline gefunden: Nimm nur die Baseline und breche ab.
            finalBaseline = entry.version;
            tempMinorVersions = []; 
            break; 
        }
        
        // Nur die letzten 3 Minor-Versionen sammeln
        if (tempMinorVersions.length < 3) {
            tempMinorVersions.push(entry.version);
        } else {
            // 3 Minor-Versionen ohne Baseline-Unterbrechung gesammelt. Abbrechen.
            break; 
        }
    }
    
    // 3. Set der wiederherstellbaren Versionen zusammenstellen
    const restorable = new Set();
    
    if (finalBaseline) {
        restorable.add(finalBaseline);
    } else {
        // Füge die gesammelten Minor-Versionen (max. 3) hinzu.
        tempMinorVersions.forEach(v => restorable.add(v));
    }
    
    // Das Set der zu rendernden Versionen
    const versionsToRender = new Set([...restorable, currentVersion]);
    
    // 4. Filtern und Rendern der Tabelle
    history
        .filter(entry => versionsToRender.has(entry.version))
        // Sortieren, damit die aktuelle Version immer oben ist, gefolgt von der Historie (neueste zuerst)
        .sort((a, b) => {
            if (a.version === currentVersion) return -1;
            if (b.version === currentVersion) return 1;
            
            // Absteigend sortieren
            const [aMajor, aMinor] = a.version.split('.').map(Number);
            const [bMajor, bMinor] = b.version.split('.').map(Number);
            if (aMajor !== bMajor) return bMajor - aMajor;
            return bMinor - aMinor;
        })
        .forEach(entry => {
            const row = document.createElement('tr');
            const isCurrent = entry.version === currentVersion;
            
            if (isCurrent) {
                row.classList.add('is-current-version');
            }

            const isActiveRollbackButton = !isCurrent && restorable.has(entry.version);
            
            row.innerHTML = `
                <td>${entry.version}</td>
                <td>${entry.author}</td>
                <td>${entry.date}</td>
                <td>${entry.comment}</td>
                <td>
                    <button onclick="window.revertToVersion('${analysis.id}', '${entry.version}')" 
                            class="action-button small" 
                            ${!isActiveRollbackButton ? 'disabled' : ''}>
                        ${isCurrent ? 'Aktuell' : 'Wiederherstellen'}
                    </button>
                </td>
            `;
            historyTableBody.appendChild(row);
        });
}

// Verwendet das Custom-Modal anstelle von confirm()
window.revertToVersion = (analysisId, version) => {
    const analysis = analysisData.find(a => a.id === analysisId);
    if (!analysis) return;

    const entry = analysis.history.find(h => h.version === version);
    if (!entry) return;
    
    // 1. Konfigurieren des Modals
    confirmationTitle.textContent = 'Versionswiederherstellung';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie zur Version <b>${version}</b> (${entry.comment}) zurückkehren möchten? Aktuelle Änderungen werden dabei überschrieben.`;
    
    // Texte für Wiederherstellung setzen
    btnConfirmAction.textContent = 'Ja, wiederherstellen';
    btnConfirmAction.classList.add('dangerous'); 
    
    // 2. Das Modal anzeigen
    confirmationModal.style.display = 'block';

    // 3. WICHTIG: Alte Event-Listener entfernen
    btnConfirmAction.onclick = null; 
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;
    
    // 4. Bestätigungs-Listener hinzufügen
    btnConfirmAction.onclick = () => {
        
        analysis.name = entry.state.name;
        analysis.description = entry.state.description;
        analysis.intendedUse = entry.state.intendedUse;
        analysis.assets = entry.state.assets;
        
        // NEU: Damage Scenarios und Impact Matrix wiederherstellen
        analysis.damageScenarios = entry.state.damageScenarios;
        analysis.impactMatrix = entry.state.impactMatrix;
        
        analysis.riskEntries = entry.state.riskEntries;
        
        analysis.metadata.version = entry.version;
        analysis.metadata.author = entry.state.metadata.author;
        analysis.metadata.date = entry.state.metadata.date;

        fillAnalysisForm(analysis);
        renderHistoryTable(analysis);
        
        // Render aktiven Tab neu
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.dataset.tab === 'tabAssets') {
            renderAssets(analysis);
        } else if (activeTab && activeTab.dataset.tab === 'tabDamageScenarios') {
            renderDamageScenarios();
            renderImpactMatrix();
        }

        saveAnalyses();
        versionControlModal.style.display = 'none';
        confirmationModal.style.display = 'none'; // Bestätigungs-Modal schließen
        
        showToast(`Erfolgreich zur Version ${version} zurückgekehrt.`, 'success');
        statusBarMessage.textContent = `Version ${version} wiederhergestellt.`;
    };
    
    // 5. Abbruch-Listener hinzufügen
    btnCancelConfirmation.onclick = () => {
        confirmationModal.style.display = 'none';
    };
    
    closeConfirmationModal.onclick = () => {
        confirmationModal.style.display = 'none';
    };
};


// Die Hauptfunktion zum Erstellen einer neuen Version (mit Major/Minor Auswahl)
function createNewVersion(comment) {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    saveCurrentAnalysisState();
    saveAnalyses(); 

    if (!comment || comment.trim() === "") {
        showToast('Abgebrochen. Versionskommentar ist notwendig.', 'info');
        return;
    }
    
    const versionTypeElement = document.querySelector('input[name="versionType"]:checked');
    const versionType = versionTypeElement ? versionTypeElement.value : 'minor'; 

    const currentVersion = analysis.metadata.version;
    let [major, minor] = currentVersion.split('.').map(Number);
    let newVersion;
    
    if (versionType === 'major') {
        major++;
        minor = 0; 
        newVersion = `${major}.0`; 
    } else { // 'minor'
        minor++;
        newVersion = `${major}.${minor}`;
    }

    const newEntry = {
        version: newVersion,
        author: analysis.metadata.author, 
        date: todayISO,
        comment: comment.trim(), 
        state: {
            name: analysis.name,
            metadata: { ...analysis.metadata, version: newVersion, date: todayISO },
            description: analysis.description,
            intendedUse: analysis.intendedUse,
            assets: JSON.parse(JSON.stringify(analysis.assets)), 
            // NEU: Damage Scenarios und Impact Matrix
            damageScenarios: JSON.parse(JSON.stringify(analysis.damageScenarios)),
            impactMatrix: JSON.parse(JSON.stringify(analysis.impactMatrix)),
            riskEntries: JSON.parse(JSON.stringify(analysis.riskEntries)) 
        }
    };
    
    analysis.history.push(newEntry);
    
    analysis.metadata.version = newVersion;
    analysis.metadata.date = todayISO;
    
    fillAnalysisForm(analysis);
    renderHistoryTable(analysis);
    saveAnalyses();
    showToast(`Neue Version ${newVersion} erstellt.`, 'success');
    statusBarMessage.textContent = `Neue Version ${newVersion} erstellt.`;

    if (versionControlModal) versionControlModal.style.display = 'none';
}


// =============================================================
// --- EVENT LISTENER & INIT ---
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadAnalyses();
    renderAnalysisSelector(); 

    // Listener für den Analysen-Selektor
    if (analysisSelector) {
        analysisSelector.addEventListener('change', (e) => {
            activateAnalysis(e.target.value);
        });
    }
    
    // Aktiviere die erste Analyse
    if (analysisData.length > 0) {
        const firstId = analysisData[0].id;
        activateAnalysis(firstId); 
    } else {
        fillAnalysisForm(defaultAnalysis);
        statusBarMessage.textContent = 'Bitte starten Sie eine neue Analyse.';
    }
    
    // Change-Listener für Konsistenz (Aktualisierung des Headers)
    document.querySelectorAll('#inputAnalysisName, #inputAuthorName, #inputDescription, #inputIntendedUse').forEach(input => {
        input.addEventListener('change', () => {
            saveCurrentAnalysisState();
            
            if (input.id === 'inputAnalysisName' || input.id === 'inputAuthorName') {
                const analysis = analysisData.find(a => a.id === activeAnalysisId);
                if (analysis) {
                    fillAnalysisForm(analysis); 
                }
            }
        });
    });

    // --- BUTTON LISTENERS ---
    
    if (btnSave) {
        btnSave.onclick = () => {
            saveCurrentAnalysisState();
            saveAnalyses();
            showToast('Änderungen gespeichert.', 'success');
            statusBarMessage.textContent = 'Änderungen gespeichert.';
        };
    }
    
    if (btnExportAnalysis) {
        btnExportAnalysis.onclick = handleExport;
    }
    
    // Import Modal (Aktivierung mit Warnfenster)
    if (document.getElementById('btnImportAnalysis')) {
        document.getElementById('btnImportAnalysis').onclick = () => {
            // 1. Konfiguriere das Bestätigungs-Modal als Warnfenster
            confirmationTitle.textContent = 'Achtung: Datenimport';
            confirmationMessage.innerHTML = 'Durch den Datenimport werden die Daten im Browser überschrieben.<br>Sichern Sie Ihre Daten vorab mit der Export-Funktion, um Datenverlust zu vermeiden.';
            
            btnConfirmAction.textContent = 'Importieren';
            btnConfirmAction.classList.remove('dangerous'); 
            
            // 2. Modal anzeigen
            confirmationModal.style.display = 'block';

            // 3. WICHTIG: Alte Event-Listener entfernen
            btnConfirmAction.onclick = null; 
            btnCancelConfirmation.onclick = null;
            closeConfirmationModal.onclick = null;
            
            // 4. Listener für die Bestätigung/Abbruch hinzufügen
            btnConfirmAction.onclick = () => {
                confirmationModal.style.display = 'none';
                handleImportWarningConfirmed(); // Ruft die Funktion auf, die das Haupt-Import-Modal öffnet
            };
            
            btnCancelConfirmation.onclick = () => {
                confirmationModal.style.display = 'none';
                showToast('Import abgebrochen.', 'info');
            };
            
            closeConfirmationModal.onclick = () => {
                confirmationModal.style.display = 'none';
                showToast('Import abgebrochen.', 'info');
            };
        };
    }


    if (btnShowVersionControl) {
        btnShowVersionControl.onclick = () => {
            const analysis = analysisData.find(a => a.id === activeAnalysisId);
            if (analysis) {
                renderHistoryTable(analysis);
                versionControlModal.style.display = 'block';
            }
        };
    }
    if (closeVersionControlModal) {
        closeVersionControlModal.onclick = () => versionControlModal.style.display = 'none';
    }
    
    // Listener für den Versions-Button öffnet jetzt das Kommentar-Modal
    if (btnCreateNewVersion) {
        btnCreateNewVersion.onclick = () => {
            if (!activeAnalysisId) return;
            // Haupt-Versionsmodal schließen, bevor das Kommentar-Modal geöffnet wird
            versionControlModal.style.display = 'none'; 
            inputVersionComment.value = ''; // Eingabe leeren
            versionCommentModal.style.display = 'block';
            
            // Sicherstellen, dass Minor Change standardmäßig ausgewählt ist
            const defaultMinor = document.querySelector('input[name="versionType"][value="minor"]');
            if (defaultMinor) defaultMinor.checked = true;
        };
    }
    
    // Listener für das Versionskommentar-Modal
    if (closeVersionCommentModal) {
        closeVersionCommentModal.onclick = () => versionCommentModal.style.display = 'none';
    }

    if (versionCommentForm) {
        versionCommentForm.onsubmit = (e) => {
            e.preventDefault();
            const comment = inputVersionComment.value.trim();
            if (comment) {
                createNewVersion(comment); // Ruft die Hauptfunktion mit dem Kommentar auf
                versionCommentModal.style.display = 'none';
            } else {
                showToast('Bitte geben Sie einen Versionskommentar ein.', 'warning');
            }
        };
    }

    // Neues Analyse Modal
    if (document.getElementById('btnNewAnalysis')) {
        document.getElementById('btnNewAnalysis').onclick = () => {
            newAnalysisForm.reset();
            newAnalysisModal.style.display = 'block';
        };
    }
    if (closeNewAnalysisModal) {
        closeNewAnalysisModal.onclick = () => newAnalysisModal.style.display = 'none';
    }
    if (newAnalysisForm) {
        newAnalysisForm.onsubmit = (e) => {
            e.preventDefault();
            const newName = document.getElementById('newAnalysisName').value.trim();
            if (!newName) return;

            const newId = 'tara-' + (analysisData.length + 1).toString().padStart(3, '0');
            
            const newAnalysis = JSON.parse(JSON.stringify(defaultAnalysis));
            newAnalysis.id = newId;
            newAnalysis.name = newName;
            newAnalysis.metadata.date = todayISO;
            newAnalysis.history[0].state.name = newName; 
            
            analysisData.push(newAnalysis);
            activateAnalysis(newId);
            
            newAnalysisModal.style.display = 'none';
            showToast(`Analyse "${newName}" erfolgreich erstellt.`, 'success');
        };
    }

    // Import Modal (Schließen des Hauptmodals)
    if (closeImportAnalysisModal) {
        closeImportAnalysisModal.onclick = () => importAnalysisModal.style.display = 'none';
    }
    
    // NEU: Damage Scenario Modal Listener
    if (btnAddDamageScenario) {
        btnAddDamageScenario.onclick = () => {
             if (!activeAnalysisId) {
                showToast('Bitte wählen Sie zuerst eine aktive Analyse aus.', 'info');
                return;
            }
            damageScenarioForm.reset();
            
            // Wichtig: ID-Feld leeren und Titel für NEU setzen
            if (dsIdField) dsIdField.value = ''; 
            
            // KORRIGIERT: Voraussichtliche neue ID im Titel anzeigen
            const analysis = analysisData.find(a => a.id === activeAnalysisId);
            const existingIds = analysis.damageScenarios.map(ds => parseInt(ds.id.replace('DS', ''))).filter(n => !isNaN(n));
            const nextIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
            const nextId = 'DS' + nextIndex;
            
            if (dsModalTitle) dsModalTitle.textContent = `Neues Schadensszenario ${nextId} erfassen`;
            
            damageScenarioModal.style.display = 'block';
        };
    }
    if (closeDamageScenarioModal) {
        closeDamageScenarioModal.onclick = () => damageScenarioModal.style.display = 'none';
    }
    if (damageScenarioForm) {
        damageScenarioForm.onsubmit = saveDamageScenario; // Geändert auf die neue generische Funktion
    }

    // Globaler Listener zum Schließen von Modals bei Klick außerhalb
    window.onclick = function(event) {
        if (event.target == newAnalysisModal || event.target == versionControlModal || event.target == importAnalysisModal || event.target == assetModal || event.target == versionCommentModal || event.target == confirmationModal || event.target == damageScenarioModal) {
            event.target.style.display = 'none';
        }
    };
    
    // --- TAB NAVIGATION ---
    document.querySelectorAll('.tab-navigation .tab-button').forEach(button => {
        button.addEventListener('click', (e) => {
            if (activeAnalysisId) {
                saveCurrentAnalysisState();
            }
            document.querySelectorAll('.tab-navigation .tab-button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
            const tabId = e.target.dataset.tab;
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.style.display = 'block';
            }
            
            const activeAnalysis = analysisData.find(a => a.id === activeAnalysisId);
            
            if (tabId === 'tabAssets' && activeAnalysis) {
                renderAssets(activeAnalysis);
            } 
            // NEU: Logik für Damage Scenarios Tab
            else if (tabId === 'tabDamageScenarios' && activeAnalysis) {
                renderDamageScenarios();
                renderImpactMatrix();
            }
        });
    });
});