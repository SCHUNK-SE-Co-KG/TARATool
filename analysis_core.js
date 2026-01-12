
// =============================================================
// --- ANALYSE VERWALTUNG (SWITCH, CREATE, IMPORT, EXPORT) ---
// =============================================================

function activateAnalysis(id) {
    const analysis = analysisData.find(a => a.id === id);
    if (!analysis) return;
    
    activeAnalysisId = id;
    
    // UI Update
    fillAnalysisForm(analysis);
    
    // Status Bar Update
    if (statusBarMessage) {
        statusBarMessage.textContent = `Aktiv: ${analysis.name} (v${analysis.metadata.version})`;
    }
    
    // Dropdown Sync
    if (analysisSelector) analysisSelector.value = id;

    // Aktiven Tab neu rendern
    const activeTabBtn = document.querySelector('.tab-button.active');
    if (activeTabBtn) {
        const tabId = activeTabBtn.dataset.tab;
        
        if (tabId === 'tabOverview') {
            renderOverview(analysis);
        }
        else if (tabId === 'tabAssets' && typeof renderAssets === 'function') {
            renderAssets(analysis);
        }
        else if (tabId === 'tabDamageScenarios') {
            if (typeof renderDamageScenarios === 'function') renderDamageScenarios();
            if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
        }
        else if (tabId === 'tabRiskAnalysis') {
            if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis();
        }
    }
}

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
    if (analysisNameDisplay) analysisNameDisplay.textContent = analysis.name;
    if (inputAnalysisName) inputAnalysisName.value = analysis.name;
    if (inputDescription) inputDescription.value = analysis.description;
    if (inputIntendedUse) inputIntendedUse.value = analysis.intendedUse;
    if (inputAuthorName) inputAuthorName.value = analysis.metadata.author; 
    
    if (analysisMetadata) {
        analysisMetadata.innerHTML = `
            <span>Version: ${analysis.metadata.version}</span> | 
            <span>Autor: ${analysis.metadata.author}</span> | 
            <span>Datum: ${analysis.metadata.date}</span>
        `;
    }
    
    // Auch Übersicht aktualisieren, wenn gerade sichtbar
    renderOverview(analysis);
}

// NEU: Erweiterte Funktion für die Übersicht (Dashboard)
function renderOverview(analysis) {
    if (!analysis) return;

    // 1. Einfache Zähler
    const elAssetCount = document.getElementById('statAssetCount');
    const elDSCount = document.getElementById('statDSCount');
    const elRiskCount = document.getElementById('statRiskCount');

    if (elAssetCount) elAssetCount.textContent = (analysis.assets || []).length;
    if (elDSCount) elDSCount.textContent = (analysis.damageScenarios || []).length;
    
    const risks = analysis.riskEntries || [];
    if (elRiskCount) elRiskCount.textContent = risks.length;

    // 2. Detaillierte Risiko-Kategorisierung
    let cCrit = 0;   // >= 2.0
    let cHigh = 0;   // >= 1.6
    let cMed = 0;    // >= 0.8
    let cLow = 0;    // < 0.8

    risks.forEach(r => {
        const val = parseFloat(r.rootRiskValue);
        if (isNaN(val)) return;

        if (val >= 2.0) {
            cCrit++;
        } else if (val >= 1.6) {
            cHigh++;
        } else if (val >= 0.8) {
            cMed++;
        } else {
            cLow++;
        }
    });

    // Werte in die neuen Felder schreiben
    const elCrit = document.getElementById('statCrit');
    const elHigh = document.getElementById('statHigh');
    const elMed = document.getElementById('statMed');
    const elLow = document.getElementById('statLow');

    if (elCrit) elCrit.textContent = cCrit;
    if (elHigh) elHigh.textContent = cHigh;
    if (elMed) elMed.textContent = cMed;
    if (elLow) elLow.textContent = cLow;
}


// =============================================================
// --- IMPORT / EXPORT LOGIK ---
// =============================================================

function exportAnalysis() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) {
        showToast('Keine aktive Analyse zum Exportieren.', 'warning');
        return;
    }
    
    const dataStr = JSON.stringify(analysis, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const safeName = analysis.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    a.download = `TARA_Export_${safeName}_${analysis.metadata.date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Analyse exportiert.', 'success');
}

if (closeImportAnalysisModal) {
    closeImportAnalysisModal.onclick = () => {
        if (importAnalysisModal) importAnalysisModal.style.display = 'none';
    };
}

function executeImport() {
    const file = importFileInput.files[0];
    if (!file) {
        showToast('Bitte eine Datei auswählen.', 'warning');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (json.id && json.metadata) {
                if (analysisData.some(a => a.id === json.id)) {
                    json.id = json.id + '_imp_' + Date.now();
                    json.name = json.name + ' (Imported)';
                }
                
                analysisData.push(json);
                saveAnalyses();
                renderAnalysisSelector();
                activateAnalysis(json.id);
                
                importAnalysisModal.style.display = 'none';
                showToast(`Analyse "${json.name}" erfolgreich importiert.`, 'success');
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

    const newId = 'tara-' + (analysisData.length + 1).toString().padStart(3, '0') + '-' + Date.now().toString().slice(-4);
    
    const newAnalysis = JSON.parse(JSON.stringify(defaultAnalysis));
    newAnalysis.id = newId;
    newAnalysis.name = newName;
    newAnalysis.metadata.date = todayISO;
    newAnalysis.history[0].state.name = newName; 
    
    analysisData.push(newAnalysis);
    renderAnalysisSelector();
    activateAnalysis(newId);
    saveAnalyses();
    
    newAnalysisModal.style.display = 'none';
    showToast(`Analyse "${newName}" erstellt.`, 'success');
}

if (closeNewAnalysisModal) {
    closeNewAnalysisModal.onclick = () => {
        if (newAnalysisModal) newAnalysisModal.style.display = 'none';
    };
}

if (newAnalysisForm) {
    newAnalysisForm.onsubmit = createNewAnalysis;
}
