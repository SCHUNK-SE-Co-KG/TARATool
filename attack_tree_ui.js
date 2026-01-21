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
            emptyOpt.textContent = type; // Zeigt Buchstaben
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
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    if (attackTreeForm) attackTreeForm.reset();
    
    // Zuerst Dropdowns befüllen
    populateAttackTreeDropdowns();
    
    const hiddenIdField = document.getElementById('at_id');
    const previewContainer = document.getElementById('graph-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    
    setTreeDepth(1);
    // Startzustand: je Pfad nur 2 Auswirkungen sichtbar
    _atResetImpactRows();

    if (existingEntry) {
        if (hiddenIdField) hiddenIdField.value = existingEntry.id;

        // Abwärtskompatibel:
        // - treeDepth 1 => ohne Zwischenpfad
        // - treeDepth 2 => Zwischenpfad(e) parallel
        // - treeDepth 3 (alte Version) => wird als "2. Zwischenpfad aktiv" interpretiert, Leaves hängen am 2. Zwischenpfad
        const rawDepth = parseInt(existingEntry.treeDepth, 10);
        const depth = (rawDepth === 1) ? 1 : ((existingEntry.useDeepTree === true || rawDepth === 2 || rawDepth === 3) ? 2 : 1);
        setTreeDepth(depth);

        const wantsSecond = (existingEntry.useSecondIntermediate === true) ||
            (rawDepth === 3) ||
            (existingEntry.branches || []).some(b => Array.isArray(b?.l2_nodes) && b.l2_nodes.length > 1) ||
            (existingEntry.branches || []).some(b => b?.l3_node && b?.l3_node?.name);

        if (depth === 2 && wantsSecond) _atSetSecondIntermediateEnabled(true);

        const rootInput = document.querySelector('input[name="at_root"]');
        if (rootInput) rootInput.value = existingEntry.rootName;

        const loadLeaf = (leafData, leafIndex) => {
            if (!leafData) return;
            const prefix = `at_leaf_${leafIndex}`;

            const txt = document.querySelector(`input[name="${prefix}_text"]`);
            if (txt) txt.value = leafData.text || '';

            ['k', 's', 't', 'u'].forEach(param => {
                const sel = document.querySelector(`select[name="${prefix}_${param}"]`);
                if (sel) {
                    let val = leafData[param];
                    if ((val === undefined || val === null) && leafData.kstu) {
                        val = leafData.kstu[param];
                    }
                    sel.value = (val !== undefined && val !== null) ? String(val) : '';
                }
            });

            document.querySelectorAll(`input[type="checkbox"][name^="${prefix}_ds"]`).forEach(c => { if (c) c.checked = false; });
            if (leafData.ds && Array.isArray(leafData.ds)) {
                leafData.ds.forEach(dsVal => {
                    const num = dsVal.replace('DS', '');
                    const chk = document.querySelector(`input[name="${prefix}_ds${num}"]`);
                    if (chk) chk.checked = true;
                });
            }
        };

        const _loadBranch = (branchData, branchNum) => {
            if (!branchData) return;

            const bInp = document.querySelector(`input[name="at_branch_${branchNum}"]`);
            if (bInp) bInp.value = branchData.name || '';

            // Gruppe A/B Daten auflösen (neu: l2_nodes, alt: l2_node/leaves, alt-v7: l2_node + l3_node + leaves)
            let l2AName = '';
            let l2BName = '';
            let leavesA = [];
            let leavesB = [];

            if (depth === 1) {
                leavesA = branchData.leaves || [];
            } else {
                if (Array.isArray(branchData.l2_nodes) && branchData.l2_nodes.length > 0) {
                    const a = branchData.l2_nodes[0] || {};
                    l2AName = a.name || '';
                    leavesA = a.leaves || [];
                    if (branchData.l2_nodes[1]) {
                        const b = branchData.l2_nodes[1] || {};
                        l2BName = b.name || '';
                        leavesB = b.leaves || [];
                        _atSetSecondIntermediateEnabled(true);
                    }
                } else {
                    // Legacy single intermediate
                    if (branchData.l2_node) l2AName = branchData.l2_node.name || '';
                    // v7 legacy nested: interpret l3_node as "Zwischenpfad 2", leaves hängen dort
                    if (rawDepth === 3 && branchData.l3_node) {
                        l2BName = branchData.l3_node.name || '';
                        leavesB = branchData.leaves || [];
                        _atSetSecondIntermediateEnabled(true);
                        leavesA = []; // bleibt leer (UI zeigt default 2 leere Slots)
                    } else {
                        leavesA = branchData.leaves || [];
                    }
                }
            }

            if (depth === 2) {
                const l2Inp = document.querySelector(`input[name="at_branch_${branchNum}_l2"]`);
                if (l2Inp) l2Inp.value = l2AName;

                const l2bInp = document.querySelector(`input[name="at_branch_${branchNum}_l2b"]`);
                if (l2bInp) l2bInp.value = l2BName;
            }

            const cntA = Math.min(AT_MAX_IMPACTS_PER_PATH, Math.max(2, (leavesA || []).length || 2));
            _atShowImpactsUpTo(branchNum, 'a', cntA);
            for (let i = 0; i < cntA; i++) {
                const leafIdx = _atLeafIndex(branchNum, 'a', i + 1);
                loadLeaf((leavesA || [])[i], leafIdx);
            }

            if (depth === 2 && _atIsSecondIntermediateEnabled()) {
                const cntB = Math.min(AT_MAX_IMPACTS_PER_PATH, Math.max(2, (leavesB || []).length || 2));
                _atShowImpactsUpTo(branchNum, 'b', cntB);
                for (let i = 0; i < cntB; i++) {
                    const leafIdx = _atLeafIndex(branchNum, 'b', i + 1);
                    loadLeaf((leavesB || [])[i], leafIdx);
                }
            }
        };

        _loadBranch(existingEntry.branches && existingEntry.branches[0], 1);
        _loadBranch(existingEntry.branches && existingEntry.branches[1], 2);

    } else {
        if (hiddenIdField) hiddenIdField.value = '';
    }

    const btnToggle = document.getElementById('btnToggleTreeDepth');
    if (btnToggle) {
        btnToggle.onclick = () => {
            const currentDepth = _atGetTreeDepth();
            setTreeDepth(currentDepth === 2 ? 1 : 2);
        };
    }

    const btnToggle2 = document.getElementById('btnToggleTreeDepth2');
    if (btnToggle2) {
        btnToggle2.onclick = () => {
            const currentDepth = _atGetTreeDepth();
            if (currentDepth < 2) return;
            // Zweiter Zwischenpfad parallel ein/aus
            _atSetSecondIntermediateEnabled(!_atIsSecondIntermediateEnabled());
            // Labels/Buttons/Rowspans aktualisieren
            setTreeDepth(2);
        };
    }

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

    updateAttackTreeKSTUSummariesFromForm();
    if (attackTreeModal) attackTreeModal.style.display = 'block';
}

function saveAttackTree(e) {
    if (e) e.preventDefault();
    const analysis = analysisData.find(a => a.id === activeAnalysisId);
    if (!analysis) return;

    const fd = new FormData(attackTreeForm);
    const editingId = fd.get('at_id');
    const depth = _atGetTreeDepth();
    const useDeepTree = depth >= 2;
    const useSecondIntermediate = (fd.get('use_second_intermediate') || '').toString().toLowerCase() === 'true';

    // Stabiler UID: bleibt auch bei reindexRiskIDs unveraendert (wichtig fuer Restrisikoanalyse)
    const existingEntry = editingId ? (analysis.riskEntries || []).find(r => r.id === editingId) : null;
    const riskUid = (existingEntry && existingEntry.uid) ? existingEntry.uid : generateUID('risk');

    const _leafIsEmpty = (leaf) => {
        if (!leaf) return true;
        const textEmpty = !leaf.text || String(leaf.text).trim() === '';
        const dsEmpty = !leaf.ds || leaf.ds.length === 0;
        const kEmpty = !leaf.k || String(leaf.k).trim() === '';
        const sEmpty = !leaf.s || String(leaf.s).trim() === '';
        const tEmpty = !leaf.t || String(leaf.t).trim() === '';
        const uEmpty = !leaf.u || String(leaf.u).trim() === '';
        return textEmpty && dsEmpty && kEmpty && sEmpty && tEmpty && uEmpty;
    };

    const _collectLeavesForBranchGroup = (branchNum, group) => {
        const leaves = [];
        for (let pos = 1; pos <= AT_MAX_IMPACTS_PER_PATH; pos++) {
            const leafIdx = _atLeafIndex(branchNum, group, pos);
            if (!leafIdx) continue;
            const leaf = extractLeafData(fd, leafIdx);
            if (pos <= 2 || !_leafIsEmpty(leaf)) {
                leaves.push(leaf);
            }
        }
        while (leaves.length > 2 && _leafIsEmpty(leaves[leaves.length - 1])) {
            leaves.pop();
        }
        return leaves;
    };

    const _buildBranch = (branchNum) => {
        const name = fd.get(`at_branch_${branchNum}`);
        if (depth === 1) {
            return {
                name,
                leaves: _collectLeavesForBranchGroup(branchNum, 'a')
            };
        }

        // depth === 2
        const nodeA = {
            name: fd.get(`at_branch_${branchNum}_l2`),
            leaves: _collectLeavesForBranchGroup(branchNum, 'a')
        };

        const nodes = [nodeA];

        if (useSecondIntermediate) {
            const nodeB = {
                name: fd.get(`at_branch_${branchNum}_l2b`),
                leaves: _collectLeavesForBranchGroup(branchNum, 'b')
            };
            nodes.push(nodeB);
        }

        return {
            name,
            l2_nodes: nodes,
            // Legacy-Felder für Abwärtskompatibilität (werden in Calc/Export toleriert)
            l2_node: { name: nodeA.name },
            l3_node: useSecondIntermediate ? { name: (nodes[1] || {}).name } : null
        };
    };

    const treeData = {
        id: editingId || generateNextRiskID(analysis),
        uid: riskUid,
        rootName: fd.get('at_root'),
        treeDepth: depth,
        useDeepTree: useDeepTree,
        useSecondIntermediate: useSecondIntermediate,
        branches: [
            _buildBranch(1),
            _buildBranch(2)
        ]
    };

    applyImpactInheritance(treeData, analysis);
    applyWorstCaseInheritance(treeData);
    
    const rootKSTU = treeData.kstu; 
    const rootI = parseFloat(treeData.i_norm) || 0;
    const sumP = (parseFloat(rootKSTU.k)||0) + (parseFloat(rootKSTU.s)||0) + (parseFloat(rootKSTU.t)||0) + (parseFloat(rootKSTU.u)||0);
    treeData.rootRiskValue = (rootI * sumP).toFixed(2);

    if (!analysis.riskEntries) analysis.riskEntries = [];

    if (editingId) {
        const index = analysis.riskEntries.findIndex(r => r.id === editingId);
        if (index > -1) {
            analysis.riskEntries[index] = treeData;
            showToast(`Angriffsbaum aktualisiert.`, 'success');
        } else {
            analysis.riskEntries.push(treeData);
        }
    } else {
        analysis.riskEntries.push(treeData);
        showToast(`Angriffsbaum gespeichert.`, 'success');
    }
    
    reindexRiskIDs(analysis);

    // Restrisiko-Struktur aktualisieren (getrennte Datenhaltung)
    try {
        if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
            syncResidualRiskFromRiskAnalysis(analysis, false);
        }
    } catch (e) {}
    
    saveAnalyses();
    if (attackTreeModal) attackTreeModal.style.display = 'none';
    renderRiskAnalysis(); 
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

// Initialisiere "Auswirkung hinzufügen" Buttons
document.addEventListener('DOMContentLoaded', () => {
    try { initAttackTreeImpactAdders(); } catch (e) {}
    try { initAttackTreeImpactRemovers(); } catch (e) {}
    try { initAttackTreeLeafRemovers(); } catch (e) {}
});

