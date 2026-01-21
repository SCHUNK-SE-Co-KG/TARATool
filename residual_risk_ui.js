// =============================================================
// --- RESTRISIKOANALYSE (UI) ---
//
// Uebersicht:
//  - pro Angriffsbaum eine Kachel (wie Risikoanalyse)
//  - Bearbeiten oeffnet Modal mit tabellarischer Leaf-Bearbeitung
//
// Leaf-Editor:
//  - Anzeige Risiko-Score und I(N)
//  - Behandlung: Akzeptiert / Delegiert / Mitigiert (muss gewaehlt werden)
//  - Anmerkung, Massnahme aus Security Konzept
//  - Bei Mitigiert: Eingabe K/S/T/U (analog Risikoanalyse)
//  - Green-Check Logik:
//      * Akzeptiert/Delegiert: Check wenn Anmerkung gesetzt
//      * Mitigiert: Check wenn Anmerkung + Massnahme + K/S/T/U gesetzt
// =============================================================

(function () {
    'use strict';

    // -----------------------------
    // Helpers
    // -----------------------------

    function rrEscapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function rrGetRiskMeta(rootRiskValue) {
        const rVal = parseFloat(rootRiskValue);
        let color = '#7f8c8d';
        let label = 'Unbekannt';

        if (!isNaN(rVal)) {
            if (rVal >= 2.0) { color = '#c0392b'; label = 'Kritisch'; }
            else if (rVal >= 1.6) { color = '#e67e22'; label = 'Hoch'; }
            else if (rVal >= 0.8) { color = '#f39c12'; label = 'Mittel'; }
            else { color = '#27ae60'; label = 'Niedrig'; }
        }

        const display = (rootRiskValue === undefined || rootRiskValue === null || String(rootRiskValue).trim() === '')
            ? '-' : String(rootRiskValue);

        return { color, label, display };
    }

    function rrEnsureModalWiring() {
        const modal = document.getElementById('residualRiskModal');
        if (!modal) return;
        if (modal.dataset.rrWired === '1') return;

        const btnCloseX = document.getElementById('closeResidualRiskModal');
        const btnCloseFooter = document.getElementById('btnCloseResidualRiskModalFooter');

        const close = () => {
            modal.style.display = 'none';
            // Refresh Uebersicht (damit evtl. spaeter Status/Counts sichtbar werden koennen)
            const analysis = (typeof analysisData !== 'undefined')
                ? (analysisData || []).find(a => a.id === activeAnalysisId)
                : null;
            if (analysis && typeof renderResidualRisk === 'function') {
                renderResidualRisk(analysis);
            }
        };

        if (btnCloseX) btnCloseX.onclick = close;
        if (btnCloseFooter) btnCloseFooter.onclick = close;

        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        modal.dataset.rrWired = '1';
    }

    function rrRenderScalarSelect(key, selected) {
        const crit = (typeof PROBABILITY_CRITERIA !== 'undefined') ? PROBABILITY_CRITERIA[key] : null;
        const opts = (crit && Array.isArray(crit.options)) ? crit.options : [];
        const label = crit ? crit.label : key;

        let html = `<label style="font-size:0.8em; color:#666;">${rrEscapeHtml(label)}</label>`;
        html += `<select class="kstu-select rr-kstu" data-kstu="${key}">`;
        html += `<option value="">Bitte waehlen…</option>`;
        opts.forEach(o => {
            const v = String(o.value ?? '');
            const sel = (String(selected ?? '') === v) ? 'selected' : '';
            html += `<option value="${rrEscapeHtml(v)}" ${sel}>${rrEscapeHtml(o.text ?? v)}</option>`;
        });
        html += `</select>`;
        return html;
    }

    function rrRenderOriginalSummary(leaf) {
        const kstu = { k: leaf?.k ?? '', s: leaf?.s ?? '', t: leaf?.t ?? '', u: leaf?.u ?? '' };
        const iNorm = leaf?.i_norm ?? '';

        if (typeof _renderNodeSummaryHTML === 'function') {
            return `<div class="node-stats-box">${_renderNodeSummaryHTML(kstu, iNorm)}</div>`;
        }

        // Fallback
        const valI = parseFloat(iNorm) || 0;
        const sumP = (parseFloat(kstu.k) || 0) + (parseFloat(kstu.s) || 0) + (parseFloat(kstu.t) || 0) + (parseFloat(kstu.u) || 0);
        const r = (valI * sumP).toFixed(2);
        return `<div class="node-stats-box"><div class="ns-row"><div>R=<b>${rrEscapeHtml(r)}</b></div><div>I(N)=<b>${rrEscapeHtml(iNorm || '-')}</b></div></div></div>`;
    }

    function rrComputeResidualLeafRiskValue(leaf) {
        // I(N) bleibt gleich; bei Mitigiert wird rr.K/S/T/U verwendet.
        const iNorm = leaf?.i_norm;
        const i = parseFloat(iNorm);
        if (isNaN(i)) return null;

        const rr = leaf?.rr || {};
        const k = parseFloat(rr.k);
        const s = parseFloat(rr.s);
        const t = parseFloat(rr.t);
        const u = parseFloat(rr.u);
        if ([k, s, t, u].some(v => Number.isNaN(v))) return null;

        const sumP = k + s + t + u;
        return (i * sumP).toFixed(2);
    }

    function rrRenderResidualLeafRiskValueHTML(leaf) {
        const val = rrComputeResidualLeafRiskValue(leaf);
        if (val === null) {
            return `Restrisiko R: <b>-</b>`;
        }
        const meta = rrGetRiskMeta(val);
        return `Restrisiko R: <b style="color:${meta.color}">${rrEscapeHtml(meta.display)}</b>`
            + ` <span style="margin-left:6px; padding:2px 6px; border-radius:3px; background:${meta.color}; color:#fff; font-size:0.8em;">${rrEscapeHtml(meta.label)}</span>`;
    }

    function rrLeafComplete(leaf) {
        const rr = leaf?.rr || {};
        const treatment = (rr.treatment || '').trim();
        const note = (rr.note || '').trim();
        const sec = (rr.securityConcept || '').trim();

        if (!treatment) return false;
        if (treatment === 'Akzeptiert' || treatment === 'Delegiert') {
            return note.length > 0;
        }
        if (treatment === 'Mitigiert') {
            const k = (rr.k || '').trim();
            const s = (rr.s || '').trim();
            const t = (rr.t || '').trim();
            const u = (rr.u || '').trim();
            return note.length > 0 && sec.length > 0 && k && s && t && u;
        }
        return false;
    }

    function rrAllLeavesComplete(entry) {
        let ok = true;
        try {
            if (typeof rrIterateLeaves === 'function') {
                rrIterateLeaves(entry, ({ leaf }) => {
                    if (!leaf) return;
                    if (!rrLeafComplete(leaf)) ok = false;
                });
            }
        } catch (_) {
            // fallback: if we cannot iterate, do not claim complete
            ok = false;
        }
        return ok;
    }

    function rrGetTreeNote(analysis, uid) {
        try {
            return (analysis?.residualRisk?.treeNotes && uid) ? (analysis.residualRisk.treeNotes[uid] || '') : '';
        } catch (_) {
            return '';
        }
    }

    function rrSetTreeNote(analysis, uid, val) {
        try {
            if (!analysis) return;
            if (!analysis.residualRisk) analysis.residualRisk = { leaves: {}, entries: [], treeNotes: {} };
            if (!analysis.residualRisk.treeNotes) analysis.residualRisk.treeNotes = {};
            analysis.residualRisk.treeNotes[uid] = String(val ?? '');
        } catch (_) {}
    }

    function rrTreeNoteRequired(riskLabel) {
        const lbl = String(riskLabel || '').trim();
        return (lbl === 'Kritisch' || lbl === 'Hoch');
    }

    function rrUpdateRowUI(row, leaf) {
        if (!row) return;
        const rr = leaf?.rr || {};
        const treatment = (rr.treatment || '').trim();
        const isMit = (treatment === 'Mitigiert');
        const complete = rrLeafComplete(leaf);

        // Check icon
        const ico = row.querySelector('.rr-leaf-check');
        if (ico) {
            ico.classList.toggle('incomplete', !complete);
        }
        row.classList.toggle('rr-leaf-row-complete', complete);

        // Treatment required marker
        const sel = row.querySelector('.rr-treatment');
        if (sel) {
            sel.classList.toggle('rr-select-invalid', !treatment);
        }

        // Mitigation grid
        const gridWrap = row.querySelector('.rr-mitigate-wrap');
        if (gridWrap) {
            gridWrap.classList.toggle('rr-hidden', !isMit);
        }

        // Security-Konzept-Maßnahme nur bei Mitigiert editierbar
        const taSec = row.querySelector('.rr-security');
        if (taSec) {
            taSec.disabled = !isMit;
            taSec.classList.toggle('rr-disabled', !isMit);
        }

        const ph = row.querySelector('.rr-mitigate-placeholder');
        if (ph) {
            ph.classList.toggle('rr-hidden', isMit);
        }

        // Restrisiko-Risiko-Wert unter Neubewertung anzeigen
        const rv = row.querySelector('.rr-residual-leaf-value');
        if (rv) {
            rv.classList.toggle('rr-hidden', !isMit);
            if (isMit) {
                rv.innerHTML = rrRenderResidualLeafRiskValueHTML(leaf);
            }
        }
    }

    function rrBuildLeafLabel(meta) {
        const bName = meta?.branch?.name ? String(meta.branch.name) : '';
        const nName = meta?.node?.name ? String(meta.node.name) : '';
        const leafText = meta?.leaf?.text ? String(meta.leaf.text) : '';

        // kompakt, aber eindeutig
        const parts = [];
        if (bName) parts.push(bName);
        if (nName) parts.push(nName);
        const path = parts.length ? parts.join(' › ') : `Pfad B${meta.bNum}` + (meta.nNum ? `/N${meta.nNum}` : '');

        return {
            path,
            text: leafText
        };
    }

    function rrOpenModalForTree(residualEntry) {
        rrEnsureModalWiring();

        const analysis = (typeof analysisData !== 'undefined')
            ? (analysisData || []).find(a => a.id === activeAnalysisId)
            : null;
        if (!analysis) return;

        // Sicherstellen, dass die Restrisiko-Struktur aktuell ist
        // Achtung: Sync kann Objekte neu clonen -> danach Entry erneut holen (uid-basiert)
        const entryUid = residualEntry?.uid || '';
        try {
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(analysis);
        } catch (_) {}

        const liveEntry = (analysis.residualRisk?.entries || []).find(e => e?.uid === entryUid) || residualEntry;

        const modal = document.getElementById('residualRiskModal');
        const title = document.getElementById('residualRiskModalTitle');
        const body = document.getElementById('residualRiskModalBody');
        if (!modal || !title || !body) return;

        const id = rrEscapeHtml(liveEntry?.id ?? 'R??');
        const name = rrEscapeHtml(liveEntry?.rootName ?? '(ohne Titel)');
        title.textContent = `Restrisiko bearbeiten - ${id}: ${name}`;

        const rows = [];
        try {
            if (typeof rrIterateLeaves === 'function') {
                rrIterateLeaves(liveEntry, (meta) => {
                    if (!meta || !meta.leaf) return;
                    if (!meta.leaf.rr) meta.leaf.rr = { treatment:'', note:'', securityConcept:'', k:'', s:'', t:'', u:'' };
                    rows.push(meta);
                });
            }
        } catch (e) {}

        if (rows.length === 0) {
            body.innerHTML = `<div class="warning-box" style="margin:0;"><h4 style="margin:0 0 6px 0;">Keine Blaetter gefunden</h4><p style="margin:0; color:#555;">Der Angriffsbaum enthaelt keine Auswirkungen (Leaves).</p></div>`;
            modal.style.display = 'block';
            return;
        }

        const tableHtml = `
            <div class="success-box" style="margin-bottom:12px;">
                <p style="margin:0;">Bearbeiten Sie nur die Blaetter (Auswirkungen). Risikobewertung bleibt unveraendert.</p>
            </div>
            <div style="overflow-x:auto;">
                <table class="rr-leaf-table">
                    <thead>
                        <tr>
                            <th style="width:42px; text-align:center;">&nbsp;</th>
                            <th style="min-width:220px;">Blatt (Auswirkung)</th>
                            <th style="min-width:150px;">Risiko-Score</th>
                            <th style="min-width:160px;">Behandlung</th>
                            <th style="min-width:320px;">Restrisiko Bewertung (K/S/T/U)</th>
                            <th style="min-width:220px;">Anmerkungen</th>
                            <th style="min-width:220px;">Maßnahme aus Security Konzept</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(meta => {
                            const leaf = meta.leaf;
                            const lbl = rrBuildLeafLabel(meta);
                            const rr = leaf.rr || {};
                            const treatment = rrEscapeHtml(rr.treatment || '');
                            const note = rrEscapeHtml(rr.note || '');
                            const sec = rrEscapeHtml(rr.securityConcept || '');
                            const isMit = (rr.treatment === 'Mitigiert');
                            const complete = rrLeafComplete(leaf);

                            return `
                                <tr class="rr-leaf-row ${complete ? 'rr-leaf-row-complete' : ''}" data-leafkey="${rrEscapeHtml(meta.leafKey)}">
                                    <td style="text-align:center;">
                                        <i class="fas fa-check-circle rr-leaf-check ${complete ? '' : 'incomplete'}"></i>
                                    </td>
                                    <td>
                                        <div style="font-weight:700;">${rrEscapeHtml(lbl.path)}</div>
                                        <div style="color:#555; font-size:0.9em; margin-top:3px; white-space:pre-wrap;">${rrEscapeHtml(lbl.text || '(ohne Text)')}</div>
                                    </td>
                                    <td>${rrRenderOriginalSummary(leaf)}</td>
                                    <td>
                                        <select class="rr-treatment rr-field">
                                            <option value="">Bitte waehlen…</option>
                                            <option value="Akzeptiert" ${treatment === 'Akzeptiert' ? 'selected' : ''}>Akzeptiert</option>
                                            <option value="Delegiert" ${treatment === 'Delegiert' ? 'selected' : ''}>Delegiert</option>
                                            <option value="Mitigiert" ${treatment === 'Mitigiert' ? 'selected' : ''}>Mitigiert</option>
                                        </select>
                                    </td>
                                    <td>
                                        <div class="rr-mitigate-wrap ${isMit ? '' : 'rr-hidden'}">
                                            <div class="rr-kstu-grid">
                                                <div>${rrRenderScalarSelect('K', rr.k)}</div>
                                                <div>${rrRenderScalarSelect('S', rr.s)}</div>
                                                <div>${rrRenderScalarSelect('T', rr.t)}</div>
                                                <div>${rrRenderScalarSelect('U', rr.u)}</div>
                                            </div>
                                            <div class="rr-residual-leaf-value" style="margin-top:6px; color:#666; font-size:0.85em;">
                                                ${rrRenderResidualLeafRiskValueHTML(leaf)}
                                            </div>
                                        </div>
                                        <div class="rr-mitigate-placeholder ${isMit ? 'rr-hidden' : ''}" style="color:#7f8c8d;">-</div>
                                    </td>
                                    <td>
                                        <textarea class="rr-note rr-textarea" placeholder="Anmerkungen...">${note}</textarea>
                                    </td>
                                    <td>
                                        <textarea class="rr-security rr-textarea" placeholder="Maßnahme aus Security Konzept...">${sec}</textarea>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        body.innerHTML = tableHtml;

        // Map leafKey -> leafRef
        const leafByKey = {};
        rows.forEach(meta => { leafByKey[meta.leafKey] = meta.leaf; });

        const tbody = body.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr.rr-leaf-row').forEach(tr => {
                const leafKey = tr.dataset.leafkey;
                const leaf = leafByKey[leafKey];
                if (!leaf) return;
                if (!leaf.rr) leaf.rr = { treatment:'', note:'', securityConcept:'', k:'', s:'', t:'', u:'' };

                const sel = tr.querySelector('.rr-treatment');
                const taNote = tr.querySelector('.rr-note');
                const taSec = tr.querySelector('.rr-security');
                const kstuSelects = tr.querySelectorAll('select.rr-kstu');

                const persist = () => {
                    // Legacy-Dict live mitziehen, damit beide Zugriffspfade konsistent bleiben
                    try {
                        if (analysis?.residualRisk?.leaves && liveEntry?.uid) {
                            analysis.residualRisk.leaves[`${liveEntry.uid}|${leafKey}`] = JSON.parse(JSON.stringify(leaf.rr || {}));
                        }
                    } catch (e) {}
                    try {
                        if (typeof saveAnalyses === 'function') saveAnalyses();
                    } catch (e) {}
                };

                if (sel) {
                    sel.addEventListener('change', () => {
                        leaf.rr.treatment = sel.value || '';
                        // wenn nicht mitigiert: keine Pflicht, aber Grid ausblenden
                        rrUpdateRowUI(tr, leaf);
                        persist();
                    });
                }

                if (taNote) {
                    taNote.addEventListener('input', () => {
                        leaf.rr.note = taNote.value;
                        rrUpdateRowUI(tr, leaf);
                        persist();
                    });
                }

                if (taSec) {
                    taSec.addEventListener('input', () => {
                        leaf.rr.securityConcept = taSec.value;
                        rrUpdateRowUI(tr, leaf);
                        persist();
                    });
                }

                kstuSelects.forEach(s => {
                    s.addEventListener('change', () => {
                        const key = s.dataset.kstu;
                        if (!key) return;
                        const v = s.value || '';
                        if (key === 'K') leaf.rr.k = v;
                        else if (key === 'S') leaf.rr.s = v;
                        else if (key === 'T') leaf.rr.t = v;
                        else if (key === 'U') leaf.rr.u = v;
                        rrUpdateRowUI(tr, leaf);
                        persist();
                    });
                });

                // initial
                rrUpdateRowUI(tr, leaf);
            });
        }

        modal.style.display = 'block';
    }

    // -----------------------------
    // Overview cards
    // -----------------------------

    function rrRenderTreeCard(entry, analysis) {
        const id = rrEscapeHtml(entry?.id ?? 'R??');
        const name = rrEscapeHtml(entry?.rootName ?? '(ohne Titel)');
        const uid = rrEscapeHtml(entry?.uid ?? '');

        const base = (analysis?.riskEntries || []).find(e => e?.uid === entry?.uid) || entry;

        const origRisk = (base?.rootRiskValue ?? '-').toString();
        const origMeta = rrGetRiskMeta(origRisk);
        const iNorm = (base?.i_norm === '' || base?.i_norm === null || base?.i_norm === undefined) ? '-' : String(base.i_norm);

        let resVal = '-';
        // K/S/T/U werden in der Uebersicht nicht dargestellt (nur Risiko, Restrisiko, I und Anmerkung)

        try {
            if (typeof computeResidualTreeMetrics === 'function' && analysis && entry?.uid) {
                const m = computeResidualTreeMetrics(analysis, entry.uid);
                if (m && m.riskValue !== undefined) {
                    resVal = String(m.riskValue);
                }
            }
        } catch (e) {}

        const resMeta = rrGetRiskMeta(resVal);

        // In der Restrisiko-Uebersicht soll die Randfarbe das Restrisiko widerspiegeln
        const borderColor = resMeta.color;

        const note = rrGetTreeNote(analysis, entry?.uid);
        const noteRequired = rrTreeNoteRequired(resMeta.label);
        const leavesOk = rrAllLeavesComplete(entry);
        const treeOk = leavesOk && (!noteRequired || String(note || '').trim().length > 0);

        return `
            <div class="rr-risk-card" style="border-left: 5px solid ${borderColor};" data-rr-uid="${uid}" data-rr-leaves-ok="${leavesOk ? '1' : '0'}" data-rr-note-required="${noteRequired ? '1' : '0'}">
                <div class="rr-risk-header">
                    <div style="flex:1; min-width:260px;">
                        <div style="font-size:1.05em; font-weight:700;">
                            <span>${id}</span>: ${name}
                        </div>
                        <div style="margin-top:8px; color:#666; font-size:0.9em; display:flex; flex-wrap:wrap; gap:14px; align-items:center;">
                            <span>
                                Risiko-Score (R): <b style="color:${origMeta.color}">${rrEscapeHtml(origMeta.display)}</b>
                                <span style="margin-left:6px; padding:2px 6px; border-radius:3px; background:${origMeta.color}; color:#fff; font-size:0.8em;">${rrEscapeHtml(origMeta.label)}</span>
                            </span>
                            <span>
                                Restrisiko (R): <b style="color:${resMeta.color}">${rrEscapeHtml(resMeta.display)}</b>
                                <span style="margin-left:6px; padding:2px 6px; border-radius:3px; background:${resMeta.color}; color:#fff; font-size:0.8em;">${rrEscapeHtml(resMeta.label)}</span>
                            </span>
                        </div>
                        <div style="margin-top:6px; color:#666; font-size:0.85em;">
                            Gesamtschutzbedarf I(N): <b>${rrEscapeHtml(iNorm)}</b>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
                        <i class="fas fa-check-circle rr-check ${treeOk ? '' : 'incomplete'}" title="${treeOk ? 'Restrisikoanalyse komplett' : 'Restrisikoanalyse unvollstaendig'}"></i>
                        <button class="action-button small rr-edit-btn" data-rr-edit="${uid}">
                            <i class="fas fa-edit"></i> Bearbeiten
                        </button>
                    </div>
                </div>

                <div style="margin-top:10px;">
                    <label style="display:block; font-weight:600; font-size:0.9em; margin-bottom:6px; color:#333;">
                        Anmerkungen${noteRequired ? ' (Pflicht bei Kritisch/Hoch)' : ''}
                    </label>
                    <textarea class="rr-tree-note rr-textarea ${noteRequired && String(note||'').trim().length===0 ? 'rr-select-invalid' : ''}" data-rr-uid="${uid}" data-rr-note-required="${noteRequired ? '1' : '0'}" placeholder="Anmerkungen zur Restrisiko-Bewertung...">${rrEscapeHtml(note || '')}</textarea>
                </div>
            </div>
        `;
    }

    // -----------------------------
    // Public API
    // -----------------------------

    window.renderResidualRisk = function (analysis) {
        const container = document.getElementById('residualRiskContainer');
        if (!container) return;

        if (!analysis) {
            container.innerHTML = '<p style="color:#7f8c8d;">Keine Analyse aktiv.</p>';
            return;
        }

        try {
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(analysis);
        } catch (e) {}

        const entries = (analysis.residualRisk && Array.isArray(analysis.residualRisk.entries))
            ? analysis.residualRisk.entries
            : (analysis.riskEntries || []);

        if (!entries || entries.length === 0) {
            container.innerHTML = '<p style="color:#7f8c8d;">Noch keine Angriffsbäume vorhanden (siehe Reiter "Risikoanalyse").</p>';
            return;
        }

        container.innerHTML = entries.map(e => rrRenderTreeCard(e, analysis)).join('');

        container.querySelectorAll('.rr-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.currentTarget?.dataset?.rrEdit;
                if (typeof window.editResidualRiskTree === 'function') {
                    window.editResidualRiskTree(uid);
                }
            });
        });

        // Tree-Notizen (Pflicht bei Kritisch/Hoch)
        container.querySelectorAll('textarea.rr-tree-note').forEach(ta => {
            ta.addEventListener('input', () => {
                const uid = ta.dataset.rrUid;
                rrSetTreeNote(analysis, uid, ta.value);

                const noteRequired = (ta.dataset.rrNoteRequired === '1');
                const noteOk = String(ta.value || '').trim().length > 0;
                ta.classList.toggle('rr-select-invalid', noteRequired && !noteOk);

                // Checkmark aktualisieren
                const card = ta.closest('.rr-risk-card');
                const leavesOk = card ? (card.dataset.rrLeavesOk === '1') : false;
                const treeOk = leavesOk && (!noteRequired || noteOk);
                if (card) {
                    const ico = card.querySelector('.rr-check');
                    if (ico) ico.classList.toggle('incomplete', !treeOk);
                }

                try { if (typeof saveAnalyses === 'function') saveAnalyses(); } catch (_) {}
            });
        });
    };

    window.editResidualRiskTree = function (riskUid) {
        const analysis = (typeof analysisData !== 'undefined')
            ? (analysisData || []).find(a => a.id === activeAnalysisId)
            : null;
        if (!analysis) return;

        try {
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(analysis);
        } catch (_) {}

        const entry = (analysis.residualRisk?.entries || []).find(r => r?.uid === riskUid)
            || (analysis.riskEntries || []).find(r => r?.uid === riskUid);

        if (!entry) {
            if (typeof showToast === 'function') showToast('Angriffsbaum nicht gefunden.', 'error');
            return;
        }

        rrOpenModalForTree(entry);
    };

})();
