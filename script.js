// =============================================================
// --- GLOBALE VARIABLEN UND KONSTANTEN ---
// =============================================================
const INITIAL_VERSION = '0.1'; 
const todayISO = new Date().toISOString().substring(0, 10);

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
const assetsTableBody = document.getElementById('assetsTableBody');
const btnAddAsset = document.getElementById('btnAddAsset');
const assetModal = document.getElementById('assetModal');
const closeAssetModal = document.getElementById('closeAssetModal');
const assetForm = document.getElementById('assetForm');
const assetModalTitle = document.getElementById('assetModalTitle');

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


// NEUES Bestätigungs-Modal (für Wiederherstellung und Import-Warnung)
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
        version: INITIAL_VERSION // Verwendet 0.1
    },
    description: 'Dies ist die Standardbeschreibung.',
    intendedUse: 'Der vorgesehene Einsatzzweck.',
    
    assets: [
         { id: 'a-001', name: 'Steuereinheit', type: 'Hardware', schutzbedarf: 'I' }
    ],
    riskEntries: [], 
    
    history: [
        {
            version: INITIAL_VERSION, // Verwendet 0.1
            author: 'Max Mustermann',
            date: todayISO,
            comment: 'Erstanlage der Analyse.',
            state: {
                name: 'TARA-Analyse Produkt A',
                metadata: { author: 'Max Mustermann', date: todayISO, version: INITIAL_VERSION },
                description: 'Dies ist die Standardbeschreibung.',
                intendedUse: 'Der vorgesehene Einsatzzweck.',
                assets: [{ id: 'a-001', name: 'Steuereinheit', type: 'Hardware', schutzbedarf: 'I' }],
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
// --- EXPORT FUNKTION (ULTRA-ROBUST: Exportiert ALLE Analysen) ---
// =============================================================

function handleExport() {
    // 1. Speichere den aktuellen Zustand der aktiven Analyse, bevor der Export beginnt.
    saveCurrentAnalysisState();
    
    // 2. Datenquelle ist nun der GESAMTE Array.
    const dataToExport = analysisData; 
    
    if (dataToExport.length === 0) {
        showToast('Keine Analysen zum Exportieren vorhanden.', 'info');
        return;
    }

    // Erzeugen des Dateinamens (enthält das Datum für Eindeutigkeit)
    const filename = `TARA_Alle_Analysen_Backup_${todayISO}.json`;
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    
    // WICHTIG: Erstellung eines temporären Links OHNE ihn dem DOM hinzuzufügen.
    const tempLink = document.createElement('a');
    tempLink.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(dataStr);
    tempLink.download = filename;
    
    // Klick auslösen
    tempLink.click();
    
    showToast(`Alle ${dataToExport.length} Analysen in "${filename}" exportiert.`, 'success');
}

// =============================================================
// --- IMPORT FUNKTIONEN (NEU) ---
// =============================================================

function handleImportWarningConfirmed() {
    // Setzt das Feld zurück, um sicherzustellen, dass keine alte Datei mehr ausgewählt ist
    if (importForm) importForm.reset();
    
    // 1. Das Haupt-Import-Modal öffnen
    importAnalysisModal.style.display = 'block';
    
    // 2. Das Formular aktivieren
    if (importFileInput) importFileInput.disabled = false;
    if (btnImportStart) btnImportStart.disabled = false;

    // 3. Listener für den eigentlichen Import hinzufügen (wird nur einmal registriert)
    if (importForm) {
        importForm.onsubmit = handleImportFile;
    }
}

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
            
            // WICHTIG: Prüfen, ob die Datenstruktur plausibel ist (muss ein Array von Analysen sein)
            if (Array.isArray(importedData) && importedData.every(item => item.id && item.name)) {
                // Daten ersetzen und speichern
                analysisData = importedData;
                saveAnalyses();
                
                // UI neu laden
                const firstId = analysisData.length > 0 ? analysisData[0].id : null;
                if (firstId) {
                    activateAnalysis(firstId);
                } else {
                    // Fallback: Lade Standard, falls die importierte Datei leer war
                    loadAnalyses(); 
                }
                
                // Modal schließen und Erfolgsmeldung
                importAnalysisModal.style.display = 'none';
                showToast(`Erfolgreich ${analysisData.length} Analysen importiert.`, 'success');
                
            } else {
                showToast('Importfehler: Die Datei enthält keine gültige Analysedatenstruktur.', 'error');
            }
            
        } catch (error) {
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
        renderAnalysisSelector(); // Aktualisiert den Selektor, um die korrekte Analyse anzuzeigen
        saveAnalyses();
        statusBarMessage.textContent = `Analyse "${analysis.name}" geladen.`;
        showToast(`Analyse "${analysis.name}" geladen.`, 'info');
        // Initial auf den General Tab schalten und rendern
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
        // Sicherstellen, dass das Element existiert und noch im DOM ist, bevor entfernt wird.
        const parent = toast.parentElement; 
        if (parent && parent.contains(toast)) {
             // Kurze Verzögerung, um der CSS-Transition Zeit zu geben
             setTimeout(() => {
                 try {
                     parent.removeChild(toast);
                 } catch (e) {
                     // Wird nur protokolliert, wenn der Fehler doch auftritt
                     // console.warn('Toast removeChild abgefangen:', e);
                 }
             }, 500);
        }
    }, 4000);
}


// =============================================================
// --- ASSET LOGIK (CRUD) ---
// =============================================================

// Rendert die Asset-Tabelle
function renderAssets(analysis) {
    if (!assetsTableBody) return;
    assetsTableBody.innerHTML = '';

    if (!analysis.assets || analysis.assets.length === 0) {
        assetsTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #7f8c8d;">Noch keine Assets erfasst.</td></tr>';
        return;
    }

    analysis.assets.forEach(asset => {
        const row = document.createElement('tr');
        row.dataset.id = asset.id;
        row.innerHTML = `
            <td>${asset.name}</td>
            <td>${asset.type}</td>
            <td>${asset.schutzbedarf}</td>
            <td>
                <button onclick="window.editAsset('${asset.id}')" class="action-button small">Bearbeiten</button>
                <button onclick="window.deleteAsset('${asset.id}')" class="action-button small dangerous">Löschen</button>
            </td>
        `;
        assetsTableBody.appendChild(row);
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

    const newAssetData = {
        name: document.getElementById('assetName').value.trim(),
        type: document.getElementById('assetType').value.trim(),
        schutzbedarf: document.getElementById('assetSchutzbedarf').value
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
            Math.max(...analysis.assets.map(a => parseInt(a.id.split('-')[1]))) + 1 : 1;
        const newId = 'a-' + newAssetIndex.toString().padStart(3, '0');
        
        analysis.assets.push({ ...newAssetData, id: newId });
        showToast('Neues Asset hinzugefügt.', 'success');
    }

    if (assetModal) assetModal.style.display = 'none';
    saveCurrentAnalysisState();
    saveAnalyses();
    renderAssets(analysis);
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
    document.getElementById('assetName').value = asset.name;
    document.getElementById('assetType').value = asset.type;
    document.getElementById('assetSchutzbedarf').value = asset.schutzbedarf;

    if (assetModal) assetModal.style.display = 'block';
};

// --- LÖSCHEN (Globale Funktion) ---
window.deleteAsset = (assetId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    if (confirm(`Sind Sie sicher, dass Sie das Asset mit der ID ${assetId} löschen möchten?`)) {
        analysis.assets = analysis.assets.filter(a => a.id !== assetId);

        saveCurrentAnalysisState();
        saveAnalyses();
        renderAssets(analysis);
        showToast(`Asset ${assetId} gelöscht.`, 'success');
    }
};

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
    
    // Temporäre Liste für die Minor-Versionen
    let tempMinorVersions = []; 
    let finalBaseline = null;
    
    // 2. Iteriere von der Version VOR der aktuellen rückwärts
    for (let i = currentVersionIndex - 1; i >= 0; i--) {
        const entry = history[i];
        
        // Definition Baseline: Version X.0 (z.B. 1.0, 2.0). 0.1 wird im Minor-Pfad gesammelt.
        const isX0Baseline = entry.version.endsWith('.0') && entry.version !== INITIAL_VERSION;

        if (isX0Baseline) {
            // REGEL 2: Baseline gefunden. Discarde alle gesammelten Minor-Versionen
            // und nimm nur die Baseline.
            finalBaseline = entry.version;
            tempMinorVersions = []; // Discard
            break; // Suche beenden, da wir die letzte restorable Baseline gefunden haben.
        }
        
        // REGEL 3: Nur die letzten 3 Minor-Versionen sammeln
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
        // Keine X.0 Baseline gefunden (Kette ist 0.x). 
        // Füge die gesammelten Minor-Versionen (max. 3) hinzu.
        tempMinorVersions.forEach(v => restorable.add(v));
    }
    
    // Das Set der zu rendernden Versionen
    const versionsToRender = new Set([...restorable, currentVersion]);
    
    // 4. Filtern und Rendern der Tabelle
    history
        // Filtern: Zeige nur die aktuelle Version ODER eine der restorable Versionen
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

            // Der Button ist nur aktiv, wenn es nicht die aktuelle Version und in unserem restorable Set ist.
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
        // Bestätigungscode ausführen
        
        analysis.name = entry.state.name;
        analysis.description = entry.state.description;
        analysis.intendedUse = entry.state.intendedUse;
        analysis.assets = entry.state.assets;
        analysis.riskEntries = entry.state.riskEntries;
        
        analysis.metadata.version = entry.version;
        analysis.metadata.author = entry.state.metadata.author;
        analysis.metadata.date = entry.state.metadata.date;

        fillAnalysisForm(analysis);
        renderHistoryTable(analysis);
        
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.dataset.tab === 'tabAssets') {
            renderAssets(analysis);
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

    // Prüfen, ob der Kommentar über das Modal übergeben wurde
    if (!comment || comment.trim() === "") {
        showToast('Abgebrochen. Versionskommentar ist notwendig.', 'info');
        return;
    }
    
    // NEU: Auslesen des gewählten Versionstyps
    const versionTypeElement = document.querySelector('input[name="versionType"]:checked');
    const versionType = versionTypeElement ? versionTypeElement.value : 'minor'; // Standard: minor

    const currentVersion = analysis.metadata.version;
    let [major, minor] = currentVersion.split('.').map(Number);
    let newVersion;
    
    if (versionType === 'major') {
        major++;
        minor = 0; // Zurücksetzen auf 0 für die neue Baseline (X.0)
        newVersion = `${major}.0`; // Explizit .0 verwenden (z.B. 1.0)
    } else { // 'minor'
        minor++;
        newVersion = `${major}.${minor}`;
    }

    const newEntry = {
        version: newVersion,
        author: analysis.metadata.author, 
        date: todayISO,
        comment: comment.trim(), // Verwenden des Modal-Kommentars
        state: {
            name: analysis.name,
            metadata: { ...analysis.metadata, version: newVersion, date: todayISO },
            description: analysis.description,
            intendedUse: analysis.intendedUse,
            assets: JSON.parse(JSON.stringify(analysis.assets)), 
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

    // Das Haupt-Versionskontroll-Modal nach erfolgreicher Erstellung schließen
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

    // Globaler Listener zum Schließen von Modals bei Klick außerhalb
    window.onclick = function(event) {
        if (event.target == newAnalysisModal || event.target == versionControlModal || event.target == importAnalysisModal || event.target == assetModal || event.target == versionCommentModal || event.target == confirmationModal) {
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
        });
    });
});