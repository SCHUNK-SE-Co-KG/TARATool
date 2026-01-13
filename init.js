
// =============================================================
// --- EVENT LISTENER & INIT ---
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialisierung
    if (typeof loadAnalyses === 'function') loadAnalyses();
    if (typeof renderAnalysisSelector === 'function') renderAnalysisSelector(); 

    if (analysisData.length > 0) {
        const firstId = analysisData[0].id;
        if (typeof activateAnalysis === 'function') activateAnalysis(firstId); 
    } else {
        if (typeof fillAnalysisForm === 'function') fillAnalysisForm(defaultAnalysis);
        if (statusBarMessage) statusBarMessage.textContent = 'Bitte starten Sie eine neue Analyse.';
    }
    
    // 2. Listener für den Analysen-Selektor
    if (analysisSelector) {
        analysisSelector.addEventListener('change', (e) => {
            if (typeof activateAnalysis === 'function') activateAnalysis(e.target.value);
        });
    }
    
    // 3. Listener für Metadaten-Änderungen (Auto-Save)
    const metaInputs = document.querySelectorAll('#inputAnalysisName, #inputAuthorName, #inputDescription, #inputIntendedUse');
    metaInputs.forEach(input => {
        input.addEventListener('change', () => {
            if (typeof saveCurrentAnalysisState === 'function') saveCurrentAnalysisState();
            
            // Wenn Name/Autor geändert, Header & Liste aktualisieren
            if (input.id === 'inputAnalysisName' || input.id === 'inputAuthorName') {
                const analysis = analysisData.find(a => a.id === activeAnalysisId);
                if (analysis) {
                    fillAnalysisForm(analysis); 
                    renderAnalysisSelector();
                }
            }
        });
    });

    // 4. TAB NAVIGATION
    const tabs = document.querySelectorAll('.tab-navigation .tab-button');
    tabs.forEach(button => {
        button.addEventListener('click', (e) => {
            // Speichern bevor gewechselt wird
            if (activeAnalysisId && typeof saveCurrentAnalysisState === 'function') {
                saveCurrentAnalysisState();
            }

            // Buttons umschalten
            tabs.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Inhalte umschalten
            document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
            const tabId = e.target.dataset.tab;
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.style.display = 'block';
            }
            
            // Render Funktionen aufrufen
            const activeAnalysis = analysisData.find(a => a.id === activeAnalysisId);
            if (!activeAnalysis) return;
            
            if (tabId === 'tabOverview') {
                if (typeof renderOverview === 'function') renderOverview(activeAnalysis);
            }
            else if (tabId === 'tabAssets') {
                if (typeof renderAssets === 'function') renderAssets(activeAnalysis);
            } 
            else if (tabId === 'tabDamageScenarios') {
                if (typeof renderDamageScenarios === 'function') renderDamageScenarios();
                if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
            }
            else if (tabId === 'tabRiskAnalysis') {
                if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis();
            }
        });
    });

    // 5. BUTTON EVENTS
    const btnDeleteAnalysis = document.getElementById('btnDeleteAnalysis');
    if (btnDeleteAnalysis) {
        btnDeleteAnalysis.onclick = () => {
            if (typeof deleteActiveAnalysis === 'function') {
                deleteActiveAnalysis();
            }
    };
}

    if (btnExportAnalysis) {
        btnExportAnalysis.onclick = () => {
            if (typeof exportAnalysis === 'function') exportAnalysis();
        };
    }

    if (btnImportAnalysis) {
        btnImportAnalysis.onclick = () => {
            if (importFileInput) importFileInput.value = '';
            if (importAnalysisModal) importAnalysisModal.style.display = 'block';
        };
    }
    
    if (btnNewAnalysis) {
        btnNewAnalysis.onclick = () => {
            if (newAnalysisForm) newAnalysisForm.reset();
	            if (typeof prepareNewAnalysisModal === 'function') prepareNewAnalysisModal();
            if (newAnalysisModal) newAnalysisModal.style.display = 'block';
        };
    }

    if (btnSave) {
        btnSave.onclick = () => {
            if (typeof saveCurrentAnalysisState === 'function') saveCurrentAnalysisState();
            if (typeof saveAnalyses === 'function') saveAnalyses();
            if (typeof showToast === 'function') showToast('Analyse gespeichert.', 'success');
        };
    }
    
    if (btnShowVersionControl) {
        btnShowVersionControl.onclick = () => {
             const analysis = analysisData.find(a => a.id === activeAnalysisId);
             if (analysis && typeof renderHistoryTable === 'function') {
                 renderHistoryTable(analysis);
                 if (versionControlModal) versionControlModal.style.display = 'block';
             }
        };
    }
});
