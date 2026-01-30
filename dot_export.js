function generateDotString(analysis, specificTreeId = null) {
    if (!analysis || !Array.isArray(analysis.riskEntries) || analysis.riskEntries.length === 0) {
        return null;
    }

    let dot = 'digraph {\n\n';
    dot += '    node [shape=record, fontname="Arial", fontsize=10];\n';
    dot += '    edge [fontname="Arial", fontsize=9];\n';
    dot += '    rankdir=TB;\n';
    dot += '    overlap = false;\n    splines = ortho;\n\n';

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

    const _calcR = (iNorm, kstu) => {
        const iVal = parseFloat(String(iNorm).replace(',', '.')) || 0;
        const k = parseFloat(kstu?.k) || 0;
        const s = parseFloat(kstu?.s) || 0;
        const t = parseFloat(kstu?.t) || 0;
        const u = parseFloat(kstu?.u) || 0;
        const pSum = k + s + t + u;
        return _fmt((iVal * pSum).toFixed(2));
    };

    const _lbl = (text, kstu, iNorm) => {
        const p = _pStr(kstu);
        const i = _fmt(iNorm);
        const r = _calcR(i, kstu);
        const cleanText = (text || '').replace(/[\{\}<>|\"]/g, "'");
        return `{${cleanText} | P = ${p} | I[norm] = ${i} | R = ${r}}`;
    };

    const _getColor = (iNorm, kstu) => {
        const iVal = parseFloat(String(iNorm).replace(',', '.')) || 0;
        const pSum = (parseFloat(kstu?.k) || 0) + (parseFloat(kstu?.s) || 0) + (parseFloat(kstu?.t) || 0) + (parseFloat(kstu?.u) || 0);
        const r = iVal * pSum;
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

        // Ranking: Root oben, jede Ebene in rank=same
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

    // Normalisiert Zwischenpfade für depth=2 (parallel) inkl. Legacy-Fällen.
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

        // Legacy: depth=3 alt (l2_node + l3_node, Leaves hängen an branch.leaves unter "2. Zwischenpfad")
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

        // Fallback: keine Zwischenstruktur vorhanden
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

// Wir definieren exportRiskAnalysisToDot als Alias für generateDotString
window.exportRiskAnalysisToDot = generateDotString;

document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeAttackTreeModal');
    const modal = document.getElementById('attackTreeModal');
    if (closeBtn && modal) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
});

// =============================================================
// --- EXPORT TRIGGER FÜR .DOT DATEI ---
// =============================================================

window.downloadDotFile = function() {
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    const dotContent = typeof generateDotString === 'function' ? generateDotString(analysis) : null;

    if (!dotContent) {
        if (typeof showToast === 'function') {
            showToast('Keine Daten für den Export vorhanden.', 'warning');
        } else {
            alert('Keine Daten für den Export vorhanden.');
        }
        return;
    }

    try {
        const blob = new Blob([dotContent], { type: 'text/vnd.graphviz' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        const fileName = `TARA_Export_${activeAnalysisId || 'Analysis'}.dot`;

        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        // Aufräumen
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);

        if (typeof showToast === 'function') {
            showToast('.dot Datei wurde erfolgreich erstellt.', 'success');
        }
    } catch (err) {
        console.error('Fehler beim DOT-Export:', err);
        if (typeof showToast === 'function') {
            showToast('Export fehlgeschlagen.', 'error');
        }
    }
};
