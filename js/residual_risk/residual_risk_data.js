// =============================================================
// --- RESTRISIKOANALYSE: DATENSTRUKTUR & SYNC ---
//
// Ziel:
//  - Separate Datenstruktur (analysis.residualRisk.entries) als Deep-Clone von analysis.riskEntries
//  - Pro Leaf zusaetzlich:
//      * Behandlung: "Akzeptiert" | "Delegiert" | "Mitigiert"
//      * Anmerkung (Text)
//      * Massnahme aus Security Konzept (Text)
//      * Restrisiko-Bewertung (K/S/T/U) (nur relevant bei "Mitigiert")
//  - Updates in der Risikoanalyse sollen in die Restrisiko-Struktur uebernommen werden,
//    ohne dass Restrisiko-Informationen verloren gehen.
//
// Hinweis: Leaves haben aktuell keine eigenen stabilen UIDs. Daher wird ein Leaf-Key
// positionsbasiert gebildet:  B<Branch>|N<Node>|L<Leaf>
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
        // kompatibel zu bestehender Logik
        try {
            if (typeof _getTreeDepthForData === 'function') return _getTreeDepthForData(entry);
        } catch (_) {}
        const d = parseInt(entry?.treeDepth, 10);
        if (d === 2 || d === 3) return 2;
        return 1;
    }

    // Iteriert ueber alle Leaves eines Baums und liefert Meta-Infos.
    function rrIterateLeaves(entry, cb) {
        if (entry && entry.treeV2) {
            // treeV2: rekursiv traversieren und Breadcrumbs liefern, damit die Benennung im UI eindeutig bleibt.
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
                        // Kompatibel: branch/node Objekte liefern name-Property
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
                // Linear: Root -> Pfad -> L2 -> L3 -> Leaves
                const leaves = Array.isArray(branch.leaves) ? branch.leaves : (Array.isArray(branch?.l3_node?.leaves) ? branch.l3_node.leaves : []);
                leaves.forEach((leaf, lIdx) => {
                    const lNum = lIdx + 1;
                    // Leaf-Key bleibt kompatibel: ein Node-Slot (N1) für den linearen Pfad
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
            // Erwartete Struktur: {treatment,note,securityConcept,k,s,t,u} oder kompatibel.
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

    // Sync-Funktion: Risikoanalyse -> Restrisiko-Datenstruktur
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
                // sollte durch Migration bereits passieren, aber sicherheitshalber
                riskEntry.uid = (typeof generateUID === 'function') ? generateUID('risk') : ('risk_' + Date.now());
                changed = true;
            }

            const existingResidual = prevByUid[riskEntry.uid];
            const rrMap = existingResidual ? rrBuildLeafRRMap(existingResidual) : {};

            // Keys, die es im neuen Baum geben wird
            const desiredKeys = new Set();
            rrIterateLeaves(riskEntry, ({ leafKey }) => desiredKeys.add(leafKey));

            // Legacy dict uebernehmen (falls vorhanden)
            rrMergeLegacyLeavesIntoMap(analysis, riskEntry.uid, rrMap, desiredKeys);

            const cloned = rrDeepClone(riskEntry);
            rrIterateLeaves(cloned, ({ leaf, leafKey }) => {
                if (!leaf) return;
                const existing = rrMap[leafKey];
                leaf.rr = existing ? existing : rrDefaultLeafRR();
            });

            next.push(cloned);
        });

        // changed detection (einfach)
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

    // Komfort: stellt Struktur sicher und synced (ohne Save) 
    // Komfort: stellt Struktur sicher und synced (ohne Save) 
    window.ensureResidualRiskSynced = function (analysis) {
        try {
            return window.syncResidualRiskFromRiskAnalysis(analysis, false);
        } catch (e) {
            return false;
        }
    };

    // Berechnet Restrisiko-Metriken fuer einen Angriffsbaum (Root)
    // basierend auf den Leaf-Restrisikoangaben (Mitigiert -> rr.K/S/T/U).
    // I(N) bleibt identisch zur Risikoanalyse.
    window.computeResidualTreeMetrics = function (analysis, riskUid) {
        if (!analysis || !riskUid) return null;
        rrEnsureStructure(analysis);

        const base = window.getRiskEntryByUid ? window.getRiskEntryByUid(analysis, riskUid) : null;
        const residual = window.getResidualEntryByUid ? window.getResidualEntryByUid(analysis, riskUid) : null;
        if (!residual) return null;

        const clone = rrDeepClone(residual);

        // Leaf K/S/T/U fuer Berechnung ersetzen (nur bei Mitigiert)
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
