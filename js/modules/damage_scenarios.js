/**
 * @file        damage_scenarios.js
 * @description Damage scenario management – CRUD, modal forms, and UI wiring
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

const dsManagementContainer = document.getElementById('dsManagementContainer');
const btnAddDamageScenario = document.getElementById('btnAddDamageScenario');
const damageScenarioModal = document.getElementById('damageScenarioModal');
const closeDamageScenarioModal = document.getElementById('closeDamageScenarioModal');
const damageScenarioForm = document.getElementById('damageScenarioForm');

const DEFAULT_DS_IDS = new Set(
    (typeof DEFAULT_DAMAGE_SCENARIOS !== 'undefined' && Array.isArray(DEFAULT_DAMAGE_SCENARIOS)
        ? DEFAULT_DAMAGE_SCENARIOS
        : []
    ).map(ds => ds.id)
);

function _t(k) { return (typeof t === 'function') ? t(k) : k; }
function _loc(obj, field, fallback) {
    if (typeof getLocalizedField === 'function') {
        return getLocalizedField(obj, field, undefined, { fallback: !!fallback });
    }
    return obj?.[field] != null ? String(obj[field]) : '';
}

function renderDamageScenarios() {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    if (!dsManagementContainer) return;

    let dsList = [];

    if (DEFAULT_DAMAGE_SCENARIOS && DEFAULT_DAMAGE_SCENARIOS.length > 0) {
        dsList = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
    }

    if (analysis.damageScenarios && Array.isArray(analysis.damageScenarios)) {
        analysis.damageScenarios.forEach(ds => {
            if (ds && ds.id && !DEFAULT_DS_IDS.has(ds.id)) {
                dsList.push(ds);
            }
        });
    }

    dsList.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    let html = `<h4>${_t('ds.defined')}</h4>`;
    html += `<p class="muted-hint" style="font-size: 0.9em;">${_t('ds.hint')}</p>`;
    html += '<ul class="ds-list">';

    dsList.forEach(ds => {
        const isDefault = DEFAULT_DS_IDS.has(ds.id);
        const eId = escapeHtml(ds.id);
        const name = _loc(ds, 'name');
        const short = _loc(ds, 'short') || (ds.short || '');
        const desc = _loc(ds, 'description');
        const eName = escapeHtml(name);
        const eShort = escapeHtml(short);
        const eDesc = desc ? escapeHtml(desc) : _t('ds.noDesc');

        html += `<li data-id="${eId}">
            <div class="ds-header-row">
                <div style="flex-grow: 1;">
                    <div class="ds-col-id-name">
                        <strong>${eId}:</strong> ${eName}
                    </div>
                    <div class="ds-subtitle-row">
                        (${eShort})
                        ${isDefault ? `<span style="color: #2ecc71; margin-left: 5px; font-weight:600;">${_t('ds.standard')}</span>` : ''}
                    </div>
                </div>
                ${isDefault ? '' : `
                <div class="ds-actions">
                    <button type="button" onclick="editDamageScenario('${eId}')" class="action-button small">${_t('btn.edit')}</button>
                    <button type="button" onclick="removeDamageScenario('${eId}')" class="action-button small dangerous">${_t('btn.delete')}</button>
                </div>`}
            </div>
            <div class="ds-col-description">${eDesc}</div>
        </li>`;
    });

    html += '</ul>';
    dsManagementContainer.innerHTML = html;
}

window.saveDamageScenario = function(e) {
    if (e) e.preventDefault();
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    const dsId = document.getElementById('dsIdField').value;
    const nameVal = document.getElementById('dsName').value.trim();
    const shortVal = document.getElementById('dsShort').value.trim();
    const descriptionVal = document.getElementById('dsDescription').value.trim();

    if (!nameVal || !shortVal) {
        showToast(_t('assets.empty'), 'warning');
        return;
    }

    if (!analysis.damageScenarios) analysis.damageScenarios = [];

    if (dsId) {
        const index = analysis.damageScenarios.findIndex(ds => ds.id === dsId);
        if (index !== -1) {
            const updated = { ...analysis.damageScenarios[index], id: dsId };
            if (typeof setLocalizedField === 'function') {
                setLocalizedField(updated, 'name', nameVal);
                setLocalizedField(updated, 'short', shortVal);
                setLocalizedField(updated, 'description', descriptionVal);
            } else {
                updated.name = nameVal;
                updated.short = shortVal;
                updated.description = descriptionVal;
            }
            analysis.damageScenarios[index] = updated;
            showToast(`DS ${dsId} OK`, 'success');
        }
    } else {
        const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...analysis.damageScenarios];
        const existingIds = allDS.map(ds => parseInt(ds.id.replace('DS', ''))).filter(n => !isNaN(n));
        const newIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newId = 'DS' + newIndex;
        const created = { id: newId, name: '', short: '', description: '' };
        if (typeof setLocalizedField === 'function') {
            setLocalizedField(created, 'name', nameVal);
            setLocalizedField(created, 'short', shortVal);
            setLocalizedField(created, 'description', descriptionVal);
        } else {
            created.name = nameVal;
            created.short = shortVal;
            created.description = descriptionVal;
        }
        analysis.damageScenarios.push(created);
        showToast(`DS ${newId} OK`, 'success');
    }

    saveAnalyses();
    renderDamageScenarios();
    renderImpactMatrix();
    if (damageScenarioModal) damageScenarioModal.style.display = 'none';
};

window.editDamageScenario = function(dsId) {
    if (DEFAULT_DS_IDS.has(dsId)) {
        showToast('Standard', 'warning');
        return;
    }

    if (!activeAnalysisId) return;
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    let ds = analysis.damageScenarios ? analysis.damageScenarios.find(d => d.id === dsId) : null;
    if (!ds) ds = DEFAULT_DAMAGE_SCENARIOS.find(d => d.id === dsId);
    if (!ds) return;

    const titleEl = document.getElementById('dsModalTitle');
    const idField = document.getElementById('dsIdField');
    if (titleEl) titleEl.textContent = `DS ${ds.id}`;
    if (idField) idField.value = ds.id;

    document.getElementById('dsName').value = _loc(ds, 'name');
    document.getElementById('dsShort').value = _loc(ds, 'short') || (ds.short || '');
    document.getElementById('dsDescription').value = _loc(ds, 'description');

    if (damageScenarioModal) damageScenarioModal.style.display = 'block';
};

window.removeDamageScenario = function(dsId) {
    if (DEFAULT_DS_IDS.has(dsId)) {
        showToast('Standard', 'warning');
        return;
    }

    const analysis = getActiveAnalysis();
    if (!analysis) return;

    const ds = (analysis.damageScenarios || []).find(d => d.id === dsId);
    if (!ds) return;

    const displayName = _loc(ds, 'name', true) || ds.name || dsId;
    showConfirmation({
        title: _t('btn.delete'),
        messageHtml: `<b>${escapeHtml(displayName)} (${escapeHtml(dsId)})</b>`,
        confirmText: _t('btn.delete'),
        onConfirm: () => {
            analysis.damageScenarios = analysis.damageScenarios.filter(d => d.id !== dsId);

            if (analysis.impactMatrix) {
                for (const assetId in analysis.impactMatrix) {
                    delete analysis.impactMatrix[assetId][dsId];
                }
            }

            if (analysis.impactComments) {
                for (const assetId in analysis.impactComments) {
                    delete analysis.impactComments[assetId][dsId];
                    if (Object.keys(analysis.impactComments[assetId]).length === 0) {
                        delete analysis.impactComments[assetId];
                    }
                }
            }

            if (typeof purgeDamageScenarioFromRiskEntries === 'function') {
                purgeDamageScenarioFromRiskEntries(analysis, dsId);
            }

            saveAnalyses();
            renderDamageScenarios();
            renderImpactMatrix();
            showToast(`DS ${dsId} OK`, 'success');
        }
    });
};

if (damageScenarioForm) {
    damageScenarioForm.onsubmit = window.saveDamageScenario;
}

if (btnAddDamageScenario) {
    btnAddDamageScenario.onclick = () => {
        if (!activeAnalysisId) {
            showToast(_t('toast.noAnalysis'), 'warning');
            return;
        }
        const titleEl = document.getElementById('dsModalTitle');
        const idField = document.getElementById('dsIdField');
        if (titleEl) titleEl.textContent = _t('btn.addDs');
        if (idField) idField.value = '';
        if (damageScenarioForm) damageScenarioForm.reset();
        const desc = document.getElementById('dsDescription');
        if (desc) desc.value = '';
        if (damageScenarioModal) damageScenarioModal.style.display = 'block';
    };
}

if (closeDamageScenarioModal) {
    closeDamageScenarioModal.onclick = () => {
        if (damageScenarioModal) damageScenarioModal.style.display = 'none';
    };
}
