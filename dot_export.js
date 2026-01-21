function generateDotString(analysis, specificTreeId = null) {
    if (!analysis || !analysis.riskEntries || analysis.riskEntries.length === 0) {
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
        const cleanText = (text || '').replace(/[\{\}<>|"]/g, "'");
        return `{${cleanText} | P = ${p} | I[norm] = ${i} | R = ${r}}`;
    };

    const _getColor = (iNorm, kstu) => {
        const iVal = parseFloat(String(iNorm).replace(',', '.')) || 0;
        const pSum = (parseFloat(kstu?.k)||0) + (parseFloat(kstu?.s)||0) + (parseFloat(kstu?.t)||0) + (parseFloat(kstu?.u)||0);
        const r = iVal * pSum;
        if(r >= 2.0) return '#ffcccc';
        if(r >= 1.6) return '#ffe0b3';
        if(r >= 0.8) return '#ffffcc';
        return '#ccffcc';
    };

    const _normBranchNodes = (entry, branch) => {
        const d = parseInt(entry.treeDepth, 10);
        const treeDepth = (d === 1) ? 1 : 2; // alte 3 wird als 2 interpretiert

        if (treeDepth === 1) {
            return [{ name: null, leaves: branch.leaves || [], kstu: null, i_norm: null, idSuffix: 'Direct' }];
        }

        if (Array.isArray(branch.l2_nodes) && branch.l2_nodes.length > 0) {
            return branch.l2_nodes.map((n, idx) => ({
                name: n?.name || '',
                leaves: n?.leaves || [],
                kstu: n?.kstu,
                i_norm: n?.i_norm,
                idSuffix: `L2_${idx+1}`
            }));
        }

        // Legacy: single intermediate in l2_node + leaves
        if (branch.l2_node) {
            return [{
                name: branch.l2_node?.name || '',
                leaves: branch.leaves || [],
                kstu: branch.l2_node?.kstu,
                i_norm: branch.l2_node?.i_norm,
                idSuffix: 'L2_1'
            }];
        }

        // Fallback
        return [{ name: '', leaves: branch.leaves || [], kstu: null, i_norm: null, idSuffix: 'L2_1' }];
    };

    let entriesToProcess = analysis.riskEntries;
    if (specificTreeId) {
        entriesToProcess = analysis.riskEntries.filter(e => e.id === specificTreeId);
    }

    // --- NODES ---
    entriesToProcess.forEach(entry => {
        const riskId = entry.id;
        const d = parseInt(entry.treeDepth, 10);
        const treeDepth = (d === 1) ? 1 : 2;

        const rootId = `${riskId}_Root`;
        const rootFill = _getColor(entry.i_norm, entry.kstu);

        dot += `    // Tree ${riskId}\n`;
        dot += `    ${rootId} [label="${_lbl(entry.rootName, entry.kstu, entry.i_norm)}", style=filled, fillcolor="${rootFill}"]\n`;

        entry.branches.forEach((branch, bIdx) => {
            const bId = `${riskId}_B${bIdx+1}`;
            if (branch.name) {
                const bFill = _getColor(branch.i_norm, branch.kstu);
                dot += `    ${bId} [label="${_lbl(branch.name, branch.kstu, branch.i_norm)}", style=filled, fillcolor="${bFill}"]\n`;
            }

            const nodes = _normBranchNodes(entry, branch);
            if (treeDepth === 2) {
                nodes.forEach((node, nIdx) => {
                    if (!node.name) return;
                    const nId = `${riskId}_B${bIdx+1}_${node.idSuffix}`;
                    const nFill = _getColor(node.i_norm, node.kstu);
                    dot += `    ${nId} [label="${_lbl(node.name, node.kstu, node.i_norm)}", style=filled, fillcolor="${nFill}"]\n`;

                    (node.leaves || []).forEach((leaf, lIdx) => {
                        if (!leaf.text) return;
                        const lId = `${riskId}_B${bIdx+1}_${node.idSuffix}_Leaf${lIdx+1}`;
                        const lFill = _getColor(leaf.i_norm, leaf);
                        dot += `    ${lId} [label="${_lbl(leaf.text, leaf, leaf.i_norm)}", style=filled, fillcolor="${lFill}"]\n`;
                    });
                });
            } else {
                // depth 1: leaves direkt unter branch
                (branch.leaves || []).forEach((leaf, lIdx) => {
                    if (!leaf.text) return;
                    const lId = `${riskId}_B${bIdx+1}_Leaf${lIdx+1}`;
                    const lFill = _getColor(leaf.i_norm, leaf);
                    dot += `    ${lId} [label="${_lbl(leaf.text, leaf, leaf.i_norm)}", style=filled, fillcolor="${lFill}"]\n`;
                });
            }
        });

        dot += '\n';
    });

    // --- EDGES ---
    entriesToProcess.forEach(entry => {
        const riskId = entry.id;
        const d = parseInt(entry.treeDepth, 10);
        const treeDepth = (d === 1) ? 1 : 2;

        const rootId = `${riskId}_Root`;
        // --- RANKING: enforce strict top->bottom levels for this tree ---
        const __rank_branchIds = [];
        const __rank_l2Ids = [];
        const __rank_leafIds = [];


        entry.branches.forEach((branch, bIdx) => {
            if (!branch.name) return;
            const bId = `${riskId}_B${bIdx+1}`;
            __rank_branchIds.push(bId);
            dot += `    ${rootId} -> ${bId}\n`;

            const nodes = _normBranchNodes(entry, branch);

            if (treeDepth === 2) {
                nodes.forEach(node => {
                    if (!node.name) return;
                    const nId = `${riskId}_B${bIdx+1}_${node.idSuffix}`;
                    __rank_l2Ids.push(nId);
                    dot += `    ${bId} -> ${nId}\n`;
                    (node.leaves || []).forEach((leaf, lIdx) => {
                        if (!leaf.text) return;
                        const lId = `${riskId}_B${bIdx+1}_${node.idSuffix}_Leaf${lIdx+1}`;
                        __rank_leafIds.push(lId);
                        dot += `    ${nId} -> ${lId}\n`;
                    });
                });
            } else {
                (branch.leaves || []).forEach((leaf, lIdx) => {
                    if (!leaf.text) return;
                    const lId = `${riskId}_B${bIdx+1}_Leaf${lIdx+1}`;
                    __rank_leafIds.push(lId);
                    dot += `    ${bId} -> ${lId}\n`;
                });
            }
        });

        // --- APPLY RANK GROUPS (keeps all arrows flowing downward) ---
        dot += `    { rank=source; ${rootId}; }\n`;
        if (__rank_branchIds.length) {
            dot += `    { rank=same; ${__rank_branchIds.join('; ')}; }\n`;
        }
        if (__rank_l2Ids.length) {
            dot += `    { rank=same; ${__rank_l2Ids.join('; ')}; }\n`;
        }
        if (__rank_leafIds.length) {
            dot += `    { rank=sink; ${__rank_leafIds.join('; ')}; }\n`;
        }

        dot += '\n';
    });

    dot += '}\n';
    return dot;
}

// Wir definieren exportRiskAnalysisToDot als Alias für generateDotString als Alias für generateDotString
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
        console.error("Fehler beim DOT-Export:", err);
        if (typeof showToast === 'function') {
            showToast('Export fehlgeschlagen.', 'error');
        }
    }
};