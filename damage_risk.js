// =============================================================
// --- DAMAGE SCENARIO LOGIK (CRUD & MATRIX) ---
// =============================================================

function renderDamageScenarios() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsManagementContainer) return;

    let dsList = [];
    const defaultIds = new Set(DEFAULT_DAMAGE_SCENARIOS.map(ds => ds.id));

    if (DEFAULT_DAMAGE_SCENARIOS && DEFAULT_DAMAGE_SCENARIOS.length > 0) {
        dsList = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
    }
    
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
        
        // NEUES LAYOUT:
        // Zeile 1: ID und Name
        // Zeile 2: (Short) (Standard) -> Zeilenumbruch hier
        
        html += `<li data-id="${ds.id}">
            
            <div class="ds-header-row">
                <div style="flex-grow: 1;">
                    <div class="ds-col-id-name">
                        <strong>${ds.id}:</strong> ${ds.name} 
                    </div>
                    <div class="ds-subtitle-row">
                        (${ds.short})
                        ${isDefault ? `<span style="color: #2ecc71; margin-left: 5px; font-weight:600;">(Standard)</span>` : ''}
                    </div>
                </div>
                
                <div class="ds-actions">
                    <button onclick="editDamageScenario('${ds.id}')" class="action-button small" ${isDefault ? 'disabled' : ''}>Bearbeiten</button>
                    <button onclick="removeDamageScenario('${ds.id}')" class="action-button small dangerous" ${isDefault ? 'disabled' : ''}>Löschen</button>
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

// Funktionen explizit ans Window binden, damit sie im HTML onclick funktionieren
window.saveDamageScenario = function(e) {
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

window.editDamageScenario = function(dsId) {
    console.log("Edit DS Triggered for:", dsId);
    if (!activeAnalysisId) return;
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    let ds = analysis.damageScenarios ? analysis.damageScenarios.find(d => d.id === dsId) : null;
    if (!ds) ds = DEFAULT_DAMAGE_SCENARIOS.find(d => d.id === dsId);

    if (!ds) {
        console.error("DS not found:", dsId);
        return;
    }
    
    const titleEl = document.getElementById('dsModalTitle');
    const idField = document.getElementById('dsIdField');
    
    if (titleEl) titleEl.textContent = `Schadensszenario ${ds.id} bearbeiten`;
    if (idField) idField.value = ds.id; 

    document.getElementById('dsName').value = ds.name;
    document.getElementById('dsShort').value = ds.short;
    document.getElementById('dsDescription').value = ds.description;

    const modal = document.getElementById('damageScenarioModal');
    if (modal) modal.style.display = 'block';
};

window.removeDamageScenario = function(dsId) {
    console.log("Remove DS Triggered for:", dsId);
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    if (DEFAULT_DAMAGE_SCENARIOS.some(d => d.id === dsId)) {
        showToast('Standard-Szenarien können nicht gelöscht werden.', 'error');
        return;
    }

    const ds = analysis.damageScenarios.find(d => d.id === dsId);
    if (!ds) {
        console.error("DS to remove not found in custom list:", dsId);
        return;
    }
    
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationTitle');
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');

    if(title) title.textContent = 'Schadensszenario löschen bestätigen';
    msg.innerHTML = `Sind Sie sicher, dass Sie das Schadensszenario <b>${ds.name} (${dsId})</b> löschen möchten? Alle zugehörigen Impact-Bewertungen gehen verloren.`;
    
    btnConfirm.textContent = 'Ja, DS löschen';
    btnConfirm.className = 'primary-button dangerous'; 
    
    modal.style.display = 'block';

    btnConfirm.onclick = null; 
    btnCancel.onclick = null;
    btnClose.onclick = null;
    
    btnConfirm.onclick = () => {
        analysis.damageScenarios = analysis.damageScenarios.filter(d => d.id !== dsId);
        
        if (analysis.impactMatrix) {
            for (const assetId in analysis.impactMatrix) {
                delete analysis.impactMatrix[assetId][dsId];
            }
        }

        saveAnalyses();
        renderDamageScenarios();
        renderImpactMatrix();
        modal.style.display = 'none'; 
        showToast(`Schadensszenario ${dsId} gelöscht.`, 'success');
    };

    const closeFn = () => { modal.style.display = 'none'; };
    btnCancel.onclick = closeFn;
    btnClose.onclick = closeFn;
}

// Hilfsfunktion für Farben
function getImpactColorClass(val) {
    if (val === '3') return 'impact-high';
    if (val === '2') return 'impact-medium';
    if (val === '1') return 'impact-low';
    if (val === 'N/A') return 'impact-na';
    return '';
}

window.updateImpactScore = function(assetId, dsId, newValue, selectElement) {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    if (!analysis.impactMatrix) analysis.impactMatrix = {};
    if (!analysis.impactMatrix[assetId]) {
        analysis.impactMatrix[assetId] = {};
    }
    
    analysis.impactMatrix[assetId][dsId] = newValue;
    
    // Farbe live aktualisieren
    if (selectElement) {
        selectElement.className = 'impact-select ' + getImpactColorClass(newValue);
    }

    saveAnalyses();
    showToast(`Impact für ${assetId}/${dsId} auf ${newValue} gesetzt.`, 'info');
    
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
            const colorClass = getImpactColorClass(currentScore);
            
            html += '<td class="score-cell">';
            // Übergebe 'this' an die Funktion, um direkten DOM-Zugriff zu haben
            html += `<select 
                data-asset-id="${asset.id}" 
                data-ds-id="${ds.id}" 
                onchange="updateImpactScore('${asset.id}', '${ds.id}', this.value, this)"
                class="impact-select ${colorClass}">
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


// =============================================================
// --- RISIKOANALYSE & ANGRIFFSBAUM LOGIK ---
// =============================================================

function renderRiskAnalysis() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!riskAnalysisContainer) return; 

    if (!analysis.assets || analysis.assets.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Assets</h4>
                <p>Es wurden noch keine Schutzobjekte (Assets) im Reiter "Assets" erfasst.</p>
            </div>
        `;
        return;
    }

    const allDS = [...DEFAULT_DAMAGE_SCENARIOS, ...(analysis.damageScenarios || [])];
    if (allDS.length === 0) {
        riskAnalysisContainer.innerHTML = `
            <div class="warning-box">
                <h4>Fehlende Daten: Schadensszenarien</h4>
                <p>Bitte definieren Sie zuerst Schadensszenarien.</p>
            </div>
        `;
        return;
    }
    
    riskAnalysisContainer.innerHTML = `
        <div class="success-box" style="margin-bottom:20px;">
            <div style="display:flex; gap:10px;">
                <button id="btnOpenAttackTreeModal" class="primary-button large"><i class="fas fa-sitemap"></i> Neuen Angriffsbaum erstellen</button>
                <button onclick="downloadDotFile()" class="action-button large"><i class="fas fa-file-export"></i> Export (.dot)</button>
            </div>
        </div>
        <div id="existingRiskEntriesContainer">
            ${renderExistingRiskEntries(analysis)}
        </div>
    `;

    const btn = document.getElementById('btnOpenAttackTreeModal');
    if (btn) btn.onclick = () => openAttackTreeModal(); 
}

function renderExistingRiskEntries(analysis) {
    if (!analysis.riskEntries || analysis.riskEntries.length === 0) {
        return '<p style="color: #7f8c8d;">Noch keine Angriffs-Bäume angelegt.</p>';
    }

    let html = '<h4>Gespeicherte Angriffsbäume:</h4><ul style="list-style:none; padding:0;">';
    analysis.riskEntries.forEach(entry => {
        const rootRisk = entry.rootRiskValue || '-';
        
        // Berechnung Risikoklasse und Label
        let rColor = '#7f8c8d';
        let rLabel = 'Unbekannt';

        const rVal = parseFloat(rootRisk);
        if(!isNaN(rVal)) {
            if(rVal >= 2.0) {
                rColor = '#c0392b';
                rLabel = 'Kritisch';
            } else if(rVal >= 1.6) {
                rColor = '#e67e22';
                rLabel = 'Hoch';
            } else if(rVal >= 0.8) {
                rColor = '#f39c12';
                rLabel = 'Mittel';
            } else {
                rColor = '#27ae60';
                rLabel = 'Niedrig';
            }
        }

        html += `
            <li style="background:#fff; border:1px solid #ddd; padding:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border-left: 5px solid ${rColor};">
                <div>
                    <strong>${entry.id}</strong>: ${entry.rootName} <br> 
                    <span style="color:#666; font-size:0.9em;">
                        Risk Score (R): <b style="color:${rColor}">${rootRisk}</b> 
                        <span style="margin-left:5px; padding:2px 6px; border-radius:3px; background:${rColor}; color:#fff; font-size:0.8em;">${rLabel}</span>
                    </span>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="editAttackTree('${entry.id}')" class="action-button small">
                        <i class="fas fa-edit"></i> Bearbeiten
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

window.editAttackTree = function(riskId) {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;
    openAttackTreeModal(entry);
};

function reindexRiskIDs(analysis) {
    if (!analysis || !analysis.riskEntries) return;
    analysis.riskEntries.forEach((entry, index) => {
        const newId = 'R' + (index + 1).toString().padStart(2, '0');
        entry.id = newId;
    });
}

window.deleteAttackTree = function(riskId) {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis || !analysis.riskEntries) return;

    const entry = analysis.riskEntries.find(r => r.id === riskId);
    if (!entry) return;

    // FIX: Explizite DOM-Elemente holen (ReferenceError Fix)
    const modal = document.getElementById('confirmationModal');
    const title = document.getElementById('confirmationTitle');
    const msg = document.getElementById('confirmationMessage');
    const btnConfirm = document.getElementById('btnConfirmAction');
    const btnCancel = document.getElementById('btnCancelConfirmation');
    const btnClose = document.getElementById('closeConfirmationModal');

    if(title) title.textContent = 'Angriffsbaum löschen';
    msg.innerHTML = `Möchten Sie den Angriffsbaum <b>${entry.id}: ${entry.rootName}</b> wirklich löschen?`;

    btnConfirm.textContent = 'Löschen';
    btnConfirm.className = 'primary-button dangerous';

    modal.style.display = 'block';

    // Events bereinigen
    btnConfirm.onclick = null;
    btnCancel.onclick = null;
    btnClose.onclick = null;

    btnConfirm.onclick = () => {
        analysis.riskEntries = analysis.riskEntries.filter(r => r.id !== riskId);
        reindexRiskIDs(analysis);
        saveAnalyses();
        
        // Modal und AttackTree Modal schließen, falls offen
        if (typeof attackTreeModal !== 'undefined' && attackTreeModal) attackTreeModal.style.display = 'none';
        modal.style.display = 'none';
        
        renderRiskAnalysis();
        showToast(`Angriffsbaum gelöscht.`, 'success');
    };

    const closeFn = () => { modal.style.display = 'none'; };
    btnCancel.onclick = closeFn;
    btnClose.onclick = closeFn;
};

// UI HELPER: TOGGLE DEPTH
function setTreeDepth(isDeep) {
    const cols = document.querySelectorAll('.col-level-2');
    const inputUseDeep = document.getElementById('use_deep_tree');
    const btn = document.getElementById('btnToggleTreeDepth');

    if (isDeep) {
        cols.forEach(el => el.style.display = 'table-cell');
        if (inputUseDeep) inputUseDeep.value = 'true';
        if (btn) btn.innerHTML = '<i class="fas fa-minus"></i> Zwischenebene ausblenden';
    } else {
        cols.forEach(el => el.style.display = 'none');
        if (inputUseDeep) inputUseDeep.value = 'false';
        if (btn) btn.innerHTML = '<i class="fas fa-layer-group"></i> Zwischenebene einblenden';
    }
    updateAttackTreeKSTUSummariesFromForm(); 
}

// FIX: Default value is now the Scalar name (K, S, T, U)
function populateAttackTreeDropdowns() {
    const selects = document.querySelectorAll('.kstu-select');
    selects.forEach(select => {
        const name = select.getAttribute('name');
        if (!name) return;
        
        let type = null;
        if (name.endsWith('_k')) type = 'K';
        else if (name.endsWith('_s')) type = 'S';
        else if (name.endsWith('_t')) type = 'T';
        else if (name.endsWith('_u')) type = 'U';
        
        if (type && PROBABILITY_CRITERIA[type]) {
            const currentVal = select.value;
            select.innerHTML = ''; 

            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = type; // Zeigt Buchstaben
            emptyOpt.style.fontWeight = 'bold';
            emptyOpt.style.color = '#888';
            select.appendChild(emptyOpt);
            
            PROBABILITY_CRITERIA[type].options.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.value;
                el.textContent = opt.text;
                select.appendChild(el);
            });
            
            if (currentVal) select.value = currentVal;
        }
    });
}

function openAttackTreeModal(existingEntry = null) {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    if (attackTreeForm) attackTreeForm.reset();
    
    // Zuerst Dropdowns befüllen
    populateAttackTreeDropdowns();
    
    const hiddenIdField = document.getElementById('at_id');
    const previewContainer = document.getElementById('graph-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    
    setTreeDepth(false); 

    if (existingEntry) {
        if (hiddenIdField) hiddenIdField.value = existingEntry.id;
        
        const hasL2 = existingEntry.useDeepTree === true;
        setTreeDepth(hasL2);
        
        const rootInput = document.querySelector('input[name="at_root"]');
        if (rootInput) rootInput.value = existingEntry.rootName;

        const loadLeaf = (leafData, leafIndex) => {
            if (!leafData) return;
            const prefix = `at_leaf_${leafIndex}`;
            
            const txt = document.querySelector(`input[name="${prefix}_text"]`);
            if (txt) txt.value = leafData.text || '';
            
            ['k', 's', 't', 'u'].forEach(param => {
                const sel = document.querySelector(`select[name="${prefix}_${param}"]`);
                if (sel) {
                    let val = leafData[param]; 
                    if ((val === undefined || val === null) && leafData.kstu) {
                        val = leafData.kstu[param];
                    }
                    sel.value = (val !== undefined && val !== null) ? String(val) : '';
                }
            });

            document.querySelectorAll(`input[type="checkbox"][name^="${prefix}_ds"]`).forEach(c => { if (c) c.checked = false; });
            if (leafData.ds && Array.isArray(leafData.ds)) {
                leafData.ds.forEach(dsVal => {
                    const num = dsVal.replace('DS', '');
                    const chk = document.querySelector(`input[name="${prefix}_ds${num}"]`);
                    if (chk) chk.checked = true;
                });
            }
        };

        if (existingEntry.branches[0]) {
            const b1 = existingEntry.branches[0];
            document.querySelector('input[name="at_branch_1"]').value = b1.name || '';
            if (hasL2 && b1.l2_node) {
                 const l2Inp = document.querySelector('input[name="at_branch_1_l2"]');
                 if(l2Inp) l2Inp.value = b1.l2_node.name || '';
            }
            loadLeaf(b1.leaves[0], 1);
            loadLeaf(b1.leaves[1], 2);
        }

        if (existingEntry.branches[1]) {
            const b2 = existingEntry.branches[1];
            document.querySelector('input[name="at_branch_2"]').value = b2.name || '';
            if (hasL2 && b2.l2_node) {
                 const l2Inp = document.querySelector('input[name="at_branch_2_l2"]');
                 if(l2Inp) l2Inp.value = b2.l2_node.name || '';
            }
            loadLeaf(b2.leaves[0], 3);
            loadLeaf(b2.leaves[1], 4);
        }
        
    } else {
        if (hiddenIdField) hiddenIdField.value = ''; 
    }

    const btnToggle = document.getElementById('btnToggleTreeDepth');
    if (btnToggle) {
        btnToggle.onclick = () => {
            const current = document.getElementById('use_deep_tree').value === 'true';
            setTreeDepth(!current);
        };
    }

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

    updateAttackTreeKSTUSummariesFromForm();
    if (attackTreeModal) attackTreeModal.style.display = 'block';
}

function saveAttackTree(e) {
    if (e) e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const fd = new FormData(attackTreeForm);
    const editingId = fd.get('at_id');
    const useDeepTree = document.getElementById('use_deep_tree').value === 'true';

    const treeData = {
        id: editingId || generateNextRiskID(analysis),
        rootName: fd.get('at_root'),
        useDeepTree: useDeepTree,
        branches: [
            {
                name: fd.get('at_branch_1'),
                l2_node: useDeepTree ? { name: fd.get('at_branch_1_l2') } : null,
                leaves: [
                    extractLeafData(fd, 1),
                    extractLeafData(fd, 2)
                ]
            },
            {
                name: fd.get('at_branch_2'),
                l2_node: useDeepTree ? { name: fd.get('at_branch_2_l2') } : null,
                leaves: [
                    extractLeafData(fd, 3),
                    extractLeafData(fd, 4)
                ]
            }
        ]
    };

    applyImpactInheritance(treeData, analysis);
    applyWorstCaseInheritance(treeData);
    
    const rootKSTU = treeData.kstu; 
    const rootI = parseFloat(treeData.i_norm) || 0;
    const sumP = (parseFloat(rootKSTU.k)||0) + (parseFloat(rootKSTU.s)||0) + (parseFloat(rootKSTU.t)||0) + (parseFloat(rootKSTU.u)||0);
    treeData.rootRiskValue = (rootI * sumP).toFixed(2);

    if (!analysis.riskEntries) analysis.riskEntries = [];

    if (editingId) {
        const index = analysis.riskEntries.findIndex(r => r.id === editingId);
        if (index > -1) {
            analysis.riskEntries[index] = treeData;
            showToast(`Angriffsbaum aktualisiert.`, 'success');
        } else {
            analysis.riskEntries.push(treeData);
        }
    } else {
        analysis.riskEntries.push(treeData);
        showToast(`Angriffsbaum gespeichert.`, 'success');
    }
    
    reindexRiskIDs(analysis);
    
    saveAnalyses();
    if (attackTreeModal) attackTreeModal.style.display = 'none';
    renderRiskAnalysis(); 
}

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
    } catch (e) { checkedDS = []; }

    if (checkedDS.length === 0) {
         for (const [key, val] of formData.entries()) {
            if (!key) continue;
            if (!key.startsWith(`at_leaf_${index}_ds`)) continue;
            const m = key.match(/_ds(\d+)$/i);
            if (m) checkedDS.push(`DS${m[1]}`);
        }
    }

    return {
        text: formData.get(`at_leaf_${index}_text`),
        ds: checkedDS,
        k: formData.get(`at_leaf_${index}_k`),
        s: formData.get(`at_leaf_${index}_s`),
        t: formData.get(`at_leaf_${index}_t`),
        u: formData.get(`at_leaf_${index}_u`),
        i_norm: formData.get(`at_leaf_${index}_i`) || ''
    };
}


// --- CALCULATION LOGIC ---

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
            let raw = it[key];
            if (it.kstu && it.kstu[key]) raw = it.kstu[key];
            const v = _parseKSTUValue(raw);
            if (v === null) return;
            if (max === null || v > max) max = v;
        });
        res[key] = (max === null) ? null : String(max);
    });
    return res;
}

function computeLeafImpactNorm(dsList, analysis) {
    if (!analysis || !analysis.impactMatrix) return '';
    if (!dsList || dsList.length === 0) return '';
    if (!analysis.assets || analysis.assets.length === 0) return '';

    let maxWeightedImpact = 0.0;
    let foundAny = false;

    analysis.assets.forEach(asset => {
        const row = analysis.impactMatrix[asset.id];
        if (!row) return;

        let gFactor = 0.6; 
        if (asset.schutzbedarf === 'III') gFactor = 1.0;
        else if (asset.schutzbedarf === 'II') gFactor = 0.8;
        else if (asset.schutzbedarf === 'I') gFactor = 0.6;
        
        dsList.forEach(dsId => {
            const rawVal = row[dsId]; 
            let sFactor = 0.0;
            if (rawVal === '3') sFactor = 1.0;       
            else if (rawVal === '2') sFactor = 0.6;  
            else if (rawVal === '1') sFactor = 0.3;  
            
            if (sFactor > 0) {
                const currentWeightedImpact = sFactor * gFactor;
                if (currentWeightedImpact > maxWeightedImpact) maxWeightedImpact = currentWeightedImpact;
                foundAny = true;
            }
        });
    });

    if (!foundAny && maxWeightedImpact === 0.0) return '';
    if (maxWeightedImpact === 0.0) return '0.0';
    return maxWeightedImpact.toFixed(2);
}

function applyWorstCaseInheritance(treeData) {
    if (!treeData || !treeData.branches) return treeData;

    treeData.branches.forEach(branch => {
        const leavesWC = _kstuWorstCase(branch.leaves || []);
        
        if (treeData.useDeepTree && branch.l2_node) {
            branch.l2_node.kstu = leavesWC;
            branch.kstu = _kstuWorstCase([branch.l2_node]);
        } else {
            branch.kstu = leavesWC;
        }
    });

    treeData.kstu = _kstuWorstCase(treeData.branches.map(b => b.kstu));
    return treeData;
}

function _parseImpactValue(val) {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

function applyImpactInheritance(treeData, analysis) {
    if (!treeData || !treeData.branches) return treeData;

    treeData.branches.forEach(branch => {
        (branch.leaves || []).forEach(leaf => {
            const dsList = (leaf && Array.isArray(leaf.ds)) ? leaf.ds : [];
            leaf.i_norm = computeLeafImpactNorm(dsList, analysis);
        });

        let bMax = 0.0;
        let bFound = false;
        (branch.leaves || []).forEach(leaf => {
            const v = _parseImpactValue(leaf?.i_norm);
            if (v === null) return;
            if (v > bMax) bMax = v;
            bFound = true;
        });
        
        const leavesMaxI = bFound ? bMax.toFixed(2) : '';

        if (treeData.useDeepTree && branch.l2_node) {
            branch.l2_node.i_norm = leavesMaxI;
            branch.i_norm = leavesMaxI; 
        } else {
            branch.i_norm = leavesMaxI;
        }
    });

    let rMax = 0.0;
    let rFound = false;
    treeData.branches.forEach(branch => {
        const v = _parseImpactValue(branch?.i_norm);
        if (v === null) return;
        if (v > rMax) rMax = v;
        rFound = true;
    });
    treeData.i_norm = rFound ? rMax.toFixed(2) : '';

    return treeData;
}

function _renderNodeSummaryHTML(kstu, iNorm) {
    const valK = parseFloat(kstu?.k) || 0;
    const valS = parseFloat(kstu?.s) || 0;
    const valT = parseFloat(kstu?.t) || 0;
    const valU = parseFloat(kstu?.u) || 0;
    const valI = parseFloat(iNorm) || 0;

    const sumP = valK + valS + valT + valU;
    const riskR = (valI * sumP).toFixed(2);
    
    const dispI = (iNorm === '' || iNorm === null) ? '-' : iNorm;
    const dispK = (kstu?.k === null || kstu?.k === '') ? '-' : kstu.k;
    const dispS = (kstu?.s === null || kstu?.s === '') ? '-' : kstu.s;
    const dispT = (kstu?.t === null || kstu?.t === '') ? '-' : kstu.t;
    const dispU = (kstu?.u === null || kstu?.u === '') ? '-' : kstu.u;

    let riskClass = 'risk-val-low';
    const R = parseFloat(riskR);
    if (R >= 2.0) riskClass = 'risk-val-critical';
    else if (R >= 1.6) riskClass = 'risk-val-high';
    else if (R >= 0.8) riskClass = 'risk-val-medium';
    else if (R > 0) riskClass = 'risk-val-low'; 

    return `
        <div class="ns-row" style="background-color: #f0f0f0;">
            <div style="display:flex; align-items:center;">
                <span class="ns-label">R=</span>
                <span class="ns-value ${riskClass}">${riskR}</span>
            </div>
            <div style="display:flex; align-items:center;">
                <span class="ns-label" style="font-size:0.9em; min-width:auto; margin-left:10px;">I(N)=</span>
                <span class="ns-value">${dispI}</span>
            </div>
        </div>
        <div class="ns-row" style="border-bottom:none; font-size:0.8em; color:#666;">
            <div class="ns-kstu">
                <span>K:${dispK}</span>
                <span>S:${dispS}</span>
                <span>T:${dispT}</span>
                <span>U:${dispU}</span>
            </div>
        </div>
    `;
}

function updateAttackTreeKSTUSummariesFromForm() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    const useDeepTree = document.getElementById('use_deep_tree').value === 'true';

    const getLeafDs = (idx) => readLeafDsFromDOM(idx);
    const getLeafKSTU = (idx) => ({
        k: document.querySelector(`select[name="at_leaf_${idx}_k"]`)?.value || '',
        s: document.querySelector(`select[name="at_leaf_${idx}_s"]`)?.value || '',
        t: document.querySelector(`select[name="at_leaf_${idx}_t"]`)?.value || '',
        u: document.querySelector(`select[name="at_leaf_${idx}_u"]`)?.value || ''
    });

    const formValues = {
        useDeepTree: useDeepTree,
        branches: [
            {
                l2_node: useDeepTree ? {} : null,
                leaves: [
                    { ds: getLeafDs(1), kstu: getLeafKSTU(1) },
                    { ds: getLeafDs(2), kstu: getLeafKSTU(2) }
                ]
            },
            {
                l2_node: useDeepTree ? {} : null,
                leaves: [
                    { ds: getLeafDs(3), kstu: getLeafKSTU(3) },
                    { ds: getLeafDs(4), kstu: getLeafKSTU(4) }
                ]
            }
        ]
    };
    
    applyImpactInheritance(formValues, analysis);
    applyWorstCaseInheritance(formValues);

    const elRoot = document.getElementById('at_root_kstu_summary');
    if (elRoot) elRoot.innerHTML = _renderNodeSummaryHTML(formValues.kstu, formValues.i_norm);

    [0, 1].forEach((bIdx) => {
        const branchNum = bIdx + 1;
        const branchData = formValues.branches[bIdx];
        
        const elB1 = document.getElementById(`at_branch_${branchNum}_kstu_summary`);
        if (elB1) elB1.innerHTML = _renderNodeSummaryHTML(branchData.kstu, branchData.i_norm);
        
        if (useDeepTree) {
            const elL2 = document.getElementById(`at_branch_${branchNum}_l2_kstu_summary`);
            if (elL2) elL2.innerHTML = _renderNodeSummaryHTML(branchData.l2_node.kstu, branchData.l2_node.i_norm);
        }
    });

    const leaves = [
        formValues.branches[0].leaves[0], formValues.branches[0].leaves[1],
        formValues.branches[1].leaves[0], formValues.branches[1].leaves[1]
    ];
    
    leaves.forEach((leaf, idx) => {
        const leafNum = idx + 1;
        const inp = document.querySelector(`input[name="at_leaf_${leafNum}_i"]`);
        if (inp) inp.value = leaf.i_norm;
        
        const elL = document.getElementById(`at_leaf_${leafNum}_summary`);
        if (elL) elL.innerHTML = _renderNodeSummaryHTML(leaf.kstu, leaf.i_norm); 
    });
}

if (attackTreeForm) {
    attackTreeForm.onsubmit = saveAttackTree;

    const _atShouldUpdate = (t) => {
        if (!t) return false;
        if (t.classList && t.classList.contains('kstu-select')) return true;
        if (t.type === 'checkbox') return true;
        if (t.closest && t.closest('.ds-checks')) return true; 
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

function generateNextRiskID(analysis) {
    if (!analysis.riskEntries) return 'R01';
    return 'R' + (analysis.riskEntries.length + 1).toString().padStart(2, '0');
}


// --- GRAPHVIZ GENERATOR (WASM) ---

function generateDotString(analysis, specificTreeId = null) {
    if (!analysis || !analysis.riskEntries || analysis.riskEntries.length === 0) {
        return null;
    }

    let dot = 'digraph {\n\n';
    dot += '    node [shape=record, fontname="Arial", fontsize=10];\n';
    dot += '    edge [fontname="Arial", fontsize=9];\n';
    dot += '    rankdir=TB;\n'; 
    dot += '    overlap = false;\n    splines = ortho;\n\n'; 

    const _fmt = (val) => {
        if (val === null || val === undefined || val === '') return '0,0';
        return String(val).replace('.', ',');
    };

    const _pStr = (kstu) => {
        if (!kstu) return '- / - / - / -';
        const k = _fmt(kstu.k);
        const s = _fmt(kstu.s);
        const t = _fmt(kstu.t);
        const u = _fmt(kstu.u);
        return `${k} / ${s} / ${t} / ${u}`;
    };

    const _calcR = (iNorm, kstu) => {
        const iVal = parseFloat(String(iNorm).replace(',', '.')) || 0;
        const k = parseFloat(kstu?.k) || 0;
        const s = parseFloat(kstu?.s) || 0;
        const t = parseFloat(kstu?.t) || 0;
        const u = parseFloat(kstu?.u) || 0;
        const pSum = k + s + t + u;
        return _fmt((iVal * pSum).toFixed(2));
    };

    const _lbl = (text, kstu, iNorm) => {
        const p = _pStr(kstu);
        const i = _fmt(iNorm);
        const r = _calcR(i, kstu);
        const cleanText = (text || '').replace(/[\{\}<>|"]/g, "'");
        return `{${cleanText} | P = ${p} | I[norm] = ${i} | R = ${r}}`;
    };

    const _getColor = (iNorm, kstu) => {
        const iVal = parseFloat(String(iNorm).replace(',', '.')) || 0;
        const pSum = (parseFloat(kstu?.k)||0) + (parseFloat(kstu?.s)||0) + (parseFloat(kstu?.t)||0) + (parseFloat(kstu?.u)||0);
        const r = iVal * pSum;
        if(r >= 2.0) return '#ffcccc'; 
        if(r >= 1.6) return '#ffe0b3'; 
        if(r >= 0.8) return '#ffffcc'; 
        return '#ccffcc'; 
    };

    let entriesToProcess = analysis.riskEntries;
    if (specificTreeId) {
        entriesToProcess = analysis.riskEntries.filter(e => e.id === specificTreeId);
    }

    entriesToProcess.forEach(entry => {
        const riskId = entry.id;
        const rootId = `${riskId}_Root`;
        const rootFill = _getColor(entry.i_norm, entry.kstu);
        
        dot += `    // Tree ${riskId}\n`;
        dot += `    ${rootId} [label="${_lbl(entry.rootName, entry.kstu, entry.i_norm)}", style=filled, fillcolor="${rootFill}"]\n`;

        entry.branches.forEach((branch, bIdx) => {
            const bId = `${riskId}_B${bIdx+1}`;
            if (branch.name) {
                const bFill = _getColor(branch.i_norm, branch.kstu);
                dot += `    ${bId} [label="${_lbl(branch.name, branch.kstu, branch.i_norm)}", style=filled, fillcolor="${bFill}"]\n`;
            }

            let l2Id = null;
            if (entry.useDeepTree && branch.l2_node && branch.l2_node.name) {
                l2Id = `${riskId}_B${bIdx+1}_L2`;
                const l2Fill = _getColor(branch.l2_node.i_norm, branch.l2_node.kstu);
                dot += `    ${l2Id} [label="${_lbl(branch.l2_node.name, branch.l2_node.kstu, branch.l2_node.i_norm)}", style=filled, fillcolor="${l2Fill}"]\n`;
            }

            if (branch.leaves) {
                branch.leaves.forEach((leaf, lIdx) => {
                    if (leaf.text) {
                        const lId = `${riskId}_B${bIdx+1}_Leaf${lIdx+1}`;
                        const lFill = _getColor(leaf.i_norm, leaf); 
                        dot += `    ${lId} [label="${_lbl(leaf.text, leaf, leaf.i_norm)}", style=filled, fillcolor="${lFill}"]\n`;
                    }
                });
            }
        });
        
        dot += '\n';

        entry.branches.forEach((branch, bIdx) => {
            if (!branch.name) return;
            const bId = `${riskId}_B${bIdx+1}`;
            
            dot += `    ${rootId} -> ${bId}\n`;

            let parentForLeaves = bId;
            if (entry.useDeepTree && branch.l2_node && branch.l2_node.name) {
                const l2Id = `${riskId}_B${bIdx+1}_L2`;
                dot += `    ${bId} -> ${l2Id}\n`;
                parentForLeaves = l2Id;
            }

            if (branch.leaves) {
                branch.leaves.forEach((leaf, lIdx) => {
                    if (leaf.text) {
                        const lId = `${riskId}_B${bIdx+1}_Leaf${lIdx+1}`;
                        dot += `    ${parentForLeaves} -> ${lId}\n`;
                    }
                });
            }
        });
        dot += '\n';
    });

    dot += '}\n';
    return dot;
}

// Wir definieren exportRiskAnalysisToDot als Alias für generateDotString
window.exportRiskAnalysisToDot = generateDotString;

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeAttackTreeModal');
    const modal = document.getElementById('attackTreeModal');
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
});

// =============================================================
// --- EXPORT TRIGGER FÜR .DOT DATEI ---
// =============================================================

window.downloadDotFile = function() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    const dotContent = typeof generateDotString === 'function' ? generateDotString(analysis) : null;
    
    if (!dotContent) {
        if (typeof showToast === 'function') {
            showToast('Keine Daten für den Export vorhanden.', 'warning');
        } else {
            alert('Keine Daten für den Export vorhanden.');
        }
        return;
    }

    try {
        const blob = new Blob([dotContent], { type: 'text/vnd.graphviz' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const fileName = `TARA_Export_${activeAnalysisId || 'Analysis'}.dot`;
        
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Aufräumen
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);

        if (typeof showToast === 'function') {
            showToast('.dot Datei wurde erfolgreich erstellt.', 'success');
        }
    } catch (err) {
        console.error("Fehler beim DOT-Export:", err);
        if (typeof showToast === 'function') {
            showToast('Export fehlgeschlagen.', 'error');
        }
    }
};