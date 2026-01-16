function _atGetTreeDepth() {
    // Ab jetzt gibt es nur noch:
    // 1 = Root -> Auswirkungen
    // 2 = Root -> Zwischenpfad(e) -> Auswirkungen (1 oder 2 Zwischenpfade parallel)
    const v = parseInt(document.getElementById('tree_depth')?.value || '1', 10);
    return (v === 2) ? 2 : 1;
}

function _atIsSecondIntermediateEnabled() {
    const v = (document.getElementById('use_second_intermediate')?.value || 'false');
    return String(v).toLowerCase() === 'true';
}

function _atSetSecondIntermediateEnabled(enabled) {
    const inp = document.getElementById('use_second_intermediate');
    if (inp) inp.value = enabled ? 'true' : 'false';

    // L2B Zellen + Rows pro Branch ein-/ausblenden
    [1,2].forEach(branchNum => {
        const cell = document.getElementById(`at_branch_${branchNum}_cell_l2b`);
        if (cell) cell.style.display = enabled ? 'table-cell' : 'none';

        document.querySelectorAll(`tr.l2b-row[data-branch="${branchNum}"]`).forEach(r => {
            if (!r) return;
            r.style.display = enabled ? '' : 'none';
        });

        if (enabled) {
            // Default: 2 Auswirkungen sichtbar, Extra hidden
            document.querySelectorAll(`tr.l2b-row[data-branch="${branchNum}"][data-impact="3"], tr.l2b-row[data-branch="${branchNum}"][data-impact="4"], tr.l2b-row[data-branch="${branchNum}"][data-impact="5"]`)
                .forEach(r => { if (r) r.style.display = 'none'; });
        }
    });

    // Rowspans neu berechnen
    try { _atRecomputeAllRowspans(); } catch(e) {}
    try { _atUpdateAddImpactButtonState(1, 'a'); } catch(e) {}
    try { _atUpdateAddImpactButtonState(2, 'a'); } catch(e) {}
    try { _atUpdateAddImpactButtonState(1, 'b'); } catch(e) {}
    try { _atUpdateAddImpactButtonState(2, 'b'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(1, 'a'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(2, 'a'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(1, 'b'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(2, 'b'); } catch(e) {}

    updateAttackTreeKSTUSummariesFromForm();

    // Leaf-Delete Buttons pro Zeile (sichtbar/disabled) aktualisieren
    try { _atEnsureLeafDeleteButtons(); } catch(e) {}
    try { _atUpdateAllLeafDeleteButtonsState(); } catch(e) {}
}

function setTreeDepth(depth) {
    // Backwards-compatible: old calls used boolean (deep on/off) oder 3
    if (typeof depth === 'boolean') depth = depth ? 2 : 1;
    depth = parseInt(depth || 1, 10);
    if (depth !== 2) depth = 1;

    const colsL2 = document.querySelectorAll('.col-level-2');
    const colsL3 = document.querySelectorAll('.col-level-3'); // bleibt künftig ungenutzt/ausgeblendet
    const inputUseDeep = document.getElementById('use_deep_tree');
    const inputDepth = document.getElementById('tree_depth');

    const btnL2 = document.getElementById('btnToggleTreeDepth');
    const btnSecond = document.getElementById('btnToggleTreeDepth2');

    const showL2 = depth === 2;

    colsL2.forEach(el => el.style.display = showL2 ? 'table-cell' : 'none');
    colsL3.forEach(el => el.style.display = 'none'); // keine "tiefe" dritte Ebene mehr

    if (inputUseDeep) inputUseDeep.value = showL2 ? 'true' : 'false';
    if (inputDepth) inputDepth.value = String(depth);

    if (btnL2) {
        btnL2.innerHTML = showL2
            ? '<i class="fas fa-minus"></i> Zwischenebene ausblenden'
            : '<i class="fas fa-layer-group"></i> Zwischenebene einblenden';
    }

    // Zweiter Zwischenpfad nur möglich, wenn Zwischenebene aktiv
    if (btnSecond) {
        btnSecond.style.display = showL2 ? 'inline-flex' : 'none';
        btnSecond.innerHTML = _atIsSecondIntermediateEnabled()
            ? '<i class="fas fa-minus"></i> 2. Zwischenpfad entfernen'
            : '<i class="fas fa-layer-group"></i> 2. Zwischenpfad anlegen';
    }

    // "Auswirkung hinzufügen" Buttons:
    // - Tiefe 1: am L1-Knoten
    // - Tiefe 2: am jeweiligen Zwischenpfad (L2 / L2B)
    document.querySelectorAll('button.add-impact-btn').forEach(b => {
        if (!b || !b.classList) return;
        const isL1 = b.classList.contains('level-l1');
        const isL2 = b.classList.contains('level-l2');
        const isL2B = b.classList.contains('level-l2b');
        const isL3 = b.classList.contains('level-l3');

        if (depth === 1) {
            b.style.display = isL1 ? 'inline-flex' : 'none';
        } else {
            if (isL3) { b.style.display = 'none'; return; }
            if (isL2B) {
                b.style.display = _atIsSecondIntermediateEnabled() ? 'inline-flex' : 'none';
            } else {
                b.style.display = isL2 ? 'inline-flex' : 'none';
            }
        }
    });

    document.querySelectorAll('button.remove-impact-btn').forEach(b => {
        if (!b || !b.classList) return;
        const isL1 = b.classList.contains('level-l1');
        const isL2 = b.classList.contains('level-l2');
        const isL2B = b.classList.contains('level-l2b');
        const isL3 = b.classList.contains('level-l3');

        if (depth === 1) {
            b.style.display = isL1 ? 'inline-flex' : 'none';
        } else {
            if (isL3) { b.style.display = 'none'; return; }
            if (isL2B) {
                b.style.display = _atIsSecondIntermediateEnabled() ? 'inline-flex' : 'none';
            } else {
                b.style.display = isL2 ? 'inline-flex' : 'none';
            }
        }
    });

    // Wenn Zwischenebene aus: 2. Zwischenpfad auch ausblenden
    if (!showL2) _atSetSecondIntermediateEnabled(false);

    // Max-5 Zustände und Rowspans aktualisieren
    try { _atRecomputeAllRowspans(); } catch(e) {}
    try { _atUpdateAddImpactButtonState(1, 'a'); } catch(e) {}
    try { _atUpdateAddImpactButtonState(2, 'a'); } catch(e) {}
    try { _atUpdateAddImpactButtonState(1, 'b'); } catch(e) {}
    try { _atUpdateAddImpactButtonState(2, 'b'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(1, 'a'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(2, 'a'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(1, 'b'); } catch(e) {}
    try { _atUpdateRemoveImpactButtonState(2, 'b'); } catch(e) {}

    updateAttackTreeKSTUSummariesFromForm();

    // Leaf-Delete Buttons pro Zeile (sichtbar/disabled) aktualisieren
    try { _atEnsureLeafDeleteButtons(); } catch(e) {}
    try { _atUpdateAllLeafDeleteButtonsState(); } catch(e) {}
}

// =============================================================
// --- DYNAMIC IMPACT (AUSWIRKUNG) ROWS PER PATH / ZWISCHENPFAD ---
// =============================================================
const AT_MAX_IMPACTS_PER_PATH = 5;

// Leaf-Index Mapping:
// - Branch 1, Gruppe A (Zwischenpfad 1 oder direkt): 1..5
// - Branch 2, Gruppe A: 6..10
// - Branch 1, Gruppe B (Zwischenpfad 2): 11..15
// - Branch 2, Gruppe B: 16..20
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

function _atSetRowspanFor(branchNum, spanL1, spanA, spanB) {
    const tdL1 = document.getElementById(`at_branch_${branchNum}_cell_l1`);
    if (tdL1) tdL1.rowSpan = spanL1;

    const tdL2A = document.getElementById(`at_branch_${branchNum}_cell_l2`);
    if (tdL2A) tdL2A.rowSpan = spanA;

    const tdL2B = document.getElementById(`at_branch_${branchNum}_cell_l2b`);
    if (tdL2B) tdL2B.rowSpan = spanB;
}

function _atRecomputeAllRowspans() {
    const depth = _atGetTreeDepth();
    const secondOn = _atIsSecondIntermediateEnabled();

    [1,2].forEach(branchNum => {
        const a = _atGetVisibleImpactCount(branchNum, 'a');
        const b = secondOn ? _atGetVisibleImpactCount(branchNum, 'b') : 0;

        if (depth === 1) {
            _atSetRowspanFor(branchNum, a, a, 0);
        } else {
            const total = a + b;
            _atSetRowspanFor(branchNum, total, a, Math.max(2, b || 2));
        }
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

        // Sichtbarkeit abhängig von Ebene
        const isL1 = btn.classList && btn.classList.contains('level-l1');
        const isL2 = btn.classList && btn.classList.contains('level-l2');
        const isL2B = btn.classList && btn.classList.contains('level-l2b');

        if (depth === 1) {
            if (!isL1 || g !== 'a') { btn.style.display = 'none'; return; }
        } else {
            if (g === 'a') {
                if (!isL2) { btn.style.display = 'none'; return; }
            } else {
                if (!secondOn || !isL2B) { btn.style.display = 'none'; return; }
            }
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

        if (depth === 1) {
            if (!isL1 || g !== 'a') { btn.style.display = 'none'; return; }
        } else {
            if (g === 'a') {
                if (!isL2) { btn.style.display = 'none'; return; }
            } else {
                if (!secondOn || !isL2B) { btn.style.display = 'none'; return; }
            }
        }

        btn.style.display = (visible <= 2) ? 'none' : 'inline-flex';
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
// --- PER-LEAF DELETE: Einzelne Auswirkungen gezielt entfernen ---
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

    // Summary wird über updateAttackTreeKSTUSummariesFromForm() neu berechnet
    const sum = document.getElementById(`${prefix}_summary`);
    if (sum) sum.innerHTML = '';
}

function _atCopyLeafFields(srcLeafIdx, dstLeafIdx) {
    if (!srcLeafIdx || !dstLeafIdx) return;
    const data = _atReadLeafFields(srcLeafIdx);
    _atWriteLeafFields(dstLeafIdx, data);
}

function _atEnsureLeafDeleteButtons() {
    // Füge pro Auswirkung einen kleinen "-" Button hinzu (einmalig).
    document.querySelectorAll('tr.impact-row').forEach(row => {
        if (!row) return;
        const leafContainer = row.querySelector('.leaf-container');
        if (!leafContainer) return;

        // Button wird in der DS-Zeile platziert (stabil, kein Input-Layout verändern).
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

        // Kontext: Branch/Group/Pos aus Row übernehmen
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
        // Minimum 2 Auswirkungen pro Gruppe
        btn.disabled = visible <= 2;
    });
}

function _atUpdateAllLeafDeleteButtonsState() {
    [1, 2].forEach(b => {
        _atUpdateLeafDeleteButtonsState(b, 'a');
        if (_atGetTreeDepth() === 2 && _atIsSecondIntermediateEnabled()) {
            _atUpdateLeafDeleteButtonsState(b, 'b');
        }
    });
}

function _atResetImpactRows() {
    // Gruppe A: extra impacts ausblenden
    [1, 2].forEach(branchNum => {
        for (let i = 3; i <= 5; i++) {
            const r = _atGetImpactRow(branchNum, 'a', i);
            if (r) r.style.display = 'none';
        }
    });

    // Gruppe B komplett ausblenden
    _atSetSecondIntermediateEnabled(false);

    // Standard: Gruppe A hat 2 visible
    _atRecomputeAllRowspans();
    _atUpdateAddImpactButtonState(1, 'a');
    _atUpdateAddImpactButtonState(2, 'a');
    _atUpdateRemoveImpactButtonState(1, 'a');
    _atUpdateRemoveImpactButtonState(2, 'a');

    // Leaf-Delete Buttons (pro Zeile) aktualisieren
    _atEnsureLeafDeleteButtons();
    _atUpdateAllLeafDeleteButtonsState();
}

function _atShowImpactsUpTo(branchNum, group, count) {
    const g = (group || 'a');
    const capped = Math.max(2, Math.min(AT_MAX_IMPACTS_PER_PATH, count || 2));
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

            // Gruppe B nur wenn aktiv
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

            populateAttackTreeDropdowns();
            updateAttackTreeKSTUSummariesFromForm();
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
            if (visible <= 2) return;

            // Letzte sichtbare Auswirkung entfernen (nur hinzugefügte, also >2)
            const row = _atGetImpactRow(branchNum, group, visible);
            if (row) row.style.display = 'none';

            const leafIdx = _atLeafIndex(branchNum, group, visible);
            _atClearLeafFields(leafIdx);

            _atRecomputeAllRowspans();
            _atUpdateAddImpactButtonState(branchNum, group);
            _atUpdateRemoveImpactButtonState(branchNum, group);

            _atEnsureLeafDeleteButtons();
            _atUpdateLeafDeleteButtonsState(branchNum, group);

            populateAttackTreeDropdowns();
            updateAttackTreeKSTUSummariesFromForm();
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
            if (visible <= 2) return; // Minimum 2
            if (impactPos > visible) return;

            // Werte nach oben schieben (damit keine Lücken entstehen)
            for (let pos = impactPos; pos < visible; pos++) {
                const srcIdx = _atLeafIndex(branchNum, group, pos + 1);
                const dstIdx = _atLeafIndex(branchNum, group, pos);
                _atCopyLeafFields(srcIdx, dstIdx);
            }

            // Letztes Leaf leeren + letzte sichtbare Zeile ausblenden
            const lastIdx = _atLeafIndex(branchNum, group, visible);
            _atClearLeafFields(lastIdx);
            const lastRow = _atGetImpactRow(branchNum, group, visible);
            if (lastRow) lastRow.style.display = 'none';

            _atRecomputeAllRowspans();
            _atUpdateAddImpactButtonState(branchNum, group);
            _atUpdateRemoveImpactButtonState(branchNum, group);
            _atUpdateLeafDeleteButtonsState(branchNum, group);

            populateAttackTreeDropdowns();
            updateAttackTreeKSTUSummariesFromForm();
        };
    });

    _atUpdateAllLeafDeleteButtonsState();
}

