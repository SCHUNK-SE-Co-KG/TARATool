/**
 * @file        residual_risk_ui.js
 * @description Residual risk analysis – UI rendering, modal editor, and card overview
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

(function () {
    'use strict';

    // -----------------------------
    // Helpers
    // -----------------------------

    // Delegates to global escapeHtml() in utils.js
    function rrEscapeHtml(str) {
        return escapeHtml(str);
    }

    function _t(k) {
        return (typeof t === 'function') ? t(k) : k;
    }

    function _paren(str) {
        return (typeof localizeParenHtml === 'function') ? localizeParenHtml(str) : rrEscapeHtml(str);
    }

    // Delegates to global getRiskMeta() in utils.js
    function rrGetRiskMeta(rootRiskValue) {
        return getRiskMeta(rootRiskValue);
    }

    function rrEnsureModalWiring() {
        const modal = document.getElementById('residualRiskModal');
        if (!modal) return;
        if (modal.dataset.rrWired === '1') return;

        const btnCloseX = document.getElementById('closeResidualRiskModal');
        const btnCloseFooter = document.getElementById('btnCloseResidualRiskModalFooter');

        const close = () => {
            modal.style.display = 'none';
            delete modal.dataset.rrEditingUid;
            // Refresh overview (so that status/counts can become visible later)
            const analysis = (typeof getActiveAnalysis === 'function') ? getActiveAnalysis() : null;
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

        let html = `<label style="font-size:0.8em; color:#666;">${rrEscapeHtml(
            (typeof getLocalizedOptionText === 'function')
                ? (getLocalizedOptionText(crit || {}, 'label') || label)
                : label
        )}</label>`;
        html += `<select class="kstu-select rr-kstu" data-kstu="${key}">`;
        html += `<option value="">${_t('rr.pleaseSelect')}</option>`;
        opts.forEach(o => {
            const v = String(o.value ?? '');
            const sel = (String(selected ?? '') === v) ? 'selected' : '';
            const txt = (typeof getLocalizedOptionText === 'function')
                ? getLocalizedOptionText(o, 'text')
                : (o.text ?? v);
            html += `<option value="${rrEscapeHtml(v)}" ${sel}>${rrEscapeHtml(txt)}</option>`;
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

        // Fallback – uses global computeRiskScore()
        const r = computeRiskScore(iNorm, kstu).toFixed(2);
        return `<div class="node-stats-box"><div class="ns-row"><div>R=<b>${rrEscapeHtml(r)}</b></div><div>I(N)=<b>${rrEscapeHtml(iNorm || '-')}</b></div></div></div>`;
    }

    function rrComputeResidualLeafRiskValue(leaf) {
        // I(N) stays the same; for Mitigated, rr.K/S/T/U is used.
        const iNorm = leaf?.i_norm;
        const i = parseFloat(iNorm);
        if (isNaN(i)) return null;

        const rr = leaf?.rr || {};
        const k = parseFloat(rr.k);
        const s = parseFloat(rr.s);
        const t = parseFloat(rr.t);
        const u = parseFloat(rr.u);
        if ([k, s, t, u].some(v => Number.isNaN(v))) return null;

        return computeRiskScore(iNorm, rr).toFixed(2);
    }

    function rrRenderResidualLeafRiskValueHTML(leaf) {
        const val = rrComputeResidualLeafRiskValue(leaf);
        if (val === null) {
            return `${_t('rr.residualR')} <b>-</b>`;
        }
        const meta = rrGetRiskMeta(val);
        return `${_t('rr.residualR')} <b style="color:${meta.color}">${rrEscapeHtml(meta.display)}</b>`
            + ` <span style="margin-left:6px; padding:2px 6px; border-radius:3px; background:${meta.color}; color:#fff; font-size:0.8em;">${rrEscapeHtml(rrRiskLabel(meta))}</span>`;
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
            // Note is optional for mitigation
            return sec.length > 0 && k && s && t && u;
        }
        return false;
    }

    function rrTreeAllLeavesComplete(entry) {
        if (!entry) return false;
        let any = false;
        let ok = true;
        try {
            if (typeof rrIterateLeaves === 'function') {
                rrIterateLeaves(entry, ({ leaf }) => {
                    if (!leaf) return;
                    any = true;
                    if (!rrLeafComplete(leaf)) ok = false;
                });
            }
        } catch (_) {}
        return any && ok;
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

        // Security concept measure only editable for Mitigated
        const taSec = row.querySelector('.rr-security');
        if (taSec) {
            taSec.disabled = !isMit;
            taSec.classList.toggle('rr-disabled', !isMit);
        }

        const ph = row.querySelector('.rr-mitigate-placeholder');
        if (ph) {
            ph.classList.toggle('rr-hidden', isMit);
        }

        // Show residual risk value under reassessment
        const rv = row.querySelector('.rr-residual-leaf-value');
        if (rv) {
            rv.classList.toggle('rr-hidden', !isMit);
            if (isMit) {
                rv.innerHTML = rrRenderResidualLeafRiskValueHTML(leaf);
            }
        }
    }

    function rrLoc(obj, field) {
        if (!obj || !field) return '';
        if (typeof getLocalizedField === 'function') {
            return getLocalizedField(obj, field) || '';
        }
        return obj[field] != null ? String(obj[field]) : '';
    }

    function rrRootLabel(entry) {
        if (!entry) return '';
        const obj = {
            title: entry.rootName || entry.treeV2?.title || '',
            title_en: entry.rootName_en || entry.treeV2?.title_en || ''
        };
        return rrLoc(obj, 'title') || entry.rootName || entry.id || '';
    }

    function rrRiskLabel(meta) {
        const raw = meta?.label || '';
        return (typeof tRiskLabel === 'function') ? tRiskLabel(raw) : raw;
    }

    function rrBuildLeafLabel(meta) {
        const leaf = meta?.leaf;
        const leafText = leaf
            ? (rrLoc(leaf, 'text') || (leaf.name ? String(leaf.name) : (leaf.label ? String(leaf.label) : '')))
            : '';

        // treeV2 provides breadcrumb directly (full naming) – already localized in rrIterateLeaves
        if (meta?.breadcrumb) {
            return {
                path: String(meta.breadcrumb),
                text: leafText
            };
        }

        const bName = meta?.branch
            ? (rrLoc(meta.branch, 'title') || rrLoc(meta.branch, 'name') || (meta.branch.name ? String(meta.branch.name) : '') || (meta.branch.title ? String(meta.branch.title) : ''))
            : '';

        const nName = meta?.node
            ? (rrLoc(meta.node, 'title') || rrLoc(meta.node, 'name') || (meta.node.name ? String(meta.node.name) : '') || (meta.node.title ? String(meta.node.title) : ''))
            : '';

        // compact but unambiguous
        const parts = [];
        if (bName) parts.push(bName);
        if (nName && nName !== bName) parts.push(nName);
        const path = parts.length
            ? parts.join(' › ')
            : `Pfad B${meta.bNum}` + (meta.nNum ? `/N${meta.nNum}` : '');

        return { path, text: leafText };
    }

    function rrOpenModalForTree(residualEntry) {
        rrEnsureModalWiring();

        const analysis = (typeof getActiveAnalysis === 'function') ? getActiveAnalysis() : null;
        if (!analysis) return;

        // Ensure that the residual risk structure is up to date
        // Note: Sync may re-clone objects -> fetch entry again afterwards (uid-based)
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
        const namePlain = rrRootLabel(liveEntry) || _t('rr.emptyTitle');
        title.textContent = `${_t('rr.editTitle')} - ${id}: ${namePlain}`;

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
            body.innerHTML = `<div class="warning-box" style="margin:0;"><h4 style="margin:0 0 6px 0;">${_t('rr.noLeaves')}</h4><p style="margin:0; color:#555;">${_t('rr.noLeavesHint')}</p></div>`;
            modal.dataset.rrEditingUid = liveEntry?.uid || '';
            modal.style.display = 'block';
            return;
        }

        const tableHtml = `
            <div class="success-box" style="margin-bottom:12px;">
                <p style="margin:0;">${_t('rr.editHint')}</p>
            </div>
            <div style="overflow-x:auto; max-width:100%;">
                <table class="rr-leaf-table">
                    <thead>
                        <tr>
                            <th style="width:42px; text-align:center;">&nbsp;</th>
                            <th class="rr-col-path">${_t('rr.colLeaf')}</th>
                            <th class="rr-col-score">${_t('rr.colScore')}</th>
                            <th class="rr-col-treat">${_t('rr.colTreat')}</th>
                            <th class="rr-col-kstu">${_t('rr.colKstu')}</th>
                            <th class="rr-col-note">${_t('rr.colNote')}</th>
                            <th class="rr-col-sec">${_t('rr.colSec')}</th>
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
                                        <div style="font-weight:700;">${_paren(lbl.path)}</div>
                                        <div style="color:#555; font-size:0.9em; margin-top:3px; white-space:pre-wrap;">${_paren(lbl.text || _t('rr.noText'))}</div>
                                    </td>
                                    <td>${rrRenderOriginalSummary(leaf)}</td>
                                    <td>
                                        <select class="rr-treatment rr-field">
                                            <option value="">${_t('rr.pleaseSelect')}</option>
                                            <option value="Akzeptiert" ${treatment === 'Akzeptiert' ? 'selected' : ''}>${_t('rr.treat.accept')}</option>
                                            <option value="Delegiert" ${treatment === 'Delegiert' ? 'selected' : ''}>${_t('rr.treat.delegate')}</option>
                                            <option value="Mitigiert" ${treatment === 'Mitigiert' ? 'selected' : ''}>${_t('rr.treat.mitigate')}</option>
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
                                        <textarea class="rr-note rr-textarea" placeholder="${_t('rr.notePh')}">${note}</textarea>
                                    </td>
                                    <td>
                                        <textarea class="rr-security rr-textarea" placeholder="${_t('rr.secPh')}">${sec}</textarea>
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
                    // Keep legacy dict in sync (needed for migration of older data formats)
                    try {
                        if (analysis?.residualRisk?.leaves && liveEntry?.uid) {
                            const legacyK = (typeof rrLegacyKey === 'function')
                                ? rrLegacyKey(liveEntry.uid, leafKey)
                                : `${liveEntry.uid}|${leafKey}`;
                            analysis.residualRisk.leaves[legacyK] = JSON.parse(JSON.stringify(leaf.rr || {}));
                        }
                    } catch (e) {}
                    try {
                        if (typeof saveAnalyses === 'function') saveAnalyses();
                    } catch (e) {}
                };

                if (sel) {
                    sel.addEventListener('change', () => {
                        leaf.rr.treatment = sel.value || '';
                        // if not mitigated: not required, but hide grid
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

        modal.dataset.rrEditingUid = liveEntry?.uid || '';
        modal.style.display = 'block';
    }

    // -----------------------------
    // Root-Node-Overview (Residual Risk)
    // -----------------------------

    function rrRenderRootOverview(entries, analysis) {
        if (!entries || entries.length === 0) return '';

        const fmt = (val) => {
            if (val === null || val === undefined || val === '') return '0,0';
            return String(val).replace('.', ',');
        };

        const pStr = (kstu) => {
            if (!kstu) return '- / - / - / -';
            return `${fmt(kstu.k)} / ${fmt(kstu.s)} / ${fmt(kstu.t)} / ${fmt(kstu.u)}`;
        };

        // Compute residual metrics and sort descending
        const withMetrics = entries.map(entry => {
            const base = (analysis?.riskEntries || []).find(e => e?.uid === entry?.uid) || entry;
            let m = null;
            try {
                if (typeof computeResidualTreeMetrics === 'function' && analysis && entry?.uid) {
                    m = computeResidualTreeMetrics(analysis, entry.uid);
                }
            } catch (_) {}
            return { entry, base, m };
        });

        withMetrics.sort((a, b) => {
            const ra = parseFloat(a.m?.riskValue) || 0;
            const rb = parseFloat(b.m?.riskValue) || 0;
            return rb - ra;
        });

        let html = `<h4>${_t('rr.rootOverview')}</h4>`;
        html += '<div class="root-overview-grid">';

        withMetrics.forEach(({ entry, base, m }) => {
            const origKstu = base?.kstu || {};
            const origScore = computeRiskScore(base?.i_norm, origKstu);
            const origMeta = rrGetRiskMeta(base?.rootRiskValue);

            const resKstu = (m && m.kstu) ? m.kstu : {};
            const resScore = (m && m.riskValue !== undefined) ? parseFloat(m.riskValue) : 0;
            const resMeta = rrGetRiskMeta(m ? m.riskValue : null);

            const fillClass = (typeof getRiskBgClass === 'function')
                ? getRiskBgClass(resScore)
                : 'risk-bg-unknown';

            html += `
            <div class="root-overview-card ${fillClass}">
                <div class="root-overview-title">${_paren(rrRootLabel(base) || base?.id || '')}</div>
                <div class="root-overview-row">P(RR) = ${rrEscapeHtml(pStr(resKstu))}</div>
                <div class="root-overview-row">I[norm] = ${rrEscapeHtml(fmt(m ? m.i_norm : base?.i_norm))}</div>
                <div class="root-overview-row">R = <b style="color:${origMeta.color}">${rrEscapeHtml(fmt(origScore.toFixed(2)))}</b></div>
                <div class="root-overview-row root-overview-risk">RR = <b style="color:${resMeta.color}">${rrEscapeHtml(fmt(resScore.toFixed(2)))}</b>
                    <span class="root-overview-badge" style="background:${resMeta.color}; color:#fff;">${rrEscapeHtml(rrRiskLabel(resMeta))}</span>
                </div>
            </div>`;
        });

        html += '</div>';
        return html;
    }

    // -----------------------------
    // Overview cards
    // -----------------------------

    function rrRenderTreeCard(entry, analysis) {
        const id = rrEscapeHtml(entry?.id ?? 'R??');
        const name = _paren(rrRootLabel(entry) || _t('rr.emptyTitle'));
        const uid = rrEscapeHtml(entry?.uid ?? '');

        const base = (analysis?.riskEntries || []).find(e => e?.uid === entry?.uid) || entry;

        const origRisk = (base?.rootRiskValue ?? '-').toString();
        const origMeta = rrGetRiskMeta(origRisk);
        const iNorm = (base?.i_norm === '' || base?.i_norm === null || base?.i_norm === undefined) ? '-' : String(base.i_norm);

        const okstu = base?.kstu || {};
        const oK = (okstu.k === undefined || okstu.k === null || String(okstu.k).trim() === '') ? '-' : String(okstu.k);
        const oS = (okstu.s === undefined || okstu.s === null || String(okstu.s).trim() === '') ? '-' : String(okstu.s);
        const oT = (okstu.t === undefined || okstu.t === null || String(okstu.t).trim() === '') ? '-' : String(okstu.t);
        const oU = (okstu.u === undefined || okstu.u === null || String(okstu.u).trim() === '') ? '-' : String(okstu.u);

        let resVal = '-';
        let resK = '-';
        let resS = '-';
        let resT = '-';
        let resU = '-';

        try {
            if (typeof computeResidualTreeMetrics === 'function' && analysis && entry?.uid) {
                const m = computeResidualTreeMetrics(analysis, entry.uid);
                if (m && m.riskValue !== undefined) {
                    resVal = String(m.riskValue);
                    const rkstu = m.kstu || {};
                    resK = (rkstu.k === undefined || rkstu.k === null || String(rkstu.k).trim() === '') ? '-' : String(rkstu.k);
                    resS = (rkstu.s === undefined || rkstu.s === null || String(rkstu.s).trim() === '') ? '-' : String(rkstu.s);
                    resT = (rkstu.t === undefined || rkstu.t === null || String(rkstu.t).trim() === '') ? '-' : String(rkstu.t);
                    resU = (rkstu.u === undefined || rkstu.u === null || String(rkstu.u).trim() === '') ? '-' : String(rkstu.u);
                }
            }
        } catch (e) {
            console.warn('[rrRenderTreeCard] computeResidualTreeMetrics error for uid', entry?.uid, e);
        }

        const resMeta = rrGetRiskMeta(resVal);

        // Tree note (required for Critical/High in residual risk)
        const notesDict = analysis?.residualRisk?.treeNotes || {};
        const treeNote = (notesDict && entry?.uid && notesDict[entry.uid] !== undefined) ? String(notesDict[entry.uid] || '') : '';
        const noteRequired = (resMeta.label === 'Kritisch' || resMeta.label === 'Hoch');

        // Completion check: all leaves + required note if applicable
        const allLeavesOk = rrTreeAllLeavesComplete(entry);
        const noteOk = (!noteRequired) || (treeNote.trim().length > 0);
        const treeComplete = allLeavesOk && noteOk;

        // In the residual risk overview, the border color should reflect the residual risk
        const borderColor = resMeta.color;

        return `
            <div class="rr-risk-card" style="border-left: 5px solid ${borderColor};">
                <div class="rr-risk-header">
                    <div style="flex:1; min-width:260px;">
                        <div style="font-size:1.05em; font-weight:700;">
                            <span>${id}</span>: ${name}
                        </div>

                        <!-- Risiko-Score & Restrisiko hintereinander -->
                        <div style="margin-top:6px; color:#666; font-size:0.9em;">
                            <span>${_t('rr.scoreR')} <b style="color:${origMeta.color}">${rrEscapeHtml(origMeta.display)}</b></span>
                            <span style="margin-left:6px; padding:2px 6px; border-radius:3px; background:${origMeta.color}; color:#fff; font-size:0.8em;">${rrEscapeHtml(rrRiskLabel(origMeta))}</span>
                            <span style="margin:0 8px; color:#bbb;">|</span>
                            <span>${_t('rr.residualLabel')} <b style="color:${resMeta.color}">${rrEscapeHtml(resMeta.display)}</b></span>
                            <span style="margin-left:6px; padding:2px 6px; border-radius:3px; background:${resMeta.color}; color:#fff; font-size:0.8em;">${rrEscapeHtml(rrRiskLabel(resMeta))}</span>
                        </div>

                        <div style="margin-top:4px; color:#666; font-size:0.85em;">
                            I(N): <b>${rrEscapeHtml(iNorm)}</b>
                            <span style="margin-left:10px;">K:${rrEscapeHtml(oK)} S:${rrEscapeHtml(oS)} T:${rrEscapeHtml(oT)} U:${rrEscapeHtml(oU)}</span>
                        </div>

                        <div style="margin-top:4px; color:#666; font-size:0.85em;">
                            ${_t('rr.residualKstu')}: <span>K:${rrEscapeHtml(resK)} S:${rrEscapeHtml(resS)} T:${rrEscapeHtml(resT)} U:${rrEscapeHtml(resU)}</span>
                        </div>

                        <div style="margin-top:10px;">
                            <div style="font-size:0.85em; color:#666; font-weight:600; margin-bottom:4px;">
                                ${_t('rr.notesLabel')} ${noteRequired ? `<span style="color:#c0392b; font-weight:700;">${_t('rr.noteRequired')}</span>` : `<span style="color:#7f8c8d; font-weight:600;">${_t('rr.noteOptional')}</span>`}
                            </div>
                            <textarea
                                class="rr-tree-note rr-textarea ${noteRequired && !treeNote.trim() ? 'rr-text-invalid' : ''}"
                                data-rr-tree-uid="${uid}"
                                data-rr-note-required="${noteRequired ? '1' : '0'}"
                                data-rr-allleaves="${allLeavesOk ? '1' : '0'}"
                                placeholder="${_t('rr.treeNotePh')}"
                                style="min-height:56px;"
                            >${rrEscapeHtml(treeNote)}</textarea>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:10px; align-items:flex-end;">
                        <i class="fas fa-check-circle rr-tree-check ${treeComplete ? '' : 'incomplete'}" title="${treeComplete ? _t('rr.complete') : _t('rr.incomplete')}"></i>
                        <button class="action-button small rr-edit-btn" data-rr-edit="${uid}">
                            <i class="fas fa-edit"></i> ${_t('btn.edit')}
                        </button>
                    </div>
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
            container.innerHTML = `<p class="muted-hint">${_t('rr.noAnalysis')}</p>`;
            return;
        }

        try {
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(analysis);
        } catch (e) {
            console.warn('[renderResidualRisk] Sync error:', e);
        }

        const entries = (analysis.residualRisk && Array.isArray(analysis.residualRisk.entries))
            ? analysis.residualRisk.entries
            : [];

        if (!entries || entries.length === 0) {
            container.innerHTML = `<p class="muted-hint">${_t('rr.noTrees')}</p>`;
            return;
        }

        container.innerHTML = rrRenderRootOverview(entries, analysis) + entries.map(e => rrRenderTreeCard(e, analysis)).join('');

        container.querySelectorAll('.rr-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const uid = e.currentTarget?.dataset?.rrEdit;
                if (typeof window.editResidualRiskTree === 'function') {
                    window.editResidualRiskTree(uid);
                }
            });
        });

        // Persist tree notes + required logic + update check
        container.querySelectorAll('textarea.rr-tree-note').forEach(ta => {
            ta.addEventListener('input', () => {
                const uid = ta.dataset.rrTreeUid;
                if (!uid) return;
                if (!analysis.residualRisk) analysis.residualRisk = { leaves: {}, entries: [], treeNotes: {} };
                if (!analysis.residualRisk.treeNotes) analysis.residualRisk.treeNotes = {};
                analysis.residualRisk.treeNotes[uid] = ta.value;

                // Required marker
                const required = ta.dataset.rrNoteRequired === '1';
                const allLeavesOk = ta.dataset.rrAllleaves === '1';
                const noteOk = (!required) || (ta.value || '').trim().length > 0;
                ta.classList.toggle('rr-text-invalid', required && !noteOk);

                // Tree check
                const card = ta.closest('.rr-risk-card');
                const ico = card ? card.querySelector('.rr-tree-check') : null;
                if (ico) {
                    const complete = allLeavesOk && noteOk;
                    ico.classList.toggle('incomplete', !complete);
                }

                try {
                    if (typeof saveAnalyses === 'function') saveAnalyses();
                } catch (_) {}
            });
        });
    };

    window.editResidualRiskTree = function (riskUid) {
        const analysis = (typeof getActiveAnalysis === 'function') ? getActiveAnalysis() : null;
        if (!analysis) return;

        try {
            if (typeof ensureResidualRiskSynced === 'function') ensureResidualRiskSynced(analysis);
        } catch (_) {}

        const entry = (analysis.residualRisk?.entries || []).find(r => r?.uid === riskUid);

        if (!entry) {
            if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.treeNotFound') : 'Angriffsbaum nicht gefunden.'), 'error');
            return;
        }

        rrOpenModalForTree(entry);
    };

})();
