/**
 * @file        impact_matrix.js
 * @description Impact matrix rendering and color-coded assessment grid
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

// Explicit DOM reference (more robust than implicit window ID globals)
const dsMatrixContainer = document.getElementById('dsMatrixContainer');

/* global IMPACT_CSS_CLASSES, VALID_IMPACT_VALUES, IMPACT_LABELS */
function getImpactColorClass(val) {
    return (typeof IMPACT_CSS_CLASSES !== 'undefined' && IMPACT_CSS_CLASSES[val]) || '';
}

/**
 * Recalculates impact inheritance, worst-case KSTU and risk score
 * for every riskEntry in the given analysis.
 * Called whenever the impact matrix changes so that stored tree data
 * stays in sync without requiring the user to open & save each tree.
 */
function _recalcAllRiskEntries(analysis) {
    if (!analysis || !Array.isArray(analysis.riskEntries) || analysis.riskEntries.length === 0) return;

    let changed = false;
    analysis.riskEntries.forEach(entry => {
        try {
            if (typeof applyImpactInheritance === 'function') applyImpactInheritance(entry, analysis);
            if (typeof applyWorstCaseInheritance === 'function') applyWorstCaseInheritance(entry);
            const newRisk = _computeRiskScore(entry.kstu, entry.i_norm).toFixed(2);
            if (entry.rootRiskValue !== newRisk) {
                entry.rootRiskValue = newRisk;
                changed = true;
            }
        } catch (e) {
            console.warn('[ImpactMatrix] recalc riskEntry', entry.id, e.message || e);
        }
    });

    if (changed) saveAnalyses();
}

window.updateImpactScore = function(assetId, dsId, newValue, selectElement) {
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    // Validate input
    if (!VALID_IMPACT_VALUES.includes(newValue)) {
        showToast(`Ungültiger Impact-Wert: ${newValue}`, 'warning');
        return;
    }
    
    if (!analysis.impactMatrix) analysis.impactMatrix = {};
    if (!analysis.impactMatrix[assetId]) {
        analysis.impactMatrix[assetId] = {};
    }
    
    analysis.impactMatrix[assetId][dsId] = newValue;
    
    // Update color live
    if (selectElement) {
        selectElement.className = 'impact-select ' + getImpactColorClass(newValue);
    }

    saveAnalyses();
    
    // Recalculate all attack trees (impact depends on matrix values)
    _recalcAllRiskEntries(analysis);
    
    showToast(`Impact für ${escapeHtml(assetId)}/${escapeHtml(dsId)} auf ${escapeHtml(newValue)} gesetzt.`, 'info');
    
    const riskTab = document.getElementById('tabRiskAnalysis');
    if (riskTab && riskTab.classList.contains('active')) {
         if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis();
    }
};

function renderImpactMatrix() {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    if (!dsMatrixContainer) return;

    if (!analysis.assets || analysis.assets.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte legen Sie zuerst Assets im Reiter "Assets" an.</p>';
        return;
    }

    let displayDS = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
    const defaultIds = new Set(displayDS.map(d => d.id));
    
    if (analysis.damageScenarios) {
        analysis.damageScenarios.forEach(ds => {
            if (!defaultIds.has(ds.id)) displayDS.push(ds);
        });
    }
    displayDS.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    if (displayDS.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte definieren Sie zuerst Schadensszenarien.</p>';
        return;
    }
    
    let html = '<h4>Schadensauswirkungsmatrix (Assets vs. Damage Scenarios)</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Bewerten Sie die Auswirkung (Impact) jedes Schadensszenarios auf jedes Asset (1=Low, 3=High, N/A=Nicht anwendbar).</p>';
    html += '<div style="overflow-x: auto;"><table class="impact-matrix-table">';
    
    html += '<thead><tr>';
    html += '<th class="asset-col">Asset (ID: Name)</th>';
    
    displayDS.forEach(ds => {
        const eDsName = escapeHtml(ds.name);
        const eDsDesc = escapeHtml(ds.description);
        const eDsId = escapeHtml(ds.id);
        const eDsShort = escapeHtml(ds.short);
        html += `<th class="ds-col" title="${eDsName}: ${eDsDesc}">
            <div class="vertical-text">${eDsId} (${eDsShort})</div>
        </th>`;
    });
    
    html += '</tr></thead>';
    html += '<tbody>';
    
    if (!analysis.impactMatrix) analysis.impactMatrix = {};

    analysis.assets.forEach(asset => {
        if (!analysis.impactMatrix[asset.id]) {
            analysis.impactMatrix[asset.id] = {};
        }

        const eAssetId = escapeHtml(asset.id);
        const eAssetName = escapeHtml(asset.name);

        html += '<tr>';
        html += `<td class="asset-col"><strong>${eAssetId}: ${eAssetName}</strong></td>`;
        
        displayDS.forEach(ds => {
            const currentScore = analysis.impactMatrix[asset.id][ds.id] || 'N/A';
            const colorClass = getImpactColorClass(currentScore);
            const hasComment = analysis.impactComments
                && analysis.impactComments[asset.id]
                && analysis.impactComments[asset.id][ds.id];
            const commentIconClass = hasComment ? 'impact-comment-btn has-comment' : 'impact-comment-btn';
            const commentTooltip = hasComment ? 'Kommentar bearbeiten' : 'Kommentar hinzufügen';
            
            html += '<td class="score-cell">';
            html += '<div class="impact-cell-wrap">';
            // Build <option> tags dynamically from config
            const optionsHtml = VALID_IMPACT_VALUES.map(v => {
                const lbl = IMPACT_LABELS[v] || v;
                const display = (v === lbl) ? v : `${v} (${lbl})`;
                const sel = (currentScore === v) ? ' selected' : '';
                return `<option value="${escapeHtml(v)}"${sel}>${escapeHtml(display)}</option>`;
            }).join('\n                ');
            html += `<select 
                data-asset-id="${eAssetId}" 
                data-ds-id="${escapeHtml(ds.id)}" 
                onchange="updateImpactScore('${eAssetId}', '${escapeHtml(ds.id)}', this.value, this)"
                class="impact-select ${colorClass}">
                ${optionsHtml}
            </select>`;
            html += `<button type="button" class="${commentIconClass}" title="${commentTooltip}" onclick="openImpactComment('${eAssetId}', '${escapeHtml(ds.id)}')"><i class="fas fa-sticky-note"></i></button>`;
            html += '</div>';
            html += '</td>';
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    dsMatrixContainer.innerHTML = html;
}

window.openImpactComment = function(assetId, dsId) {
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    const modal = document.getElementById('impactCommentModal');
    const titleEl = document.getElementById('impactCommentTitle');
    const textEl = document.getElementById('impactCommentText');
    const assetField = document.getElementById('impactCommentAssetId');
    const dsField = document.getElementById('impactCommentDsId');
    if (!modal || !textEl) return;

    const existing = (analysis.impactComments && analysis.impactComments[assetId])
        ? (analysis.impactComments[assetId][dsId] || '')
        : '';

    if (titleEl) titleEl.textContent = `Kommentar – ${assetId} / ${dsId}`;
    textEl.value = existing;
    if (assetField) assetField.value = assetId;
    if (dsField) dsField.value = dsId;

    modal.style.display = 'block';
    textEl.focus();
};

window.saveImpactComment = function() {
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    const modal = document.getElementById('impactCommentModal');
    const textEl = document.getElementById('impactCommentText');
    const assetId = document.getElementById('impactCommentAssetId')?.value;
    const dsId = document.getElementById('impactCommentDsId')?.value;
    if (!assetId || !dsId) return;

    if (!analysis.impactComments) analysis.impactComments = {};
    if (!analysis.impactComments[assetId]) analysis.impactComments[assetId] = {};

    const comment = (textEl ? textEl.value : '').trim();
    if (comment) {
        analysis.impactComments[assetId][dsId] = comment;
    } else {
        delete analysis.impactComments[assetId][dsId];
        if (Object.keys(analysis.impactComments[assetId]).length === 0) {
            delete analysis.impactComments[assetId];
        }
    }

    saveAnalyses();
    if (modal) modal.style.display = 'none';
    renderImpactMatrix();
    showToast('Kommentar gespeichert.', 'success');
};