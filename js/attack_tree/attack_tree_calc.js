/**
 * @file        attack_tree_calc.js
 * @description Attack tree calculation – KSTU worst-case inheritance and impact propagation
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

function _parseKSTUValue(val) {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

// Alias: _parseImpactValue is identical to _parseKSTUValue (DRY)
const _parseImpactValue = _parseKSTUValue;

// --- Methodology Constants ---
const PROTECTION_LEVEL_WEIGHTS = { 'I': 0.6, 'II': 0.8, 'III': 1.0 };
const SEVERITY_LEVEL_FACTORS  = { '0': 0.0, '1': 0.3, '2': 0.6, '3': 1.0 };
// Risk level thresholds for attack-tree classification (English labels)
// NOTE: The global RISK_THRESHOLDS (array) in globals.js is for UI display (German labels).
const _TREE_RISK_LEVELS = { critical: 2.0, high: 1.6, medium: 0.8 };

// --- Centralized Risk Calculation Helpers ---
function _computeRiskScore(kstu, iNorm) {
    const valI = parseFloat(iNorm) || 0;
    const sumP = (parseFloat(kstu?.k) || 0) + (parseFloat(kstu?.s) || 0)
               + (parseFloat(kstu?.t) || 0) + (parseFloat(kstu?.u) || 0);
    return valI * sumP;
}

function _getRiskLevel(riskScore) {
    const R = parseFloat(riskScore) || 0;
    if (R >= _TREE_RISK_LEVELS.critical) return 'critical';
    if (R >= _TREE_RISK_LEVELS.high)     return 'high';
    if (R >= _TREE_RISK_LEVELS.medium)   return 'medium';
    return 'low';
}

function _getRiskCssClass(riskScore) {
    return 'risk-val-' + _getRiskLevel(riskScore);
}

function _getTreeDepthForData(treeData) {
    const d = parseInt(treeData?.treeDepth, 10);
    // 1: Root -> Path -> Leaves
    // 2: Root -> Path -> Intermediate path(s) (parallel) -> Leaves
    // 3: Root -> Path -> Intermediate node -> Intermediate node 2 -> Leaves
    // 4: Root -> Path -> Intermediate node -> Intermediate node 2 -> Intermediate node 3 -> Leaves
    if (d === 1) return 1;
    if (d === 2) return 2;
    if (d === 3) {
        // Backwards-compatible: old depth=3 entries were "2nd intermediate path"
        return (treeData?.useThirdIntermediate === true) ? 3 : 2;
    }
    if (d === 4) return 4;
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
            // Prefer kstu sub-object value if present (explicit null-check;
            // previous truthiness check would skip valid '0' or 0 values)
            if (it.kstu && it.kstu[key] !== undefined && it.kstu[key] !== null) {
                raw = it.kstu[key];
            }
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

        const gFactor = PROTECTION_LEVEL_WEIGHTS[asset.schutzbedarf] || PROTECTION_LEVEL_WEIGHTS['I'];
        
        dsList.forEach(dsId => {
            const sFactor = SEVERITY_LEVEL_FACTORS[row[dsId]] || 0.0;
            
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
    // Ensures a uniform structure exists for depth=2:
    // branch.l2_nodes = [{name, leaves}, {name, leaves}?]
    const depth = _getTreeDepthForData(treeData);
    if (!treeData || !treeData.branches) return treeData;
    if (depth !== 2) return treeData;

    treeData.branches.forEach(branch => {
        if (!branch) return;

        // New format: already present
        if (Array.isArray(branch.l2_nodes) && branch.l2_nodes.length > 0) return;

        // Legacy single intermediate: l2_node + leaves
        if (branch.l2_node && (branch.leaves || branch.leaves === undefined)) {
            branch.l2_nodes = [{
                name: branch.l2_node?.name || '',
                leaves: Array.isArray(branch.leaves) ? branch.leaves : []
            }];
            return;
        }

        // Legacy v7 nested depth=3: l2_node + l3_node + leaves attached under l3
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
    if (treeData && treeData.treeV2) return applyWorstCaseInheritanceV2(treeData);
    if (!treeData || !treeData.branches) return treeData;

    const depth = _getTreeDepthForData(treeData);
    if (depth === 2) _normalizeParallelIntermediate(treeData);

    treeData.branches.forEach(branch => {
        if (!branch) return;

        if (depth === 1) {
            branch.kstu = _kstuWorstCase(branch.leaves || []);
            return;
        }

        if (depth === 2) {
            const nodes = Array.isArray(branch.l2_nodes) ? branch.l2_nodes : [];
            nodes.forEach(node => {
                node.kstu = _kstuWorstCase((node && node.leaves) ? node.leaves : []);
            });
            // Branch worst-case across intermediate paths
            branch.kstu = _kstuWorstCase(nodes.map(n => n.kstu));
            return;
        }

        // depth === 3: linear (l2_node -> l3_node -> leaves)
        branch.l2_node = branch.l2_node || { name: '' };
        branch.l3_node = branch.l3_node || { name: '' };

        const leaves = Array.isArray(branch.leaves)
            ? branch.leaves
            : (branch.l3_node && Array.isArray(branch.l3_node.leaves) ? branch.l3_node.leaves : []);

        branch.l3_node.kstu = _kstuWorstCase(leaves);
        // linear: l2 takes worst-case from its only child
        branch.l2_node.kstu = _kstuWorstCase([branch.l3_node.kstu]);
        branch.kstu = _kstuWorstCase([branch.l2_node.kstu]);
    });

    treeData.kstu = _kstuWorstCase(treeData.branches.map(b => b.kstu));
    return treeData;
}


function applyImpactInheritance(treeData, analysis) {
    if (treeData && treeData.treeV2) return applyImpactInheritanceV2(treeData, analysis);
    if (!treeData || !treeData.branches) return treeData;

    const depth = _getTreeDepthForData(treeData);
    if (depth === 2) _normalizeParallelIntermediate(treeData);

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

        if (depth === 2) {
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
            return;
        }

        // depth === 3
        branch.l2_node = branch.l2_node || { name: '' };
        branch.l3_node = branch.l3_node || { name: '' };

        const leaves = Array.isArray(branch.leaves)
            ? branch.leaves
            : (branch.l3_node && Array.isArray(branch.l3_node.leaves) ? branch.l3_node.leaves : []);

        leaves.forEach(leaf => {
            const dsList = (leaf && Array.isArray(leaf.ds)) ? leaf.ds : [];
            leaf.i_norm = computeLeafImpactNorm(dsList, analysis);
        });

        let l3Max = 0.0;
        let l3Found = false;
        leaves.forEach(leaf => {
            const v = _parseImpactValue(leaf?.i_norm);
            if (v === null) return;
            if (v > l3Max) l3Max = v;
            l3Found = true;
        });
        branch.l3_node.i_norm = l3Found ? l3Max.toFixed(2) : '';
        // linear
        branch.l2_node.i_norm = branch.l3_node.i_norm;
        branch.i_norm = branch.l2_node.i_norm;
    });

    // Root Impact: max across branches
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

function updateAttackTreeKSTUSummariesFromForm() {
    if (window.atV2 && typeof window.atV2.updateSummaries === "function") { window.atV2.updateSummaries(); return; }
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
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
    if (!analysis || !analysis.riskEntries || analysis.riskEntries.length === 0) return 'R01';
    let maxNum = 0;
    analysis.riskEntries.forEach(entry => {
        const m = (entry?.id || '').match(/^R(\d+)$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
        }
    });
    return 'R' + (maxNum + 1).toString().padStart(2, '0');
}


// --- GRAPHVIZ GENERATOR (WASM) ---




/* ============================================================
   Attack Tree Calc V2 (treeV2)
   - Supports tree editor (cards) with varying depth
   - Inheritance: i_norm (max) and KSTU worst-case (per dimension)
   ============================================================ */

function applyImpactInheritanceV2(treeData, analysis) {
    if (!treeData || !treeData.treeV2) return treeData;
    const root = treeData.treeV2;

    const walk = (node) => {
        if (!node) return '';
        let maxI = null;

        // Leaves
        (node.impacts || []).forEach(leaf => {
            const dsList = Array.isArray(leaf.ds) ? leaf.ds : [];
            leaf.i_norm = computeLeafImpactNorm(dsList, analysis);
            const v = _parseImpactValue(leaf.i_norm);
            if (v === null) return;
            if (maxI === null || v > maxI) maxI = v;
        });

        // Children
        (node.children || []).forEach(ch => {
            walk(ch);
            const v = _parseImpactValue(ch && ch.i_norm);
            if (v === null) return;
            if (maxI === null || v > maxI) maxI = v;
        });

        node.i_norm = (maxI === null) ? '' : maxI.toFixed(2);
        return node.i_norm;
    };

    walk(root);
    treeData.i_norm = root.i_norm || '';
    return treeData;
}

function applyWorstCaseInheritanceV2(treeData) {
    if (!treeData || !treeData.treeV2) return treeData;
    const root = treeData.treeV2;

    const walk = (node) => {
        if (!node) return;
        (node.children || []).forEach(walk);

        const items = [];
        // Leaves: leaf has k/s/t/u directly (supported by _kstuWorstCase)
        (node.impacts || []).forEach(leaf => items.push(leaf));
        // Children: provide as {kstu: child.kstu}
        (node.children || []).forEach(ch => items.push({ kstu: ch.kstu }));

        node.kstu = _kstuWorstCase(items);
    };

    walk(root);
    treeData.kstu = root.kstu || _kstuWorstCase([]);
    return treeData;
}
