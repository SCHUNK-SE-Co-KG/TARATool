/**
 * @file        risk_analysis.js
 * @description Risk analysis overview and attack tree card rendering
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

// Explicit DOM reference
const riskAnalysisContainerEl = document.getElementById('riskAnalysisContainer');

function renderRiskAnalysis() {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    if (!riskAnalysisContainerEl) return; 

    if (!analysis.assets || analysis.assets.length === 0) {
        riskAnalysisContainerEl.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Assets</h4>
                <p>Es wurden noch keine Schutzobjekte (Assets) im Reiter "Assets" erfasst.</p>
            </div>
        `;
        return;
    }

    const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...(analysis.damageScenarios || [])];
    if (allDS.length === 0) {
        riskAnalysisContainerEl.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Schadensszenarien</h4>
                <p>Bitte definieren Sie zuerst Schadensszenarien.</p>
            </div>
        `;
        return;
    }
    
    riskAnalysisContainerEl.innerHTML = `
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
        const meta = getRiskMeta(entry.rootRiskValue);
        const eId = escapeHtml(entry.id);
        const eName = escapeHtml(entry.rootName);

        html += `
            <li style="background:#fff; border:1px solid #ddd; padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border-left: 5px solid ${meta.color};">
                <div>
                    <strong>${eId}</strong>: ${eName} <br> 
                    <span style="color:#666; font-size:0.9em;">
                        Risk Score (R): <b style="color:${meta.color}">${escapeHtml(meta.display)}</b> 
                        <span style="margin-left:5px; padding:2px 6px; border-radius:3px; background:${meta.color}; color:#fff; font-size:0.8em;">${escapeHtml(meta.label)}</span>
                    </span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="editAttackTree('${eId}')" class="action-button small">
                        <i class="fas fa-edit"></i> Bearbeiten
                    </button>
                    <button onclick="deleteAttackTree('${eId}')" class="action-button small dangerous">
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
    const analysis = getActiveAnalysis();
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
    const analysis = getActiveAnalysis();
    if (!analysis || !analysis.riskEntries) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    showConfirmation({
        title: 'Angriffsbaum löschen',
        messageHtml: `Möchten Sie den Angriffsbaum <b>${escapeHtml(entry.id)}: ${escapeHtml(entry.rootName)}</b> wirklich löschen?`,
        confirmText: 'Löschen',
        onConfirm: () => {
            analysis.riskEntries = analysis.riskEntries.filter(r => r.id !== riskId);
            reindexRiskIDs(analysis);

            // Update residual risk structure (separate data management)
            try {
                if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
                    syncResidualRiskFromRiskAnalysis(analysis, false);
                }
            } catch (e) {
                console.warn('[deleteAttackTree] Residual risk sync failed:', e);
            }
            saveAnalyses();
            
            // Close AttackTree modal if open
            if (typeof attackTreeModal !== 'undefined' && attackTreeModal) attackTreeModal.style.display = 'none';
            
            renderRiskAnalysis();
            showToast('Angriffsbaum gelöscht.', 'success');
        }
    });
};