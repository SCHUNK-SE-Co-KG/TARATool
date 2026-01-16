function _parseKSTUValue(val) {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

function _getTreeDepthForData(treeData) {
    const d = parseInt(treeData?.treeDepth, 10);
    // Ab jetzt: 1 oder 2 (alte 3 wird als 2 interpretiert)
    if (d === 1) return 1;
    if (d === 2 || d === 3) return 2;
    return treeData?.useDeepTree ? 2 : 1;
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


function _normalizeParallelIntermediate(treeData) {
    // Sorgt dafür, dass bei depth=2 eine einheitliche Struktur vorliegt:
    // branch.l2_nodes = [{name, leaves}, {name, leaves}?]
    const depth = _getTreeDepthForData(treeData);
    if (!treeData || !treeData.branches) return treeData;
    if (depth !== 2) return treeData;

    treeData.branches.forEach(branch => {
        if (!branch) return;

        // Neu: bereits vorhanden
        if (Array.isArray(branch.l2_nodes) && branch.l2_nodes.length > 0) return;

        // Legacy single intermediate: l2_node + leaves
        if (branch.l2_node && (branch.leaves || branch.leaves === undefined)) {
            branch.l2_nodes = [{
                name: branch.l2_node?.name || '',
                leaves: Array.isArray(branch.leaves) ? branch.leaves : []
            }];
            return;
        }

        // Legacy v7 nested depth=3: l2_node + l3_node + leaves hängen unter l3
        if (branch.l2_node && branch.l3_node) {
            branch.l2_nodes = [
                { name: branch.l2_node?.name || '', leaves: [] },
                { name: branch.l3_node?.name || '', leaves: Array.isArray(branch.leaves) ? branch.leaves : [] }
            ];
        }
    });

    return treeData;
}


function applyWorstCaseInheritance(treeData) {
    if (!treeData || !treeData.branches) return treeData;

    const depth = _getTreeDepthForData(treeData);
    _normalizeParallelIntermediate(treeData);

    treeData.branches.forEach(branch => {
        if (!branch) return;

        if (depth === 1) {
            branch.kstu = _kstuWorstCase(branch.leaves || []);
            return;
        }

        const nodes = Array.isArray(branch.l2_nodes) ? branch.l2_nodes : [];
        nodes.forEach(node => {
            node.kstu = _kstuWorstCase((node && node.leaves) ? node.leaves : []);
        });

        // Branch-Worst-Case über die Zwischenpfade
        branch.kstu = _kstuWorstCase(nodes.map(n => n.kstu));
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

    const depth = _getTreeDepthForData(treeData);
    _normalizeParallelIntermediate(treeData);

    treeData.branches.forEach(branch => {
        if (!branch) return;

        if (depth === 1) {
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
            branch.i_norm = bFound ? bMax.toFixed(2) : '';
            return;
        }

        const nodes = Array.isArray(branch.l2_nodes) ? branch.l2_nodes : [];
        nodes.forEach(node => {
            (node.leaves || []).forEach(leaf => {
                const dsList = (leaf && Array.isArray(leaf.ds)) ? leaf.ds : [];
                leaf.i_norm = computeLeafImpactNorm(dsList, analysis);
            });

            let nMax = 0.0;
            let nFound = false;
            (node.leaves || []).forEach(leaf => {
                const v = _parseImpactValue(leaf?.i_norm);
                if (v === null) return;
                if (v > nMax) nMax = v;
                nFound = true;
            });
            node.i_norm = nFound ? nMax.toFixed(2) : '';
        });

        let bMax = 0.0;
        let bFound = false;
        nodes.forEach(node => {
            const v = _parseImpactValue(node?.i_norm);
            if (v === null) return;
            if (v > bMax) bMax = v;
            bFound = true;
        });
        branch.i_norm = bFound ? bMax.toFixed(2) : '';
    });

    // Root Impact: max über branches
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

    const depthRaw = parseInt(document.getElementById('tree_depth')?.value || '1', 10);
    const treeDepth = (depthRaw === 2 || depthRaw === 3) ? 2 : 1;
    const useDeepTree = treeDepth >= 2;

    const secondOn = (document.getElementById('use_second_intermediate')?.value || 'false').toString().toLowerCase() === 'true';

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
        branches: [
            {},
            {}
        ]
    };

    // Branch 1
    if (treeDepth === 1) {
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

        if (treeDepth >= 2) {
            const nodeA = (branchData.l2_nodes && branchData.l2_nodes[0]) ? branchData.l2_nodes[0] : null;
            const elL2 = document.getElementById(`at_branch_${branchNum}_l2_kstu_summary`);
            if (elL2) elL2.innerHTML = _renderNodeSummaryHTML(nodeA?.kstu, nodeA?.i_norm);

            const nodeB = (branchData.l2_nodes && branchData.l2_nodes[1]) ? branchData.l2_nodes[1] : null;
            const elL2B = document.getElementById(`at_branch_${branchNum}_l2b_kstu_summary`);
            if (elL2B) elL2B.innerHTML = secondOn ? _renderNodeSummaryHTML(nodeB?.kstu, nodeB?.i_norm) : '';
        }
    });

    // Leaf-Summaries für alle Slots (1..20). Hidden Rows sind ok.
    for (let idx = 1; idx <= 20; idx++) {
        const leafObj = (() => {
            // Ermittlung: welche Branch/Gruppe gehört idx?
            if (idx >= 1 && idx <= 5) return (treeDepth === 1 ? formValues.branches[0].leaves[idx-1] : formValues.branches[0].l2_nodes[0].leaves[idx-1]);
            if (idx >= 6 && idx <= 10) return (treeDepth === 1 ? formValues.branches[1].leaves[idx-6] : formValues.branches[1].l2_nodes[0].leaves[idx-6]);
            if (idx >= 11 && idx <= 15) {
                if (treeDepth === 1 || !secondOn) return null;
                return formValues.branches[0].l2_nodes[1].leaves[idx-11];
            }
            if (idx >= 16 && idx <= 20) {
                if (treeDepth === 1 || !secondOn) return null;
                return formValues.branches[1].l2_nodes[1].leaves[idx-16];
            }
            return null;
        })();

        const inp = document.querySelector(`input[name="at_leaf_${idx}_i"]`);
        if (inp) inp.value = leafObj ? (leafObj.i_norm || '') : '';

        const elL = document.getElementById(`at_leaf_${idx}_summary`);
        if (elL) elL.innerHTML = leafObj ? _renderNodeSummaryHTML(leafObj.kstu, leafObj.i_norm) : '';
    }
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

