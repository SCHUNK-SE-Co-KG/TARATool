// =============================================================
// --- RISK ANALYSIS & ATTACK TREE LOGIC ---
// =============================================================

function renderRiskAnalysis() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!riskAnalysisContainer) return; 

    if (!analysis.assets || analysis.assets.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Assets</h4>
                <p>Es wurden noch keine Schutzobjekte (Assets) im Reiter "Assets" erfasst.</p>
            </div>
        `;
        return;
    }

    const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...(analysis.damageScenarios || [])];
    if (allDS.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Schadensszenarien</h4>
                <p>Bitte definieren Sie zuerst Schadensszenarien.</p>
            </div>
        `;
        return;
    }
    
    riskAnalysisContainer.innerHTML = `
        <div class="success-box" style="margin-bottom:20px;">
            <div style="display:flex; gap:10px;">
                <button id="btnOpenAttackTreeModal" class="primary-button large"><i class="fas fa-sitemap"></i> Neuen Angriffsbaum erstellen</button>
                <button onclick="downloadDotFile()" class="action-button large"><i class="fas fa-file-export"></i> Export (.dot)</button>
            </div>
        </div>
        <div id="existingRiskEntriesContainer">
            ${renderExistingRiskEntries(analysis)}
        </div>
    `;

    const btn = document.getElementById('btnOpenAttackTreeModal');
    if (btn) btn.onclick = () => openAttackTreeModal(); 
}

function renderExistingRiskEntries(analysis) {
    if (!analysis.riskEntries || analysis.riskEntries.length === 0) {
        return '<p style="color: #7f8c8d;">Noch keine Angriffs-Bäume angelegt.</p>';
    }

    let html = '<h4>Gespeicherte Angriffsbäume:</h4><ul style="list-style:none; padding:0;">';
    analysis.riskEntries.forEach(entry => {
        const rootRisk = entry.rootRiskValue || '-';
        
        // Calculate risk class and label
        let rColor = '#7f8c8d';
        let rLabel = 'Unbekannt';

        const rVal = parseFloat(rootRisk);
        if(!isNaN(rVal)) {
            if(rVal >= 2.0) {
                rColor = '#c0392b';
                rLabel = 'Kritisch';
            } else if(rVal >= 1.6) {
                rColor = '#e67e22';
                rLabel = 'Hoch';
            } else if(rVal >= 0.8) {
                rColor = '#f39c12';
                rLabel = 'Mittel';
            } else {
                rColor = '#27ae60';
                rLabel = 'Niedrig';
            }
        }

        html += `
            <li style="background:#fff; border:1px solid #ddd; padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border-left: 5px solid ${rColor};">
                <div>
                    <strong>${entry.id}</strong>: ${entry.rootName} <br> 
                    <span style="color:#666; font-size:0.9em;">
                        Risk Score (R): <b style="color:${rColor}">${rootRisk}</b> 
                        <span style="margin-left:5px; padding:2px 6px; border-radius:3px; background:${rColor}; color:#fff; font-size:0.8em;">${rLabel}</span>
                    </span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="editAttackTree('${entry.id}')" class="action-button small">
                        <i class="fas fa-edit"></i> Bearbeiten
                    </button>
                    <button onclick="deleteAttackTree('${entry.id}')" class="action-button small dangerous">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

window.editAttackTree = function(riskId) {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;
    openAttackTreeModal(entry);
};

function reindexRiskIDs(analysis) {
    if (!analysis || !analysis.riskEntries) return;
    analysis.riskEntries.forEach((entry, index) => {
        const newId = 'R' + (index + 1).toString().padStart(2, '0');
        entry.id = newId;
    });
}

window.deleteAttackTree = function(riskId) {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis || !analysis.riskEntries) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    // FIX: Fetch DOM elements explicitly (ReferenceError fix)
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationTitle');
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');

    if(title) title.textContent = 'Angriffsbaum löschen';
    msg.innerHTML = `Möchten Sie den Angriffsbaum <b>${entry.id}: ${entry.rootName}</b> wirklich löschen?`;

    btnConfirm.textContent = 'Löschen';
    btnConfirm.className = 'primary-button dangerous';

    modal.style.display = 'block';

    // Clear events
    btnConfirm.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;

    btnConfirm.onclick = () => {
        analysis.riskEntries = analysis.riskEntries.filter(r => r.id !== riskId);
        reindexRiskIDs(analysis);

        // Update residual risk structure (separate data management)
        try {
            if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
                syncResidualRiskFromRiskAnalysis(analysis, false);
            }
        } catch (e) {}
        saveAnalyses();
        
        // Close modal and AttackTree modal if open
        if (typeof attackTreeModal !== 'undefined' && attackTreeModal) attackTreeModal.style.display = 'none';
        modal.style.display = 'none';
        
        renderRiskAnalysis();
        showToast(`Angriffsbaum gelöscht.`, 'success');
    };

    const closeFn = () => { modal.style.display = 'none'; };
    btnCancel.onclick = closeFn;
    btnClose.onclick = closeFn;
};

// UI HELPER: TOGGLE DEPTH
