/**
 * @file        assets.js
 * @description Asset management UI – CRUD operations and rendering
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

function renderAssets(analysis) {
    if (!assetsCardContainer) return;
    assetsCardContainer.innerHTML = '';

    if (!analysis.assets || analysis.assets.length === 0) {
        assetsCardContainer.innerHTML = '<p style="color: #7f8c8d; grid-column: 1/-1; text-align: center;">Noch keine Assets vorhanden. Klicken Sie auf "Asset hinzufügen".</p>';
        return;
    }

    analysis.assets.forEach(asset => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
            <div class="asset-card-header">${asset.id}: ${asset.name}</div>
            <div class="asset-description-area">
                <strong>Typ:</strong> ${asset.type || '-'}<br><br>
                ${asset.description ? asset.description.substring(0, 100) + (asset.description.length > 100 ? '...' : '') : 'Keine Beschreibung'}
            </div>
            <div class="asset-cia-area">
                <div style="font-weight:600; font-size:0.8em; margin-bottom:2px; text-transform:uppercase; color:#999;">Schutzbedarf</div>
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                    <span title="Confidentiality">C: ${asset.confidentiality || '-'}</span>
                    <span title="Integrity">I: ${asset.integrity || '-'}</span>
                    <span title="Availability">A: ${asset.authenticity || '-'}</span>
                </div>
            </div>
            <div class="asset-card-footer">
                <button onclick="editAsset('${asset.id}')" class="action-button small">Bearbeiten</button>
                <button onclick="removeAsset('${asset.id}')" class="action-button small dangerous">Löschen</button>
            </div>
        `;
        assetsCardContainer.appendChild(card);
    });
}

function saveAsset(e) {
    e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
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
    const getRadioVal = (name) => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : '-';
    };
    
    const cia = {
        c: getRadioVal('confidentiality'),
        i: getRadioVal('integrity'),
        a: getRadioVal('authenticity') 
    };

    // Determine protection level (highest value)
    let levels = { '-': 0, 'I': 1, 'II': 2, 'III': 3 };
    let maxLevel = Math.max(levels[cia.c], levels[cia.i], levels[cia.a]);
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
    assetModal.style.display = 'none';
}

window.editAsset = (id) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    const asset = analysis.assets.find(a => a.id === id);
    if (!asset) return;

    if (assetModalTitle) assetModalTitle.textContent = `Asset ${asset.id} bearbeiten`;
    document.getElementById('assetIdField').value = asset.id;
    document.getElementById('assetName').value = asset.name;
    document.getElementById('assetType').value = asset.type || '';
    document.getElementById('assetDescription').value = asset.description || '';

    // Set radio buttons
    const setRadio = (name, val) => {
        const els = document.querySelectorAll(`input[name="${name}"]`);
        els.forEach(el => {
            el.checked = (el.value === val);
        });
    };
    setRadio('confidentiality', asset.confidentiality);
    setRadio('integrity', asset.integrity);
    setRadio('authenticity', asset.authenticity);

    if (assetModal) assetModal.style.display = 'block';
};

window.removeAsset = (id) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    const asset = analysis.assets.find(a => a.id === id);
    if (!asset) return;

    // FIX: Fetch DOM elements explicitly (prevents ReferenceError)
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationTitle'); // Requires the corrected HTML!
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');

    // Ensure element exists to prevent crashes
    if (title) title.textContent = 'Asset löschen';
    
    msg.innerHTML = `Möchten Sie das Asset <b>${asset.name} (${asset.id})</b> wirklich löschen?<br>Dies entfernt auch alle Einträge in der Impact-Matrix!`;
    
    btnConfirm.textContent = 'Löschen';
    btnConfirm.className = 'primary-button dangerous';

    modal.style.display = 'block';

    // Clear events
    btnConfirm.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;

    btnConfirm.onclick = () => {
        analysis.assets = analysis.assets.filter(a => a.id !== id);
        
        // Clean up impact matrix
        if (analysis.impactMatrix && analysis.impactMatrix[id]) {
            delete analysis.impactMatrix[id];
        }

        saveAnalyses();
        renderAssets(analysis);
        if (typeof renderImpactMatrix === 'function') renderImpactMatrix();
        
        modal.style.display = 'none';
        showToast(`Asset ${id} gelöscht.`, 'success');
    };

    const closeFn = () => { modal.style.display = 'none'; };
    btnCancel.onclick = closeFn;
    btnClose.onclick = closeFn;
};

if (assetForm) {
    assetForm.onsubmit = saveAsset;
}

if (btnAddAsset) {
    btnAddAsset.onclick = () => {
        if (!activeAnalysisId) {
            showToast('Bitte erst eine Analyse wählen/erstellen.', 'warning');
            return;
        }
        if (assetModalTitle) assetModalTitle.textContent = 'Neues Asset';
        assetForm.reset();
        document.getElementById('assetIdField').value = '';
        if (assetModal) assetModal.style.display = 'block';
    };
}

if (closeAssetModal) {
    closeAssetModal.onclick = () => {
        if (assetModal) assetModal.style.display = 'none';
    };
}