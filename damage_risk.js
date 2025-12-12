// =============================================================
// --- DAMAGE SCENARIO LOGIK (CRUD & MATRIX) ---
// =============================================================

function renderDamageScenarios() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsManagementContainer) return;

    let html = '<h4>Definierte Schadens-Szenarien:</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Verwalten Sie die Damage Scenarios (DS), die zur Bewertung der Assets verwendet werden.</p>';
    html += '<ul class="ds-list">';
    
    analysis.damageScenarios.forEach(ds => {
        const isDefault = DEFAULT_DAMAGE_SCENARIOS.some(defaultDs => defaultDs.id === ds.id);
        
        html += `<li data-id="${ds.id}">
            <div class="ds-row-header">
                <div class="ds-col-id-name">
                    <strong>${ds.id}:</strong> ${ds.name} 
                    <span style="font-weight: 400; color: #7f8c8d; margin-left: 5px;">(${ds.short})</span>
                    ${isDefault ? `<span class="small" style="color: #2ecc71; margin-left: 10px;">(Standard)</span>` : ''}
                </div>
                <div class="ds-actions">
                    <button onclick="editDamageScenario('${ds.id}')" class="action-button small">Bearbeiten</button>
                    <button onclick="removeDamageScenario('${ds.id}')" class="action-button small dangerous">Entfernen</button>
                </div>
            </div>
            <div class="ds-col-description">
                ${ds.description || '— Keine Beschreibung —'}
            </div>
        </li>`;
    });

    html += '</ul>';
    dsManagementContainer.innerHTML = html;
}

function saveDamageScenario(e) {
    if (e) e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const dsId = document.getElementById('dsIdField').value; 
    const name = document.getElementById('dsName').value.trim();
    const short = document.getElementById('dsShort').value.trim();
    const description = document.getElementById('dsDescription').value.trim();

    if (!name || !short) {
        showToast('Name und Kurzbezeichnung sind erforderlich.', 'warning');
        return;
    }
    
    if (dsId) {
        // EDITIEREN
        const index = analysis.damageScenarios.findIndex(ds => ds.id === dsId);
        if (index !== -1) {
            analysis.damageScenarios[index] = { id: dsId, name, short, description };
            showToast(`Schadensszenario ${dsId} aktualisiert.`, 'success');
        }
    } else {
        // NEU ERSTELLEN
        const existingIds = analysis.damageScenarios.map(ds => parseInt(ds.id.replace('DS', ''))).filter(n => !isNaN(n));
        const newIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const newId = 'DS' + newIndex;

        analysis.damageScenarios.push({ id: newId, name, short, description });
        showToast(`Schadensszenario ${newId} hinzugefügt.`, 'success');
    }

    saveAnalyses();
    renderDamageScenarios();
    renderImpactMatrix();
    damageScenarioModal.style.display = 'none';
}

window.editDamageScenario = (dsId) => {
    if (!activeAnalysisId) return;

    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const ds = analysis.damageScenarios.find(d => d.id === dsId);
    if (!ds) return;
    
    if (dsModalTitle) dsModalTitle.textContent = `Schadensszenario ${ds.id} bearbeiten`;
    if (dsIdField) dsIdField.value = ds.id; 

    document.getElementById('dsName').value = ds.name;
    document.getElementById('dsShort').value = ds.short;
    document.getElementById('dsDescription').value = ds.description;

    if (damageScenarioModal) damageScenarioModal.style.display = 'block';
};

window.removeDamageScenario = (dsId) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    const ds = analysis.damageScenarios.find(d => d.id === dsId);
    if (!ds) return;
    
    confirmationTitle.textContent = 'Schadensszenario löschen bestätigen';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie das Schadensszenario <b>${ds.name} (${dsId})</b> löschen möchten? Alle zugehörigen Impact-Bewertungen gehen verloren.`;
    
    btnConfirmAction.textContent = 'Ja, DS löschen';
    btnConfirmAction.classList.add('dangerous'); 
    
    confirmationModal.style.display = 'block';

    btnConfirmAction.onclick = null; 
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;
    
    btnConfirmAction.onclick = () => {
        analysis.damageScenarios = analysis.damageScenarios.filter(d => d.id !== dsId);
        
        for (const assetId in analysis.impactMatrix) {
            delete analysis.impactMatrix[assetId][dsId];
        }

        saveAnalyses();
        renderDamageScenarios();
        renderImpactMatrix();
        confirmationModal.style.display = 'none'; 
        showToast(`Schadensszenario ${dsId} gelöscht.`, 'success');
    };

    btnCancelConfirmation.onclick = () => { confirmationModal.style.display = 'none'; };
    closeConfirmationModal.onclick = () => { confirmationModal.style.display = 'none'; };
}

window.updateImpactScore = (assetId, dsId, score) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    if (!analysis.impactMatrix[assetId]) {
        analysis.impactMatrix[assetId] = {};
    }
    
    analysis.impactMatrix[assetId][dsId] = score;
    saveAnalyses();
    showToast(`Impact für ${assetId}/${dsId} auf ${score} gesetzt.`, 'info');
}

function renderImpactMatrix() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsMatrixContainer) return;

    if (analysis.assets.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte legen Sie zuerst Assets im Reiter "Assets" an.</p>';
        return;
    }

    if (analysis.damageScenarios.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte definieren Sie zuerst Schadensszenarien.</p>';
        return;
    }
    
    let html = '<h4>Schadensauswirkungsmatrix (Assets vs. Damage Scenarios)</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Bewerten Sie die Auswirkung (Impact) jedes Schadensszenarios auf jedes Asset (1=Low, 3=High, N/A=Nicht anwendbar).</p>';
    html += '<div style="overflow-x: auto;"><table class="impact-matrix-table">';
    
    html += '<thead><tr>';
    html += '<th class="asset-col">Asset (ID: Name)</th>';
    
    analysis.damageScenarios.forEach(ds => {
        html += `<th class="ds-col" title="${ds.name}: ${ds.description}">
            <div class="vertical-text">${ds.id} (${ds.short})</div>
        </th>`;
    });
    
    html += '</tr></thead>';

    html += '<tbody>';
    analysis.assets.forEach(asset => {
        // Sicherstellen, dass der Asset-Eintrag in der Impact Matrix existiert, falls er noch nicht da war
        if (!analysis.impactMatrix[asset.id]) {
            analysis.impactMatrix[asset.id] = {};
        }

        html += '<tr>';
        html += `<td class="asset-col"><strong>${asset.id}: ${asset.name}</strong></td>`;
        
        analysis.damageScenarios.forEach(ds => {
            // currentScore wird für das Rendering verwendet. Wenn der Wert in der Datenstruktur undefined ist,
            // wird 'N/A' angezeigt.
            const currentScore = analysis.impactMatrix[asset.id][ds.id] || 'N/A';
            
            html += '<td class="score-cell">';
            html += `<select 
                data-asset-id="${asset.id}" 
                data-ds-id="${ds.id}" 
                onchange="updateImpactScore('${asset.id}', '${ds.id}', this.value)"
                class="impact-select">
                <option value="N/A" ${currentScore === 'N/A' ? 'selected' : ''}>N/A</option>
                <option value="1" ${currentScore === '1' ? 'selected' : ''}>1 (Low)</option>
                <option value="2" ${currentScore === '2' ? 'selected' : ''}>2 (Medium)</option>
                <option value="3" ${currentScore === '3' ? 'selected' : ''}>3 (High)</option>
            </select>`;
            html += '</td>';
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    dsMatrixContainer.innerHTML = html;
}

// Event Listener für Modals
if (btnAddDamageScenario) {
    btnAddDamageScenario.onclick = () => {
         if (!activeAnalysisId) {
            showToast('Bitte wählen Sie zuerst eine aktive Analyse aus.', 'info');
            return;
        }
        damageScenarioForm.reset();
        
        if (dsIdField) dsIdField.value = ''; 
        
        const analysis = analysisData.find(a => a.id === activeAnalysisId);
        const existingIds = analysis.damageScenarios.map(ds => parseInt(ds.id.replace('DS', ''))).filter(n => !isNaN(n));
        const nextIndex = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        const nextId = 'DS' + nextIndex;
        
        if (dsModalTitle) dsModalTitle.textContent = `Neues Schadensszenario ${nextId} erfassen`;
        
        damageScenarioModal.style.display = 'block';
    };
}
if (closeDamageScenarioModal) {
    closeDamageScenarioModal.onclick = () => damageScenarioModal.style.display = 'none';
}
if (damageScenarioForm) {
    damageScenarioForm.onsubmit = saveDamageScenario; 
}


// =============================================================
// --- RISIKOFUNKTIONEN (PREREQUISITE CHECK) ---
// =============================================================

function renderRiskAnalysis() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!riskAnalysisContainer) return; 

    // 1. Prüfen auf Assets
    if (!analysis.assets || analysis.assets.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Assets</h4>
                <p>Es wurden noch keine Schutzobjekte (Assets) im Reiter "Assets" erfasst. Die Risikoanalyse kann ohne Assets nicht durchgeführt werden.</p>
            </div>
        `;
        return;
    }

    // 2. Prüfen auf Schadensszenarien
    if (!analysis.damageScenarios || analysis.damageScenarios.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Schadensszenarien</h4>
                <p>Es wurden noch keine Schadensszenarien im Reiter "Schadensszenarien" erfasst. Die Risikoanalyse kann nicht gestartet werden.</p>
            </div>
        `;
        return;
    }
    
    // 3. Prüfen auf Impact Matrix (Bewertung) - FINALE KORREKTUR
    let incompleteImpact = false;
    let missingCount = 0;
    const validScores = ['1', '2', '3', 'N/A'];
    
    // Durchlaufe alle Assets und alle Damage Scenarios
    analysis.assets.forEach(asset => {
        const assetId = asset.id;
        
        // Stellt sicher, dass wir Zugriff auf das Impact-Objekt haben (falls nicht, ist es leer)
        const assetMatrix = analysis.impactMatrix[assetId] || {}; 
        
        analysis.damageScenarios.forEach(ds => {
            const dsId = ds.id;

            // Holt den gespeicherten Wert. Ist er undefined (noch nie gesetzt),
            // behandeln wir ihn als den impliziten Default 'N/A'.
            const storedValue = assetMatrix[dsId]; 
            
            // WICHTIG: Wenn storedValue undefined ist, wird 'N/A' angenommen, was als vollständig gilt.
            const scoreToCheck = storedValue === undefined ? 'N/A' : storedValue;

            // Prüfen, ob der Score (gespeichert oder Default) gültig ist.
            // Nur null oder ein ungültiger String führt zur Fehlerzählung.
            if (scoreToCheck === null || !validScores.includes(scoreToCheck)) {
                incompleteImpact = true;
                missingCount++;
            }
        });
    });

    if (incompleteImpact) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Unvollständige Bewertung</h4>
                <p>Die Schadensauswirkungsmatrix ist unvollständig. Es fehlen noch <b>${missingCount}</b> Bewertungen (Impact-Werte) im Reiter "Schadensszenarien".</p>
                <p><b>Aktion:</b> Bitte vervollständigen Sie alle Einträge in der Schadensauswirkungsmatrix (Werte 1, 2, 3 oder N/A).</p>
            </div>
        `;
        return;
    }

    // Wenn alle Daten vorhanden sind
    riskAnalysisContainer.innerHTML = `
        <div class="success-box">
            <h4>Datenprüfung abgeschlossen</h4>
            <p>Alle notwendigen Assets, Schadensszenarien und Impact-Bewertungen sind vorhanden.</p>
            <p><b>HIER FOLGT IN ZUKUNFT DIE RISIKO-MATRIX.</b></p>
        </div>
    `;
}