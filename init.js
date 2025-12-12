// =============================================================
// --- EVENT LISTENER & INIT ---
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Initialisierung
    loadAnalyses();
    renderAnalysisSelector(); 

    // Aktiviere die erste Analyse
    if (analysisData.length > 0) {
        const firstId = analysisData[0].id;
        activateAnalysis(firstId); 
    } else {
        fillAnalysisForm(defaultAnalysis);
        statusBarMessage.textContent = 'Bitte starten Sie eine neue Analyse.';
    }
    
    // 2. Listener für den Analysen-Selektor
    if (analysisSelector) {
        analysisSelector.addEventListener('change', (e) => {
            activateAnalysis(e.target.value);
        });
    }
    
    // 3. Change-Listener für Konsistenz (Aktualisierung des Headers/Speichern)
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

    // 4. Haupt-Button Listeners
    
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
    
    if (document.getElementById('btnImportAnalysis')) {
        document.getElementById('btnImportAnalysis').onclick = () => {
            confirmationTitle.textContent = 'Achtung: Datenimport';
            confirmationMessage.innerHTML = 'Durch den Datenimport werden die Daten im Browser überschrieben.<br>Sichern Sie Ihre Daten vorab mit der Export-Funktion, um Datenverlust zu vermeiden.';
            
            btnConfirmAction.textContent = 'Importieren';
            btnConfirmAction.classList.remove('dangerous'); 
            
            confirmationModal.style.display = 'block';

            btnConfirmAction.onclick = null; 
            btnCancelConfirmation.onclick = null;
            closeConfirmationModal.onclick = null;
            
            btnConfirmAction.onclick = () => {
                confirmationModal.style.display = 'none';
                handleImportWarningConfirmed();
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

    // 5. Versionskontrolle Modal Listeners
    if (btnShowVersionControl) {
        btnShowVersionControl.onclick = () => {
            const analysis = analysisData.find(a => a.id === activeAnalysisId);
            if (analysis) {
                renderHistoryTable(analysis);
                versionControlModal.style.display = 'block';
            }
        };
    }
    
    if (btnCreateNewVersion) {
        btnCreateNewVersion.onclick = () => {
            if (!activeAnalysisId) return;
            versionControlModal.style.display = 'none'; 
            inputVersionComment.value = ''; 
            versionCommentModal.style.display = 'block';
            
            const defaultMinor = document.querySelector('input[name="versionType"][value="minor"]');
            if (defaultMinor) defaultMinor.checked = true;
        };
    }
    
    // 6. Neues Analyse Modal Listeners
    if (document.getElementById('btnNewAnalysis')) {
        document.getElementById('btnNewAnalysis').onclick = () => {
            newAnalysisForm.reset();
            newAnalysisModal.style.display = 'block';
        };
    }
    
    if (closeNewAnalysisModal) {
        closeNewAnalysisModal.onclick = () => newAnalysisModal.style.display = 'none';
    }

    // 7. Import Modal (Schließen des Hauptmodals)
    if (closeImportAnalysisModal) {
        closeImportAnalysisModal.onclick = () => importAnalysisModal.style.display = 'none';
    }
    
    // 8. Globaler Listener zum Schließen von Modals bei Klick außerhalb
    window.onclick = function(event) {
        if (event.target == newAnalysisModal || event.target == versionControlModal || event.target == importAnalysisModal || event.target == assetModal || event.target == versionCommentModal || event.target == confirmationModal || event.target == damageScenarioModal) {
            event.target.style.display = 'none';
        }
    };
    
    // 9. TAB NAVIGATION
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
            
            if (tabId === 'tabAssets' && activeAnalysis && typeof renderAssets === 'function') {
                renderAssets(activeAnalysis);
            } 
            else if (tabId === 'tabDamageScenarios' && activeAnalysis && typeof renderDamageScenarios === 'function' && typeof renderImpactMatrix === 'function') {
                renderDamageScenarios();
                renderImpactMatrix();
            }
            // NEU: Logik für Risikoanalyse Tab hinzufügen
            else if (tabId === 'tabRiskAnalysis' && activeAnalysis && typeof renderRiskAnalysis === 'function') {
                renderRiskAnalysis();
            }
        });
    });
});