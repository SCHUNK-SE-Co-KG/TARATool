/**
 * @file        analysis_core.js
 * @description Analysis management – create, switch, delete, import/export
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

function activateAnalysis(id) {
    const analysis = analysisData.find(a => a.id === id);
    if (!analysis) return;
    
    activeAnalysisId = id;

    // Keep residual risk structure up to date (risk analysis -> residual risk)
    try {
        if (typeof ensureResidualRiskSynced === 'function') {
            ensureResidualRiskSynced(analysis);
        }
    } catch (e) {
        console.warn('[activateAnalysis] Residual risk sync error:', e);
    }
    
    // UI Update
    fillAnalysisForm(analysis);
    
    // Status Bar Update
    const elStatusBar = document.getElementById('statusBarMessage');
    if (elStatusBar) {
        elStatusBar.textContent = `Aktiv: ${analysis.name} (v${analysis.metadata.version})`;
    }
    
    // Dropdown Sync
    const elSelector = document.getElementById('analysisSelector');
    if (elSelector) elSelector.value = id;

    // Re-render the active tab (using shared function from globals.js)
    renderActiveTab(analysis);
}

// =============================================================
// --- UI UPDATES & GENERAL FUNCTIONS ---
// =============================================================

function renderAnalysisSelector() {
    const elSelector = document.getElementById('analysisSelector');
    if (!elSelector) return;
    elSelector.innerHTML = '';
    
    if (analysisData.length === 0) {
        const option = document.createElement('option');
        option.textContent = 'Keine Analysen vorhanden';
        option.value = '';
        elSelector.appendChild(option);
        return;
    }

    analysisData.forEach(analysis => {
        const option = document.createElement('option');
        option.textContent = analysis.name;
        option.value = analysis.id;
        if (analysis.id === activeAnalysisId) {
            option.selected = true;
        }
        elSelector.appendChild(option);
    });
}

function fillAnalysisForm(analysis) {
    const elNameDisplay = document.getElementById('analysisNameDisplay');
    const elName     = document.getElementById('inputAnalysisName');
    const elDesc     = document.getElementById('inputDescription');
    const elUse      = document.getElementById('inputIntendedUse');
    const elAuthor   = document.getElementById('inputAuthorName');
    const elMetadata = document.getElementById('analysisMetadata');

    if (elNameDisplay) elNameDisplay.textContent = analysis.name;
    if (elName)     elName.value = analysis.name;
    if (elDesc)     elDesc.value = analysis.description;
    if (elUse)      elUse.value = analysis.intendedUse;
    if (elAuthor)   elAuthor.value = analysis.metadata.author; 
    
    if (elMetadata) {
        elMetadata.innerHTML = `
            <span>Version: ${analysis.metadata.version}</span> | 
            <span>Autor: ${analysis.metadata.author}</span> | 
            <span>Datum: ${analysis.metadata.date}</span>
        `;
    }
    
    // Also update overview if currently visible
    renderOverview(analysis);
}

// Extended function for the overview (dashboard)
function renderOverview(analysis) {
    if (!analysis) return;

    // 1. Simple counters
    const elAssetCount = document.getElementById('statAssetCount');
    const elDSCount = document.getElementById('statDSCount');
    const elRiskCount = document.getElementById('statRiskCount');

    if (elAssetCount) elAssetCount.textContent = (analysis.assets || []).length;
    if (elDSCount) elDSCount.textContent = (analysis.damageScenarios || []).length;
    
    const risks = analysis.riskEntries || [];
    if (elRiskCount) elRiskCount.textContent = risks.length;

    // 2. Detailed risk categorization (uses global RISK_THRESHOLDS via getRiskMeta)
    const dist = { 'Kritisch': 0, 'Hoch': 0, 'Mittel': 0, 'Niedrig': 0 };

    risks.forEach(r => {
        const val = parseFloat(r.rootRiskValue);
        if (isNaN(val)) return;
        const label = getRiskMeta(val).label;
        if (label in dist) dist[label]++;
    });

    // Write values to the new fields
    const elCrit = document.getElementById('statCrit');
    const elHigh = document.getElementById('statHigh');
    const elMed = document.getElementById('statMed');
    const elLow = document.getElementById('statLow');

    if (elCrit) elCrit.textContent = dist['Kritisch'];
    if (elHigh) elHigh.textContent = dist['Hoch'];
    if (elMed) elMed.textContent = dist['Mittel'];
    if (elLow) elLow.textContent = dist['Niedrig'];

    // 3. Residual risk distribution (based on residual risk root per attack tree)
    // If residual risk does not exist yet, it will be synced automatically.
    try {
        if (typeof ensureResidualRiskSynced === 'function') {
            ensureResidualRiskSynced(analysis);
        }
    } catch (e) {
        console.warn('[renderOverview] Residual risk sync error:', e);
    }

    const rrDist = { 'Kritisch': 0, 'Hoch': 0, 'Mittel': 0, 'Niedrig': 0 };

    risks.forEach(r => {
        if (!r?.uid) return;
        let val = NaN;
        try {
            if (typeof computeResidualTreeMetrics === 'function') {
                const m = computeResidualTreeMetrics(analysis, r.uid);
                if (m && m.riskValue !== undefined) val = parseFloat(m.riskValue);
            }
        } catch (e) {
            console.warn('[renderOverview] computeResidualTreeMetrics error for uid', r.uid, e);
        }
        if (isNaN(val)) {
            val = parseFloat(r.rootRiskValue);
        }
        if (isNaN(val)) return;

        const label = getRiskMeta(val).label;
        if (label in rrDist) rrDist[label]++;
    });

    const elRRCrit = document.getElementById('statRRCrit');
    const elRRHigh = document.getElementById('statRRHigh');
    const elRRMed = document.getElementById('statRRMed');
    const elRRLow = document.getElementById('statRRLow');

    if (elRRCrit) elRRCrit.textContent = rrDist['Kritisch'];
    if (elRRHigh) elRRHigh.textContent = rrDist['Hoch'];
    if (elRRMed) elRRMed.textContent = rrDist['Mittel'];
    if (elRRLow) elRRLow.textContent = rrDist['Niedrig'];
}


// =============================================================
// --- IMPORT / EXPORT LOGIC ---
// =============================================================

function exportAnalysis() {
    const analysis = getActiveAnalysis();
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

function executeImport() {
    const elFileInput = document.getElementById('importFileInput');
    const elModal     = document.getElementById('importAnalysisModal');

    if (!elFileInput || !elFileInput.files[0]) {
        showToast('Bitte eine Datei auswählen.', 'warning');
        return;
    }
    
    const file = elFileInput.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const json = JSON.parse(ev.target.result);
            if (json.id && json.metadata) {
                if (analysisData.some(a => a.id === json.id)) {
                    json.id = json.id + '_imp_' + Date.now();
                    json.name = json.name + ' (Imported)';
                }
                
                analysisData.push(json);

                // Use shared migration function (single source of truth)
                migrateAnalysis(json);

                saveAnalyses();
                renderAnalysisSelector();
                activateAnalysis(json.id);
                
                if (elModal) elModal.style.display = 'none';
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
// --- NEW ANALYSIS LOGIC ---
// =============================================================

/**
 * Initializes the "New Analysis" dialog (reset/populate the copy selection).
 * Used when opening and closing the modal.
 */
function prepareNewAnalysisModal() {
    const group = document.getElementById('copyExistingAnalysisGroup');
    const select = document.getElementById('copyExistingAnalysisSelect');
    const btn = document.getElementById('btnToggleCopyExistingAnalysis');

    if (group) group.style.display = 'none';
    if (btn) btn.textContent = 'Kopieren';

    if (!select) return;

    // Rebuild options (current list of analyses)
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Bitte Vorlage wählen…';
    select.appendChild(placeholder);

    (analysisData || []).forEach(a => {
        // Only valid analyses
        if (!a || !a.id) return;
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name || a.id;
        select.appendChild(opt);
    });
}

function toggleCopyExistingAnalysisUI() {
    const group = document.getElementById('copyExistingAnalysisGroup');
    const btn = document.getElementById('btnToggleCopyExistingAnalysis');
    const select = document.getElementById('copyExistingAnalysisSelect');
    if (!group) return;

    const willShow = group.style.display === 'none' || group.style.display === '';
    group.style.display = willShow ? 'block' : 'none';

    if (btn) btn.textContent = willShow ? 'Kopieren ausblenden' : 'Kopieren';
    if (willShow) {
        // On first open, ensure options are up to date
        prepareNewAnalysisModal();
        // Then make visible again (prepareNewAnalysisModal hides it)
        group.style.display = 'block';
        if (btn) btn.textContent = 'Kopieren ausblenden';
        if (select) select.focus();
    } else {
        if (select) select.value = '';
    }
}

function createNewAnalysis(e) {
    e.preventDefault();
    
    // Explicit element selection for safety
    const nameInput = document.getElementById('newAnalysisName');
    const modal = document.getElementById('newAnalysisModal');
    
    const newName = nameInput ? nameInput.value.trim() : '';
    if (!newName) return;

    // Generate collision-safe unique ID using UUID
    const newId = 'tara-' + generateUID('id').replace('id_', '');
    
    // Optional: copy from existing analysis
    const copyGroup = document.getElementById('copyExistingAnalysisGroup');
    const copySelect = document.getElementById('copyExistingAnalysisSelect');
    const copySourceId = (copyGroup && copyGroup.style.display !== 'none' && copySelect) ? (copySelect.value || '') : '';

    let newAnalysis;
    let copySourceName = '';

    if (copySourceId) {
        const source = analysisData.find(a => a.id === copySourceId);
        if (source) {
            copySourceName = source.name || source.id;
            newAnalysis = JSON.parse(JSON.stringify(source));
        }
    }

    // Fallback: default structure
    if (!newAnalysis) {
        newAnalysis = createDefaultAnalysis();
    }

    const today = getTodayISO();
    newAnalysis.id = newId;
    newAnalysis.name = newName;
    // Reset metadata/history for new analysis
    if (!newAnalysis.metadata) newAnalysis.metadata = { version: INITIAL_VERSION, author: 'Unbekannt', date: today };
    newAnalysis.metadata.version = INITIAL_VERSION;
    newAnalysis.metadata.date = today;

    // Initialize history (do not carry over old history)
    newAnalysis.history = [
        {
            version: INITIAL_VERSION,
            date: today,
            author: (newAnalysis.metadata && newAnalysis.metadata.author) ? newAnalysis.metadata.author : 'System',
            comment: copySourceName ? `Kopie von: ${copySourceName}` : 'Initiale Erstellung',
            state: {
                name: newName,
                metadata: { ...(newAnalysis.metadata || {}), version: INITIAL_VERSION, date: today },
                description: newAnalysis.description || '',
                intendedUse: newAnalysis.intendedUse || '',
                assets: JSON.parse(JSON.stringify(newAnalysis.assets || [])),
                damageScenarios: JSON.parse(JSON.stringify(newAnalysis.damageScenarios || JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS)))),
                impactMatrix: JSON.parse(JSON.stringify(newAnalysis.impactMatrix || {})),
                riskEntries: JSON.parse(JSON.stringify(newAnalysis.riskEntries || [])),
                securityGoals: JSON.parse(JSON.stringify(newAnalysis.securityGoals || [])),
                residualRisk: JSON.parse(JSON.stringify(newAnalysis.residualRisk || { leaves: {} }))
            }
        }
    ];
    
    // Keep name consistent in initial history
    if (newAnalysis.history && newAnalysis.history[0] && newAnalysis.history[0].state) {
        newAnalysis.history[0].state.name = newName;
    }
    
    // Save data and update UI
    analysisData.push(newAnalysis);
    renderAnalysisSelector();
    activateAnalysis(newId);
    saveAnalyses();
    
    // Close modal and provide feedback
    if (modal) modal.style.display = 'none';
    showToast(`Analyse "${newName}" wurde erstellt.`, 'success');
}

/**
 * Initializes event listeners for analysis_core modals and buttons.
 * Called from the central DOMContentLoaded handler in init.js.
 */
function initAnalysisCoreListeners() {
    const form = document.getElementById('newAnalysisForm');
    const modal = document.getElementById('newAnalysisModal');
    const closeBtn = document.getElementById('closeNewAnalysisModal');
    const btnToggleCopy = document.getElementById('btnToggleCopyExistingAnalysis');
    const closeImport = document.getElementById('closeImportAnalysisModal');
    const importModal = document.getElementById('importAnalysisModal');

    // Submit handler (create)
    if (form) {
        form.onsubmit = createNewAnalysis;
    }

    // X button close (bugfix: previously missing handler)
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            if (form) form.reset();
            prepareNewAnalysisModal();
        };
    }

    // Click on dark overlay also closes
    if (modal) {
        window.addEventListener('click', (ev) => {
            if (ev.target === modal) {
                modal.style.display = 'none';
                if (form) form.reset();
                prepareNewAnalysisModal();
            }
        });
    }

    // Copy UI
    if (btnToggleCopy) {
        btnToggleCopy.onclick = () => {
            toggleCopyExistingAnalysisUI();
        };
    }

    // Import modal close button (moved from top-level scope into DOMContentLoaded)
    if (closeImport && importModal) {
        closeImport.onclick = () => {
            importModal.style.display = 'none';
        };
    }

    // Initial reset
    prepareNewAnalysisModal();
}

/**
 * Deletes the currently active analysis after user confirmation.
 */
function deleteActiveAnalysis() {
    if (!activeAnalysisId) return;
    
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    // Use existing confirmation modal
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationTitle');
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');

    if (!modal) {
        console.warn('[deleteActiveAnalysis] Confirmation modal not found in DOM.');
        return;
    }

    if (title) title.textContent = 'Gesamte Analyse löschen';
    if (msg) msg.innerHTML = `Sind Sie sicher, dass Sie die Analyse <strong>${analysis.name}</strong> unwiderruflich löschen möchten? <br><br><span style="color:red;">Warnung: Alle Assets, Schadensszenarien und Angriffsbäume gehen verloren!</span>`;
    
    // Reset button state (important since the confirmation modal is used for multiple actions)
    if (btnConfirm) {
        btnConfirm.className = 'primary-button';
        btnConfirm.classList.add('dangerous');
        btnConfirm.textContent = 'Ja, alles löschen';
    }
    
    modal.style.display = 'block';

    // Remove previous handlers to prevent conflicts with other confirmations
    if (btnConfirm) btnConfirm.onclick = null;
    if (btnCancel) btnCancel.onclick = null;
    if (btnClose) btnClose.onclick = null;

    // Confirmation event handler
    if (btnConfirm) btnConfirm.onclick = () => {
        // Remove from list
        analysisData = analysisData.filter(a => a.id !== activeAnalysisId);
        
        // If no analyses remain, create fresh default analysis
        if (analysisData.length === 0) {
            analysisData = [createDefaultAnalysis()];
        }
        
        // Select the next available analysis (first in list)
        const nextId = analysisData[0].id;
        
        // Save and update UI
        saveAnalyses();
        renderAnalysisSelector();
        activateAnalysis(nextId);
        
        modal.style.display = 'none';
        showToast('Analyse wurde erfolgreich gelöscht.', 'success');
    };

    // Cancel
    if (btnCancel) btnCancel.onclick = () => {
        modal.style.display = 'none';
    };

    if (btnClose) btnClose.onclick = () => {
        modal.style.display = 'none';
    };
}
