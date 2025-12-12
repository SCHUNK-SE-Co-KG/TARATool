
// =============================================================
// --- UI UPDATES & ALLGEMEINE FUNKTIONEN ---
// =============================================================

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

function fillAnalysisForm(analysis) {
    analysisNameDisplay.textContent = analysis.name;
    inputAnalysisName.value = analysis.name;
    inputDescription.value = analysis.description;
    inputIntendedUse.value = analysis.intendedUse;
    inputAuthorName.value = analysis.metadata.author; 
    
    analysisMetadata.innerHTML = `
        <span>Version: ${analysis.metadata.version}</span> | 
        <span>Autor: ${analysis.metadata.author}</span> | 
        <span>Datum: ${analysis.metadata.date}</span>
    `;

    const disable = !analysis || !activeAnalysisId;
    document.querySelectorAll('.main-content input, .main-content textarea, .main-content select, #btnSave, #btnShowVersionControl').forEach(el => {
        el.disabled = disable;
    });
    if (btnExportAnalysis) btnExportAnalysis.disabled = disable;
}

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

// =============================================================
// --- EXPORT FUNKTION ---
// =============================================================

function handleExport() {
    saveCurrentAnalysisState();
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
    if (importForm) importForm.reset();
    importAnalysisModal.style.display = 'block';
    if (importFileInput) importFileInput.disabled = false;
    if (btnImportStart) btnImportStart.disabled = false;
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
            if (Array.isArray(importedData) && importedData.every(item => item.id && item.name)) {
                analysisData = importedData;
                saveAnalyses();
                const firstId = analysisData.length > 0 ? analysisData[0].id : null;
                if (firstId) {
                    activateAnalysis(firstId);
                } else {
                    loadAnalyses(); 
                }
                importAnalysisModal.style.display = 'none';
                showToast(`Erfolgreich ${analysisData.length} Analysen importiert.`, 'success');
            } else {
                showToast('Importfehler: Ungültige Datenstruktur.', 'error');
            }
        } catch (error) {
            console.error('Importfehler:', error);
            showToast('Importfehler: Ungültiges JSON.', 'error');
        }
    };
    reader.readAsText(file);
}

// =============================================================
// --- NEUE ANALYSE LOGIK ---
// =============================================================

function createNewAnalysis(e) {
    e.preventDefault();
    const newName = newAnalysisName.value.trim();
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
}

if (newAnalysisForm) {
    newAnalysisForm.onsubmit = createNewAnalysis;
}
