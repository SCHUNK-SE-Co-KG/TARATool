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
            loadLeaf(b1.leaves[0], 1);
            loadLeaf(b1.leaves[1], 2);
        }

        if (existingEntry.branches[1]) {
            const b2 = existingEntry.branches[1];
            document.querySelector('input[name="at_branch_2"]').value = b2.name || '';
            if (hasL2 && b2.l2_node) {
                 const l2Inp = document.querySelector('input[name="at_branch_2_l2"]');
                 if(l2Inp) l2Inp.value = b2.l2_node.name || '';
            }
            loadLeaf(b2.leaves[0], 3);
            loadLeaf(b2.leaves[1], 4);
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

    const treeData = {
        id: editingId || generateNextRiskID(analysis),
        rootName: fd.get('at_root'),
        useDeepTree: useDeepTree,
        branches: [
            {
                name: fd.get('at_branch_1'),
                l2_node: useDeepTree ? { name: fd.get('at_branch_1_l2') } : null,
                leaves: [
                    extractLeafData(fd, 1),
                    extractLeafData(fd, 2)
                ]
            },
            {
                name: fd.get('at_branch_2'),
                l2_node: useDeepTree ? { name: fd.get('at_branch_2_l2') } : null,
                leaves: [
                    extractLeafData(fd, 3),
                    extractLeafData(fd, 4)
                ]
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

