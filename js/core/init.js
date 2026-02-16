
// =============================================================
// --- EVENT LISTENERS & INIT ---
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialization
    if (typeof loadAnalyses === 'function') loadAnalyses();
    if (typeof renderAnalysisSelector === 'function') renderAnalysisSelector(); 

    if (analysisData.length > 0) {
        const firstId = analysisData[0].id;
        if (typeof activateAnalysis === 'function') activateAnalysis(firstId); 
    } else {
        if (typeof fillAnalysisForm === 'function') fillAnalysisForm(defaultAnalysis);
        if (statusBarMessage) statusBarMessage.textContent = 'Bitte starten Sie eine neue Analyse.';
    }
    
    // 2. Listener for the analysis selector
    if (analysisSelector) {
        analysisSelector.addEventListener('change', (e) => {
            if (typeof activateAnalysis === 'function') activateAnalysis(e.target.value);
        });
    }
    
    // 3. Listener for metadata changes (auto-save)
    const metaInputs = document.querySelectorAll('#inputAnalysisName, #inputAuthorName, #inputDescription, #inputIntendedUse');
    metaInputs.forEach(input => {
        input.addEventListener('change', () => {
            if (typeof saveCurrentAnalysisState === 'function') saveCurrentAnalysisState();
            
            // If name/author changed, update header & list
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
            // Save before switching
            if (activeAnalysisId && typeof saveCurrentAnalysisState === 'function') {
                saveCurrentAnalysisState();
            }

            // Toggle buttons
            tabs.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            // Toggle content
            document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
            const tabId = e.target.dataset.tab;
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.style.display = 'block';
            }
            
            // Call render functions
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
            else if (tabId === 'tabSecurityGoals') {
                if (typeof renderSecurityGoals === 'function') renderSecurityGoals(activeAnalysis);
            }
            else if (tabId === 'tabRiskAnalysis') {
                if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis();
            }
            else if (tabId === 'tabResidualRisk') {
                if (typeof renderResidualRisk === 'function') renderResidualRisk(activeAnalysis);
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

    const btnGenerateReport = document.getElementById("btnGenerateReport");
    if (btnGenerateReport) {
        btnGenerateReport.onclick = () => {
            if (typeof generateReportPdf === "function") {
                try {
                    const p = generateReportPdf();
                    if (p && typeof p.then === 'function') {
                        p.catch(() => {
                            if (typeof showToast === "function") {
                                showToast("Report-Erzeugung fehlgeschlagen.", "error");
                            }
                        });
                    }
                } catch (_) {
                    if (typeof showToast === "function") {
                        showToast("Report-Erzeugung fehlgeschlagen.", "error");
                    }
                }
            } else if (typeof showToast === "function") {
                showToast("Report-Funktion nicht verfügbar (jsPDF fehlt?).", "error");
            }
        };
    }

});
