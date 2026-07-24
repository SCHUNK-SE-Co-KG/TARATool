/**
 * @file        assets.js
 * @description Asset management UI – CRUD operations and rendering
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

// Explicit DOM references (robust against implicit window ID globals)
const assetsCardContainerEl = document.getElementById('assetsCardContainer');
const assetFormEl            = document.getElementById('assetForm');
const assetModalEl           = document.getElementById('assetModal');
const assetModalTitleEl      = document.getElementById('assetModalTitle');
const closeAssetModalEl      = document.getElementById('closeAssetModal');
const btnAddAssetEl          = document.getElementById('btnAddAsset');

function renderAssets(analysis) {
    if (!assetsCardContainerEl) return;
    assetsCardContainerEl.innerHTML = '';
    const _t = (k) => (typeof t === 'function' ? t(k) : k);
    const _loc = (obj, field) => (typeof getLocalizedField === 'function' ? getLocalizedField(obj, field) : (obj?.[field] || ''));

    if (!analysis.assets || analysis.assets.length === 0) {
        assetsCardContainerEl.innerHTML = `<p class="muted-hint" style="grid-column: 1/-1; text-align: center;">${_t('assets.empty')}</p>`;
        return;
    }

    analysis.assets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        const name = _loc(asset, 'name');
        const descRaw = _loc(asset, 'description');
        const eName = escapeHtml(name);
        const eType = escapeHtml(asset.type || '-');
        const eDesc = descRaw
            ? escapeHtml(descRaw.substring(0, 100)) + (descRaw.length > 100 ? '...' : '')
            : _t('assets.noDesc');
        const eId = escapeHtml(asset.id);

        card.innerHTML = `
            <div class="asset-card-header">${eId}: ${eName}</div>
            <div class="asset-description-area">
                <strong>${_t('assets.type')}</strong> ${eType}<br><br>
                ${eDesc}
            </div>
            <div class="asset-cia-area">
                <div style="font-weight:600; font-size:0.8em; margin-bottom:2px; text-transform:uppercase; color:#999;">${_t('assets.schutz')}</div>
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                    <span title="Confidentiality">C: ${escapeHtml(asset.confidentiality || '-')}</span>
                    <span title="Integrity">I: ${escapeHtml(asset.integrity || '-')}</span>
                    <span title="Authenticity">A: ${escapeHtml(asset.authenticity || '-')}</span>
                </div>
            </div>
            <div class="asset-card-footer">
                <button onclick="editAsset('${eId}')" class="action-button small">${_t('btn.edit')}</button>
                <button onclick="removeAsset('${eId}')" class="action-button small dangerous">${_t('btn.delete')}</button>
            </div>
        `;
        assetsCardContainerEl.appendChild(card);
    });
}

function saveAsset(e) {
    e.preventDefault();
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    const idField = document.getElementById('assetIdField');
    const nameField = document.getElementById('assetName');
    const typeField = document.getElementById('assetType');
    const descField = document.getElementById('assetDescription');

    const assetId = idField.value;
    const name = nameField.value.trim();
    
    if (!name) {
        showToast((typeof t === 'function' ? t('assets.empty') : 'Name'), 'warning');
        return;
    }

    // Read CIA values
    const getRadioVal = (radioName) => {
        const el = document.querySelector(`input[name="${radioName}"]:checked`);
        return el ? el.value : '-';
    };
    
    const cia = {
        c: getRadioVal('confidentiality'),
        i: getRadioVal('integrity'),
        a: getRadioVal('authenticity') 
    };

    // Determine protection level (highest value)
    /* global PROTECTION_LEVEL_RANKING */
    const levels = (typeof PROTECTION_LEVEL_RANKING !== 'undefined')
        ? PROTECTION_LEVEL_RANKING
        : { '-': 0, 'I': 1, 'II': 2, 'III': 3 };
    const maxLevel = Math.max(levels[cia.c] || 0, levels[cia.i] || 0, levels[cia.a] || 0);
    let schutzbedarf = '-';
    if (maxLevel === 1) schutzbedarf = 'I';
    if (maxLevel === 2) schutzbedarf = 'II';
    if (maxLevel === 3) schutzbedarf = 'III';

    if (assetId) {
        // Edit
        const index = analysis.assets.findIndex(a => a.id === assetId);
        if (index !== -1) {
            const updated = {
                ...analysis.assets[index],
                type: typeField.value,
                confidentiality: cia.c,
                integrity: cia.i,
                authenticity: cia.a,
                schutzbedarf: schutzbedarf
            };
            if (typeof setLocalizedField === 'function') {
                setLocalizedField(updated, 'name', name);
                setLocalizedField(updated, 'description', descField.value);
            } else {
                updated.name = name;
                updated.description = descField.value;
            }
            analysis.assets[index] = updated;
            showToast(`Asset ${assetId} OK`, 'success');
        }
    } else {
        // New
        if (!analysis.assets) analysis.assets = [];
        const existingIds = analysis.assets.map(a => parseInt(a.id.replace('A', ''))).filter(n => !isNaN(n));
        const newIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newId = 'A' + newIndex.toString().padStart(2, '0');
        const created = {
            id: newId,
            name: '',
            type: typeField.value,
            description: '',
            confidentiality: cia.c,
            integrity: cia.i,
            authenticity: cia.a,
            schutzbedarf: schutzbedarf
        };
        if (typeof setLocalizedField === 'function') {
            setLocalizedField(created, 'name', name);
            setLocalizedField(created, 'description', descField.value);
        } else {
            created.name = name;
            created.description = descField.value;
        }
        analysis.assets.push(created);
        showToast(`Asset ${newId} OK`, 'success');
    }

    saveAnalyses();
    renderAssets(analysis);
    if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
    if (assetModalEl) assetModalEl.style.display = 'none';
}

window.editAsset = (id) => {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    const asset = analysis.assets.find(a => a.id === id);
    if (!asset) return;

    if (assetModalTitleEl) assetModalTitleEl.textContent = `Asset ${asset.id}`;
    document.getElementById('assetIdField').value = asset.id;
    document.getElementById('assetName').value = (typeof getLocalizedField === 'function') ? getLocalizedField(asset, 'name') : (asset.name || '');
    document.getElementById('assetType').value = asset.type || '';
    document.getElementById('assetDescription').value = (typeof getLocalizedField === 'function') ? getLocalizedField(asset, 'description') : (asset.description || '');

    // Set radio buttons
    const setRadio = (radioName, val) => {
        const els = document.querySelectorAll(`input[name="${radioName}"]`);
        els.forEach(el => {
            el.checked = (el.value === val);
        });
    };
    setRadio('confidentiality', asset.confidentiality);
    setRadio('integrity', asset.integrity);
    setRadio('authenticity', asset.authenticity);

    if (assetModalEl) assetModalEl.style.display = 'block';
};

/**
 * Renumbers all assets sequentially (A01, A02, ...) and remaps
 * impactMatrix keys to match the new IDs.
 */
function _renumberAssets(analysis) {
    if (!analysis.assets || analysis.assets.length === 0) return;

    const idMap = {};                       // oldId → newId
    analysis.assets.forEach((asset, i) => {
        const newId = 'A' + (i + 1).toString().padStart(2, '0');
        if (asset.id !== newId) {
            idMap[asset.id] = newId;
            asset.id = newId;
        }
    });

    // Nothing to remap
    if (Object.keys(idMap).length === 0) return;

    // Remap impactMatrix keys
    if (analysis.impactMatrix) {
        const newMatrix = {};
        for (const oldKey in analysis.impactMatrix) {
            const newKey = idMap[oldKey] || oldKey;
            newMatrix[newKey] = analysis.impactMatrix[oldKey];
        }
        analysis.impactMatrix = newMatrix;
    }

    // Remap impactComments keys
    if (analysis.impactComments) {
        const newComments = {};
        for (const oldKey in analysis.impactComments) {
            const newKey = idMap[oldKey] || oldKey;
            newComments[newKey] = analysis.impactComments[oldKey];
        }
        analysis.impactComments = newComments;
    }
}

window.removeAsset = (id) => {
    const analysis = getActiveAnalysis();
    if (!analysis) return;
    const asset = analysis.assets.find(a => a.id === id);
    if (!asset) return;

    showConfirmation({
        title: 'Asset löschen',
        messageHtml: `Möchten Sie das Asset <b>${escapeHtml(asset.name)} (${escapeHtml(asset.id)})</b> wirklich löschen?<br>Dies entfernt auch alle Einträge in der Impact-Matrix!`,
        confirmText: 'Löschen',
        onConfirm: () => {
            analysis.assets = analysis.assets.filter(a => a.id !== id);

            // Clean up impact matrix
            if (analysis.impactMatrix && analysis.impactMatrix[id]) {
                delete analysis.impactMatrix[id];
            }

            // Clean up impact comments
            if (analysis.impactComments && analysis.impactComments[id]) {
                delete analysis.impactComments[id];
            }

            // Renumber remaining assets (A01, A02, ...) and remap impactMatrix keys
            _renumberAssets(analysis);

            saveAnalyses();
            renderAssets(analysis);
            if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
            showToast(`Asset ${id} gelöscht.`, 'success');
        }
    });
};

if (assetFormEl) {
    assetFormEl.onsubmit = saveAsset;
}

if (btnAddAssetEl) {
    btnAddAssetEl.onclick = () => {
        if (!activeAnalysisId) {
            showToast('Bitte erst eine Analyse wählen/erstellen.', 'warning');
            return;
        }
        if (assetModalTitleEl) assetModalTitleEl.textContent = 'Neues Asset';
        if (assetFormEl) assetFormEl.reset();
        document.getElementById('assetIdField').value = '';
        if (assetModalEl) assetModalEl.style.display = 'block';
    };
}

if (closeAssetModalEl) {
    closeAssetModalEl.onclick = () => {
        if (assetModalEl) assetModalEl.style.display = 'none';
    };
}