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

    if (!analysis.assets || analysis.assets.length === 0) {
        assetsCardContainerEl.innerHTML = '<p style="color: #7f8c8d; grid-column: 1/-1; text-align: center;">Noch keine Assets vorhanden. Klicken Sie auf "Asset hinzufügen".</p>';
        return;
    }

    analysis.assets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        const eName = escapeHtml(asset.name);
        const eType = escapeHtml(asset.type || '-');
        const eDesc = asset.description
            ? escapeHtml(asset.description.substring(0, 100)) + (asset.description.length > 100 ? '...' : '')
            : 'Keine Beschreibung';
        const eId = escapeHtml(asset.id);

        card.innerHTML = `
            <div class="asset-card-header">${eId}: ${eName}</div>
            <div class="asset-description-area">
                <strong>Typ:</strong> ${eType}<br><br>
                ${eDesc}
            </div>
            <div class="asset-cia-area">
                <div style="font-weight:600; font-size:0.8em; margin-bottom:2px; text-transform:uppercase; color:#999;">Schutzbedarf</div>
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                    <span title="Confidentiality">C: ${escapeHtml(asset.confidentiality || '-')}</span>
                    <span title="Integrity">I: ${escapeHtml(asset.integrity || '-')}</span>
                    <span title="Authenticity">A: ${escapeHtml(asset.authenticity || '-')}</span>
                </div>
            </div>
            <div class="asset-card-footer">
                <button onclick="editAsset('${eId}')" class="action-button small">Bearbeiten</button>
                <button onclick="removeAsset('${eId}')" class="action-button small dangerous">Löschen</button>
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
        showToast('Name ist erforderlich.', 'warning');
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
    const levels = { '-': 0, 'I': 1, 'II': 2, 'III': 3 };
    const maxLevel = Math.max(levels[cia.c] || 0, levels[cia.i] || 0, levels[cia.a] || 0);
    let schutzbedarf = '-';
    if (maxLevel === 1) schutzbedarf = 'I';
    if (maxLevel === 2) schutzbedarf = 'II';
    if (maxLevel === 3) schutzbedarf = 'III';

    if (assetId) {
        // Edit
        const index = analysis.assets.findIndex(a => a.id === assetId);
        if (index !== -1) {
            analysis.assets[index] = {
                ...analysis.assets[index],
                name: name,
                type: typeField.value,
                description: descField.value,
                confidentiality: cia.c,
                integrity: cia.i,
                authenticity: cia.a,
                schutzbedarf: schutzbedarf
            };
            showToast(`Asset ${assetId} aktualisiert.`, 'success');
        }
    } else {
        // New
        if (!analysis.assets) analysis.assets = [];
        const existingIds = analysis.assets.map(a => parseInt(a.id.replace('A', ''))).filter(n => !isNaN(n));
        const newIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newId = 'A' + newIndex.toString().padStart(2, '0');
        
        analysis.assets.push({
            id: newId,
            name: name,
            type: typeField.value,
            description: descField.value,
            confidentiality: cia.c,
            integrity: cia.i,
            authenticity: cia.a,
            schutzbedarf: schutzbedarf
        });
        showToast(`Asset ${newId} erstellt.`, 'success');
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

    if (assetModalTitleEl) assetModalTitleEl.textContent = `Asset ${asset.id} bearbeiten`;
    document.getElementById('assetIdField').value = asset.id;
    document.getElementById('assetName').value = asset.name;
    document.getElementById('assetType').value = asset.type || '';
    document.getElementById('assetDescription').value = asset.description || '';

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