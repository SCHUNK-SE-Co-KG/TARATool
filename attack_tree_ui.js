function setTreeDepth(isDeep) {
    const cols = document.querySelectorAll('.col-level-2');
    const inputUseDeep = document.getElementById('use_deep_tree');
    const btn = document.getElementById('btnToggleTreeDepth');

    if (isDeep) {
        cols.forEach(el => el.style.display = 'table-cell');
        if (inputUseDeep) inputUseDeep.value = 'true';
        if (btn) btn.innerHTML = '<i class="fas fa-minus"></i> Zwischenebene ausblenden';
    } else {
        cols.forEach(el => el.style.display = 'none');
        if (inputUseDeep) inputUseDeep.value = 'false';
        if (btn) btn.innerHTML = '<i class="fas fa-layer-group"></i> Zwischenebene einblenden';
    }
    updateAttackTreeKSTUSummariesFromForm(); 
}

// FIX: Default value is now the Scalar name (K, S, T, U)
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

// =============================================================
// --- DYNAMIC IMPACT (AUSWIRKUNG) ROWS PER PATH ---
// =============================================================
const AT_MAX_IMPACTS_PER_PATH = 5;
const AT_BRANCH_LEAF_BASE = { 1: 1, 2: 6 }; // Branch 1 uses 1..5, Branch 2 uses 6..10

function _atLeafIndex(branchNum, impactPos) {
    const base = AT_BRANCH_LEAF_BASE[branchNum];
    return base ? (base + (impactPos - 1)) : null;
}

function _atGetImpactRow(branchNum, impactPos) {
    return document.querySelector(`tr.impact-row[data-branch="${branchNum}"][data-impact="${impactPos}"]`);
}

function _atGetVisibleImpactCount(branchNum) {
    const rows = document.querySelectorAll(`tr.impact-row[data-branch="${branchNum}"]`);
    let c = 0;
    rows.forEach(r => {
        if (!r) return;
        const disp = r.style && r.style.display;
        if (disp === 'none') return;
        c++;
    });
    return c;
}

function _atSetBranchRowspan(branchNum, newSpan) {
    const tdL1 = document.getElementById(`at_branch_${branchNum}_cell_l1`);
    if (tdL1) tdL1.rowSpan = newSpan;
    const tdL2 = document.getElementById(`at_branch_${branchNum}_cell_l2`);
    if (tdL2) tdL2.rowSpan = newSpan;
}

function _atUpdateAddImpactButtonState(branchNum) {
    const btn = document.querySelector(`button.add-impact-btn[data-branch="${branchNum}"]`);
    if (!btn) return;
    const visible = _atGetVisibleImpactCount(branchNum);
    btn.style.display = (visible >= AT_MAX_IMPACTS_PER_PATH) ? 'none' : 'inline-flex';
}

function _atResetImpactRows() {
    [1, 2].forEach(branchNum => {
        document.querySelectorAll(`tr.extra-impact[data-branch="${branchNum}"]`).forEach(r => {
            if (r) r.style.display = 'none';
        });
        _atSetBranchRowspan(branchNum, 2);
        _atUpdateAddImpactButtonState(branchNum);
    });
}

function _atShowImpactsUpTo(branchNum, count) {
    const capped = Math.max(2, Math.min(AT_MAX_IMPACTS_PER_PATH, count || 2));
    for (let i = 3; i <= capped; i++) {
        const row = _atGetImpactRow(branchNum, i);
        if (row) row.style.display = '';
    }
    _atSetBranchRowspan(branchNum, capped);
    _atUpdateAddImpactButtonState(branchNum);
}

function initAttackTreeImpactAdders() {
    const btns = document.querySelectorAll('button.add-impact-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            const branchNum = parseInt(btn.getAttribute('data-branch') || '0', 10);
            if (!branchNum) return;
            const visible = _atGetVisibleImpactCount(branchNum);
            const next = visible + 1;
            if (next > AT_MAX_IMPACTS_PER_PATH) return;
            const row = _atGetImpactRow(branchNum, next);
            if (row) row.style.display = '';
            _atSetBranchRowspan(branchNum, next);
            _atUpdateAddImpactButtonState(branchNum);
            // Dropdowns in newly shown rows should have their options
            populateAttackTreeDropdowns();
            updateAttackTreeKSTUSummariesFromForm();
        };
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
    
    setTreeDepth(false);
    // Startzustand: je Pfad nur 2 Auswirkungen sichtbar
    _atResetImpactRows();

    if (existingEntry) {
        if (hiddenIdField) hiddenIdField.value = existingEntry.id;
        
        const hasL2 = existingEntry.useDeepTree === true;
        setTreeDepth(hasL2);
        
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

        if (existingEntry.branches[0]) {
            const b1 = existingEntry.branches[0];
            document.querySelector('input[name="at_branch_1"]').value = b1.name || '';
            if (hasL2 && b1.l2_node) {
                 const l2Inp = document.querySelector('input[name="at_branch_1_l2"]');
                 if(l2Inp) l2Inp.value = b1.l2_node.name || '';
            }

            const cnt = Math.min(AT_MAX_IMPACTS_PER_PATH, Math.max(2, (b1.leaves || []).length));
            _atShowImpactsUpTo(1, cnt);
            for (let i = 0; i < cnt; i++) {
                loadLeaf((b1.leaves || [])[i], _atLeafIndex(1, i + 1));
            }
        }

        if (existingEntry.branches[1]) {
            const b2 = existingEntry.branches[1];
            document.querySelector('input[name="at_branch_2"]').value = b2.name || '';
            if (hasL2 && b2.l2_node) {
                 const l2Inp = document.querySelector('input[name="at_branch_2_l2"]');
                 if(l2Inp) l2Inp.value = b2.l2_node.name || '';
            }

            const cnt = Math.min(AT_MAX_IMPACTS_PER_PATH, Math.max(2, (b2.leaves || []).length));
            _atShowImpactsUpTo(2, cnt);
            for (let i = 0; i < cnt; i++) {
                loadLeaf((b2.leaves || [])[i], _atLeafIndex(2, i + 1));
            }
        }
        
    } else {
        if (hiddenIdField) hiddenIdField.value = ''; 
    }

    const btnToggle = document.getElementById('btnToggleTreeDepth');
    if (btnToggle) {
        btnToggle.onclick = () => {
            const current = document.getElementById('use_deep_tree').value === 'true';
            setTreeDepth(!current);
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
    const useDeepTree = document.getElementById('use_deep_tree').value === 'true';

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

    const _collectLeavesForBranch = (branchNum) => {
        const leaves = [];
        for (let pos = 1; pos <= AT_MAX_IMPACTS_PER_PATH; pos++) {
            const leafIdx = _atLeafIndex(branchNum, pos);
            if (!leafIdx) continue;
            const leaf = extractLeafData(fd, leafIdx);
            // Vorher waren 2 Auswirkungen fest vorhanden. Diese Logik bleibt:
            // - die ersten beiden Slots werden immer gespeichert
            // - zusätzliche nur, wenn wirklich befüllt
            if (pos <= 2 || !_leafIsEmpty(leaf)) {
                leaves.push(leaf);
            }
        }
        // trailing empties (beyond 2) entfernen, falls der Nutzer nach dem Hinzufügen alles geleert hat
        while (leaves.length > 2 && _leafIsEmpty(leaves[leaves.length - 1])) {
            leaves.pop();
        }
        return leaves;
    };

    const treeData = {
        id: editingId || generateNextRiskID(analysis),
        rootName: fd.get('at_root'),
        useDeepTree: useDeepTree,
        branches: [
            {
                name: fd.get('at_branch_1'),
                l2_node: useDeepTree ? { name: fd.get('at_branch_1_l2') } : null,
                leaves: _collectLeavesForBranch(1)
            },
            {
                name: fd.get('at_branch_2'),
                l2_node: useDeepTree ? { name: fd.get('at_branch_2_l2') } : null,
                leaves: _collectLeavesForBranch(2)
            }
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
});

