// =============================================================
// --- DAMAGE SCENARIO LOGIK (CRUD & MATRIX) ---
// =============================================================

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

// Event Listener für DS Modals
if (btnAddDamageScenario) {
    btnAddDamageScenario.onclick = () => {
         if (!activeAnalysisId) {
            showToast('Bitte wählen Sie zuerst eine aktive Analyse aus.', 'info');
            return;
        }
        damageScenarioForm.reset();
        if (dsIdField) dsIdField.value = ''; 
        
        const analysis = analysisData.find(a => a.id === activeAnalysisId);
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
// --- RISIKOANALYSE & ANGRIFFSBAUM LOGIK ---
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

    // Wenn alle Daten vorhanden sind
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

    const btn = document.getElementById('btnOpenAttackTreeModal');
    if (btn) btn.onclick = () => openAttackTreeModal(); // Neuer Aufruf ohne ID -> Erstellt neu
}

function renderExistingRiskEntries(analysis) {
    if (!analysis.riskEntries || analysis.riskEntries.length === 0) {
        return '<p style="color: #7f8c8d;">Noch keine Angriffs-Bäume angelegt.</p>';
    }

    let html = '<h4>Gespeicherte Angriffsbäume:</h4><ul style="list-style:none; padding:0;">';
    analysis.riskEntries.forEach(entry => {
        const assetName = analysis.assets.find(a => a.id === entry.assetId)?.name || entry.assetId;
        // Button hinzugefügt, der editAttackTree aufruft
        html += `
            <li style="background:#fff; border:1px solid #ddd; padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${entry.id}</strong>: ${entry.rootName} <br> 
                    <span style="color:#666; font-size:0.9em;">Asset: ${assetName}</span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="editAttackTree('${entry.id}')" class="action-button small">
                        <i class="fas fa-edit"></i> Bearbeiten / Anzeigen
                    </button>
                    <button onclick="deleteAttackTree('${entry.id}')" class="action-button small dangerous">
                        <i class="fas fa-trash"></i> Löschen
                    </button>
                </div>
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

// Global verfügbar machen für onclick im HTML
window.editAttackTree = (riskId) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    // Modal öffnen im "Edit" Modus (Daten laden)
    openAttackTreeModal(entry);
};

window.deleteAttackTree = (riskId) => {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis || !analysis.riskEntries) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    const assetName = (analysis.assets || []).find(a => a.id === entry.assetId)?.name || entry.assetId;

    confirmationTitle.textContent = 'Angriffsbaum löschen bestätigen';
    confirmationMessage.innerHTML = `Sind Sie sicher, dass Sie den Angriffsbaum <b>${entry.id}: ${entry.rootName}</b> (Asset: ${assetName}) löschen möchten?`;

    btnConfirmAction.textContent = 'Ja, Angriffsbaum löschen';
    btnConfirmAction.classList.add('dangerous');

    confirmationModal.style.display = 'block';

    // Handler zurücksetzen (sonst stapeln sich Aktionen)
    btnConfirmAction.onclick = null;
    btnCancelConfirmation.onclick = null;
    closeConfirmationModal.onclick = null;

    btnConfirmAction.onclick = () => {
        analysis.riskEntries = analysis.riskEntries.filter(r => r.id !== riskId);
        saveAnalyses();
        if (attackTreeModal) attackTreeModal.style.display = 'none';
        confirmationModal.style.display = 'none';
        renderRiskAnalysis();
        showToast(`Angriffsbaum ${riskId} gelöscht.`, 'success');
    };

    btnCancelConfirmation.onclick = () => { confirmationModal.style.display = 'none'; };
    closeConfirmationModal.onclick = () => { confirmationModal.style.display = 'none'; };
};


function openAttackTreeModal(existingEntry = null) {
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

    if (attackTreeForm) attackTreeForm.reset();

    // Verstecktes ID Feld setzen oder löschen
    const hiddenIdField = document.getElementById('at_id');
    
    if (existingEntry) {
        // --- DATEN LADEN (Mapping JSON -> Form) ---
        if (hiddenIdField) hiddenIdField.value = existingEntry.id;
        
        // Asset setzen
        atTargetAsset.value = existingEntry.assetId;
        
        // Root Pfad
        const rootInput = document.querySelector('input[name="at_root"]');
        if (rootInput) rootInput.value = existingEntry.rootName;

        // Hilfsfunktion zum Laden eines Blattes
        const loadLeaf = (leafData, leafIndex) => {
            if (!leafData) return;
            const prefix = `at_leaf_${leafIndex}`;
            
            // Text
            const txt = document.querySelector(`input[name="${prefix}_text"]`);
            if (txt) txt.value = leafData.text || '';
            
            // K, S, T, U Selects
            ['k', 's', 't', 'u'].forEach(param => {
                const sel = document.querySelector(`select[name="${prefix}_${param}"]`);
                if (sel) sel.value = leafData[param] || '';
            });

            // DS Checkboxes
            document.querySelectorAll(`input[type="checkbox"][name^="${prefix}_ds"]`).forEach(c => { if (c) c.checked = false; });
            if (leafData.ds && Array.isArray(leafData.ds)) {
                leafData.ds.forEach(dsVal => {
                    // dsVal ist z.B. "DS1", "DS3"
                    // Checkbox Name z.B. at_leaf_1_ds1
                    const num = dsVal.replace('DS', '');
                    const chk = document.querySelector(`input[name="${prefix}_ds${num}"]`);
                    if (chk) chk.checked = true;
                });
            }
        };

        // Branch 1 (Index 0) -> Leaf 1 & 2
        if (existingEntry.branches[0]) {
            const b1 = existingEntry.branches[0];
            const b1Input = document.querySelector('input[name="at_branch_1"]');
            if (b1Input) b1Input.value = b1.name;
            
            loadLeaf(b1.leaves[0], 1);
            loadLeaf(b1.leaves[1], 2);
        }

        // Branch 2 (Index 1) -> Leaf 3 & 4
        if (existingEntry.branches[1]) {
            const b2 = existingEntry.branches[1];
            const b2Input = document.querySelector('input[name="at_branch_2"]');
            if (b2Input) b2Input.value = b2.name;

            loadLeaf(b2.leaves[0], 3);
            loadLeaf(b2.leaves[1], 4);
        }
        
    } else {
        // --- NEU ERSTELLEN ---
        if (hiddenIdField) hiddenIdField.value = ''; // ID leer -> Neues Element
    }


    // Delete-Button im Modal: nur bei bestehenden Bäumen anzeigen
    const delBtn = document.getElementById('btnDeleteAttackTree') || window.btnDeleteAttackTree;
    if (delBtn) {
        if (existingEntry && existingEntry.id) {
            delBtn.style.display = 'inline-flex';
            delBtn.onclick = () => window.deleteAttackTree(existingEntry.id);
        } else {
            delBtn.style.display = 'none';
            delBtn.onclick = null;
        }
    }

    // Read-only Summaries (Worst-Case) für K/S/T/U + I(norm) aktualisieren
    updateAttackTreeKSTUSummariesFromForm();

    if (attackTreeModal) attackTreeModal.style.display = 'block';
}

function saveAttackTree(e) {
    if (e) e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const fd = new FormData(attackTreeForm);
    const editingId = fd.get('at_id'); // Prüfen, ob wir bearbeiten
    
    // Datenstruktur aufbauen
    const treeData = {
        id: editingId || generateNextRiskID(analysis), // Alte ID behalten oder neue generieren
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
                name: fd.get('at_branch_2'),
                leaves: [
                    extractLeafData(fd, 3),
                    extractLeafData(fd, 4)
                ]
            }
        ]
    };

    // Worst-Case Vererbung:
    //  - I(norm): max(ImpactMatrix[assetId][DS...] ) je Leaf, dann max nach oben
    //  - K/S/T/U: max je Aspekt nach oben
    applyImpactInheritance(treeData, analysis);
    applyWorstCaseInheritance(treeData);


    if (!analysis.riskEntries) analysis.riskEntries = [];

    if (editingId) {
        // Update existierenden Eintrag
        const index = analysis.riskEntries.findIndex(r => r.id === editingId);
        if (index > -1) {
            analysis.riskEntries[index] = treeData;
            showToast(`Angriffsbaum ${editingId} aktualisiert.`, 'success');
        } else {
            // Fallback, falls ID nicht gefunden (sollte nicht passieren)
            analysis.riskEntries.push(treeData);
        }
    } else {
        // Neuer Eintrag
        analysis.riskEntries.push(treeData);
        showToast(`Angriffsbaum ${treeData.id} gespeichert.`, 'success');
    }
    
    saveAnalyses();
    
    if (attackTreeModal) attackTreeModal.style.display = 'none';
    renderRiskAnalysis(); 
}


// Liest DS-Checkboxen eines Leafs direkt aus dem DOM (robust, unabhängig von FormData).
function readLeafDsFromDOM(leafIndex) {
    const ds = [];
    const boxes = document.querySelectorAll(`input[type="checkbox"][name^="at_leaf_${leafIndex}_ds"]`);
    boxes.forEach(chk => {
        if (!chk || !chk.checked) return;
        const nm = chk.getAttribute('name') || '';
        const m = nm.match(/_ds(\d+)$/i);
        if (m) ds.push(`DS${m[1]}`);
    });
    return [...new Set(ds)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}


function extractLeafData(formData, index) {
    let checkedDS = [];
    try {
        checkedDS = readLeafDsFromDOM(index);
    } catch (e) {
        checkedDS = [];
    }

    // Fallback: falls DOM-Query nichts liefert (z.B. falls Checkboxen dynamisch anders benannt sind)
    if (!checkedDS || checkedDS.length === 0) {
        for (const [key, val] of formData.entries()) {
            if (!key) continue;
            if (!key.startsWith(`at_leaf_${index}_ds`)) continue;
            const m = key.match(/_ds(\d+)$/i);
            if (m) checkedDS.push(`DS${m[1]}`);
        }
        checkedDS = [...new Set(checkedDS)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    }

    return {
        text: formData.get(`at_leaf_${index}_text`),
        ds: checkedDS,
        k: formData.get(`at_leaf_${index}_k`),
        s: formData.get(`at_leaf_${index}_s`),
        t: formData.get(`at_leaf_${index}_t`),
        u: formData.get(`at_leaf_${index}_u`),
        // Read-only Feld im UI; wird beim Speichern zusätzlich aus der Impact-Matrix neu berechnet
        i_norm: formData.get(`at_leaf_${index}_i`) || ''
    };
}


// =============================================================
// --- WORST-CASE VERERBUNG K/S/T/U (Anzeige + Speicherung) ---

function _parseKSTUValue(val) {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

function _kstuWorstCase(items) {
    const res = { k: null, s: null, t: null, u: null };
    ['k', 's', 't', 'u'].forEach(key => {
        let max = null;
        if (!items || items.length === 0) {
            res[key] = null;
            return;
        }
        items.forEach(it => {
            if (!it) return;
            const v = _parseKSTUValue(it[key]);
            if (v === null) return;
            if (max === null || v > max) max = v;
        });
        res[key] = (max === null) ? null : String(max);
    });
    return res;
}

// NEU: Hilfsfunktion zur Umwandlung der Matrix-Werte in SCHASAM I(norm)
function getSchasamImpactValue(matrixValue) {
    // matrixValue ist der Wert aus dem Select ("1", "2", "3", "N/A" oder undefined)
    if (matrixValue === '3') return 1.0; // High
    if (matrixValue === '2') return 0.6; // Medium
    if (matrixValue === '1') return 0.3; // Low
    return 0.0; // N/A oder undefiniert
}

function _parseImpactValue(val) {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

/**
 * Konsolidierter Impact-Vektor -> Maximum (Worst Case) nach SCHASAM.
 * - assetId: Asset des Angriffsbaums
 * - dsList: Array wie ["DS1","DS3"]
 * - analysis: aktive Analyse (enthält impactMatrix)
 * Ergebnis: Zahl als String (z.B. "1.0", "0.6") oder "" wenn nicht bestimmbar
 */
function computeLeafImpactNorm(assetId, dsList, analysis) {
    if (!analysis || !analysis.impactMatrix || !assetId) return '';
    if (!dsList || dsList.length === 0) return '';
    const row = analysis.impactMatrix[assetId]; // Objekt z.B. { DS1: "3", DS2: "1" }
    if (!row) return '';

    let maxNorm = 0.0;
    let foundAny = false;

    dsList.forEach(dsId => {
        const rawVal = row[dsId]; // "1", "2", "3", "N/A"
        const normVal = getSchasamImpactValue(rawVal);
        
        // Da N/A = 0.0, prüfen wir auf > maxNorm
        if (normVal > maxNorm) {
            maxNorm = normVal;
        }
        // Wir markieren, dass wir zumindest einen Eintrag geprüft haben
        foundAny = true; 
    });

    if (!foundAny) return '';
    
    // Ausgabe formatieren (z.B. "1" -> "1.0", "0.6")
    if (maxNorm === 0.0) return '0.0';
    return maxNorm.toFixed(1); 
}

/**
 * Übernimmt beim Speichern die Worst-Case Werte (max) der K/S/T/U aus den Blättern
 * in die nächsthöheren Knoten (Branch -> Root).
 */
function applyWorstCaseInheritance(treeData) {
    if (!treeData || !treeData.branches) return treeData;

    treeData.branches.forEach(branch => {
        branch.kstu = _kstuWorstCase(branch.leaves || []);
    });

    treeData.kstu = _kstuWorstCase(treeData.branches.map(b => b.kstu));
    return treeData;
}

/**
 * Impact-Vererbung:
 * - Leaf: I(norm) = max(ImpactMatrix[assetId][DS...] ) über die selektierten DS (SCHASAM gemappt)
 * - Branch: I(norm) = max(Leaf I(norm))
 * - Root: I(norm) = max(Branch I(norm))
 */
function applyImpactInheritance(treeData, analysis) {
    if (!treeData || !treeData.branches) return treeData;
    const assetId = treeData.assetId;

    treeData.branches.forEach(branch => {
        (branch.leaves || []).forEach(leaf => {
            const dsList = (leaf && Array.isArray(leaf.ds)) ? leaf.ds : [];
            // Hier wird jetzt die neue Logik verwendet:
            leaf.i_norm = computeLeafImpactNorm(assetId, dsList, analysis);
        });

        let bMax = 0.0;
        let bFound = false;

        (branch.leaves || []).forEach(leaf => {
            const v = _parseImpactValue(leaf?.i_norm);
            if (v === null) return;
            if (v > bMax) bMax = v;
            bFound = true;
        });
        branch.i_norm = bFound ? bMax.toFixed(1) : '';
    });

    let rMax = 0.0;
    let rFound = false;
    
    treeData.branches.forEach(branch => {
        const v = _parseImpactValue(branch?.i_norm);
        if (v === null) return;
        if (v > rMax) rMax = v;
        rFound = true;
    });
    treeData.i_norm = rFound ? rMax.toFixed(1) : '';

    return treeData;
}

function _renderNodeSummaryHTML(kstu, iNorm) {
    const fmt = (v) => (v === null || v === undefined || v === '') ? '-' : v;
    const iTxt = fmt(iNorm);
    return `Worst-Case: 
        <span><strong>I(norm)</strong>: ${iTxt}</span>
        <span><strong>K</strong>: ${fmt(kstu ? kstu.k : null)}</span>
        <span><strong>S</strong>: ${fmt(kstu ? kstu.s : null)}</span>
        <span><strong>T</strong>: ${fmt(kstu ? kstu.t : null)}</span>
        <span><strong>U</strong>: ${fmt(kstu ? kstu.u : null)}</span>`;
}

/**
 * Aktualisiert:
 * - I(norm) Read-only Textfelder in den Blättern
 * - Read-only Anzeige der vererbten Worst-Case Werte in Root/Branches
 */
function updateAttackTreeKSTUSummariesFromForm() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    const assetId = document.getElementById('atTargetAsset')?.value || '';

    const getLeaf = (idx) => ({
        k: document.querySelector(`select[name="at_leaf_${idx}_k"]`)?.value || '',
        s: document.querySelector(`select[name="at_leaf_${idx}_s"]`)?.value || '',
        t: document.querySelector(`select[name="at_leaf_${idx}_t"]`)?.value || '',
        u: document.querySelector(`select[name="at_leaf_${idx}_u"]`)?.value || ''
    });

    const getLeafDs = (idx) => readLeafDsFromDOM(idx);

    const leafImp = {};
    [1,2,3,4].forEach(idx => {
        const iVal = computeLeafImpactNorm(assetId, getLeafDs(idx), analysis);
        leafImp[idx] = iVal;
        const inp = document.querySelector(`input[name="at_leaf_${idx}_i"]`);
        if (inp) inp.value = iVal;
    });

    const b1 = _kstuWorstCase([getLeaf(1), getLeaf(2)]);
    const b2 = _kstuWorstCase([getLeaf(3), getLeaf(4)]);
    const root = _kstuWorstCase([b1, b2]);

    const b1I = (() => {
        const v1 = _parseImpactValue(leafImp[1]);
        const v2 = _parseImpactValue(leafImp[2]);
        const max = (v1 === null) ? v2 : (v2 === null ? v1 : Math.max(v1, v2));
        return (max === null || max === undefined) ? '' : max.toFixed(1);
    })();

    const b2I = (() => {
        const v1 = _parseImpactValue(leafImp[3]);
        const v2 = _parseImpactValue(leafImp[4]);
        const max = (v1 === null) ? v2 : (v2 === null ? v1 : Math.max(v1, v2));
        return (max === null || max === undefined) ? '' : max.toFixed(1);
    })();

    const rootI = (() => {
        const v1 = _parseImpactValue(b1I);
        const v2 = _parseImpactValue(b2I);
        const max = (v1 === null) ? v2 : (v2 === null ? v1 : Math.max(v1, v2));
        return (max === null || max === undefined) ? '' : max.toFixed(1);
    })();

    const elRoot = document.getElementById('at_root_kstu_summary');
    if (elRoot) elRoot.innerHTML = _renderNodeSummaryHTML(root, rootI);

    const elB1 = document.getElementById('at_branch_1_kstu_summary');
    if (elB1) elB1.innerHTML = _renderNodeSummaryHTML(b1, b1I);

    const elB2 = document.getElementById('at_branch_2_kstu_summary');
    if (elB2) elB2.innerHTML = _renderNodeSummaryHTML(b2, b2I);
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

    
// Live-Update: sobald K/S/T/U, DS-Checkboxen oder Asset geändert wird
const _atShouldUpdate = (t) => {
    if (!t) return false;
    if ((t.classList && t.classList.contains('kstu-select')) || t.id === 'atTargetAsset') return true;
    if (t.type === 'checkbox') return true;
    if (t.closest && t.closest('.ds-checks')) return true; // Klick auf Label/Container
    return false;
};

['change','input','click'].forEach(evtName => {
    attackTreeForm.addEventListener(evtName, (ev) => {
        const t = ev && ev.target ? ev.target : null;
        if (!_atShouldUpdate(t)) return;
        updateAttackTreeKSTUSummariesFromForm();
    });
});

}