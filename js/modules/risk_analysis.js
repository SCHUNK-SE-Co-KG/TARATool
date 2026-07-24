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

    const _t = (k) => (typeof t === 'function' ? t(k) : k);

    if (!analysis.assets || analysis.assets.length === 0) {
        riskAnalysisContainerEl.innerHTML = `
            <div class="warning-box">
                <h4>${_t('risk.missingAssets')}</h4>
                <p>${_t('risk.missingAssetsHint')}</p>
            </div>
        `;
        return;
    }

    const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...(analysis.damageScenarios || [])];
    if (allDS.length === 0) {
        riskAnalysisContainerEl.innerHTML = `
            <div class="warning-box">
                <h4>${_t('risk.missingDs')}</h4>
                <p>${_t('risk.missingDsHint')}</p>
            </div>
        `;
        return;
    }

    riskAnalysisContainerEl.innerHTML = `
        <div class="success-box" style="margin-bottom:20px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button id="btnOpenAttackTreeModal" class="primary-button large"><i class="fas fa-sitemap"></i> ${_t('btn.createTree')}</button>
                <button onclick="downloadDotFile()" class="action-button large"><i class="fas fa-file-export"></i> ${_t('btn.exportDot')}</button>
            </div>
        </div>
        <div id="rootOverviewContainer">
            ${renderRootOverview(analysis)}
        </div>
        <div id="existingRiskEntriesContainer">
            ${renderExistingRiskEntries(analysis)}
        </div>
    `;

    const btn = document.getElementById('btnOpenAttackTreeModal');
    if (btn) btn.onclick = () => { if (typeof openAttackTreeModal === 'function') openAttackTreeModal(); };
}

/* ── Root-Node-Overview Panel ──────────────────────────────────────── */

function renderRootOverview(analysis) {
    if (!analysis.riskEntries || analysis.riskEntries.length === 0) return '';

    const _t = (k) => (typeof t === 'function' ? t(k) : k);
    const _rl = (lbl) => (typeof tRiskLabel === 'function' ? tRiskLabel(lbl) : lbl);

    const fmt = (val) => {
        if (val === null || val === undefined || val === '') return '0,0';
        return String(val).replace('.', ',');
    };

    const pStr = (kstu) => {
        if (!kstu) return '- / - / - / -';
        return `${fmt(kstu.k)} / ${fmt(kstu.s)} / ${fmt(kstu.t)} / ${fmt(kstu.u)}`;
    };

    const sorted = [...analysis.riskEntries].sort((a, b) => {
        const ra = parseFloat(a.rootRiskValue) || 0;
        const rb = parseFloat(b.rootRiskValue) || 0;
        return rb - ra;
    });

    let html = `<h4>${_t('risk.rootOverview')}</h4>`;
    html += '<div class="root-overview-grid">';

    sorted.forEach(entry => {
        const kstu = entry.kstu || {};
        const iNorm = entry.i_norm;
        const rScore = computeRiskScore(iNorm, kstu);
        const meta = getRiskMeta(entry.rootRiskValue);
        const fill = rScore >= 2.0 ? '#ffcccc'
                   : rScore >= 1.6 ? '#ffe0b3'
                   : rScore >= 0.8 ? '#ffffcc'
                   : '#ccffcc';

        html += `
            <div class="root-overview-card" style="background:${fill}; border:1px solid #999;">
                <div class="root-overview-title">${escapeHtml(entry.rootName || entry.id)}</div>
                <div class="root-overview-row">P = ${escapeHtml(pStr(kstu))}</div>
                <div class="root-overview-row">I[norm] = ${escapeHtml(fmt(iNorm))}</div>
                <div class="root-overview-row root-overview-risk">R = ${escapeHtml(fmt(rScore.toFixed(2)))}
                    <span class="root-overview-badge" style="background:${meta.color}; color:#fff;">${escapeHtml(_rl(meta.label))}</span>
                </div>
            </div>`;
    });

    html += '</div>';
    return html;
}

function renderExistingRiskEntries(analysis) {
    const _t = (k) => (typeof t === 'function' ? t(k) : k);
    const _rl = (lbl) => (typeof tRiskLabel === 'function' ? tRiskLabel(lbl) : lbl);

    if (!analysis.riskEntries || analysis.riskEntries.length === 0) {
        return `<p class="muted-hint">${_t('risk.none')}</p>`;
    }

    let html = `<h4>${_t('risk.savedTrees')}</h4><ul class="entry-list">`;
    analysis.riskEntries.forEach(entry => {
        const meta = getRiskMeta(entry.rootRiskValue);
        const eId = escapeHtml(entry.id);
        const eName = escapeHtml(entry.rootName);
        const hasNotes = (entry.notes || '').trim().length > 0;

        html += `
            <li class="entry-list-item" style="border-left-color:${meta.color};">
                <div>
                    <strong>${eId}</strong>: ${eName} <br>
                    <span class="entry-list-meta">
                        ${_t('risk.score')} <b style="color:${meta.color}">${escapeHtml(meta.display)}</b>
                        <span class="root-overview-badge" style="margin-left:5px; background:${meta.color}; color:#fff;">${escapeHtml(_rl(meta.label))}</span>
                    </span>
                </div>
                <div class="entry-list-actions">
                    <button onclick="openTreeNotes('${eId}')" class="action-button small" title="${_t('risk.notes')}">
                        <i class="fas fa-sticky-note${hasNotes ? ' tree-note-active' : ''}"></i>
                    </button>
                    <button onclick="editAttackTree('${eId}')" class="action-button small">
                        <i class="fas fa-edit"></i> ${_t('btn.edit')}
                    </button>
                    <button onclick="deleteAttackTree('${eId}')" class="action-button small dangerous">
                        <i class="fas fa-trash"></i> ${_t('btn.delete')}
                    </button>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

/* ── Tree Notes ────────────────────────────────────────────────────── */

window.openTreeNotes = function(riskId) {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    const modal = document.getElementById('treeNotesModal');
    if (!modal) return;

    const notesLabel = (typeof t === 'function' ? t('risk.notes') : 'Notizen');
    document.getElementById('treeNotesTitle').textContent =
        notesLabel + ': ' + (entry.id || '') + ' – ' + (entry.rootName || '');
    document.getElementById('treeNotesText').value = entry.notes || '';
    modal.dataset.riskId = riskId;
    modal.style.display = 'block';
};

window.saveTreeNotes = function() {
    const modal = document.getElementById('treeNotesModal');
    if (!modal) return;
    const riskId = modal.dataset.riskId;
    const analysis = getActiveAnalysis();
    if (!analysis || !riskId) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    entry.notes = (document.getElementById('treeNotesText').value || '').trim();
    saveAnalyses();
    modal.style.display = 'none';

    renderRiskAnalysis();
    if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('risk.notes') : 'Notiz') + ' OK', 'success');
};

window.editAttackTree = function(riskId) {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;
    if (typeof openAttackTreeModal === 'function') openAttackTreeModal(entry);
};

function reindexRiskIDs(analysis) {
    if (!analysis || !analysis.riskEntries) return;
    const idMap = {};
    analysis.riskEntries.forEach((entry, index) => {
        const newId = 'R' + (index + 1).toString().padStart(2, '0');
        if (entry.id !== newId) idMap[entry.id] = newId;
        entry.id = newId;
    });
    if (analysis.securityGoals) {
        const validIds = new Set(analysis.riskEntries.map(e => e.id));
        analysis.securityGoals.forEach(sg => {
            if (Array.isArray(sg.rootRefs)) {
                sg.rootRefs = sg.rootRefs
                    .map(ref => idMap[ref] || ref)
                    .filter(ref => validIds.has(ref));
            }
        });
    }
}

window.deleteAttackTree = function(riskId) {
    const analysis = getActiveAnalysis();
    if (!analysis || !analysis.riskEntries) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    const delLabel = (typeof t === 'function' ? t('btn.delete') : 'Löschen');
    showConfirmation({
        title: delLabel,
        messageHtml: `<b>${escapeHtml(entry.id)}: ${escapeHtml(entry.rootName)}</b>`,
        confirmText: delLabel,
        onConfirm: () => {
            analysis.riskEntries = analysis.riskEntries.filter(r => r.id !== riskId);
            reindexRiskIDs(analysis);

            try {
                if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
                    syncResidualRiskFromRiskAnalysis(analysis, false);
                }
            } catch (e) {
                console.warn('[deleteAttackTree] Residual risk sync failed:', e);
            }
            saveAnalyses();

            const attackTreeModalEl = document.getElementById('attackTreeModal');
            if (attackTreeModalEl) attackTreeModalEl.style.display = 'none';

            renderRiskAnalysis();
            showToast(delLabel + ' OK', 'success');
        }
    });
};

