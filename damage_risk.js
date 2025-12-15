// =============================================================
// --- DAMAGE SCENARIO LOGIK (CRUD & MATRIX) ---
// =============================================================

/**
 * Rendert die Liste der Damage Scenarios (DS) im Management-Bereich.
 * Diese Funktion sichert ab, dass DEFAULT_DAMAGE_SCENARIOS immer angezeigt werden, 
 * falls analysis.damageScenarios aus irgendeinem Grund leer ist.
 */
function renderDamageScenarios() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsManagementContainer) return;

    let dsList = [];
    const defaultIds = new Set(DEFAULT_DAMAGE_SCENARIOS.map(ds => ds.id));

    // 1. Liste IMMER mit Standard-DS initialisieren (tief kopiert)
    if (DEFAULT_DAMAGE_SCENARIOS && DEFAULT_DAMAGE_SCENARIOS.length > 0) {
        dsList = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
    }
    
    // 2. Benutzerdefinierte Szenarien aus der Analyse hinzufügen
    if (analysis.damageScenarios && Array.isArray(analysis.damageScenarios)) {
        analysis.damageScenarios.forEach(ds => {
            if (ds && ds.id && !defaultIds.has(ds.id)) {
                dsList.push(ds);
            }
        });
    }

    dsList.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    let html = '<h4>Definierte Schadens-Szenarien:</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Verwalten Sie die Damage Scenarios (DS), die zur Bewertung der Assets verwendet werden.</p>';
    html += '<ul class="ds-list">';
    
    dsList.forEach(ds => {
        const isDefault = defaultIds.has(ds.id);
        
        html += `<li data-id="${ds.id}">
            <div class="ds-row-header">
                <div class="ds-col-id-name">
                    <strong>${ds.id}:</strong> ${ds.name} 
                    <span style="font-weight: 400; color: #7f8c8d; margin-left: 5px;">(${ds.short})</span>
                    ${isDefault ? `<span class="small" style="color: #2ecc71; margin-left: 10px;">(Standard)</span>` : ''}
                </div>
                <div class="ds-actions">
                    <button onclick="editDamageScenario('${ds.id}')" class="action-button small" ${isDefault ? 'disabled' : ''}>Bearbeiten</button>
                    <button onclick="removeDamageScenario('${ds.id}')" class="action-button small dangerous" ${isDefault ? 'disabled' : ''}>Entfernen</button>
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
    
    // Sicherstellen, dass das Array existiert
    if (!analysis.damageScenarios) analysis.damageScenarios = [];

    if (dsId) {
        // EDITIEREN
        const index = analysis.damageScenarios.findIndex(ds => ds.id === dsId);
        if (index !== -1) {
            analysis.damageScenarios[index] = { id: dsId, name, short, description };
            showToast(`Schadensszenario ${dsId} aktualisiert.`, 'success');
        }
    } else {
        // NEU ERSTELLEN
        // Berücksichtige sowohl Defaults als auch eigene für die ID Generierung
        const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...analysis.damageScenarios];
        const existingIds = allDS.map(ds => parseInt(ds.id.replace('DS', ''))).filter(n => !isNaN(n));
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

    // Suche zuerst in der Analyse, dann in Defaults
    let ds = analysis.damageScenarios ? analysis.damageScenarios.find(d => d.id === dsId) : null;
    if (!ds) ds = DEFAULT_DAMAGE_SCENARIOS.find(d => d.id === dsId);

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
    
    // Prüfen ob Standard
    if (DEFAULT_DAMAGE_SCENARIOS.some(d => d.id === dsId)) {
        showToast('Standard-Szenarien können nicht gelöscht werden.', 'error');
        return;
    }

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
        
        if (analysis.impactMatrix) {
            for (const assetId in analysis.impactMatrix) {
                delete analysis.impactMatrix[assetId][dsId];
            }
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
    
    if (!analysis.impactMatrix) analysis.impactMatrix = {};
    if (!analysis.impactMatrix[assetId]) {
        analysis.impactMatrix[assetId] = {};
    }
    
    analysis.impactMatrix[assetId][dsId] = score;
    saveAnalyses();
    showToast(`Impact für ${assetId}/${dsId} auf ${score} gesetzt.`, 'info');
    
    // Optional: Refresh Risk Analysis if open
    if (document.getElementById('tabRiskAnalysis').classList.contains('active')) {
         renderRiskAnalysis();
    }
}

function renderImpactMatrix() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsMatrixContainer) return;

    if (!analysis.assets || analysis.assets.length === 0) {
        dsMatrixContainer.innerHTML = '<h4>Schadensauswirkungsmatrix</h4><p style="text-align: center; color: #7f8c8d; padding: 20px;">Bitte legen Sie zuerst Assets im Reiter "Assets" an.</p>';
        return;
    }

    // Kombiniere Defaults und Custom DS für die Anzeige
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
        html += `<th class="ds-col" title="${ds.name}: ${ds.description}">
            <div class="vertical-text">${ds.id} (${ds.short})</div>
        </th>`;
    });
    
    html += '</tr></thead>';

    html += '<tbody>';
    
    // Impact Matrix sicherstellen
    if (!analysis.impactMatrix) analysis.impactMatrix = {};

    analysis.assets.forEach(asset => {
        if (!analysis.impactMatrix[asset.id]) {
            analysis.impactMatrix[asset.id] = {};
        }

        html += '<tr>';
        html += `<td class="asset-col"><strong>${asset.id}: ${asset.name}</strong></td>`;
        
        displayDS.forEach(ds => {
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

// Event Listener für DS Modals (Vorhandene Logic)
if (btnAddDamageScenario) {
    btnAddDamageScenario.onclick = () => {
         if (!activeAnalysisId) {
            showToast('Bitte wählen Sie zuerst eine aktive Analyse aus.', 'info');
            return;
        }
        damageScenarioForm.reset();
        if (dsIdField) dsIdField.value = ''; 
        
        const analysis = analysisData.find(a => a.id === activeAnalysisId);
        // ID Berechnung
        let maxNum = 0;
        const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...(analysis.damageScenarios || [])];
        allDS.forEach(ds => {
             const match = ds.id.match(/DS(\d+)/);
             if (match) maxNum = Math.max(maxNum, parseInt(match[1]));
        });
        const nextId = 'DS' + (maxNum + 1);
        
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
// --- RISIKOANALYSE & ANGRIFFSBAUM LOGIK (NEU) ---
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

    // 2. Prüfen auf Schadensszenarien (Defaults sind immer da, also Check ist eher formal)
    const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...(analysis.damageScenarios || [])];
    if (allDS.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Schadensszenarien</h4>
                <p>Es wurden noch keine Schadensszenarien im Reiter "Schadensszenarien" erfasst. Die Risikoanalyse kann nicht gestartet werden.</p>
            </div>
        `;
        return;
    }
    
    // 3. Prüfen auf Impact Matrix (Bewertung)
    let incompleteImpact = false;
    let missingCount = 0;
    const validScores = ['1', '2', '3', 'N/A'];
    
    if (!analysis.impactMatrix) analysis.impactMatrix = {};

    analysis.assets.forEach(asset => {
        const assetId = asset.id;
        const assetMatrix = analysis.impactMatrix[assetId] || {}; 
        
        allDS.forEach(ds => {
            const storedValue = assetMatrix[ds.id]; 
            const scoreToCheck = storedValue === undefined ? 'N/A' : storedValue;

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

    // Wenn alle Daten vorhanden sind -> Button anzeigen
    riskAnalysisContainer.innerHTML = `
        <div class="success-box">
            <h4>Datenprüfung abgeschlossen</h4>
            <p>Alle notwendigen Assets, Schadensszenarien und Impact-Bewertungen sind vorhanden.</p>
            <button id="btnOpenAttackTreeModal" class="primary-button large" style="margin-top:10px;"><i class="fas fa-sitemap"></i> Neuen Angriffsbaum erstellen</button>
        </div>
        
        <div id="existingRiskEntriesContainer" style="margin-top: 20px;">
            ${renderExistingRiskEntries(analysis)}
        </div>
    `;

    // Event Listener für den Button
    const btn = document.getElementById('btnOpenAttackTreeModal');
    if (btn) btn.onclick = openAttackTreeModal;
}

function renderExistingRiskEntries(analysis) {
    if (!analysis.riskEntries || analysis.riskEntries.length === 0) {
        return '<p style="color: #7f8c8d;">Noch keine Angriffs-Bäume angelegt.</p>';
    }
    // Einfache Liste zur Anzeige, dass etwas gespeichert wurde
    let html = '<h4>Gespeicherte Angriffsbäume:</h4><ul>';
    analysis.riskEntries.forEach(entry => {
        const assetName = analysis.assets.find(a => a.id === entry.assetId)?.name || entry.assetId;
        html += `<li><strong>${entry.id}</strong> für Asset: ${assetName} (Root: ${entry.rootName})</li>`;
    });
    html += '</ul>';
    return html;
}

function openAttackTreeModal() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    // Asset Selector füllen
    if (atTargetAsset) {
        atTargetAsset.innerHTML = '';
        analysis.assets.forEach(asset => {
            const opt = document.createElement('option');
            opt.value = asset.id;
            opt.textContent = `${asset.id}: ${asset.name}`;
            atTargetAsset.appendChild(opt);
        });
    }

    // Formular resetten
    if (attackTreeForm) attackTreeForm.reset();

    if (attackTreeModal) attackTreeModal.style.display = 'block';
}

function saveAttackTree(e) {
    if (e) e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const fd = new FormData(attackTreeForm);
    
    // Datenstruktur aufbauen (1 Root -> 2 Branches -> 4 Leaves)
    const treeData = {
        id: generateNextRiskID(analysis),
        assetId: atTargetAsset.value,
        rootName: fd.get('at_root'),
        branches: [
            {
                name: fd.get('at_branch_1'),
                leaves: [
                    extractLeafData(fd, 1),
                    extractLeafData(fd, 2)
                ]
            },
            {
                name: fd.get('at_branch_2'), // Branch 2 für Blatt 3 und 4
                leaves: [
                    extractLeafData(fd, 3),
                    extractLeafData(fd, 4)
                ]
            }
        ]
    };

    if (!analysis.riskEntries) analysis.riskEntries = [];
    analysis.riskEntries.push(treeData);
    
    saveAnalyses();
    showToast(`Angriffsbaum ${treeData.id} gespeichert.`, 'success');
    
    if (attackTreeModal) attackTreeModal.style.display = 'none';
    renderRiskAnalysis(); // Liste aktualisieren
}

function extractLeafData(formData, index) {
    // DS Checkboxes sammeln
    const checkedDS = [];
    for(let i=1; i<=5; i++) {
        if (formData.get(`at_leaf_${index}_ds${i}`)) {
            checkedDS.push(`DS${i}`);
        }
    }

    return {
        text: formData.get(`at_leaf_${index}_text`),
        ds: checkedDS,
        k: formData.get(`at_leaf_${index}_k`),
        s: formData.get(`at_leaf_${index}_s`),
        t: formData.get(`at_leaf_${index}_t`),
        u: formData.get(`at_leaf_${index}_u`)
    };
}

function generateNextRiskID(analysis) {
    if (!analysis.riskEntries || analysis.riskEntries.length === 0) return 'R01';
    
    let max = 0;
    analysis.riskEntries.forEach(entry => {
        const num = parseInt(entry.id.replace('R', ''));
        if (!isNaN(num) && num > max) max = num;
    });
    return 'R' + (max + 1).toString().padStart(2, '0');
}

// Event Listeners für das neue Modal
if (closeAttackTreeModal) {
    closeAttackTreeModal.onclick = () => attackTreeModal.style.display = 'none';
}
if (attackTreeForm) {
    attackTreeForm.onsubmit = saveAttackTree;
}