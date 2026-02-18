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

    try { if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns(); } catch (e) { console.warn('[AT UI] populateAttackTreeDropdowns:', e.message || e); }

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
            try { if (window.atV2) window.atV2.rerender(); } catch (e) { console.warn('[AT UI] atV2.rerender:', e.message || e); }
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

    try { if (typeof reindexRiskIDs === 'function') reindexRiskIDs(analysis); } catch (e) { console.warn('[AT UI] reindexRiskIDs:', e.message || e); }

    try {
        if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
            syncResidualRiskFromRiskAnalysis(analysis, false);
        }
    } catch (e) { console.warn('[AT UI] syncResidualRisk:', e.message || e); }

    try { if (typeof saveAnalyses === 'function') saveAnalyses(); } catch (e) { console.warn('[AT UI] saveAnalyses:', e.message || e); }

    const modal = document.getElementById('attackTreeModal');
    if (modal) modal.style.display = 'none';

    try { if (typeof renderRiskAnalysis === 'function') renderRiskAnalysis(); } catch (e) { console.warn('[AT UI] renderRiskAnalysis:', e.message || e); }
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
    try { initAttackTreeImpactAdders(); } catch (e) { console.warn('[AT UI] initAttackTreeImpactAdders:', e.message || e); }
    try { initAttackTreeImpactRemovers(); } catch (e) { console.warn('[AT UI] initAttackTreeImpactRemovers:', e.message || e); }
    try { initAttackTreeLeafRemovers(); } catch (e) { console.warn('[AT UI] initAttackTreeLeafRemovers:', e.message || e); }
});



// =============================================================
// --- NODE SUMMARY HTML (moved from attack_tree_calc.js) ---
// =============================================================

function _renderNodeSummaryHTML(kstu, iNorm) {
    const riskScore = _computeRiskScore(kstu, iNorm);
    const riskR = riskScore.toFixed(2);
    
    const _disp = (v) => (v === null || v === undefined || v === '') ? '-' : v;
    const dispI = _disp(iNorm);
    const dispK = _disp(kstu?.k);
    const dispS = _disp(kstu?.s);
    const dispT = _disp(kstu?.t);
    const dispU = _disp(kstu?.u);

    const riskClass = _getRiskCssClass(riskScore); 

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

// =============================================================
// --- LIVE KSTU SUMMARIES FROM FORM (moved from attack_tree_calc.js) ---
// =============================================================

function updateAttackTreeKSTUSummariesFromForm() {
    if (window.atV2 && typeof window.atV2.updateSummaries === "function") { window.atV2.updateSummaries(); return; }
    const analysis = getActiveAnalysis();
    if (!analysis) return;

    const depthRaw = parseInt(document.getElementById('tree_depth')?.value || '1', 10);
    const treeDepth = (depthRaw === 3) ? 3 : ((depthRaw === 2) ? 2 : 1);
    const useDeepTree = treeDepth >= 2;

    const secondOn = (treeDepth === 2) && ((document.getElementById('use_second_intermediate')?.value || 'false').toString().toLowerCase() === 'true');
    const thirdOn = (treeDepth === 3);

    const getLeafDs = (idx) => readLeafDsFromDOM(idx);
    const getLeafKSTU = (idx) => ({
        k: document.querySelector(`select[name="at_leaf_${idx}_k"]`)?.value || '',
        s: document.querySelector(`select[name="at_leaf_${idx}_s"]`)?.value || '',
        t: document.querySelector(`select[name="at_leaf_${idx}_t"]`)?.value || '',
        u: document.querySelector(`select[name="at_leaf_${idx}_u"]`)?.value || ''
    });

    const max = 5;

    // Indizes: 1..5 (B1A), 6..10 (B2A), 11..15 (B1B), 16..20 (B2B)
    const bases = {
        '1a': 1,
        '2a': 6,
        '1b': 11,
        '2b': 16
    };

    const mkLeaves = (base) => {
        const arr = [];
        for (let i = 0; i < max; i++) {
            const idx = base + i;
            arr.push({ ds: getLeafDs(idx), kstu: getLeafKSTU(idx) });
        }
        return arr;
    };

    const formValues = {
        treeDepth: treeDepth,
        useDeepTree: useDeepTree,
        useSecondIntermediate: secondOn,
        useThirdIntermediate: thirdOn,
        branches: [
            {},
            {}
        ]
    };

    // Branch 1
    if (treeDepth === 1) {
        formValues.branches[0].leaves = mkLeaves(bases['1a']);
    } else if (treeDepth === 3) {
        formValues.branches[0].l2_node = {};
        formValues.branches[0].l3_node = {};
        formValues.branches[0].leaves = mkLeaves(bases['1a']);
    } else {
        formValues.branches[0].l2_nodes = [
            { leaves: mkLeaves(bases['1a']) }
        ];
        if (secondOn) {
            formValues.branches[0].l2_nodes.push({ leaves: mkLeaves(bases['1b']) });
        }
    }

    // Branch 2
    if (treeDepth === 1) {
        formValues.branches[1].leaves = mkLeaves(bases['2a']);
    } else if (treeDepth === 3) {
        formValues.branches[1].l2_node = {};
        formValues.branches[1].l3_node = {};
        formValues.branches[1].leaves = mkLeaves(bases['2a']);
    } else {
        formValues.branches[1].l2_nodes = [
            { leaves: mkLeaves(bases['2a']) }
        ];
        if (secondOn) {
            formValues.branches[1].l2_nodes.push({ leaves: mkLeaves(bases['2b']) });
        }
    }

    applyImpactInheritance(formValues, analysis);
    applyWorstCaseInheritance(formValues);

    const elRoot = document.getElementById('at_root_kstu_summary');
    if (elRoot) elRoot.innerHTML = _renderNodeSummaryHTML(formValues.kstu, formValues.i_norm);

    [0, 1].forEach((bIdx) => {
        const branchNum = bIdx + 1;
        const branchData = formValues.branches[bIdx];

        const elB = document.getElementById(`at_branch_${branchNum}_kstu_summary`);
        if (elB) elB.innerHTML = _renderNodeSummaryHTML(branchData.kstu, branchData.i_norm);

        if (treeDepth === 2) {
            const nodeA = (branchData.l2_nodes && branchData.l2_nodes[0]) ? branchData.l2_nodes[0] : null;
            const elL2 = document.getElementById(`at_branch_${branchNum}_l2_kstu_summary`);
            if (elL2) elL2.innerHTML = _renderNodeSummaryHTML(nodeA?.kstu, nodeA?.i_norm);

            const nodeB = (branchData.l2_nodes && branchData.l2_nodes[1]) ? branchData.l2_nodes[1] : null;
            const elL2B = document.getElementById(`at_branch_${branchNum}_l2b_kstu_summary`);
            if (elL2B) elL2B.innerHTML = secondOn ? _renderNodeSummaryHTML(nodeB?.kstu, nodeB?.i_norm) : '';

            const elL3 = document.getElementById(`at_branch_${branchNum}_l3_kstu_summary`);
            if (elL3) elL3.innerHTML = '';
        }

        if (treeDepth === 3) {
            const elL2 = document.getElementById(`at_branch_${branchNum}_l2_kstu_summary`);
            if (elL2) elL2.innerHTML = _renderNodeSummaryHTML(branchData?.l2_node?.kstu, branchData?.l2_node?.i_norm);

            const elL3 = document.getElementById(`at_branch_${branchNum}_l3_kstu_summary`);
            if (elL3) elL3.innerHTML = _renderNodeSummaryHTML(branchData?.l3_node?.kstu, branchData?.l3_node?.i_norm);

            const elL2B = document.getElementById(`at_branch_${branchNum}_l2b_kstu_summary`);
            if (elL2B) elL2B.innerHTML = '';
        }
    });

    // Leaf summaries for all slots (1..20). Hidden rows are OK.
    for (let idx = 1; idx <= 20; idx++) {
        const leafObj = (() => {
            // Determine: which branch/group does idx belong to?
            if (idx >= 1 && idx <= 5) return (treeDepth === 2 ? formValues.branches[0]?.l2_nodes?.[0]?.leaves?.[idx-1] : formValues.branches[0]?.leaves?.[idx-1]);
            if (idx >= 6 && idx <= 10) return (treeDepth === 2 ? formValues.branches[1]?.l2_nodes?.[0]?.leaves?.[idx-6] : formValues.branches[1]?.leaves?.[idx-6]);
            if (idx >= 11 && idx <= 15) {
                if (treeDepth !== 2 || !secondOn) return null;
                return formValues.branches[0]?.l2_nodes?.[1]?.leaves?.[idx-11];
            }
            if (idx >= 16 && idx <= 20) {
                if (treeDepth !== 2 || !secondOn) return null;
                return formValues.branches[1]?.l2_nodes?.[1]?.leaves?.[idx-16];
            }
            return null;
        })();

        const inp = document.querySelector(`input[name="at_leaf_${idx}_i"]`);
        if (inp) inp.value = leafObj ? (leafObj.i_norm || '') : '';

        const elL = document.getElementById(`at_leaf_${idx}_summary`);
        if (elL) elL.innerHTML = leafObj ? _renderNodeSummaryHTML(leafObj.kstu, leafObj.i_norm) : '';
    }
}

// =============================================================
// --- FORM EVENT BINDING (moved from attack_tree_calc.js) ---
// =============================================================

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
