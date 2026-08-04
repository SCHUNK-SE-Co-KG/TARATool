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
    const rootRefsList = document.getElementById('sgRootRefs');

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

    function riskEntryCheckboxHtml(analysis, selectedIds) {
        const entries = Array.isArray(analysis.riskEntries) ? analysis.riskEntries.slice() : [];
        entries.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

        if (entries.length === 0) {
            return '';
        }

        const selectedSet = new Set(Array.isArray(selectedIds) ? selectedIds : []);
        return entries
            .map(e => {
                const id = e.id || '';
                const name = (typeof getLocalizedField === 'function')
                    ? (getLocalizedField({ title: e.rootName || '', title_en: e.rootName_en || '' }, 'title') || e.rootName || '')
                    : (e.rootName || '');
                const label = `${id}: ${name}`;
                const checked = selectedSet.has(id) ? 'checked' : '';
                return `<label class="sg-root-ref-item">
                    <input type="checkbox" value="${escapeHtml(id)}" ${checked}>
                    <span>${escapeHtml(label)}</span>
                </label>`;
            })
            .join('');
    }

    function renderRootRefsSelect(analysis, selectedIds) {
        if (!rootRefsList) return;

        const entries = Array.isArray(analysis.riskEntries) ? analysis.riskEntries : [];
        if (entries.length === 0) {
            rootRefsList.innerHTML = `<div class="sg-root-refs-empty">${(typeof t === 'function') ? t('sg.noTrees') : 'Keine Angriffsbäume vorhanden'}</div>`;
            rootRefsList.setAttribute('data-empty', '1');
            return;
        }

        rootRefsList.removeAttribute('data-empty');
        rootRefsList.innerHTML = riskEntryCheckboxHtml(analysis, selectedIds);
    }

    function readRootRefsSelect() {
        if (!rootRefsList || rootRefsList.getAttribute('data-empty') === '1') return [];
        return Array.from(rootRefsList.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value)
            .filter(Boolean);
    }

    // escapeHtml() is provided globally via utils.js

    function openModal(goal, analysis) {
        if (!modal || !form) return;
        const a = analysis || getActiveAnalysis();
        if (!a) return;
        modal.dataset.sgId = goal && goal.id ? goal.id : '';

        if (goal) {
            if (titleEl) titleEl.textContent = (typeof tf === 'function') ? tf('sg.modal.edit', { id: goal.id }) : `Security Ziel ${goal.id} bearbeiten`;
            if (idField) idField.value = goal.id;
            if (nameField) nameField.value = goal.name || '';
            if (descField) descField.value = goal.description || '';
            renderRootRefsSelect(a, goal.rootRefs || []);
        } else {
            if (titleEl) titleEl.textContent = (typeof t === 'function') ? t('sg.modal.new') : 'Neues Security Ziel';
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
            if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.needAnalysis') : 'Bitte erst eine Analyse wählen/erstellen.'), 'warning');
            return;
        }

        ensureSecurityGoals(analysis);

        const id = (idField ? idField.value : '').trim();
        const name = (nameField ? nameField.value : '').trim();
        const description = (descField ? descField.value : '').trim();
        const rootRefs = readRootRefsSelect();

        if (!name) {
            if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.needName') : 'Bitte einen Namen angeben.'), 'warning');
            return;
        }

        if (id) {
            const existing = analysis.securityGoals.find(g => g.id === id);
            if (!existing) {
                if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.sgNotFound') : 'Security Ziel nicht gefunden.'), 'error');
                return;
            }
            existing.name = name;
            existing.description = description;
            existing.rootRefs = rootRefs;
            if (typeof showToast === 'function') showToast((typeof tf === 'function' ? tf('toast.sgUpdated', { id }) : `Security Ziel ${id} aktualisiert.`), 'success');
        } else {
            const newId = nextSecurityGoalId(analysis);
            analysis.securityGoals.push({
                id: newId,
                name,
                description,
                rootRefs
            });
            if (typeof showToast === 'function') showToast((typeof tf === 'function' ? tf('toast.sgCreated', { id: newId }) : `Security Ziel ${newId} erstellt.`), 'success');
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
                    <h4>${(typeof t === 'function') ? t('sg.noneTitle') : 'Keine Security Ziele definiert'}</h4>
                    <p>${(typeof t === 'function') ? t('sg.noneHint') : 'Fügen Sie über <b>"Security Ziel hinzufügen"</b> neue Ziele hinzu und referenzieren Sie optional bestehende Angriffsbäume (Root).'}</p>
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
                    const name = (r && typeof getLocalizedField === 'function')
                        ? (getLocalizedField({ title: r.rootName || '', title_en: r.rootName_en || '' }, 'title') || r.rootName || '')
                        : ((r && r.rootName) ? r.rootName : '');
                    return name ? `${id}: ${name}` : `${id}`;
                })
                .filter(Boolean);

            const refsMarkup = refLabels.length
                ? `<div style="margin-top:6px;">
                        ${refLabels.map(lbl => `<div style="margin:2px 0;">${escapeHtml(lbl)}</div>`).join('')}
                   </div>`
                : `<div style="color:#999; margin-top:6px;">${(typeof t === 'function') ? t('sg.noRef') : '— keine Referenz —'}</div>`;

            return `
                <div class="asset-card" style="border-top-color:#8e44ad;">
                    <div class="asset-card-header">${escapeHtml(g.id)}: ${escapeHtml(g.name)}</div>
                    <div class="asset-description-area">${g.description ? escapeHtml(g.description) : `<span style="color:#999;">${(typeof t === 'function') ? t('sg.noDesc') : '— Keine Beschreibung —'}</span>`}</div>

                    <div style="margin-bottom:12px;">
                        <div style="font-weight:600; font-size:0.9em;">${(typeof t === 'function') ? t('sg.refsTitle') : 'Referenzierte Angriffsziele (Root)'}</div>
                        ${refsMarkup}
                    </div>

                    <div class="asset-card-footer">
                        <button class="action-button small" onclick="editSecurityGoal('${escapeHtml(g.id)}')"><i class="fas fa-edit"></i> ${(typeof t === 'function') ? t('btn.edit') : 'Bearbeiten'}</button>
                        <button class="action-button small dangerous" onclick="removeSecurityGoal('${escapeHtml(g.id)}')"><i class="fas fa-trash"></i> ${(typeof t === 'function') ? t('btn.delete') : 'Löschen'}</button>
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

    /**
     * Renumbers all security goals sequentially (SO01, SO02, ...).
     */
    function _renumberSecurityGoals(analysis) {
        if (!analysis.securityGoals || analysis.securityGoals.length === 0) return;
        analysis.securityGoals.forEach((goal, i) => {
            goal.id = 'SO' + String(i + 1).padStart(2, '0');
        });
    }

    window.removeSecurityGoal = function(id) {
        const analysis = getActiveAnalysis();
        if (!analysis) return;
        ensureSecurityGoals(analysis);

        const goal = analysis.securityGoals.find(g => g.id === id);
        if (!goal) return;

        showConfirmation({
            title: (typeof t === 'function') ? t('sg.delete.title') : 'Security Ziel löschen',
            messageHtml: (typeof tf === 'function')
                ? tf('sg.delete.message', { name: escapeHtml(goal.name), id: escapeHtml(goal.id) })
                : `Möchten Sie das Security Ziel <b>${escapeHtml(goal.name)} (${escapeHtml(goal.id)})</b> wirklich löschen?`,
            confirmText: (typeof t === 'function') ? t('confirm.delete') : 'Löschen',
            onConfirm: () => {
                analysis.securityGoals = analysis.securityGoals.filter(g => g.id !== id);
                _renumberSecurityGoals(analysis);
                if (typeof saveAnalyses === 'function') saveAnalyses();
                renderSecurityGoals(analysis);
                if (typeof showToast === 'function') showToast((typeof tf === 'function' ? tf('toast.sgDeleted', { id }) : `Security Ziel ${id} gelöscht.`), 'success');
            }
        });
    };

    // Bindings
    if (btnAdd) {
        btnAdd.onclick = () => {
            const analysis = getActiveAnalysis();
            if (!analysis) {
                if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.needAnalysis') : 'Bitte erst eine Analyse wählen/erstellen.'), 'warning');
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
