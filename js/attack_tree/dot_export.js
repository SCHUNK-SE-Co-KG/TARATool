/**
 * @file        dot_export.js
 * @description Pure Graphviz DOT string generation for attack trees and residual risk trees.
 *              No DOM interaction – download/export UI lives in attack_tree_ui.js.
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 * @pattern     No IIFE – all helpers are function-local closures inside the generate* functions.
 */

function generateDotString(analysis, specificTreeId = null) {
    if (!analysis || !Array.isArray(analysis.riskEntries) || analysis.riskEntries.length === 0) {
        return null;
    }

    let dot = 'digraph {\n\n';
    dot += '    node [shape=record, fontname="Arial", fontsize=10];\n';
    dot += '    edge [fontname="Arial", fontsize=9];\n';
    dot += '    rankdir=TB;\n';
    dot += '    overlap=false;\n    splines=spline;\n';
    dot += '    nodesep=1.0;\n    ranksep=1.2;\n';
    dot += '    concentrate=true;\n';
    dot += '    ordering=out;\n\n';

    const _fmt = (val) => {
        if (val === null || val === undefined || val === '') return '0,0';
        return String(val).replace('.', ',');
    };

    const _pStr = (kstu) => {
        if (!kstu) return '- / - / - / -';
        const k = _fmt(kstu.k);
        const s = _fmt(kstu.s);
        const t = _fmt(kstu.t);
        const u = _fmt(kstu.u);
        return `${k} / ${s} / ${t} / ${u}`;
    };

    // Delegates to global computeRiskScore() (utils.js) — formatted for DOT labels
    const _calcR = (iNorm, kstu) => {
        return _fmt(computeRiskScore(iNorm, kstu).toFixed(2));
    };

    const _lbl = (text, kstu, iNorm) => {
        const p = _pStr(kstu);
        const i = _fmt(iNorm);
        const r = _calcR(iNorm, kstu);
        const cleanText = (text || '').replace(/\\/g, '\\\\').replace(/\n/g, ' ').replace(/\r/g, '').replace(/[\{\}<>|\"]/g, "'");
        return `{${cleanText} | P = ${p} | I[norm] = ${i} | R = ${r}}`;
    };

    // DOT-specific pastel fill colors based on risk score
    const _getColor = (iNorm, kstu) => {
        const r = computeRiskScore(iNorm, kstu);
        if (r >= 2.0) return '#ffcccc';
        if (r >= 1.6) return '#ffe0b3';
        if (r >= 0.8) return '#ffffcc';
        return '#ccffcc';
    };

    const _safeId = (s) => String(s || '').replace(/[^A-Za-z0-9_]/g, '_');

    const _emitDotTreeV2 = (entry) => {
        const riskId = entry.id;
        const rootId = `${riskId}_Root`;

        const levelMap = {}; // depth -> [ids]
        const nodes = [];
        const edges = [];

        const pushRank = (depth, id) => {
            if (!levelMap[depth]) levelMap[depth] = [];
            levelMap[depth].push(id);
        };

        const rootFill = _getColor(entry.i_norm, entry.kstu);
        nodes.push(`    ${rootId} [label="${_lbl(entry.rootName, entry.kstu, entry.i_norm)}", style=filled, fillcolor="${rootFill}"]\n`);
        pushRank(0, rootId);

        const walk = (node, depth, parentId) => {
            const nid = `${riskId}_N${_safeId(node.uid || node.title || ('d' + depth))}`;
            const fill = _getColor(node.i_norm, node.kstu);
            nodes.push(`    ${nid} [label="${_lbl(node.title, node.kstu, node.i_norm)}", style=filled, fillcolor="${fill}"]\n`);
            edges.push(`    ${parentId} -> ${nid}\n`);
            pushRank(depth, nid);

            (node.impacts || []).forEach((leaf, idx) => {
                const lid = `${riskId}_L${_safeId(leaf.uid || (node.uid + '_' + idx))}`;
                const lkstu = { k: leaf.k, s: leaf.s, t: leaf.t, u: leaf.u };
                const lfFill = _getColor(leaf.i_norm, lkstu);
                nodes.push(`    ${lid} [label="${_lbl(leaf.text, lkstu, leaf.i_norm)}", style=filled, fillcolor="${lfFill}"]\n`);
                edges.push(`    ${nid} -> ${lid}\n`);
                pushRank(depth + 1, lid);
            });

            (node.children || []).forEach(ch => walk(ch, depth + 1, nid));
        };

        (entry.treeV2.children || []).forEach((pathNode) => walk(pathNode, 1, rootId));

        let out = `    // Tree ${riskId} (treeV2)\n`;
        out += nodes.join('');
        out += edges.join('');

        // Ranking: Root at top, each level in rank=same
        out += `    { rank=source; ${rootId}; }\n`;
        Object.keys(levelMap).map(k => parseInt(k,10)).filter(k => k > 0).sort((a,b)=>a-b).forEach((lvl) => {
            const ids = (levelMap[lvl] || []).join('; ');
            if (ids.trim()) out += `    { rank=same; ${ids}; }\n`;
        });

        out += "\n";
        return out;
    };


    const _effectiveDepth = (entry) => {
        const d = parseInt(entry?.treeDepth, 10);
        if (d === 1) return 1;
        if (d === 2) return 2;
        if (d === 3) return (entry?.useThirdIntermediate === true) ? 3 : 2; // legacy depth=3 => parallel
        return entry?.useDeepTree ? 2 : 1;
    };

    // Normalizes intermediate paths for depth=2 (parallel) including legacy cases.
    const _normDepth2Nodes = (entry, branch) => {
        if (!branch) return [];

        if (Array.isArray(branch.l2_nodes) && branch.l2_nodes.length > 0) {
            return branch.l2_nodes.map((n, idx) => ({
                name: n?.name || '',
                leaves: Array.isArray(n?.leaves) ? n.leaves : [],
                kstu: n?.kstu,
                i_norm: n?.i_norm,
                idSuffix: `L2_${idx + 1}`
            }));
        }

        // Legacy: depth=3 old (l2_node + l3_node, leaves attached to branch.leaves under "2nd intermediate path")
        const rawDepth = parseInt(entry?.treeDepth, 10);
        const isLegacyThird = (rawDepth === 3) && (entry?.useThirdIntermediate !== true) && branch.l2_node && branch.l3_node;
        if (isLegacyThird) {
            return [
                {
                    name: branch?.l2_node?.name || '',
                    leaves: [],
                    kstu: branch?.l2_node?.kstu,
                    i_norm: branch?.l2_node?.i_norm,
                    idSuffix: 'L2_1'
                },
                {
                    name: branch?.l3_node?.name || '',
                    leaves: Array.isArray(branch.leaves) ? branch.leaves : [],
                    kstu: branch?.l3_node?.kstu,
                    i_norm: branch?.l3_node?.i_norm,
                    idSuffix: 'L2_2'
                }
            ];
        }

        // Legacy: single intermediate (l2_node + leaves)
        if (branch.l2_node) {
            return [
                {
                    name: branch?.l2_node?.name || '',
                    leaves: Array.isArray(branch.leaves) ? branch.leaves : [],
                    kstu: branch?.l2_node?.kstu,
                    i_norm: branch?.l2_node?.i_norm,
                    idSuffix: 'L2_1'
                }
            ];
        }

        // Fallback: no intermediate structure present
        return [
            {
                name: '',
                leaves: Array.isArray(branch.leaves) ? branch.leaves : [],
                kstu: branch?.kstu,
                i_norm: branch?.i_norm,
                idSuffix: 'L2_1'
            }
        ];
    };

    const _leavesDepth3 = (branch) => {
        if (!branch) return [];
        if (Array.isArray(branch.leaves)) return branch.leaves;
        if (Array.isArray(branch?.l3_node?.leaves)) return branch.l3_node.leaves;
        return [];
    };

    let entriesToProcess = analysis.riskEntries;
    if (specificTreeId) {
        entriesToProcess = analysis.riskEntries.filter(e => e && e.id === specificTreeId);
    }

    // --- NODES ---
    entriesToProcess.forEach(entry => {
        if (!entry) return;
        if (entry.treeV2) { dot += _emitDotTreeV2(entry); return; }
        const riskId = entry.id;
        const depth = _effectiveDepth(entry);

        const rootId = `${riskId}_Root`;
        const rootFill = _getColor(entry.i_norm, entry.kstu);

        dot += `    // Tree ${riskId}\n`;
        dot += `    ${rootId} [label="${_lbl(entry.rootName, entry.kstu, entry.i_norm)}", style=filled, fillcolor="${rootFill}"]\n`;

        (entry.branches || []).forEach((branch, bIdx) => {
            if (!branch || !branch.name) return;

            const bId = `${riskId}_B${bIdx + 1}`;
            const bFill = _getColor(branch.i_norm, branch.kstu);
            dot += `    ${bId} [label="${_lbl(branch.name, branch.kstu, branch.i_norm)}", style=filled, fillcolor="${bFill}"]\n`;

            if (depth === 1) {
                (branch.leaves || []).forEach((leaf, lIdx) => {
                    if (!leaf || !leaf.text) return;
                    const lId = `${riskId}_B${bIdx + 1}_Leaf${lIdx + 1}`;
                    const lFill = _getColor(leaf.i_norm, leaf);
                    dot += `    ${lId} [label="${_lbl(leaf.text, leaf, leaf.i_norm)}", style=filled, fillcolor="${lFill}"]\n`;
                });
                return;
            }

            if (depth === 2) {
                const nodes = _normDepth2Nodes(entry, branch);
                nodes.forEach((node, nIdx) => {
                    const nId = `${riskId}_B${bIdx + 1}_${node.idSuffix}`;
                    const hasNode = !!(node && node.name);
                    if (hasNode) {
                        const nFill = _getColor(node.i_norm, node.kstu);
                        dot += `    ${nId} [label="${_lbl(node.name, node.kstu, node.i_norm)}", style=filled, fillcolor="${nFill}"]\n`;
                    }

                    (node.leaves || []).forEach((leaf, lIdx) => {
                        if (!leaf || !leaf.text) return;
                        const lId = `${riskId}_B${bIdx + 1}_${node.idSuffix}_Leaf${lIdx + 1}`;
                        const lFill = _getColor(leaf.i_norm, leaf);
                        dot += `    ${lId} [label="${_lbl(leaf.text, leaf, leaf.i_norm)}", style=filled, fillcolor="${lFill}"]\n`;
                    });
                });
                return;
            }

            // depth === 3 (linear)
            const l2Name = branch?.l2_node?.name || '';
            const l3Name = branch?.l3_node?.name || '';
            const l2Id = `${riskId}_B${bIdx + 1}_L2`;
            const l3Id = `${riskId}_B${bIdx + 1}_L3`;

            if (l2Name) {
                const l2Fill = _getColor(branch?.l2_node?.i_norm, branch?.l2_node?.kstu);
                dot += `    ${l2Id} [label="${_lbl(l2Name, branch?.l2_node?.kstu, branch?.l2_node?.i_norm)}", style=filled, fillcolor="${l2Fill}"]\n`;
            }
            if (l3Name) {
                const l3Fill = _getColor(branch?.l3_node?.i_norm, branch?.l3_node?.kstu);
                dot += `    ${l3Id} [label="${_lbl(l3Name, branch?.l3_node?.kstu, branch?.l3_node?.i_norm)}", style=filled, fillcolor="${l3Fill}"]\n`;
            }

            _leavesDepth3(branch).forEach((leaf, lIdx) => {
                if (!leaf || !leaf.text) return;
                const leafId = `${riskId}_B${bIdx + 1}_L3_Leaf${lIdx + 1}`;
                const lFill = _getColor(leaf.i_norm, leaf);
                dot += `    ${leafId} [label="${_lbl(leaf.text, leaf, leaf.i_norm)}", style=filled, fillcolor="${lFill}"]\n`;
            });
        });

        dot += '\n';
    });

    // --- EDGES ---
    entriesToProcess.forEach(entry => {
        if (!entry) return;
        const riskId = entry.id;
        const depth = _effectiveDepth(entry);

        const rootId = `${riskId}_Root`;

        // --- RANKING: enforce strict top->bottom levels for this tree ---
        const __rank_branchIds = [];
        const __rank_l2Ids = [];
        const __rank_l3Ids = [];
        const __rank_leafIds = [];

        (entry.branches || []).forEach((branch, bIdx) => {
            if (!branch || !branch.name) return;
            const bId = `${riskId}_B${bIdx + 1}`;
            __rank_branchIds.push(bId);
            dot += `    ${rootId} -> ${bId}\n`;

            if (depth === 1) {
                (branch.leaves || []).forEach((leaf, lIdx) => {
                    if (!leaf || !leaf.text) return;
                    const lId = `${riskId}_B${bIdx + 1}_Leaf${lIdx + 1}`;
                    __rank_leafIds.push(lId);
                    dot += `    ${bId} -> ${lId}\n`;
                });
                return;
            }

            if (depth === 2) {
                const nodes = _normDepth2Nodes(entry, branch);
                nodes.forEach((node) => {
                    const nId = `${riskId}_B${bIdx + 1}_${node.idSuffix}`;
                    const hasNode = !!(node && node.name);
                    if (hasNode) {
                        __rank_l2Ids.push(nId);
                        dot += `    ${bId} -> ${nId}\n`;
                    }

                    (node.leaves || []).forEach((leaf, lIdx) => {
                        if (!leaf || !leaf.text) return;
                        const lId = `${riskId}_B${bIdx + 1}_${node.idSuffix}_Leaf${lIdx + 1}`;
                        __rank_leafIds.push(lId);
                        dot += `    ${(hasNode ? nId : bId)} -> ${lId}\n`;
                    });
                });
                return;
            }

            // depth === 3
            const l2Name = branch?.l2_node?.name || '';
            const l3Name = branch?.l3_node?.name || '';
            const l2Id = `${riskId}_B${bIdx + 1}_L2`;
            const l3Id = `${riskId}_B${bIdx + 1}_L3`;

            let parent = bId;
            if (l2Name) {
                __rank_l2Ids.push(l2Id);
                dot += `    ${bId} -> ${l2Id}\n`;
                parent = l2Id;
            }
            if (l3Name) {
                __rank_l3Ids.push(l3Id);
                dot += `    ${parent} -> ${l3Id}\n`;
                parent = l3Id;
            }

            _leavesDepth3(branch).forEach((leaf, lIdx) => {
                if (!leaf || !leaf.text) return;
                const leafId = `${riskId}_B${bIdx + 1}_L3_Leaf${lIdx + 1}`;
                __rank_leafIds.push(leafId);
                dot += `    ${parent} -> ${leafId}\n`;
            });
        });

        // --- APPLY RANK GROUPS (keeps all arrows flowing downward) ---
        dot += `    { rank=source; ${rootId}; }\n`;
        if (__rank_branchIds.length) {
            dot += `    { rank=same; ${__rank_branchIds.join('; ')}; }\n`;
        }
        if (__rank_l2Ids.length) {
            dot += `    { rank=same; ${__rank_l2Ids.join('; ')}; }\n`;
        }
        if (__rank_l3Ids.length) {
            dot += `    { rank=same; ${__rank_l3Ids.join('; ')}; }\n`;
        }
        if (__rank_leafIds.length) {
            dot += `    { rank=sink; ${__rank_leafIds.join('; ')}; }\n`;
        }

        dot += '\n';
    });

    dot += '}\n';
    return dot;
}



// =============================================================
// --- RESIDUAL RISK DOT EXPORT ---
// =============================================================
// Generates a DOT visualization analogous to the risk analysis, but with
// - R (Original)
// - RR (Residual Risk)
// - P(RR) (K/S/T/U representing residual risk; always shown for all treatments)
// - additional line: Treatment (Accepted, Delegated, Mitigated, Gemischt, ...)
// The color is based on RR.
function generateResidualRiskDotString(analysis, specificTreeId = null) {
    if (!analysis || !Array.isArray(analysis.riskEntries) || analysis.riskEntries.length === 0) {
        return null;
    }

    try {
        if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(analysis);
        else if (typeof syncResidualRiskFromRiskAnalysis === 'function') syncResidualRiskFromRiskAnalysis(analysis, false);
    } catch (e) { console.warn('[DOT RR] sync error:', e.message || e); }

    const rrEntries = (analysis.residualRisk && Array.isArray(analysis.residualRisk.entries)) ? analysis.residualRisk.entries : [];

    const _cleanText = (s) => (s || '').toString().replace(/\\/g, '\\\\').replace(/\n/g, ' ').replace(/\r/g, '').replace(/[\{\}<>|\"]/g, "'");

        // JS-Helper: robust float parse (dot/comma)
    const _toNum = (v) => {
        const n = parseFloat(String(v ?? '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
    };

    const _fmtNum = (v, digits=2) => {
        if (v === null || v === undefined || String(v).trim() === '') return '-';
        const n = _toNum(v);
        return n.toFixed(digits).replace('.', ',');
    };

    const _pStr = (kstu) => {
        if (!kstu) return '- / - / - / -';
        const f = (x) => {
            if (x === null || x === undefined) return '-';
            const s = String(x).trim();
            if (!s) return '-';
            return s.replace('.', ',');
        };
        return `${f(kstu.k)} / ${f(kstu.s)} / ${f(kstu.t)} / ${f(kstu.u)}`;
    };

    // Delegates to global computeRiskScore() — formatted with comma decimal for DOT labels
    const _score = (iNorm, kstu) => {
        return computeRiskScore(iNorm, kstu).toFixed(2).replace('.', ',');
    };

    const _colorFromScore = (scoreStr) => {
        const v = parseFloat(String(scoreStr ?? '').replace(',', '.'));
        if (isNaN(v)) return '#d6dbdf';
        if (v >= 2.0) return '#ffcccc';
        if (v >= 1.6) return '#ffe0b3';
        if (v >= 0.8) return '#ffffcc';
        return '#ccffcc';
    };

    const _safeId = (s) => String(s || '').replace(/[^A-Za-z0-9_]/g, '_');

    const _treatmentLeaf = (leaf) => {
        const tr = String(leaf?.rr?.treatment || '').trim();
        return tr || '-';
    };

    const _collectTreatments = (node, set) => {
        if (!node) return;
        (node.impacts || []).forEach(l => set.add(_treatmentLeaf(l)));
        (node.children || []).forEach(ch => _collectTreatments(ch, set));
    };

    const _treatmentNode = (node) => {
        const set = new Set();
        _collectTreatments(node, set);
        if (set.size > 1 && set.has('-')) set.delete('-');
        if (set.size === 0) return '-';
        if (set.size === 1) return Array.from(set)[0] || '-';
        return 'Gemischt';
    };

    
const _buildResidualClone = (baseEntry) => {
    // IMPORTANT: always clone from the risk analysis (baseEntry) so original KSTU/I/R are preserved.
    // Residual risk entry (rrEntry) only provides treatment + optionally mitigated KSTU overrides.
    const clone = structuredClone(baseEntry || {});

    const rrEntry = rrEntries.find(e => e && e.uid && baseEntry && e.uid === baseEntry.uid) || null;

    // Map leaf.uid -> rr object
    const rrLeafMap = {};
    const collectRR = (node) => {
        if (!node) return;
        (node.impacts || []).forEach(l => {
            if (l && l.uid) rrLeafMap[l.uid] = structuredClone(l.rr || {});
        });
        (node.children || []).forEach(collectRR);
    };
    if (rrEntry && rrEntry.treeV2) {
        (rrEntry.treeV2.children || []).forEach(collectRR);
    } else if (rrEntry && Array.isArray(rrEntry.branches)) {
        // Legacy fallback
        (rrEntry.branches || []).forEach(b => {
            (b?.leaves || []).forEach(l => { if (l?.uid) rrLeafMap[l.uid] = structuredClone(l.rr || {}); });
            (b?.l2_nodes || []).forEach(n => (n?.leaves || []).forEach(l => { if (l?.uid) rrLeafMap[l.uid] = structuredClone(l.rr || {}); }));
            if (b?.l3_node && Array.isArray(b.l3_node.leaves)) b.l3_node.leaves.forEach(l => { if (l?.uid) rrLeafMap[l.uid] = structuredClone(l.rr || {}); });
        });
    }

    const _isMitigatedLocal = (t) => {
        const s = String(t || '').trim().toLowerCase();
        return (s === 'mitigiert' || s === 'mitigated');
    };

    const applyRRAndMitigation = (leaf) => {
        if (!leaf) return;

        // rr state: apply if present, otherwise leave empty
        if (leaf.uid && Object.prototype.hasOwnProperty.call(rrLeafMap, leaf.uid)) {
            leaf.rr = rrLeafMap[leaf.uid] || {};
        } else {
            leaf.rr = leaf.rr || {};
        }

        // Only for "Mitigated" are KSTU overridden (missing dimensions fall back to original)
        const rr = leaf.rr || {};
        if (!_isMitigatedLocal(rr.treatment)) return;

        const pick = (orig, rrVal) => {
            const rrStr = (rrVal === undefined || rrVal === null) ? '' : String(rrVal).trim();
            if (rrStr) return rrStr;
            return (orig === undefined || orig === null) ? '' : String(orig);
        };
        leaf.k = pick(leaf.k, rr.k);
        leaf.s = pick(leaf.s, rr.s);
        leaf.t = pick(leaf.t, rr.t);
        leaf.u = pick(leaf.u, rr.u);
    };

    const walkV2 = (node) => {
        if (!node) return;
        (node.impacts || []).forEach(applyRRAndMitigation);
        (node.children || []).forEach(walkV2);
    };

    if (clone && clone.treeV2) {
        (clone.treeV2.children || []).forEach(walkV2);
    } else if (clone && Array.isArray(clone.branches)) {
        // Legacy fallback: only adjust leaves
        (clone.branches || []).forEach(b => {
            (b?.leaves || []).forEach(applyRRAndMitigation);
            (b?.l2_nodes || []).forEach(n => (n?.leaves || []).forEach(applyRRAndMitigation));
            if (b?.l3_node && Array.isArray(b.l3_node.leaves)) b.l3_node.leaves.forEach(applyRRAndMitigation);
        });
    }

    try { if (typeof applyImpactInheritance === 'function') applyImpactInheritance(clone, analysis); } catch (e) { console.warn('[DOT RR] applyImpactInheritance:', e.message || e); }
    try { if (typeof applyWorstCaseInheritance === 'function') applyWorstCaseInheritance(clone); } catch (e) { console.warn('[DOT RR] applyWorstCaseInheritance:', e.message || e); }

    return clone;
};

    const _buildUidNodeMapV2 = (treeV2) => {
        const map = {};
        const walk = (n) => {
            if (!n) return;
            if (n.uid) map[n.uid] = n;
            (n.children || []).forEach(walk);
        };
        (treeV2?.children || []).forEach(walk);
        return map;
    };

    let entriesToProcess = analysis.riskEntries;
    if (specificTreeId) entriesToProcess = analysis.riskEntries.filter(e => e && e.id === specificTreeId);

    let dot = 'digraph {\n\n';
    dot += '    node [shape=record, fontname="Arial", fontsize=9];\n';
    dot += '    edge [fontname="Arial", fontsize=8];\n';
    dot += '    rankdir=TB;\n';
    dot += '    overlap=false;\n    splines=spline;\n';
    dot += '    nodesep=1.0;\n    ranksep=1.2;\n';
    dot += '    concentrate=true;\n';
    dot += '    ordering=out;\n\n';

    entriesToProcess.forEach(entry => {
        if (!entry) return;
        if (!entry.treeV2) {
            dot += `    // Tree ${entry.id} (legacy without treeV2)\n\n`;
            return;
        }

        const riskId = entry.id;
        const rootId = `${riskId}_Root_RR`;

        const rrClone = _buildResidualClone(entry);
        const rrRootKstu = rrClone?.kstu || rrClone?.treeV2?.kstu || { k:'', s:'', t:'', u:'' };
        const rrNodeMap = _buildUidNodeMapV2(rrClone.treeV2);

        const levelMap = {}; // depth -> [ids]
        const nodes = [];
        const edges = [];
        const pushRank = (depth, id) => {
            if (!levelMap[depth]) levelMap[depth] = [];
            levelMap[depth].push(id);
        };

        
const _normTreatment = (t) => String(t || '').trim().toLowerCase();

const _isNoMitigation = (t) => {
    const s = _normTreatment(t);
    // also no entry / '-' = no residual risk specified => RR=R
    if (!s || s === '-') return true;
    return (s === 'akzeptiert' || s === 'accepted' || s === 'delegiert' || s === 'delegated');
};

const _isMitigated = (t) => {
    const s = _normTreatment(t);
    return (s === 'mitigiert' || s === 'mitigated');
};

        const rootTreatment = _treatmentNode(rrClone.treeV2);
        const rootNoMit = _isNoMitigation(rootTreatment);
        const rrRootKstuEff = rootNoMit ? (entry.kstu || rrRootKstu) : rrRootKstu;
        const showPRR = _pStr(rrRootKstuEff);
        const rootLabel = `{${_cleanText(entry.rootName)} | P = ${_pStr(entry.kstu)} | I[norm] = ${_fmtNum(entry.i_norm, 2)} | R = ${_score(entry.i_norm, entry.kstu)} | P(RR) = ${showPRR} | RR = ${_score(entry.i_norm, rrRootKstuEff)} | Behandlung: ${_cleanText(rootTreatment)}}`;
        const rootFill = _colorFromScore(_score(entry.i_norm, rrRootKstuEff));

        nodes.push(`    ${rootId} [label="${rootLabel}", style=filled, fillcolor="${rootFill}"]\n`);
        pushRank(0, rootId);

        const walk = (baseNode, depth, parentId) => {
            if (!baseNode) return;
            const nid = `${riskId}_N_RR${_safeId(baseNode.uid || baseNode.title || ('d' + depth))}`;
            const rrNode = rrNodeMap[baseNode.uid] || null;

            const rrKstu = rrNode?.kstu || baseNode.kstu;
            const tNode = rrNode ? _treatmentNode(rrNode) : '-';
            const nodeNoMit = _isNoMitigation(tNode);
            const rrKstuEff = nodeNoMit ? baseNode.kstu : rrKstu;
            const showPRRNode = _pStr(rrKstuEff);

            const label = `{${_cleanText(baseNode.title)} | P = ${_pStr(baseNode.kstu)} | I[norm] = ${_fmtNum(baseNode.i_norm, 2)} | R = ${_score(baseNode.i_norm, baseNode.kstu)} | P(RR) = ${showPRRNode} | RR = ${_score(baseNode.i_norm, rrKstuEff)} | Behandlung: ${_cleanText(tNode)}}`;
            const fill = _colorFromScore(_score(baseNode.i_norm, rrKstuEff));

            nodes.push(`    ${nid} [label="${label}", style=filled, fillcolor="${fill}"]\n`);
            edges.push(`    ${parentId} -> ${nid}\n`);
            pushRank(depth, nid);

            // Leaves
            (baseNode.impacts || []).forEach((leaf, idx) => {
                const rrLeaf = (rrNode && Array.isArray(rrNode.impacts))
                    ? (rrNode.impacts.find(l => l && l.uid && leaf && l.uid === leaf.uid) || rrNode.impacts[idx])
                    : null;

                const lid = `${riskId}_L_RR${_safeId(leaf.uid || (baseNode.uid + '_' + idx))}`;

                const okstu = { k: leaf.k, s: leaf.s, t: leaf.t, u: leaf.u };
                const rkstu = rrLeaf ? { k: rrLeaf.k, s: rrLeaf.s, t: rrLeaf.t, u: rrLeaf.u } : okstu;

                const trLeaf = rrLeaf ? _treatmentLeaf(rrLeaf) : _treatmentLeaf(leaf);
                const leafNoMit = _isNoMitigation(trLeaf);
                const rkstuEff = leafNoMit ? okstu : rkstu;
                const showPRRLeaf = _pStr(rkstuEff);

                const leafText = _cleanText(leaf?.text ?? leaf?.name ?? leaf?.label ?? '');
                const leafLabel = `{${leafText} | P = ${_pStr(okstu)} | I[norm] = ${_fmtNum(leaf.i_norm, 2)} | R = ${_score(leaf.i_norm, okstu)} | P(RR) = ${showPRRLeaf} | RR = ${_score(leaf.i_norm, rkstuEff)} | Behandlung: ${_cleanText(trLeaf)}}`;
                const leafFill = _colorFromScore(_score(leaf.i_norm, rkstuEff));

                nodes.push(`    ${lid} [label="${leafLabel}", style=filled, fillcolor="${leafFill}"]\n`);
                edges.push(`    ${nid} -> ${lid}\n`);
                pushRank(depth + 1, lid);
            });

            (baseNode.children || []).forEach(ch => walk(ch, depth + 1, nid));
        };

        (entry.treeV2.children || []).forEach((pathNode) => walk(pathNode, 1, rootId));

        dot += `    // Tree ${riskId} (Residual Risk)\n`;
        dot += nodes.join('');
        dot += edges.join('');

        // Ranking: Root at top, each level in rank=same
        dot += `    { rank=source; ${rootId}; }\n`;
        Object.keys(levelMap).map(k => parseInt(k, 10)).filter(k => k > 0).sort((a,b)=>a-b).forEach((lvl) => {
            const ids = (levelMap[lvl] || []).join('; ');
            if (ids.trim()) dot += `    { rank=same; ${ids}; }\n`;
        });

        dot += '\n';
    });

    dot += '}\n';
    return dot;
}

// Alias for PDF and tool
window.exportResidualRiskToDot = generateResidualRiskDotString;
// Define exportRiskAnalysisToDot as alias for generateDotString
window.exportRiskAnalysisToDot = generateDotString;


