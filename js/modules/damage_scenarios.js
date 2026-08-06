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
  ).map((ds) => ds.id)
);

function _t(k) {
  return typeof t === 'function' ? t(k) : k;
}
function _loc(obj, field, fallback) {
  if (typeof getLocalizedField === 'function') {
    if (fallback === 'raw') return getLocalizedField(obj, field, undefined, { raw: true });
    return getLocalizedField(obj, field, undefined, { fallback: fallback === true });
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
    analysis.damageScenarios.forEach((ds) => {
      if (ds && ds.id && !DEFAULT_DS_IDS.has(ds.id)) {
        dsList.push(ds);
      }
    });
  }

  dsList.sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
  );

  let html = `<h4>${_t('ds.defined')}</h4>`;
  html += `<p class="muted-hint" style="font-size: 0.9em;">${_t('ds.hint')}</p>`;
  html += '<ul class="ds-list">';

  dsList.forEach((ds) => {
    const isDefault = DEFAULT_DS_IDS.has(ds.id);
    const eId = escapeHtml(ds.id);
    // Standard-DS nicht editierbar → kein Paren-Fallback, plain EN/DE
    const name = _loc(ds, 'name', isDefault);
    const short = _loc(ds, 'short', isDefault) || ds.short || '';
    const desc = _loc(ds, 'description', isDefault);
    const eName =
      typeof localizeParenHtml === 'function' ? localizeParenHtml(name) : escapeHtml(name);
    const shortHtml = /^\([\s\S]*\)$/.test(String(short).trim())
      ? typeof localizeParenHtml === 'function'
        ? localizeParenHtml(short)
        : escapeHtml(short)
      : `(${escapeHtml(short)})`;
    const eDesc = desc
      ? typeof localizeParenHtml === 'function'
        ? localizeParenHtml(desc)
        : escapeHtml(desc)
      : _t('ds.noDesc');

    html += `<li data-id="${eId}">
            <div class="ds-header-row">
                <div style="flex-grow: 1;">
                    <div class="ds-col-id-name">
                        <strong>${eId}:</strong> ${eName}
                    </div>
                    <div class="ds-subtitle-row">
                        ${shortHtml}
                        ${isDefault ? `<span style="color: #2ecc71; margin-left: 5px; font-weight:600;">${_t('ds.standard')}</span>` : ''}
                    </div>
                </div>
                ${
                  isDefault
                    ? ''
                    : `
                <div class="ds-actions">
                    <button type="button" onclick="editDamageScenario('${eId}')" class="action-button small">${_t('btn.edit')}</button>
                    <button type="button" onclick="removeDamageScenario('${eId}')" class="action-button small dangerous">${_t('btn.delete')}</button>
                </div>`
                }
            </div>
            <div class="ds-col-description">${eDesc}</div>
        </li>`;
  });

  html += '</ul>';
  dsManagementContainer.innerHTML = html;
}

window.saveDamageScenario = function (e) {
  if (e) e.preventDefault();
  const analysis = getActiveAnalysis();
  if (!analysis) return;

  const dsId = document.getElementById('dsIdField').value;
  const nameVal = document.getElementById('dsName').value.trim();
  const shortVal = document.getElementById('dsShort').value.trim();
  const descriptionVal = document.getElementById('dsDescription').value.trim();

  if (!nameVal || !shortVal) {
    showToast(_t('toast.needName'), 'warning');
    return;
  }

  if (!analysis.damageScenarios) analysis.damageScenarios = [];

  if (dsId) {
    const index = analysis.damageScenarios.findIndex((ds) => ds.id === dsId);
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
      showToast(
        typeof tf === 'function' ? tf('toast.dsOk', { id: dsId }) : `DS ${dsId} OK`,
        'success'
      );
    }
  } else {
    const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...analysis.damageScenarios];
    const existingIds = allDS
      .map((ds) => parseInt(ds.id.replace('DS', '')))
      .filter((n) => !isNaN(n));
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
    showToast(
      typeof tf === 'function' ? tf('toast.dsOk', { id: newId }) : `DS ${newId} OK`,
      'success'
    );
  }

  saveAnalyses();
  renderDamageScenarios();
  renderImpactMatrix();
  if (damageScenarioModal) damageScenarioModal.style.display = 'none';
};

window.editDamageScenario = function (dsId) {
  if (DEFAULT_DS_IDS.has(dsId)) {
    showToast(
      typeof t === 'function'
        ? t('toast.dsStandard')
        : 'Standard-Szenarien können nicht bearbeitet werden.',
      'warning'
    );
    return;
  }

  if (!activeAnalysisId) return;
  const analysis = getActiveAnalysis();
  if (!analysis) return;

  let ds = analysis.damageScenarios ? analysis.damageScenarios.find((d) => d.id === dsId) : null;
  if (!ds) ds = DEFAULT_DAMAGE_SCENARIOS.find((d) => d.id === dsId);
  if (!ds) return;

  const titleEl = document.getElementById('dsModalTitle');
  const idField = document.getElementById('dsIdField');
  if (titleEl) {
    titleEl.textContent =
      typeof tf === 'function' ? tf('ds.modal.edit', { id: ds.id }) : `DS ${ds.id}`;
  }
  if (idField) idField.value = ds.id;

  document.getElementById('dsName').value = _loc(ds, 'name', 'raw');
  document.getElementById('dsShort').value = _loc(ds, 'short', 'raw') || '';
  document.getElementById('dsDescription').value = _loc(ds, 'description', 'raw');
  const nameEl = document.getElementById('dsName');
  const shortEl = document.getElementById('dsShort');
  const descEl = document.getElementById('dsDescription');
  if (typeof syncLocalizedInputHint === 'function') {
    syncLocalizedInputHint(nameEl, ds, 'name', '');
    syncLocalizedInputHint(shortEl, ds, 'short', '');
    syncLocalizedInputHint(descEl, ds, 'description', '');
  } else {
    const lang = (window.TaraPrefs && TaraPrefs.getLang()) || 'de';
    if (lang === 'en') {
      const deN =
        typeof getPrimaryField === 'function' ? getPrimaryField(ds, 'name') : ds.name || '';
      const deS =
        typeof getPrimaryField === 'function' ? getPrimaryField(ds, 'short') : ds.short || '';
      const deD =
        typeof getPrimaryField === 'function'
          ? getPrimaryField(ds, 'description')
          : ds.description || '';
      nameEl.placeholder = deN ? `(${deN})` : '';
      shortEl.placeholder = deS ? `(${deS})` : '';
      descEl.placeholder = deD ? `(${deD})` : '';
    } else {
      nameEl.placeholder = '';
      shortEl.placeholder = '';
      descEl.placeholder = '';
    }
  }

  if (damageScenarioModal) damageScenarioModal.style.display = 'block';
};

window.removeDamageScenario = function (dsId) {
  if (DEFAULT_DS_IDS.has(dsId)) {
    showToast(
      typeof t === 'function'
        ? t('toast.dsStandard')
        : 'Standard-Szenarien können nicht bearbeitet werden.',
      'warning'
    );
    return;
  }

  const analysis = getActiveAnalysis();
  if (!analysis) return;

  const ds = (analysis.damageScenarios || []).find((d) => d.id === dsId);
  if (!ds) return;

  const displayName = _loc(ds, 'name', true) || ds.name || dsId;
  showConfirmation({
    title: _t('ds.delete.title'),
    messageHtml:
      typeof tf === 'function'
        ? tf('ds.delete.message', { name: escapeHtml(displayName), id: escapeHtml(dsId) })
        : `<b>${escapeHtml(displayName)} (${escapeHtml(dsId)})</b>`,
    confirmText: _t('confirm.delete'),
    onConfirm: () => {
      analysis.damageScenarios = analysis.damageScenarios.filter((d) => d.id !== dsId);

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
      showToast(
        typeof tf === 'function' ? tf('toast.dsOk', { id: dsId }) : `DS ${dsId} OK`,
        'success'
      );
    },
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
    if (titleEl) titleEl.textContent = _t('ds.modal.title');
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

/** Persist open DS form into language slot before DE/EN switch. */
window.flushDsModalLang = function (lang) {
  const analysis = typeof getActiveAnalysis === 'function' ? getActiveAnalysis() : null;
  if (!analysis) return;
  const id = document.getElementById('dsIdField')?.value;
  if (!id || (typeof DEFAULT_DS_IDS !== 'undefined' && DEFAULT_DS_IDS.has(id))) return;
  const ds = (analysis.damageScenarios || []).find((d) => d.id === id);
  if (!ds) return;
  const nameVal = document.getElementById('dsName')?.value ?? '';
  const shortVal = document.getElementById('dsShort')?.value ?? '';
  const descriptionVal = document.getElementById('dsDescription')?.value ?? '';
  if (typeof setLocalizedField === 'function') {
    setLocalizedField(ds, 'name', nameVal, lang);
    setLocalizedField(ds, 'short', shortVal, lang);
    setLocalizedField(ds, 'description', descriptionVal, lang);
  }
  try {
    if (typeof saveAnalyses === 'function') saveAnalyses();
  } catch (_) {}
};
