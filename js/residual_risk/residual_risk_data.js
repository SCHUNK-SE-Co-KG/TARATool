// =============================================================
// --- RESIDUAL RISK ANALYSIS: DATA STRUCTURE & SYNC ---
//
// Purpose:
//  - Separate data structure (analysis.residualRisk.entries) as deep clone of analysis.riskEntries
//  - Per leaf additionally:
//      * Treatment: "Akzeptiert" | "Delegiert" | "Mitigiert"
//      * Note (text)
//      * Measure from security concept (text)
//      * Residual risk assessment (K/S/T/U) (only relevant for "Mitigiert")
//  - Updates in the risk analysis should be transferred into the residual risk structure
//    without losing residual risk information.
//
// Note: Leaves currently do not have their own stable UIDs. Therefore a leaf key
// is formed position-based: B<Branch>|N<Node>|L<Leaf>
// =============================================================

(function () {
    'use strict';

    // -----------------------------
    // Helpers
    // -----------------------------

    function rrDeepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (e) {
            return obj;
        }
    }

    function rrEnsureStructure(analysis) {
        if (!analysis) return;
        if (!analysis.residualRisk) analysis.residualRisk = { leaves: {}, treeNotes: {} };
        if (!analysis.residualRisk.leaves) analysis.residualRisk.leaves = {};
        if (!analysis.residualRisk.treeNotes) analysis.residualRisk.treeNotes = {};
        if (!Array.isArray(analysis.residualRisk.entries)) analysis.residualRisk.entries = [];
    }

    function rrMakeLeafKey(branchNum, nodeNum, leafNum) {
        return `B${branchNum}|N${nodeNum}|L${leafNum}`;
    }

    function rrLegacyKey(riskUid, leafKey) {
        return `${riskUid}|${leafKey}`;
    }

    function rrDefaultLeafRR() {
        return {
            treatment: '',
            note: '',
            securityConcept: '',
            k: '',
            s: '',
            t: '',
            u: ''
        };
    }

    function rrGetDepth(entry) {
        // compatible with existing logic
        try {
            if (typeof _getTreeDepthForData === 'function') return _getTreeDepthForData(entry);
        } catch (_) {}
        const d = parseInt(entry?.treeDepth, 10);
        if (d === 2 || d === 3) return 2;
        return 1;
    }

    // Iterates over all leaves of a tree and provides meta info.
    function rrIterateLeaves(entry, cb) {
        if (entry && entry.treeV2) {
            // treeV2: recursively traverse and provide breadcrumbs so the naming in the UI remains unambiguous.
            const walk = (node, bNum, parts) => {
                const nodeTitle = (node && (node.title || node.name)) ? String(node.title || node.name) : '';
                const nextParts = nodeTitle ? parts.concat([nodeTitle]) : parts;
                (node.impacts || []).forEach((leaf, lIdx) => {
                    const leafUid = leaf.uid || ('leaf_' + (lIdx + 1));
                    const nodeUid = node.uid || 'node';
                    const leafKey = `B${bNum}|N${nodeUid}|L${leafUid}`;
                    const branchName = nextParts.length ? nextParts[0] : `Pfad B${bNum}`;
                    const nodeName = nodeTitle || branchName;
                    cb({
                        leaf,
                        leafKey,
                        // Compatible: branch/node objects provide name property
                        branch: { name: branchName },
                        node: { name: nodeName, title: nodeTitle },
                        breadcrumb: nextParts.length ? nextParts.join(' › ') : `Pfad B${bNum}`,
                        bNum,
                        nNum: nodeUid,
                        lNum: lIdx + 1
                    });
                });
                (node.children || []).forEach(ch => walk(ch, bNum, nextParts));
            };
            (entry.treeV2.children || []).forEach((pathNode, idx) => {
                const bNum = idx + 1;
                walk(pathNode, bNum, []);
            });
            return;
        }
        if (!entry || !entry.branches) return;
        const depth = rrGetDepth(entry);

        entry.branches.forEach((branch, bIdx) => {
            const bNum = bIdx + 1;
            if (!branch) return;

            if (depth === 1) {
                const leaves = Array.isArray(branch.leaves) ? branch.leaves : [];
                leaves.forEach((leaf, lIdx) => {
                    const lNum = lIdx + 1;
                    const leafKey = rrMakeLeafKey(bNum, 1, lNum);
                    cb({ leaf, leafKey, branch, node: null, bNum, nNum: 1, lNum });
                });
                return;
            }

            if (depth === 3) {
                // Linear: Root -> Path -> L2 -> L3 -> Leaves
                const leaves = Array.isArray(branch.leaves) ? branch.leaves : (Array.isArray(branch?.l3_node?.leaves) ? branch.l3_node.leaves : []);
                leaves.forEach((leaf, lIdx) => {
                    const lNum = lIdx + 1;
                    // Leaf key remains compatible: one node slot (N1) for the linear path
                    const leafKey = rrMakeLeafKey(bNum, 1, lNum);
                    cb({ leaf, leafKey, branch, node: (branch && branch.l3_node) ? branch.l3_node : null, bNum, nNum: 1, lNum });
                });
                return;
            }

            const nodes = Array.isArray(branch.l2_nodes) ? branch.l2_nodes : [];
            nodes.forEach((node, nIdx) => {
                const nNum = nIdx + 1;
                const leaves = Array.isArray(node?.leaves) ? node.leaves : [];
                leaves.forEach((leaf, lIdx) => {
                    const lNum = lIdx + 1;
                    const leafKey = rrMakeLeafKey(bNum, nNum, lNum);
                    cb({ leaf, leafKey, branch, node, bNum, nNum, lNum });
                });
            });
        });
    }

    function rrBuildLeafRRMap(residualEntry) {
        const map = {};
        if (!residualEntry || !residualEntry.uid) return map;
        rrIterateLeaves(residualEntry, ({ leaf, leafKey }) => {
            if (leaf && leaf.rr) {
                map[leafKey] = rrDeepClone(leaf.rr);
            }
        });
        return map;
    }

    function rrMergeLegacyLeavesIntoMap(analysis, riskUid, map, desiredKeysSet) {
        if (!analysis?.residualRisk?.leaves) return;
        const legacy = analysis.residualRisk.leaves;
        desiredKeysSet.forEach(leafKey => {
            if (map[leafKey]) return;
            const key = rrLegacyKey(riskUid, leafKey);
            const v = legacy[key];
            if (!v) return;
            // Expected structure: {treatment,note,securityConcept,k,s,t,u} or compatible.
            const rr = rrDefaultLeafRR();
            rr.treatment = v.treatment || v.rrTreatment || v.status || '';
            rr.note = v.note || v.rrNote || v.anmerkung || '';
            rr.securityConcept = v.securityConcept || v.rrSecurityConcept || v.massnahme || '';
            rr.k = v.k || v.rrK || '';
            rr.s = v.s || v.rrS || '';
            rr.t = v.t || v.rrT || '';
            rr.u = v.u || v.rrU || '';
            map[leafKey] = rr;
        });
    }

    function rrRebuildLegacyLeavesDict(analysis) {
        rrEnsureStructure(analysis);
        const dict = {};
        (analysis.residualRisk.entries || []).forEach(entry => {
            if (!entry?.uid) return;
            rrIterateLeaves(entry, ({ leaf, leafKey }) => {
                if (!leaf) return;
                dict[rrLegacyKey(entry.uid, leafKey)] = rrDeepClone(leaf.rr || rrDefaultLeafRR());
            });
        });
        analysis.residualRisk.leaves = dict;
    }

    // -----------------------------
    // Public API
    // -----------------------------

    window.rrIterateLeaves = rrIterateLeaves;
    window.rrMakeLeafKey = rrMakeLeafKey;

    window.getRiskEntryByUid = function (analysis, uid) {
        return (analysis?.riskEntries || []).find(e => e?.uid === uid) || null;
    };

    window.getResidualEntryByUid = function (analysis, uid) {
        return (analysis?.residualRisk?.entries || []).find(e => e?.uid === uid) || null;
    };

    // Sync function: Risk Analysis -> Residual Risk data structure
    window.syncResidualRiskFromRiskAnalysis = function (analysis, saveAfter = false) {
        if (!analysis) return false;
        rrEnsureStructure(analysis);
        if (!Array.isArray(analysis.riskEntries)) analysis.riskEntries = [];

        const prev = analysis.residualRisk.entries || [];
        const prevByUid = {};
        prev.forEach(e => { if (e?.uid) prevByUid[e.uid] = e; });

        let changed = false;
        const next = [];

        analysis.riskEntries.forEach(riskEntry => {
            if (!riskEntry) return;
            if (!riskEntry.uid) {
                // should already happen via migration, but as a safeguard
                riskEntry.uid = (typeof generateUID === 'function') ? generateUID('risk') : ('risk_' + Date.now());
                changed = true;
            }

            const existingResidual = prevByUid[riskEntry.uid];
            const rrMap = existingResidual ? rrBuildLeafRRMap(existingResidual) : {};

            // Keys that will exist in the new tree
            const desiredKeys = new Set();
            rrIterateLeaves(riskEntry, ({ leafKey }) => desiredKeys.add(leafKey));

            // Take over legacy dict (if present)
            rrMergeLegacyLeavesIntoMap(analysis, riskEntry.uid, rrMap, desiredKeys);

            const cloned = rrDeepClone(riskEntry);
            rrIterateLeaves(cloned, ({ leaf, leafKey }) => {
                if (!leaf) return;
                const existing = rrMap[leafKey];
                leaf.rr = existing ? existing : rrDefaultLeafRR();
            });

            next.push(cloned);
        });

        // changed detection (simple)
        if ((analysis.residualRisk.entries || []).length !== next.length) changed = true;
        if (!changed) {
            const oldUids = (analysis.residualRisk.entries || []).map(e => e?.uid).join('|');
            const newUids = next.map(e => e?.uid).join('|');
            if (oldUids !== newUids) changed = true;
        }

        analysis.residualRisk.entries = next;
        rrRebuildLegacyLeavesDict(analysis);

        if (saveAfter && changed && typeof saveAnalyses === 'function') {
            saveAnalyses();
        }

        return changed;
    };

    // Convenience: ensures structure and syncs (without save)
    // Convenience: ensures structure and syncs (without save)
    window.ensureResidualRiskSynced = function (analysis) {
        try {
            return window.syncResidualRiskFromRiskAnalysis(analysis, false);
        } catch (e) {
            return false;
        }
    };

    // Computes residual risk metrics for an attack tree (root)
    // based on the leaf residual risk data (Mitigated -> rr.K/S/T/U).
    // I(N) remains identical to the risk analysis.
    window.computeResidualTreeMetrics = function (analysis, riskUid) {
        if (!analysis || !riskUid) return null;
        rrEnsureStructure(analysis);

        const base = window.getRiskEntryByUid ? window.getRiskEntryByUid(analysis, riskUid) : null;
        const residual = window.getResidualEntryByUid ? window.getResidualEntryByUid(analysis, riskUid) : null;
        if (!residual) return null;

        const clone = rrDeepClone(residual);

        // Replace leaf K/S/T/U for calculation (only for "Mitigiert")
        rrIterateLeaves(clone, ({ leaf }) => {
            if (!leaf) return;
            const rr = leaf.rr || {};
            const tr = String(rr.treatment || '').trim();
            const isMit = (tr === 'Mitigiert');
            const pick = (orig, rrVal) => {
                const rrStr = (rrVal === undefined || rrVal === null) ? '' : String(rrVal).trim();
                if (isMit && rrStr) return rrStr;
                return (orig === undefined || orig === null) ? '' : String(orig);
            };
            leaf.k = pick(leaf.k, rr.k);
            leaf.s = pick(leaf.s, rr.s);
            leaf.t = pick(leaf.t, rr.t);
            leaf.u = pick(leaf.u, rr.u);
        });

        try {
            if (typeof applyWorstCaseInheritance === 'function') {
                applyWorstCaseInheritance(clone);
            }
        } catch (e) {}

        const iNorm = (base && base.i_norm !== undefined) ? base.i_norm : (clone.i_norm || '');
        const rootI = parseFloat(iNorm) || 0;
        const kstu = clone.kstu || { k:'', s:'', t:'', u:'' };
        const sumP = (parseFloat(kstu.k) || 0) + (parseFloat(kstu.s) || 0) + (parseFloat(kstu.t) || 0) + (parseFloat(kstu.u) || 0);
        const riskValue = (rootI * sumP).toFixed(2);

        return {
            riskValue,
            i_norm: iNorm,
            kstu: kstu
        };
    };
})();
