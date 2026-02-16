// =============================================================
// --- DAMAGE SCENARIO LOGIC (CRUD & MATRIX) ---
// =============================================================

// Explicit DOM references (more robust than implicit window ID globals)
const dsManagementContainer = document.getElementById('dsManagementContainer');
const btnAddDamageScenario = document.getElementById('btnAddDamageScenario');
const damageScenarioModal = document.getElementById('damageScenarioModal');
const closeDamageScenarioModal = document.getElementById('closeDamageScenarioModal');
const damageScenarioForm = document.getElementById('damageScenarioForm');

// Default IDs centrally defined (needed in multiple functions).
// Important: Do not define in scope of renderDamageScenarios(), otherwise edit/delete handlers break.
const DEFAULT_DS_IDS = new Set(
    (typeof DEFAULT_DAMAGE_SCENARIOS !== 'undefined' && Array.isArray(DEFAULT_DAMAGE_SCENARIOS)
        ? DEFAULT_DAMAGE_SCENARIOS
        : []
    ).map(ds => ds.id)
);

function renderDamageScenarios() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    if (!dsManagementContainer) return;

    let dsList = [];

    if (DEFAULT_DAMAGE_SCENARIOS && DEFAULT_DAMAGE_SCENARIOS.length > 0) {
        dsList = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS));
    }
    
    if (analysis.damageScenarios && Array.isArray(analysis.damageScenarios)) {
        analysis.damageScenarios.forEach(ds => {
            if (ds && ds.id && !DEFAULT_DS_IDS.has(ds.id)) {
                dsList.push(ds);
            }
        });
    }

    dsList.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));

    let html = '<h4>Definierte Schadens-Szenarien:</h4>';
    html += '<p style="font-size: 0.9em; color: #7f8c8d;">Verwalten Sie die Damage Scenarios (DS), die zur Bewertung der Assets verwendet werden.</p>';
    html += '<ul class="ds-list">';
    
    dsList.forEach(ds => {
        const isDefault = DEFAULT_DS_IDS.has(ds.id);
        
        // NEW LAYOUT:
        // Row 1: ID and Name
        // Row 2: (Short) (Standard) -> line break here
        
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
                
                ${isDefault ? '' : `
                <div class="ds-actions">
                    <button type="button" onclick="editDamageScenario('${ds.id}')" class="action-button small">Bearbeiten</button>
                    <button type="button" onclick="removeDamageScenario('${ds.id}')" class="action-button small dangerous">Löschen</button>
                </div>`}
            </div>

            <div class="ds-col-description">
                ${ds.description || '— Keine Beschreibung —'}
            </div>

        </li>`;
    });

    html += '</ul>';
    dsManagementContainer.innerHTML = html;
}

// Bind functions explicitly to window so they work in HTML onclick
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
        // EDIT
        const index = analysis.damageScenarios.findIndex(ds => ds.id === dsId);
        if (index !== -1) {
            analysis.damageScenarios[index] = { id: dsId, name, short, description };
            showToast(`Schadensszenario ${dsId} aktualisiert.`, 'success');
        }
    } else {
        // CREATE NEW
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
    if (DEFAULT_DS_IDS.has(dsId)) {
        showToast('Standard-Szenarien können nicht bearbeitet werden.');
        return;
    }

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
    if (DEFAULT_DS_IDS.has(dsId)) {
        showToast('Standard-Szenarien können nicht gelöscht werden.');
        return;
    }

    console.log("Remove DS Triggered for:", dsId);
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;
    
    if (DEFAULT_DAMAGE_SCENARIOS.some(d => d.id === dsId)) {
        showToast('Standard-Szenarien können nicht gelöscht werden.', 'error');
        return;
    }

    const ds = (analysis.damageScenarios || []).find(d => d.id === dsId);
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

// =============================================================
// --- UI WIRING (Button/Modal/Form) ---
// =============================================================

// Form submit (new + edit)
if (damageScenarioForm) {
    damageScenarioForm.onsubmit = window.saveDamageScenario;
}

// "New" button in the management view
if (btnAddDamageScenario) {
    btnAddDamageScenario.onclick = () => {
        if (!activeAnalysisId) {
            showToast('Bitte erst eine Analyse wählen/erstellen.', 'warning');
            return;
        }

        const titleEl = document.getElementById('dsModalTitle');
        const idField = document.getElementById('dsIdField');
        if (titleEl) titleEl.textContent = 'Neues Schadensszenario';
        if (idField) idField.value = '';

        // Reset fields
        if (damageScenarioForm) damageScenarioForm.reset();
        const desc = document.getElementById('dsDescription');
        if (desc) desc.value = '';

        if (damageScenarioModal) damageScenarioModal.style.display = 'block';
    };
}

// Close (X)
if (closeDamageScenarioModal) {
    closeDamageScenarioModal.onclick = () => {
        if (damageScenarioModal) damageScenarioModal.style.display = 'none';
    };
}

// Helper function for colors
