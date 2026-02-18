/**
 * @file        init.js
 * @description Application initialization and DOM event listener setup.
 *              Single, consolidated DOMContentLoaded handler for the entire core.
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

document.addEventListener('DOMContentLoaded', () => {

    // Refresh todayISO so it's current even if the page was loaded yesterday
    todayISO = getTodayISO();
    
    // 1. Initialization
    if (typeof loadAnalyses === 'function') loadAnalyses();
    if (typeof renderAnalysisSelector === 'function') renderAnalysisSelector(); 

    if (analysisData.length > 0) {
        const firstId = analysisData[0].id;
        if (typeof activateAnalysis === 'function') activateAnalysis(firstId); 
    } else {
        if (typeof fillAnalysisForm === 'function') fillAnalysisForm(createDefaultAnalysis());
        const elStatus = document.getElementById('statusBarMessage');
        if (elStatus) elStatus.textContent = 'Bitte starten Sie eine neue Analyse.';
    }
    
    // 2. Listener for the analysis selector
    const elSelector = document.getElementById('analysisSelector');
    if (elSelector) {
        elSelector.addEventListener('change', (e) => {
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
                const analysis = getActiveAnalysis();
                if (analysis) {
                    fillAnalysisForm(analysis); 
                    renderAnalysisSelector();
                }
            }
        });
    });

    // 4. TAB NAVIGATION (uses shared renderActiveTab from globals.js)
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
            
            // Render active tab content (shared function – DRY)
            const activeAnalysis = getActiveAnalysis();
            if (activeAnalysis) {
                renderActiveTab(activeAnalysis, tabId);
            }
        });
    });

    // 5. BUTTON EVENTS (explicit getElementById for all buttons)
    const btnDeleteAnalysis = document.getElementById('btnDeleteAnalysis');
    if (btnDeleteAnalysis) {
        btnDeleteAnalysis.onclick = () => {
            if (typeof deleteActiveAnalysis === 'function') {
                deleteActiveAnalysis();
            }
        };
    }

    const elBtnExport = document.getElementById('btnExportAnalysis');
    if (elBtnExport) {
        elBtnExport.onclick = () => {
            if (typeof exportAnalysis === 'function') exportAnalysis();
        };
    }

    const elBtnImport = document.getElementById('btnImportAnalysis');
    const elImportFile = document.getElementById('importFileInput');
    const elImportModal = document.getElementById('importAnalysisModal');
    if (elBtnImport) {
        elBtnImport.onclick = () => {
            if (elImportFile) elImportFile.value = '';
            if (elImportModal) elImportModal.style.display = 'block';
        };
    }
    
    const elBtnNew = document.getElementById('btnNewAnalysis');
    const elNewForm = document.getElementById('newAnalysisForm');
    const elNewModal = document.getElementById('newAnalysisModal');
    if (elBtnNew) {
        elBtnNew.onclick = () => {
            if (elNewForm) elNewForm.reset();
            if (typeof prepareNewAnalysisModal === 'function') prepareNewAnalysisModal();
            if (elNewModal) elNewModal.style.display = 'block';
        };
    }

    const elBtnSave = document.getElementById('btnSave');
    if (elBtnSave) {
        elBtnSave.onclick = () => {
            if (typeof saveCurrentAnalysisState === 'function') saveCurrentAnalysisState();
            if (typeof saveAnalyses === 'function') saveAnalyses();
            if (typeof showToast === 'function') showToast('Analyse gespeichert.', 'success');
        };
    }
    
    const elBtnVersions = document.getElementById('btnShowVersionControl');
    const elVersionModal = document.getElementById('versionControlModal');
    if (elBtnVersions) {
        elBtnVersions.onclick = () => {
            const analysis = getActiveAnalysis();
            if (analysis && typeof renderHistoryTable === 'function') {
                renderHistoryTable(analysis);
                if (elVersionModal) elVersionModal.style.display = 'block';
            }
        };
    }

    // --- Export Baumdaten (ZIP) ---
    const btnExportTreeData = document.getElementById("btnExportTreeData");
    if (btnExportTreeData) {
        btnExportTreeData.onclick = () => {
            if (typeof window.downloadTreeDataZip === 'function') {
                try {
                    const p = window.downloadTreeDataZip();
                    if (p && typeof p.then === 'function') {
                        p.catch((e) => {
                            console.error('[TreeExport]', e);
                            if (typeof showToast === 'function') showToast('Baumdaten-Export fehlgeschlagen.', 'error');
                        });
                    }
                } catch (e) {
                    console.error('[TreeExport]', e);
                    if (typeof showToast === 'function') showToast('Baumdaten-Export fehlgeschlagen.', 'error');
                }
            } else if (typeof showToast === 'function') {
                showToast('Export-Funktion nicht verfügbar.', 'error');
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

    // 6. Initialize analysis_core modal listeners (consolidated from separate DOMContentLoaded)
    if (typeof initAnalysisCoreListeners === 'function') {
        initAnalysisCoreListeners();
    }

});
