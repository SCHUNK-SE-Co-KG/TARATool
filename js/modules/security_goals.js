/**
 * @file        security_goals.js
 * @description Security objectives – CRUD with attack tree referencing
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

(() => {
    // Explicit DOM references (more robust than implicit window ID globals)
    const container = document.getElementById('securityGoalsCardContainer');
    const btnAdd = document.getElementById('btnAddSecurityGoal');

    const modal = document.getElementById('securityGoalModal');
    const closeBtn = document.getElementById('closeSecurityGoalModal');
    const form = document.getElementById('securityGoalForm');

    const titleEl = document.getElementById('securityGoalModalTitle');
    const idField = document.getElementById('sgIdField');
    const nameField = document.getElementById('sgName');
    const descField = document.getElementById('sgDescription');
    const rootRefsSelect = document.getElementById('sgRootRefs');

    // Uses global getActiveAnalysis() from utils.js

    function ensureSecurityGoals(analysis) {
        if (!analysis.securityGoals || !Array.isArray(analysis.securityGoals)) {
            analysis.securityGoals = [];
        }

        // Backwards compatibility: In earlier iterations Security Objectives used the
        // prefix "SG". The UI should show "SO" + number.
        // We normalize persisted IDs here to keep edit/delete stable.
        const used = new Set();
        let maxNum = 0;

        // 1) Normalize "SGxx" -> "SOxx" and track max.
        analysis.securityGoals.forEach(g => {
            if (!g || typeof g !== 'object') return;

            if (typeof g.id === 'string') {
                const mOld = g.id.match(/^SG(\d+)$/i);
                if (mOld) {
                    g.id = 'SO' + String(parseInt(mOld[1], 10)).padStart(2, '0');
                }
            }

            const m = (typeof g.id === 'string') ? g.id.match(/^SO(\d+)$/i) : null;
            if (m) {
                maxNum = Math.max(maxNum, parseInt(m[1], 10));
            }
        });

        // 2) Ensure each goal has a unique "SOxx" id.
        analysis.securityGoals.forEach(g => {
            if (!g || typeof g !== 'object') return;
            const m = (typeof g.id === 'string') ? g.id.match(/^SO(\d+)$/i) : null;
            if (!m || used.has(g.id)) {
                maxNum += 1;
                g.id = 'SO' + String(maxNum).padStart(2, '0');
            }
            used.add(g.id);
        });
    }

    function nextSecurityGoalId(analysis) {
        ensureSecurityGoals(analysis);
        const nums = analysis.securityGoals
            .map(g => (g && typeof g.id === 'string' ? g.id : ''))
            .map(id => {
                const m = id.match(/^SO(\d+)$/i);
                return m ? parseInt(m[1], 10) : NaN;
            })
            .filter(n => !isNaN(n));

        const next = nums.length ? Math.max(...nums) + 1 : 1;
        return 'SO' + String(next).padStart(2, '0');
    }

    function riskEntryOptionsHtml(analysis, selectedIds) {
        const entries = Array.isArray(analysis.riskEntries) ? analysis.riskEntries.slice() : [];
        entries.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

        if (entries.length === 0) {
            // Empty select is rendered as disabled in the card markup.
            return '';
        }

        const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : []);
        return entries
            .map(e => {
                const id = e.id || '';
                const label = `${id}: ${e.rootName || ''}`;
                const sel = selectedSet.has(id) ? 'selected' : '';
                return `<option value="${escapeHtml(id)}" ${sel}>${escapeHtml(label)}</option>`;
            })
            .join('');
    }

    function renderRootRefsSelect(analysis, selectedIds) {
        if (!rootRefsSelect) return;

        const entries = Array.isArray(analysis.riskEntries) ? analysis.riskEntries : [];
        if (entries.length === 0) {
            rootRefsSelect.disabled = true;
            rootRefsSelect.innerHTML = `<option>Keine Angriffsbäume vorhanden</option>`;
            return;
        }

        rootRefsSelect.disabled = false;
        rootRefsSelect.innerHTML = riskEntryOptionsHtml(analysis, selectedIds);
    }

    function readRootRefsSelect() {
        if (!rootRefsSelect || rootRefsSelect.disabled) return [];
        return Array.from(rootRefsSelect.selectedOptions || []).map(o => o.value);
    }

    // escapeHtml() is provided globally via utils.js

    function openModal(goal, analysis) {
        if (!modal || !form) return;
        const a = analysis || getActiveAnalysis();
        if (!a) return;

        if (goal) {
            if (titleEl) titleEl.textContent = `Security Ziel ${goal.id} bearbeiten`;
            if (idField) idField.value = goal.id;
            if (nameField) nameField.value = goal.name || '';
            if (descField) descField.value = goal.description || '';
            renderRootRefsSelect(a, goal.rootRefs || []);
        } else {
            if (titleEl) titleEl.textContent = 'Neues Security Ziel';
            form.reset();
            if (idField) idField.value = '';
            renderRootRefsSelect(a, []);
        }

        modal.style.display = 'block';
    }

    function closeModal() {
        if (modal) modal.style.display = 'none';
    }

    function saveGoal(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();

        const analysis = getActiveAnalysis();
        if (!analysis) {
            if (typeof showToast === 'function') showToast('Bitte erst eine Analyse wählen/erstellen.', 'warning');
            return;
        }

        ensureSecurityGoals(analysis);

        const id = (idField ? idField.value : '').trim();
        const name = (nameField ? nameField.value : '').trim();
        const description = (descField ? descField.value : '').trim();
        const rootRefs = readRootRefsSelect();

        if (!name) {
            if (typeof showToast === 'function') showToast('Bitte einen Namen angeben.', 'warning');
            return;
        }

        if (id) {
            const existing = analysis.securityGoals.find(g => g.id === id);
            if (!existing) {
                if (typeof showToast === 'function') showToast('Security Ziel nicht gefunden.', 'error');
                return;
            }
            existing.name = name;
            existing.description = description;
            existing.rootRefs = rootRefs;
            if (typeof showToast === 'function') showToast(`Security Ziel ${id} aktualisiert.`, 'success');
        } else {
            const newId = nextSecurityGoalId(analysis);
            analysis.securityGoals.push({
                id: newId,
                name,
                description,
                rootRefs
            });
            if (typeof showToast === 'function') showToast(`Security Ziel ${newId} erstellt.`, 'success');
        }

        if (typeof saveAnalyses === 'function') saveAnalyses();
        renderSecurityGoals(analysis);
        closeModal();
    }

    function renderCards(analysis) {
        if (!container) return;
        ensureSecurityGoals(analysis);

        const goals = analysis.securityGoals.slice();
        goals.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

        if (goals.length === 0) {
            container.innerHTML = `
                <div class="warning-box" style="grid-column: 1 / -1;">
                    <h4>Keine Security Ziele definiert</h4>
                    <p>Fügen Sie über <b>"Security Ziel hinzufügen"</b> neue Ziele hinzu und referenzieren Sie optional bestehende Angriffsbäume (Root).</p>
                </div>
            `;
            return;
        }

        const riskById = new Map(((analysis.riskEntries || [])).map(r => [r.id, r]));

        container.innerHTML = goals.map(g => {
            const refs = Array.isArray(g.rootRefs) ? g.rootRefs : [];
            const refLabels = refs
                .map(id => {
                    const r = riskById.get(id);
                    const name = (r && r.rootName) ? r.rootName : '';
                    // Display requirement: "Rnn: Name" (no bullet points)
                    return name ? `${id}: ${name}` : `${id}`;
                })
                .filter(Boolean);

            const refsMarkup = refLabels.length
                ? `<div style="margin-top:6px;">
                        ${refLabels.map(lbl => `<div style="margin:2px 0;">${escapeHtml(lbl)}</div>`).join('')}
                   </div>`
                : `<div style="color:#999; margin-top:6px;">— keine Referenz —</div>`;

            return `
                <div class="asset-card" style="border-top-color:#8e44ad;">
                    <div class="asset-card-header">${escapeHtml(g.id)}: ${escapeHtml(g.name)}</div>
                    <div class="asset-description-area">${g.description ? escapeHtml(g.description) : '<span style="color:#999;">— Keine Beschreibung —</span>'}</div>

                    <div style="margin-bottom:12px;">
                        <div style="font-weight:600; font-size:0.9em;">Referenzierte Angriffsziele (Root)</div>
                        ${refsMarkup}
                    </div>

                    <div class="asset-card-footer">
                        <button class="action-button small" onclick="editSecurityGoal('${escapeHtml(g.id)}')"><i class="fas fa-edit"></i> Bearbeiten</button>
                        <button class="action-button small dangerous" onclick="removeSecurityGoal('${escapeHtml(g.id)}')"><i class="fas fa-trash"></i> Löschen</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Public API
    window.renderSecurityGoals = function(analysis) {
        const a = analysis || getActiveAnalysis();
        if (!a) return;
        renderCards(a);
    };

    window.editSecurityGoal = function(id) {
        const analysis = getActiveAnalysis();
        if (!analysis) return;
        ensureSecurityGoals(analysis);

        const goal = analysis.securityGoals.find(g => g.id === id);
        if (!goal) return;
        openModal(goal, analysis);
    };

    window.removeSecurityGoal = function(id) {
        const analysis = getActiveAnalysis();
        if (!analysis) return;
        ensureSecurityGoals(analysis);

        const goal = analysis.securityGoals.find(g => g.id === id);
        if (!goal) return;

        showConfirmation({
            title: 'Security Ziel löschen',
            messageHtml: `Möchten Sie das Security Ziel <b>${escapeHtml(goal.name)} (${escapeHtml(goal.id)})</b> wirklich löschen?`,
            confirmText: 'Löschen',
            onConfirm: () => {
                analysis.securityGoals = analysis.securityGoals.filter(g => g.id !== id);
                if (typeof saveAnalyses === 'function') saveAnalyses();
                renderSecurityGoals(analysis);
                if (typeof showToast === 'function') showToast(`Security Ziel ${id} gelöscht.`, 'success');
            }
        });
    };

    // Bindings
    if (btnAdd) {
        btnAdd.onclick = () => {
            const analysis = getActiveAnalysis();
            if (!analysis) {
                if (typeof showToast === 'function') showToast('Bitte erst eine Analyse wählen/erstellen.', 'warning');
                return;
            }
            openModal(null, analysis);
        };
    }

    if (form) {
        form.onsubmit = saveGoal;
    }

    if (closeBtn) {
        closeBtn.onclick = closeModal;
    }
})();
