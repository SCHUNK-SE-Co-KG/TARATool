/**
 * @file        attack_tree_calc.js
 * @description Attack tree calculation – KSTU worst-case inheritance and impact propagation.
 *              Pure computation, no DOM access.
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 * @pattern     No IIFE – functions prefixed with _ are cross-module public API
 *              (used by attack_tree_editor_v2.js, attack_tree_ui.js, residual_risk_*.js).
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
// Delegates to the global computeRiskScore() in utils.js (single source of truth)
function _computeRiskScore(kstu, iNorm) {
    return computeRiskScore(iNorm, kstu);
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
