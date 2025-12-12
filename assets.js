
// =============================================================
// --- ASSET LOGIK (CRUD) ---
// =============================================================

function renderAssets(analysis) {
    if (!assetsCardContainer) return; 
    assetsCardContainer.innerHTML = '';

    if (!analysis.assets || analysis.assets.length === 0) {
        assetsCardContainer.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 40px;">Noch keine Assets erfasst.</p>';
        return;
    }

    analysis.assets.forEach(asset => {
        const card = document.createElement('div');
        card.classList.add('asset-card');
        card.dataset.id = asset.id;
        
        const highestCIA = asset.schutzbedarf;

        card.innerHTML = `
            <div class="asset-card-header">
                ${asset.id}: ${asset.name} 
            </div>
            <div class="asset-card-body">
                <p class="type">Typ: ${asset.type}</p>
                <p style="margin-top: 10px; font-weight: 600;">Beschreibung:</p>
                <p>${asset.description || '— Keine Beschreibung erfasst —'}</p>
                
                <hr style="border: 0; border-top: 1px dashed #eee; margin: 10px 0;">

                <p style="font-weight: 600;">CIA-Anforderungen:</p>
                <ul style="list-style: none; padding: 0; margin: 5px 0 0 0;">
                    <li><strong title="Confidentiality">C (Confidentiality):</strong> ${asset.confidentiality}</li>
                    <li><strong title="Integrity">I (Integrity):</strong> ${asset.integrity}</li>
                    <li><strong title="Authenticity">A (Availability):</strong> ${asset.authenticity}</li> 
                </ul>
            </div>
            <div class="asset-card-footer">
                <span class="protection-level" title="Höchster Wert von C, I, A">Gesamtschutzbedarf: ${highestCIA}</span>
                <div class="asset-card-actions">
                    <button onclick="editAsset('${asset.id}')" class="action-button small">Bearbeiten</button>
                    <button onclick="deleteAsset('${asset.id}')" class="action-button small dangerous">Löschen</button>
                </div>
            </div>
        `;
        assetsCardContainer.appendChild(card);
    });
}

function saveAsset() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const idField = document.getElementById('assetIdField');
    const assetId = idField ? idField.value : '';

    const cEl = document.querySelector('input[name="confidentiality"]:checked');
    const iEl = document.querySelector('input[name="integrity"]:checked');
    const aEl = document.querySelector('input[name="authenticity"]:checked');

    if (!cEl || !iEl || !aEl) {
        showToast('Fehler: Bitte wählen Sie einen Schutzbedarf für alle drei CIA-Ziele aus.', 'error');
        return;
    }
    
    const cVal = cEl.value;
    const iVal = iEl.value;
    const aVal = aEl.value;
    
    const scoreMap = { 'I': 1, 'II': 2, 'III': 3 };
    const maxScore = Math.max(scoreMap[cVal], scoreMap[iVal], scoreMap[aVal]);
    const overallSchutzbedarf = Object.keys(scoreMap).find(key => scoreMap[key] === maxScore);

    const newAssetData = {
        name: document.getElementById('assetName').value.trim(),
        type: document.getElementById('assetType').value.trim(),
        description: document.getElementById('assetDescription').value.trim(), 
        confidentiality: cVal, 
        integrity: iVal, 
        authenticity: aVal, 
        schutzbedarf: overallSchutzbedarf 
    };

    if (assetId) {
        // Bearbeiten
        const index = analysis.assets.findIndex(a => a.id === assetId);
        if (index !== -1) {
            analysis.assets[index] = { ...newAssetData, id: assetId };
            showToast('Asset aktualisiert.', 'success');
        }
    } else {
        // Neu erstellen mit A01 Format
        const existingIds = analysis.assets
            .map(a => parseInt(a.id.replace('A', ''), 10))
            .filter(n => !isNaN(n));
        
        const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newId = `A${nextNum.toString().padStart(2, '0')}`;
        
        analysis.assets.push({ ...newAssetData, id: newId });
        showToast(`Neues Asset ${newId} hinzugefügt.`, 'success');
    }

    if (assetModal) assetModal.style.display = 'none';
    saveCurrentAnalysisState();
    saveAnalyses();
    renderAssets(analysis);
    
    const activeTab = document.querySelector('.tab-button.active');
    // NEU: Nur renderImpactMatrix aufrufen, wenn Tab "Schadensszenarien" aktiv ist
    if (activeTab && activeTab.dataset.tab === 'tabDamageScenarios' && typeof renderImpactMatrix === 'function') {
        renderImpactMatrix();
    }
}

window.editAsset = (assetId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const asset = analysis.assets.find(a => a.id === assetId);
    if (!asset) return;

    document.getElementById('assetIdField').value = asset.id;
    assetModalTitle.textContent = `Asset ${asset.id} bearbeiten`;
    
    document.getElementById('assetName').value = asset.name;
    document.getElementById('assetType').value = asset.type;
    document.getElementById('assetDescription').value = asset.description || ''; 

    const cRadio = document.querySelector(`input[name="confidentiality"][value="${asset.confidentiality}"]`);
    if(cRadio) cRadio.checked = true;
    const iRadio = document.querySelector(`input[name="integrity"][value="${asset.integrity}"]`);
    if(iRadio) iRadio.checked = true;
    const aRadio = document.querySelector(`input[name="authenticity"][value="${asset.authenticity}"]`);
    if(aRadio) aRadio.checked = true;

    if (assetModal) assetModal.style.display = 'block';
};

window.deleteAsset = (assetId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const asset = analysis.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    confirmationTitle.textContent = 'Asset löschen bestätigen';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie das Asset <b>${asset.id}: ${asset.name}</b> löschen möchten? Alle zugehörigen Impact-Bewertungen gehen verloren.`;
    
    btnConfirmAction.textContent = 'Ja, Asset löschen';
    btnConfirmAction.classList.add('dangerous'); 
    
    confirmationModal.style.display = 'block';

    btnConfirmAction.onclick = null; 
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;
    
    btnConfirmAction.onclick = () => {
        analysis.assets = analysis.assets.filter(a => a.id !== assetId);
        delete analysis.impactMatrix[assetId];

        saveCurrentAnalysisState();
        saveAnalyses();
        renderAssets(analysis);
        if (typeof renderImpactMatrix === 'function') {
            renderImpactMatrix(); 
        }
        
        confirmationModal.style.display = 'none'; 
        showToast(`Asset ${assetId} gelöscht.`, 'success');
    };
    
    btnCancelConfirmation.onclick = () => { confirmationModal.style.display = 'none'; };
    closeConfirmationModal.onclick = () => { confirmationModal.style.display = 'none'; };
};

// Event Listener für Modals
if (btnAddAsset) {
    btnAddAsset.onclick = () => {
        if (!activeAnalysisId) {
            showToast('Bitte wählen Sie zuerst eine aktive Analyse aus.', 'info');
            return;
        }
        if (assetForm) assetForm.reset();
        document.getElementById('assetIdField').value = '';
        assetModalTitle.textContent = 'Neues Asset erfassen';
        
        document.querySelector('input[name="confidentiality"][value="I"]').checked = true;
        document.querySelector('input[name="integrity"][value="I"]').checked = true;
        document.querySelector('input[name="authenticity"][value="I"]').checked = true;
        
        if (assetModal) assetModal.style.display = 'block';
    };
}

if (closeAssetModal) {
    closeAssetModal.onclick = () => { if (assetModal) assetModal.style.display = 'none'; };
}

if (assetForm) {
    assetForm.onsubmit = (e) => {
        e.preventDefault();
        saveAsset();
    };
}
