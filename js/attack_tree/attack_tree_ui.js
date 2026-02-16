/**
 * @file        attack_tree_ui.js
 * @description Attack tree form UI – dropdowns, save/load, and DOM helpers
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

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
            emptyOpt.textContent = type; // Display letter
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
    // `analysisData` / `activeAnalysisId` are declared as top-level `let` in globals.js.
    // Top-level `let` does NOT create a `window.*` property, so we must use the lexical globals.
    const analysis = (typeof analysisData !== 'undefined' ? analysisData : []).find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    // Reset form (browser-implicit global by id)
    if (window.attackTreeForm) window.attackTreeForm.reset();

    try { if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns(); } catch (e) {}

    const previewContainer = document.getElementById('graph-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';

    // Delete button (entire tree)
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

    // Open editor
    if (window.atV2 && typeof window.atV2.open === 'function') {
        window.atV2.open(existingEntry);
    }

    // Root live sync
    const rootInput = document.querySelector('input[name="at_root"]');
    if (rootInput) {
        rootInput.oninput = () => {
            try { if (window.atV2) window.atV2.rerender(); } catch (_) {}
        };
    }

    const modal = document.getElementById('attackTreeModal');
    if (modal) modal.style.display = 'block';
}

function saveAttackTree(e) {
    if (e) e.preventDefault();

    const analysis = (typeof analysisData !== 'undefined' ? analysisData : []).find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    if (!analysis.riskEntries) analysis.riskEntries = [];

    const entry = (window.atV2 && typeof window.atV2.getEntryData === 'function')
        ? window.atV2.getEntryData({ computeOnly: false })
        : null;

    if (!entry) return;

    const existingIdx = analysis.riskEntries.findIndex(r => r.id === entry.id);
    if (existingIdx >= 0) {
        analysis.riskEntries[existingIdx] = entry;
        if (typeof showToast === 'function') showToast('Angriffsbaum aktualisiert.', 'success');
    } else {
        analysis.riskEntries.push(entry);
        if (typeof showToast === 'function') showToast('Angriffsbaum hinzugefügt.', 'success');
    }

    try { if (typeof reindexRiskIDs === 'function') reindexRiskIDs(analysis); } catch (_) {}

    try {
        if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
            syncResidualRiskFromRiskAnalysis(analysis, false);
        }
    } catch (_) {}

    try { if (typeof saveAnalyses === 'function') saveAnalyses(); } catch (_) {}

    const modal = document.getElementById('attackTreeModal');
    if (modal) modal.style.display = 'none';

    try { if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis(); } catch (_) {}
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

// Initialize "Add impact" buttons
document.addEventListener('DOMContentLoaded', () => {
    try { initAttackTreeImpactAdders(); } catch (e) {}
    try { initAttackTreeImpactRemovers(); } catch (e) {}
    try { initAttackTreeLeafRemovers(); } catch (e) {}
});



// DOT Preview from current editor
window.renderCurrentTreePreview = function() {
    const analysis = (typeof analysisData !== 'undefined' ? analysisData : []).find(a => a.id === activeAnalysisId);
    const previewContainer = document.getElementById('graph-preview-container');
    if (!analysis || !previewContainer) return;

    if (!(window.atV2 && typeof window.atV2.getEntryData === 'function')) return;

    const tmpEntry = window.atV2.getEntryData({ computeOnly: true });
    const tmpAnalysis = Object.assign({}, analysis, { riskEntries: [tmpEntry] });

    const dot = (typeof generateDotString === 'function') ? generateDotString(tmpAnalysis, tmpEntry.id) : null;

    previewContainer.innerHTML = '';
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.textContent = dot || '(DOT konnte nicht erzeugt werden)';
    previewContainer.appendChild(pre);
};
