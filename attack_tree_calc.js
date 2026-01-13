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

