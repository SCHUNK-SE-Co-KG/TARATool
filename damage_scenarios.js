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
