/**
 * @file        attack_tree_structure.js
 * @description Attack tree structure – depth management, intermediate levels, and dynamic impact rows
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

function _atGetTreeDepth() {
    // 1 = Root -> Path -> Impacts
    // 2 = Root -> Path -> Intermediate level(s) -> Impacts (optionally parallel)
    // 3 = Root -> Path -> Intermediate node -> Intermediate node 2 -> Impacts (optionally parallel)
    // 4 = Root -> Path -> Intermediate node -> Intermediate node 2 -> Intermediate node 3 -> Impacts (optionally parallel)
    const v = parseInt(document.getElementById('tree_depth')?.value || '1', 10);
    if (v === 4) return 4;
    if (v === 3) return 3;
    if (v === 2) return 2;
    return 1;
}

/**
 * Centralized UI state refresh: rowspans, add/remove button states, leaf delete buttons.
 * Replaces repeated try-catch blocks across _atSetSecondIntermediateEnabled and setTreeDepth.
 */
function _atRefreshUIState() {
    const _safe = (fn, label) => {
        try { fn(); } catch (e) { console.warn(`[AT Structure] ${label}:`, e.message || e); }
    };
    _safe(() => _atRecomputeAllRowspans(), '_atRecomputeAllRowspans');
    [1, 2].forEach(b => {
        ['a', 'b'].forEach(g => {
            _safe(() => _atUpdateAddImpactButtonState(b, g), `_atUpdateAddImpactButtonState(${b},'${g}')`);
            _safe(() => _atUpdateRemoveImpactButtonState(b, g), `_atUpdateRemoveImpactButtonState(${b},'${g}')`);
        });
    });
    updateAttackTreeKSTUSummariesFromForm();
    _safe(() => _atEnsureLeafDeleteButtons(), '_atEnsureLeafDeleteButtons');
    _safe(() => _atUpdateAllLeafDeleteButtonsState(), '_atUpdateAllLeafDeleteButtonsState');
}



function _atIsSecondIntermediateEnabled() {
    const v = (document.getElementById('use_second_intermediate')?.value || 'false');
    return String(v).toLowerCase() === 'true';
}

function _atSetSecondIntermediateEnabled(enabled) {
    const inp = document.getElementById('use_second_intermediate');
    if (inp) inp.value = enabled ? 'true' : 'false';

    const depth = _atGetTreeDepth();
    const showL2 = depth >= 2;
    const showL3 = depth >= 3;
    const showL4 = depth >= 4;

    // L2B/L3B/L4B cells + rows per branch show/hide
    [1,2].forEach(branchNum => {
        const on = enabled && showL2;

        const cellL2B = document.getElementById(`at_branch_${branchNum}_cell_l2b`);
        if (cellL2B) cellL2B.style.display = on ? 'table-cell' : 'none';

        const cellL3B = document.getElementById(`at_branch_${branchNum}_cell_l3b`);
        if (cellL3B) cellL3B.style.display = (on && showL3) ? 'table-cell' : 'none';

        const cellL4B = document.getElementById(`at_branch_${branchNum}_cell_l4b`);
        if (cellL4B) cellL4B.style.display = (on && showL4) ? 'table-cell' : 'none';

        document.querySelectorAll(`tr.l2b-row[data-branch="${branchNum}"]`).forEach(r => {
            if (!r) return;
            r.style.display = on ? '' : 'none';
        });

        // Separator row for alternative branch (B)
        document.querySelectorAll(`tr.branch-b-separator[data-branch="${branchNum}"]`).forEach(r => {
            if (!r) return;
            r.style.display = on ? '' : 'none';
        });

        if (on) {
            // Default: 2 impacts visible, extra hidden
            document.querySelectorAll(
                `tr.l2b-row[data-branch="${branchNum}"][data-impact="3"], tr.l2b-row[data-branch="${branchNum}"][data-impact="4"], tr.l2b-row[data-branch="${branchNum}"][data-impact="5"]`
            ).forEach(r => { if (r) r.style.display = 'none'; });
        }
    });

    _atRefreshUIState();
}

function setTreeDepth(depth) {
    // Backwards-compatible: old calls used boolean (deep on/off)
    if (typeof depth === 'boolean') depth = depth ? 2 : 1;
    depth = parseInt(depth || 1, 10);
    if (![1,2,3,4].includes(depth)) depth = 1;

    const colsL2 = document.querySelectorAll('.col-level-2');
    const colsL3 = document.querySelectorAll('.col-level-3');
    const colsL4 = document.querySelectorAll('.col-level-4');

    const inputUseDeep = document.getElementById('use_deep_tree');
    const inputDepth = document.getElementById('tree_depth');

    const btnL2 = document.getElementById('btnToggleTreeDepth');
    const btnSecond = document.getElementById('btnToggleTreeDepth2');
    const btnThird = document.getElementById('btnToggleTreeDepth3');
    const btnFourth = document.getElementById('btnToggleTreeDepth4');

    const showL2 = depth >= 2;
    const showL3 = depth >= 3;
    const showL4 = depth >= 4;

    colsL2.forEach(el => el.style.display = showL2 ? 'table-cell' : 'none');
    colsL3.forEach(el => el.style.display = showL3 ? 'table-cell' : 'none');
    colsL4.forEach(el => el.style.display = showL4 ? 'table-cell' : 'none');

    if (inputUseDeep) inputUseDeep.value = showL2 ? 'true' : 'false';
    if (inputDepth) inputDepth.value = String(depth);

    if (btnL2) {
        btnL2.innerHTML = showL2
            ? '<i class="fas fa-minus"></i> Zwischenknoten 1 ausblenden'
            : '<i class="fas fa-layer-group"></i> Zwischenknoten 1 anzeigen';
    }

    // Second intermediate path: possible from depth >= 2
    if (btnSecond) {
        btnSecond.style.display = showL2 ? 'inline-flex' : 'none';
        btnSecond.innerHTML = _atIsSecondIntermediateEnabled()
            ? '<i class="fas fa-minus"></i> Alternativen Ast (B) entfernen'
            : '<i class="fas fa-layer-group"></i> Alternativen Ast (B) hinzufügen';
    }

    // Third intermediate level button: toggle between depth 2 and 3
    if (btnThird) {
        btnThird.style.display = showL2 ? 'inline-flex' : 'none';
        btnThird.innerHTML = (depth >= 3)
            ? '<i class="fas fa-minus"></i> Zwischenknoten 2 ausblenden'
            : '<i class="fas fa-layer-group"></i> Zwischenknoten 2 anzeigen';
    }

    // Fourth intermediate level button: toggle between depth 3 and 4
    if (btnFourth) {
        btnFourth.style.display = showL3 ? 'inline-flex' : 'none';
        btnFourth.innerHTML = (depth === 4)
            ? '<i class="fas fa-minus"></i> Zwischenknoten 3 ausblenden'
            : '<i class="fas fa-layer-group"></i> Zwischenknoten 3 anzeigen';
    }

    // If intermediate level off: also turn off 2nd intermediate path
    if (!showL2) {
        _atSetSecondIntermediateEnabled(false);
    } else {
        // Re-apply so L3B/L4B cells react correctly to depth
        _atSetSecondIntermediateEnabled(_atIsSecondIntermediateEnabled());
    }

    const secondOn = _atIsSecondIntermediateEnabled();

    const _shouldShowButton = (btn, isAdd) => {
        if (!btn || !btn.classList) return false;
        const group = (btn.getAttribute('data-group') || 'a');
        if (group === 'b' && !secondOn) return false;

        const isL1 = btn.classList.contains('level-l1');
        const isL2 = btn.classList.contains('level-l2');
        const isL2B = btn.classList.contains('level-l2b');
        const isL3 = btn.classList.contains('level-l3');
        const isL3B = btn.classList.contains('level-l3b');
        const isL4 = btn.classList.contains('level-l4');
        const isL4B = btn.classList.contains('level-l4b');

        if (depth === 1) {
            return group === 'a' && isL1;
        }
        if (depth === 2) {
            return (group === 'a' && isL2) || (group === 'b' && isL2B);
        }
        if (depth === 3) {
            return (group === 'a' && isL3) || (group === 'b' && isL3B);
        }
        // depth === 4
        return (group === 'a' && isL4) || (group === 'b' && isL4B);
    };

    // "Add impact" / "Remove impact" buttons per depth
    document.querySelectorAll('button.add-impact-btn').forEach(b => {
        b.style.display = _shouldShowButton(b, true) ? 'inline-flex' : 'none';
    });

    document.querySelectorAll('button.remove-impact-btn').forEach(b => {
        b.style.display = _shouldShowButton(b, false) ? 'inline-flex' : 'none';
    });

    _atRefreshUIState();
}



// =============================================================
// --- DYNAMIC IMPACT ROWS PER PATH / INTERMEDIATE PATH ---
// =============================================================
const AT_MAX_IMPACTS_PER_PATH = 5;

// Leaf index mapping:
// - Branch 1, Group A (Intermediate path 1 or direct): 1..5
// - Branch 2, Group A: 6..10
// - Branch 1, Group B (Intermediate path 2): 11..15
// - Branch 2, Group B: 16..20
const AT_LEAF_BASE = {
    '1a': 1,
    '2a': 6,
    '1b': 11,
    '2b': 16
};

function _atLeafIndex(branchNum, group, impactPos) {
    const g = (group || 'a');
    const base = AT_LEAF_BASE[`${branchNum}${g}`];
    return base ? (base + (impactPos - 1)) : null;
}

function _atRowsFor(branchNum, group) {
    const g = (group || 'a');
    const rows = document.querySelectorAll(`tr.impact-row[data-branch="${branchNum}"]`);
    const arr = [];
    rows.forEach(r => {
        const rg = (r.getAttribute('data-group') || 'a');
        if (rg !== g) return;
        arr.push(r);
    });
    return arr;
}

function _atGetImpactRow(branchNum, group, impactPos) {
    const g = (group || 'a');
    const rows = _atRowsFor(branchNum, g);
    for (const r of rows) {
        const imp = parseInt(r.getAttribute('data-impact') || '0', 10);
        if (imp === impactPos) return r;
    }
    return null;
}

function _atGetVisibleImpactCount(branchNum, group) {
    const g = (group || 'a');
    const rows = _atRowsFor(branchNum, g);
    let c = 0;
    rows.forEach(r => {
        if (!r) return;
        const disp = r.style && r.style.display;
        if (disp === 'none') return;
        c++;
    });
    return c;
}

function _atSetRowspanFor(branchNum, spanL1, spanL2A, spanL2B, spanL3A, spanL4A, spanL3B, spanL4B) {
    const tdL1 = document.getElementById(`at_branch_${branchNum}_cell_l1`);
    if (tdL1) tdL1.rowSpan = spanL1;

    const tdL2A = document.getElementById(`at_branch_${branchNum}_cell_l2`);
    if (tdL2A) tdL2A.rowSpan = spanL2A;

    const tdL3A = document.getElementById(`at_branch_${branchNum}_cell_l3`);
    if (tdL3A) tdL3A.rowSpan = spanL3A;

    const tdL4A = document.getElementById(`at_branch_${branchNum}_cell_l4`);
    if (tdL4A) tdL4A.rowSpan = spanL4A;

    const tdL2B = document.getElementById(`at_branch_${branchNum}_cell_l2b`);
    if (tdL2B) tdL2B.rowSpan = spanL2B;

    const tdL3B = document.getElementById(`at_branch_${branchNum}_cell_l3b`);
    if (tdL3B) tdL3B.rowSpan = spanL3B;

    const tdL4B = document.getElementById(`at_branch_${branchNum}_cell_l4b`);
    if (tdL4B) tdL4B.rowSpan = spanL4B;
}


function _atRecomputeAllRowspans() {
    const depth = _atGetTreeDepth();
    const secondOn = _atIsSecondIntermediateEnabled();

    [1,2].forEach(branchNum => {
        const a = _atGetVisibleImpactCount(branchNum, 'a');
        const b = (depth >= 2 && secondOn) ? _atGetVisibleImpactCount(branchNum, 'b') : 0;

        if (depth === 1) {
            _atSetRowspanFor(branchNum, a, a, 0, 0, 0, 0, 0);
            return;
        }

        if (depth === 2) {
            const total = a + b;
            _atSetRowspanFor(branchNum, total, a, b || 0, 0, 0, 0, 0);
            return;
        }

        if (depth === 3) {
            const total = a + b;
            _atSetRowspanFor(branchNum, total, a, b || 0, a, 0, b || 0, 0);
            return;
        }

        // depth === 4
        const total = a + b;
        _atSetRowspanFor(branchNum, total, a, b || 0, a, a, b || 0, b || 0);
    });
}


function _atUpdateAddImpactButtonState(branchNum, group) {
    const g = (group || 'a');

    const btns = document.querySelectorAll(`button.add-impact-btn[data-branch="${branchNum}"]`);
    if (!btns || btns.length === 0) return;

    const depth = _atGetTreeDepth();
    const secondOn = _atIsSecondIntermediateEnabled();

    const visible = _atGetVisibleImpactCount(branchNum, g);

    btns.forEach(btn => {
        const btnGroup = btn.getAttribute('data-group') || 'a';
        if (btnGroup !== g) return;

        const isL1 = btn.classList && btn.classList.contains('level-l1');
        const isL2 = btn.classList && btn.classList.contains('level-l2');
        const isL2B = btn.classList && btn.classList.contains('level-l2b');
        const isL3 = btn.classList && btn.classList.contains('level-l3');

        if (depth === 1) {
            if (!isL1 || g !== 'a') { btn.style.display = 'none'; return; }
        } else if (depth === 2) {
            if (g === 'a') {
                if (!isL2) { btn.style.display = 'none'; return; }
            } else {
                if (!secondOn || !isL2B) { btn.style.display = 'none'; return; }
            }
        } else {
            // depth === 3: only group A at L3
            if (g !== 'a' || !isL3) { btn.style.display = 'none'; return; }
        }

        btn.style.display = (visible >= AT_MAX_IMPACTS_PER_PATH) ? 'none' : 'inline-flex';
    });
}



function _atUpdateRemoveImpactButtonState(branchNum, group) {
    const g = (group || 'a');

    const btns = document.querySelectorAll(`button.remove-impact-btn[data-branch="${branchNum}"]`);
    if (!btns || btns.length === 0) return;

    const depth = _atGetTreeDepth();
    const secondOn = _atIsSecondIntermediateEnabled();

    const visible = _atGetVisibleImpactCount(branchNum, g);

    btns.forEach(btn => {
        const btnGroup = btn.getAttribute('data-group') || 'a';
        if (btnGroup !== g) return;

        const isL1 = btn.classList && btn.classList.contains('level-l1');
        const isL2 = btn.classList && btn.classList.contains('level-l2');
        const isL2B = btn.classList && btn.classList.contains('level-l2b');
        const isL3 = btn.classList && btn.classList.contains('level-l3');

        if (depth === 1) {
            if (!isL1 || g !== 'a') { btn.style.display = 'none'; return; }
        } else if (depth === 2) {
            if (g === 'a') {
                if (!isL2) { btn.style.display = 'none'; return; }
            } else {
                if (!secondOn || !isL2B) { btn.style.display = 'none'; return; }
            }
        } else {
            // depth === 3: only group A at L3
            if (g !== 'a' || !isL3) { btn.style.display = 'none'; return; }
        }

        btn.style.display = (visible <= 1) ? 'none' : 'inline-flex';
    });
}


function _atClearLeafFields(leafIdx) {
    if (!leafIdx) return;
    const txt = document.querySelector(`input[name="at_leaf_${leafIdx}_text"]`);
    if (txt) txt.value = '';

    document.querySelectorAll(`input[type="checkbox"][name^="at_leaf_${leafIdx}_ds"]`).forEach(chk => {
        if (chk) chk.checked = false;
    });

    ['k','s','t','u'].forEach(p => {
        const sel = document.querySelector(`select[name="at_leaf_${leafIdx}_${p}"]`);
        if (sel) sel.value = '';
    });

    const iInp = document.querySelector(`input[name="at_leaf_${leafIdx}_i"]`);
    if (iInp) iInp.value = '';

    const sum = document.getElementById(`at_leaf_${leafIdx}_summary`);
    if (sum) sum.innerHTML = '';
}

// =============================================================
// --- PER-LEAF DELETE: Remove individual impacts selectively ---
// =============================================================

function _atReadLeafFields(leafIdx) {
    if (!leafIdx) return null;
    const prefix = `at_leaf_${leafIdx}`;

    const txt = document.querySelector(`input[name="${prefix}_text"]`);
    const ds = [];
    for (let i = 1; i <= 5; i++) {
        const chk = document.querySelector(`input[name="${prefix}_ds${i}"]`);
        ds.push(!!(chk && chk.checked));
    }
    const k = document.querySelector(`select[name="${prefix}_k"]`);
    const s = document.querySelector(`select[name="${prefix}_s"]`);
    const t = document.querySelector(`select[name="${prefix}_t"]`);
    const u = document.querySelector(`select[name="${prefix}_u"]`);
    const iInp = document.querySelector(`input[name="${prefix}_i"]`);

    return {
        text: txt ? txt.value : '',
        ds,
        k: k ? k.value : '',
        s: s ? s.value : '',
        t: t ? t.value : '',
        u: u ? u.value : '',
        i: iInp ? iInp.value : ''
    };
}

function _atLeafDataIsEmpty(d) {
    if (!d) return true;
    const textEmpty = !d.text || String(d.text).trim() === '';
    const dsEmpty = !d.ds || !Array.isArray(d.ds) || d.ds.every(v => !v);
    const kEmpty = !d.k || String(d.k).trim() === '';
    const sEmpty = !d.s || String(d.s).trim() === '';
    const tEmpty = !d.t || String(d.t).trim() === '';
    const uEmpty = !d.u || String(d.u).trim() === '';
    return textEmpty && dsEmpty && kEmpty && sEmpty && tEmpty && uEmpty;
}


function _atWriteLeafFields(leafIdx, data) {
    if (!leafIdx || !data) return;
    const prefix = `at_leaf_${leafIdx}`;

    const txt = document.querySelector(`input[name="${prefix}_text"]`);
    if (txt) txt.value = data.text || '';

    for (let i = 1; i <= 5; i++) {
        const chk = document.querySelector(`input[name="${prefix}_ds${i}"]`);
        if (chk) chk.checked = !!(data.ds && data.ds[i - 1]);
    }

    const k = document.querySelector(`select[name="${prefix}_k"]`);
    const s = document.querySelector(`select[name="${prefix}_s"]`);
    const t = document.querySelector(`select[name="${prefix}_t"]`);
    const u = document.querySelector(`select[name="${prefix}_u"]`);
    if (k) k.value = data.k || '';
    if (s) s.value = data.s || '';
    if (t) t.value = data.t || '';
    if (u) u.value = data.u || '';

    const iInp = document.querySelector(`input[name="${prefix}_i"]`);
    if (iInp) iInp.value = data.i || '';

    // Summary is recalculated via updateAttackTreeKSTUSummariesFromForm()
    const sum = document.getElementById(`${prefix}_summary`);
    if (sum) sum.innerHTML = '';
}

function _atCopyLeafFields(srcLeafIdx, dstLeafIdx) {
    if (!srcLeafIdx || !dstLeafIdx) return;
    const data = _atReadLeafFields(srcLeafIdx);
    _atWriteLeafFields(dstLeafIdx, data);
}

function _atEnsureLeafDeleteButtons() {
    // Add a small "-" button per impact (once).
    document.querySelectorAll('tr.impact-row').forEach(row => {
        if (!row) return;
        const leafContainer = row.querySelector('.leaf-container');
        if (!leafContainer) return;

        // Button is placed in the DS row (stable, doesn't change input layout).
        const dsChecks = leafContainer.querySelector('.ds-checks');
        if (!dsChecks) return;
        if (dsChecks.querySelector('button.leaf-delete-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'action-button small leaf-delete-btn';
        btn.title = 'Auswirkung löschen';
        btn.setAttribute('aria-label', 'Auswirkung löschen');
        btn.style.marginLeft = 'auto';
        btn.innerHTML = '<i class="fas fa-minus"></i>';

        // Context: inherit branch/group/pos from row
        btn.setAttribute('data-branch', row.getAttribute('data-branch') || '');
        btn.setAttribute('data-group', row.getAttribute('data-group') || 'a');
        btn.setAttribute('data-impact', row.getAttribute('data-impact') || '');

        dsChecks.appendChild(btn);
    });
}

function _atUpdateLeafDeleteButtonsState(branchNum, group) {
    const g = (group || 'a');
    const visible = _atGetVisibleImpactCount(branchNum, g);
    const rows = _atRowsFor(branchNum, g);
    rows.forEach(r => {
        const btn = r && r.querySelector && r.querySelector('button.leaf-delete-btn');
        if (!btn) return;
        const isHidden = r.style && r.style.display === 'none';
        btn.style.display = isHidden ? 'none' : 'inline-flex';
        // Minimum 1 Auswirkung pro Gruppe
        btn.disabled = visible <= 1;
    });
}


function _atUpdateAllLeafDeleteButtonsState() {
    [1, 2].forEach(b => {
        _atUpdateLeafDeleteButtonsState(b, 'a');
        if (_atGetTreeDepth() >= 2 && _atIsSecondIntermediateEnabled()) {
            _atUpdateLeafDeleteButtonsState(b, 'b');
        }
    });
}


function _atResetImpactRows() {
    // Group A: hide extra impacts
    [1, 2].forEach(branchNum => {
        for (let i = 3; i <= 5; i++) {
            const r = _atGetImpactRow(branchNum, 'a', i);
            if (r) r.style.display = 'none';
        }
    });

    // Group B: completely hidden
    _atSetSecondIntermediateEnabled(false);

    // Standard: Group A has 2 visible
    _atRecomputeAllRowspans();
    _atUpdateAddImpactButtonState(1, 'a');
    _atUpdateAddImpactButtonState(2, 'a');
    _atUpdateRemoveImpactButtonState(1, 'a');
    _atUpdateRemoveImpactButtonState(2, 'a');

    // Leaf delete buttons (per row) update
    _atEnsureLeafDeleteButtons();
    _atUpdateAllLeafDeleteButtonsState();
}

function _atShowImpactsUpTo(branchNum, group, count) {
    const g = (group || 'a');
    const capped = Math.max(1, Math.min(AT_MAX_IMPACTS_PER_PATH, count || 2));
    for (let i = 1; i <= capped; i++) {
        const row = _atGetImpactRow(branchNum, g, i);
        if (row) row.style.display = '';
    }
    for (let i = capped + 1; i <= AT_MAX_IMPACTS_PER_PATH; i++) {
        const row = _atGetImpactRow(branchNum, g, i);
        if (row) row.style.display = 'none';
    }
    _atRecomputeAllRowspans();
    _atUpdateAddImpactButtonState(branchNum, g);
    _atUpdateRemoveImpactButtonState(branchNum, g);

    _atEnsureLeafDeleteButtons();
    _atUpdateLeafDeleteButtonsState(branchNum, g);
}


function initAttackTreeImpactAdders() {
    const btns = document.querySelectorAll('button.add-impact-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            const branchNum = parseInt(btn.getAttribute('data-branch') || '0', 10);
            if (!branchNum) return;
            const group = (btn.getAttribute('data-group') || 'a');

            // Group B only when active
            if (group === 'b' && !_atIsSecondIntermediateEnabled()) return;

            const visible = _atGetVisibleImpactCount(branchNum, group);
            const next = visible + 1;
            if (next > AT_MAX_IMPACTS_PER_PATH) return;
            const row = _atGetImpactRow(branchNum, group, next);
            if (row) row.style.display = '';
            _atRecomputeAllRowspans();
            _atUpdateAddImpactButtonState(branchNum, group);
            _atUpdateRemoveImpactButtonState(branchNum, group);

            _atEnsureLeafDeleteButtons();
            _atUpdateLeafDeleteButtonsState(branchNum, group);

            try { if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns(); } catch (e) { console.warn('[AT] populateAttackTreeDropdowns:', e.message || e); }
            try { if (typeof updateAttackTreeKSTUSummariesFromForm === 'function') updateAttackTreeKSTUSummariesFromForm(); } catch (e) { console.warn('[AT] updateSummaries:', e.message || e); }
        };
    });
}


function initAttackTreeImpactRemovers() {
    const btns = document.querySelectorAll('button.remove-impact-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            const branchNum = parseInt(btn.getAttribute('data-branch') || '0', 10);
            if (!branchNum) return;
            const group = (btn.getAttribute('data-group') || 'a');

            if (group === 'b' && !_atIsSecondIntermediateEnabled()) return;

            const visible = _atGetVisibleImpactCount(branchNum, group);
            if (visible <= 1) return;

            // Remove last visible impact
            const leafIdx = _atLeafIndex(branchNum, group, visible);
            const leafData = _atReadLeafFields(leafIdx);
            if (!_atLeafDataIsEmpty(leafData)) {
                const ok = confirm('Diese Auswirkung ist nicht leer. Wirklich löschen?');
                if (!ok) return;
            }

            const row = _atGetImpactRow(branchNum, group, visible);
            if (row) row.style.display = 'none';
            _atClearLeafFields(leafIdx);

            _atRecomputeAllRowspans();
            _atUpdateAddImpactButtonState(branchNum, group);
            _atUpdateRemoveImpactButtonState(branchNum, group);

            _atEnsureLeafDeleteButtons();
            _atUpdateLeafDeleteButtonsState(branchNum, group);

            try { if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns(); } catch (e) { console.warn('[AT] populateAttackTreeDropdowns:', e.message || e); }
            try { if (typeof updateAttackTreeKSTUSummariesFromForm === 'function') updateAttackTreeKSTUSummariesFromForm(); } catch (e) { console.warn('[AT] updateSummaries:', e.message || e); }
        };
    });
}


function initAttackTreeLeafRemovers() {
    _atEnsureLeafDeleteButtons();

    const btns = document.querySelectorAll('button.leaf-delete-btn');
    btns.forEach(btn => {
        btn.onclick = () => {
            const branchNum = parseInt(btn.getAttribute('data-branch') || '0', 10);
            if (!branchNum) return;
            const group = (btn.getAttribute('data-group') || 'a');
            const impactPos = parseInt(btn.getAttribute('data-impact') || '0', 10);
            if (!impactPos) return;

            if (group === 'b' && !_atIsSecondIntermediateEnabled()) return;

            const visible = _atGetVisibleImpactCount(branchNum, group);
            if (visible <= 1) return; // Minimum 1
            if (impactPos > visible) return;

            // Confirm if not empty
            const delIdx = _atLeafIndex(branchNum, group, impactPos);
            const delData = _atReadLeafFields(delIdx);
            if (!_atLeafDataIsEmpty(delData)) {
                const ok = confirm('Diese Auswirkung ist nicht leer. Wirklich löschen?');
                if (!ok) return;
            }

            // Shift values up (to avoid gaps)
            for (let pos = impactPos; pos < visible; pos++) {
                const srcIdx = _atLeafIndex(branchNum, group, pos + 1);
                const dstIdx = _atLeafIndex(branchNum, group, pos);
                _atCopyLeafFields(srcIdx, dstIdx);
            }

            // Clear last leaf + hide last visible row
            const lastIdx = _atLeafIndex(branchNum, group, visible);
            _atClearLeafFields(lastIdx);
            const lastRow = _atGetImpactRow(branchNum, group, visible);
            if (lastRow) lastRow.style.display = 'none';

            _atRecomputeAllRowspans();
            _atUpdateAddImpactButtonState(branchNum, group);
            _atUpdateRemoveImpactButtonState(branchNum, group);
            _atUpdateLeafDeleteButtonsState(branchNum, group);

            try { if (typeof populateAttackTreeDropdowns === 'function') populateAttackTreeDropdowns(); } catch (e) { console.warn('[AT] populateAttackTreeDropdowns:', e.message || e); }
            try { if (typeof updateAttackTreeKSTUSummariesFromForm === 'function') updateAttackTreeKSTUSummariesFromForm(); } catch (e) { console.warn('[AT] updateSummaries:', e.message || e); }
        };
    });

    _atUpdateAllLeafDeleteButtonsState();
}


