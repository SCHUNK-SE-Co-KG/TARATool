/**
 * @file        report_export.js
 * @description PDF report generation orchestrator
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

(function () {
    'use strict';

    // Shortcuts
    const H = () => window.ReportHelpers;
    const B = () => window.ReportPdfBuilder;

    // --------------------
    // Report Generation
    // --------------------

    async function generateReportPdf() {
        const h = H();
        const b = B();
        const ri = window.ReportI18n;
        const lang = (ri && ri.getReportLang) ? ri.getReportLang() : 'de';
        const L = (ri && ri.reportStrings) ? ri.reportStrings(lang) : {};
        const riskLabel = (deLabel) => (ri && ri.mapRiskLabel) ? ri.mapRiskLabel(deLabel, lang) : deLabel;
        const isHiCrit = (deLabel) => (ri && ri.isHighOrCritical) ? ri.isHighOrCritical(deLabel) : (deLabel === 'Hoch' || deLabel === 'Kritisch');

        const analysis = h.getActiveAnalysis();
        if (!analysis) {
            if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.noAnalysis', lang) : 'Keine aktive Analyse ausgewählt.'), 'warning');
            return;
        }

        const doc = b.createPdfDoc();
        if (!doc) {
            if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.pdfMissing', lang) : 'PDF-Erzeugung nicht verfügbar (jsPDF nicht geladen).'), 'error');
            return;
        }

        const pdf = b.pdfBuilder(doc);
        const now = new Date();
        const generatedAt = `${h.formatDate(now.toISOString().substring(0, 10))} ${now.toTimeString().substring(0, 5)}`;

        const assets = Array.isArray(analysis.assets) ? analysis.assets : [];
        const dsList = h.getDisplayDamageScenarios(analysis);
        const risks = Array.isArray(analysis.riskEntries) ? analysis.riskEntries : [];

        // =============================================================
        // Chapter 1: Project Description
        // =============================================================
        pdf.addTitle(L.title);
        pdf.addText(L.projectDesc, 12, 6);
        pdf.hLine();
        pdf.addSpacer(2.5);

        pdf.addH1(L.projectDesc);
        pdf.addKeyValue(L.analysisName, analysis.name || '-');
        pdf.addKeyValue(L.author, (analysis.metadata && analysis.metadata.author) || analysis.author || '-');
        pdf.addKeyValue(L.version, (analysis.metadata && analysis.metadata.version) || '-');
        pdf.addKeyValue(L.date, h.formatDate((analysis.metadata && analysis.metadata.date) || ''));
        pdf.addKeyValue(L.systemDesc, analysis.description || '-');
        pdf.addKeyValue(L.intendedUse, analysis.intendedUse || '-');
        pdf.addKeyValue(L.reportCreated, generatedAt);

        // =============================================================
        // Chapter 2: Management Summary (eigene Seite)
        // =============================================================
        doc.addPage();
        pdf.setY(pdf.margin);

        // Risk distribution
        const dist = { Kritisch: 0, Hoch: 0, Mittel: 0, Niedrig: 0, Unbekannt: 0 };
        const riskSorted = [...risks].map(r => {
            const v = parseFloat(r.rootRiskValue);
            const cls = h.riskClassFromValue(v);
            dist[cls.label] = (dist[cls.label] || 0) + 1;
            return { ...r, _riskValueNum: isNaN(v) ? -1 : v, _riskLabel: cls.label };
        }).sort((a, b) => b._riskValueNum - a._riskValueNum);

        // Residual risk distribution (same logic as renderOverview in analysis_core.js)
        const rrDist = { Kritisch: 0, Hoch: 0, Mittel: 0, Niedrig: 0, Unbekannt: 0 };
        let hasResidualData = false;

        try {
            if (typeof ensureResidualRiskSynced === 'function') {
                ensureResidualRiskSynced(analysis);
            }
        } catch (e) { /* ignore */ }

        const riskWithResidual = risks.map(r => {
            let rrVal = NaN;
            if (r?.uid) {
                try {
                    if (typeof computeResidualTreeMetrics === 'function') {
                        const m = computeResidualTreeMetrics(analysis, r.uid);
                        if (m && m.riskValue !== undefined) {
                            rrVal = parseFloat(m.riskValue);
                            hasResidualData = true;
                        }
                    }
                } catch (e) { /* ignore */ }
            }
            if (isNaN(rrVal)) {
                rrVal = parseFloat(r.rootRiskValue);
            }
            const rrCls = h.riskClassFromValue(rrVal);
            if (!isNaN(rrVal)) {
                rrDist[rrCls.label] = (rrDist[rrCls.label] || 0) + 1;
            }
            return { ...r, _rrValueNum: isNaN(rrVal) ? -1 : rrVal, _rrLabel: rrCls.label };
        });

        const riskWithResidualSorted = [...riskWithResidual].sort((a, b) => b._rrValueNum - a._rrValueNum);

        pdf.addH1(L.mgmtSummary);
        pdf.addText(L.mgmtIntro);

        pdf.addSpacer(1.8);

        const summaryRows = [
            [L.assets, String(assets.length)],
            [L.dsTotal, String(dsList.length)],
            [L.risksTrees, String(risks.length)],
            [L.riskDist, L.distLine(dist)]
        ];
        if (hasResidualData) {
            summaryRows.push([
                L.riskDistRr,
                L.distLine(rrDist)
            ]);
        }

        pdf.addTable(
            [L.metric, L.value],
            summaryRows,
            [55, (pdf.pageW - pdf.margin * 2) - 55]
        );

        // Top risks table
        pdf.addH2(L.topRisks);
        const topOnlyHighCritical = riskSorted.filter(r => isHiCrit(r._riskLabel));
        if (topOnlyHighCritical.length === 0) {
            pdf.addText(L.noTopRisks);
        } else {
            const topN = topOnlyHighCritical.slice(0, 5);
            pdf.addTable(
                [L.colId, L.colDesc, L.colR, L.colClass],
                topN.map(r => [r.id || '-', r.rootName || '-', (r.rootRiskValue ?? '-').toString(), riskLabel(r._riskLabel || 'Unbekannt')]),
                [16, 100, 22, 30]
            );
        }

        // Top residual risks table (after risk treatment)
        if (hasResidualData) {
            pdf.addH2(L.topResidual);
            const topRRHighCritical = riskWithResidualSorted.filter(r => isHiCrit(r._rrLabel));
            if (topRRHighCritical.length === 0) {
                pdf.addText(L.noTopResidual);
            } else {
                const topRRN = topRRHighCritical.slice(0, 5);
                pdf.addTable(
                    [L.colId, L.colDesc, L.colRr, L.colClass],
                    topRRN.map(r => [r.id || '-', r.rootName || '-', r._rrValueNum >= 0 ? r._rrValueNum.toFixed(2) : '-', riskLabel(r._rrLabel || 'Unbekannt')]),
                    [16, 100, 22, 30]
                );
            }
        }

        // =============================================================
        // Chapter 3: Assets
        // =============================================================
        pdf.ensureSpace(12);
        doc.addPage();
        pdf.setY(pdf.margin);

        pdf.addTitle(L.title);
        pdf.addText(`${L.analysisPrefix}: ${analysis.name || analysis.id}`, 12, 6);
        pdf.hLine();

        pdf.addH1(L.assets);
        if (assets.length === 0) {
            pdf.addText(L.noAssets);
        } else {
            pdf.addTable(
                [L.colId, L.colName, L.colType, 'C', 'I', 'A', L.colSchutz],
                assets.map(a => [
                    a.id || '-',
                    (typeof getLocalizedField === 'function' ? getLocalizedField(a, 'name', lang, { fallback: true }) : (a.name || '-')) || '-',
                    a.type || '-',
                    a.confidentiality || '-',
                    a.integrity || '-',
                    a.authenticity || '-',
                    a.schutzbedarf || '-'
                ]),
                [14, 58, 35, 8, 8, 8, (pdf.pageW - pdf.margin * 2) - (14 + 58 + 35 + 8 + 8 + 8)]
            );
        }

        // =============================================================
        // Chapter 4: Damage Scenarios
        // =============================================================
        pdf.addH1(L.damageScenarios);
        if (dsList.length === 0) {
            pdf.addText(L.noDs);
        } else {
            pdf.addTable(
                [L.colId, L.colShort, L.colName, L.colDesc],
                dsList.map(ds => [
                    ds.id,
                    (typeof getLocalizedField === 'function' ? getLocalizedField(ds, 'short', lang, { fallback: true }) : (ds.short || '-')) || '-',
                    (typeof getLocalizedField === 'function' ? getLocalizedField(ds, 'name', lang, { fallback: true }) : (ds.name || '-')) || '-',
                    (typeof getLocalizedField === 'function' ? getLocalizedField(ds, 'description', lang, { fallback: true }) : (ds.description || '-')) || '-'
                ]),
                [14, 18, 55, (pdf.pageW - pdf.margin * 2) - (14 + 18 + 55)]
            );
        }

        // =============================================================
        // Chapter 5: Impact Matrix
        // =============================================================
        doc.addPage();
        pdf.setY(pdf.margin);
        pdf.addH1(L.impactMatrix);
        const impact = analysis.impactMatrix || {};
        if (assets.length === 0 || dsList.length === 0) {
            pdf.addText(L.impactMissing);
        } else {
            pdf.addText(L.impactHint, 9, 4.2);
            pdf.addImpactMatrixTable(assets, dsList, impact);
        }

        // =============================================================
        // Chapter 6: Risk Analysis & Attack Trees
        // =============================================================
        doc.addPage();
        pdf.setY(pdf.margin);
        pdf.addH1(L.riskAndTrees);
        if (risks.length === 0) {
            pdf.addText(L.noTrees);
        } else {
            // Root-Node-Overview table (sorted by risk, critical first)
            const overviewSorted = [...risks].sort((a, b) => {
                return (parseFloat(b.rootRiskValue) || 0) - (parseFloat(a.rootRiskValue) || 0);
            });
            const overviewRows = overviewSorted.map(entry => {
                const kstu = entry.kstu || {};
                const rScore = computeRiskScore(entry.i_norm, kstu);
                const cls = h.riskClassFromValue(entry.rootRiskValue);
                return [
                    h.sanitizePdfText(entry.rootName || entry.id || ''),
                    h.pVec(kstu.k, kstu.s, kstu.t, kstu.u),
                    h.fmtNumComma(entry.i_norm, 2),
                    h.fmtNumComma(rScore, 2),
                    riskLabel(cls.label),
                    h.sanitizePdfText((entry.notes || '').trim() || '-', true)
                ];
            });
            pdf.addH2(L.rootOverview);
            pdf.addTableGrid(
                [L.colRoot, L.colP, L.colInorm, L.colR, L.colRiskClass, L.colComment],
                overviewRows,
                [40, 35, 16, 14, 24, 39],
                { zebra: true, noWrapCols: [1, 2, 3, 4], headerFill: [250, 250, 250], headerTextColor: [20, 20, 20], zebraFill: [252, 252, 252], borderColor: [190, 190, 190], headerFontSize: 10, cellFontSize: 9 }
            );
            pdf.addSpacer(4);

            const sorted = [...risks].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
            sorted.forEach(entry => {
                const cls = h.riskClassFromValue(entry.rootRiskValue);
                pdf.addH2(`${entry.id || ''}: ${entry.rootName || ''}`);
                pdf.addKeyValue(L.riskScore, entry.rootRiskValue ?? '-');
                pdf.addKeyValue(L.colRiskClass, riskLabel(cls.label));
                if ((entry.notes || '').trim()) {
                    pdf.addKeyValue(L.notes, h.sanitizePdfText(entry.notes, true));
                }
                pdf.addSpacer(1);
                pdf.addText(L.seeTreeViz, 9, 4.2);
                pdf.hLine();
            });
        }

        // =============================================================
        // Attack Tree Visualization (A3 Landscape)
        // =============================================================
        if (risks.length > 0) {
            const sortedTrees = [...risks].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

            for (let ti = 0; ti < sortedTrees.length; ti++) {
                const entry = sortedTrees[ti];
                let svgText = null;

                try {
                    const dotContent = (typeof window.exportRiskAnalysisToDot === 'function')
                        ? window.exportRiskAnalysisToDot(analysis, entry.id)
                        : null;

                    if (dotContent) {
                        if (typeof showToast === 'function') showToast(L.toastTree + ' ' + (entry.id || ''), 'info');
                        svgText = await h.renderDotToSvg(dotContent);
                    }
                } catch (_) {
                    svgText = null;
                }

                // A3 landscape page per tree
                try {
                    doc.addPage('a3', 'landscape');
                } catch (_) {
                    doc.addPage([420, 297], 'landscape');
                }

                const pageW = doc.internal.pageSize.getWidth();
                const pageH = doc.internal.pageSize.getHeight();
                const treeMargin = pdf.margin;

                // Title
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(0);
                doc.text(L.attackTree + ' ' + (entry.id || '') + ': ' + (entry.rootName || ''), treeMargin, treeMargin);
                doc.setFont('helvetica', 'normal');

                // Watermark
                try {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(60);
                    doc.setTextColor(245);
                    doc.text(L.attackTreeWm, pageW / 2, pageH / 2, { align: 'center', angle: 35 });
                } catch (_) { /* noop */ }
                doc.setTextColor(0);
                doc.setFont('helvetica', 'normal');

                const topY = treeMargin + 10;
                const availW = pageW - treeMargin * 2;
                const availH = pageH - topY - treeMargin;

                if (svgText && svgText.includes('<svg')) {
                    let png = null;
                    // Target ~300 DPI relative to the printed width so large trees stay sharp.
                    const targetPxW = Math.round((availW / 25.4) * 300);
                    try { png = await h.svgTextToPng(svgText, targetPxW); } catch (e) { png = null; }
                    if (png && png.dataUrl) {
                        const imgRatio = (png.widthPx || 1) / (png.heightPx || 1);
                        let drawW = availW;
                        let drawH = drawW / imgRatio;
                        if (drawH > availH) {
                            drawH = availH;
                            drawW = drawH * imgRatio;
                        }
                        const x = treeMargin + (availW - drawW) / 2;
                        const y = topY + (availH - drawH) / 2;
                        try {
                            doc.addImage(png.dataUrl, png.format || 'JPEG', x, y, drawW, drawH);
                        } catch (_) {
                            doc.setFontSize(11);
                            doc.text(L.vizEmbedFail, treeMargin, topY);
                        }
                    } else {
                        doc.setFontSize(11);
                        doc.text(L.vizSvgFail, treeMargin, topY);
                    }
                } else {
                    doc.setFontSize(11);
                    doc.text(L.vizGraphvizFail, treeMargin, topY);
                }
            }

            // Reset builder state
            doc.setTextColor(0);
            doc.setFont('helvetica', 'normal');
            pdf.setY(pdf.margin);
        }

        // =============================================================
        // Chapter 7: Security Objectives
        // =============================================================
        try {
            doc.addPage('a4', 'portrait');
        } catch (_) {
            doc.addPage();
        }
        pdf.setY(pdf.margin);
        pdf.addH1(L.secObjectives);

        const secGoals = Array.isArray(analysis.securityGoals) ? analysis.securityGoals : [];
        if (secGoals.length === 0) {
            pdf.addText(L.noSecObj);
        } else {
            const sortedSG = [...secGoals].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
            
            pdf.addTable(
                [L.colId, L.colName, L.colDesc, L.colRefRisks],
                sortedSG.map(sg => {
                    const refs = Array.isArray(sg.rootRefs) ? sg.rootRefs.join(', ') : '-';
                    return [
                        sg.id || '-',
                        sg.name || '-',
                        sg.description || '-',
                        refs
                    ];
                }),
                [15, 40, 85, 40]
            );
        }

        // =============================================================
        // Chapter 8: Residual Risk Analysis
        // =============================================================
        try {
            if (typeof ensureResidualRiskSynced === 'function') {
                ensureResidualRiskSynced(analysis);
            } else if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
                syncResidualRiskFromRiskAnalysis(analysis, false);
            }
        } catch (_) { /* noop */ }

        try {
            doc.addPage('a4', 'landscape');
        } catch (_) {
            doc.addPage();
        }
        pdf.setY(pdf.margin);
        pdf.addH1(L.residualRisk);

        // Residual Risk Root-Node-Overview table
        const rrEntries = (analysis.residualRisk && Array.isArray(analysis.residualRisk.entries)) ? analysis.residualRisk.entries : [];
        if (rrEntries.length > 0 && typeof computeResidualTreeMetrics === 'function') {
            const rrOverviewRows = [];
            const rrOverviewSorted = [...rrEntries].sort((a, b) => {
                const mA = computeResidualTreeMetrics(analysis, a?.uid);
                const mB = computeResidualTreeMetrics(analysis, b?.uid);
                return (parseFloat(mB?.riskValue) || 0) - (parseFloat(mA?.riskValue) || 0);
            });
            rrOverviewSorted.forEach(rrEntry => {
                if (!rrEntry) return;
                const base = (analysis.riskEntries || []).find(e => String(e.uid) === String(rrEntry.uid)) || rrEntry;
                const origMeta = h.riskClassFromValue(base.rootRiskValue);
                const origR = h.fmtNumComma(base.rootRiskValue, 2);
                const m = computeResidualTreeMetrics(analysis, rrEntry.uid);
                const resR = (m && m.riskValue !== undefined) ? h.fmtNumComma(m.riskValue, 2) : '-';
                const resKstu = (m && m.kstu) ? m.kstu : {};
                const resMeta = h.riskClassFromValue(m ? m.riskValue : null);
                rrOverviewRows.push([
                    h.sanitizePdfText(base.rootName || base.id || ''),
                    h.pVec(resKstu.k, resKstu.s, resKstu.t, resKstu.u),
                    h.fmtNumComma(m ? m.i_norm : base.i_norm, 2),
                    origR,
                    resR,
                    riskLabel(resMeta.label)
                ]);
            });
            if (rrOverviewRows.length > 0) {
                pdf.addH2(L.rootOverviewRr);
                pdf.addTableGrid(
                    [L.colRoot, L.colPrr, L.colInorm, L.colR, L.colRR, L.colRiskClass],
                    rrOverviewRows,
                    [52, 38, 18, 16, 16, 28],
                    { zebra: true, noWrapCols: [1, 2, 3, 4, 5], headerFill: [250, 250, 250], headerTextColor: [20, 20, 20], zebraFill: [252, 252, 252], borderColor: [190, 190, 190], headerFontSize: 10, cellFontSize: 9 }
                );
                pdf.addSpacer(4);
            }
        }

        pdf.addH2(L.residualEval);

        if (!rrEntries || rrEntries.length === 0 || typeof rrIterateLeaves !== 'function') {
            pdf.addText(L.noResidualData);
        } else {
            const rows = [];

            rrEntries.forEach((rrEntry) => {
                if (!rrEntry) return;
                const treeId = (rrEntry.id || rrEntry.uid || '').toString();
                const origEntry = (analysis.riskEntries || []).find(e => String(e.id) === String(rrEntry.id));
                const rootName = h.sanitizePdfText((rrEntry.rootName || origEntry?.rootName || rrEntry.name || rrEntry.root || '').toString());

                // Map leafKey -> original leaf
                const origLeafMap = {};
                try {
                    if (origEntry && typeof rrIterateLeaves === 'function') {
                        rrIterateLeaves(origEntry, (m0) => {
                            if (m0?.leafKey && m0?.leaf) origLeafMap[String(m0.leafKey)] = m0.leaf;
                        });
                    }
                } catch (_) { /* noop */ }

                rrIterateLeaves(rrEntry, (meta) => {
                    const leaf = meta?.leaf;
                    if (!leaf) return;

                    const leafKey = (meta?.leafKey !== undefined && meta?.leafKey !== null) ? String(meta.leafKey) : '';
                    const oLeaf = (leafKey && origLeafMap[leafKey]) ? origLeafMap[leafKey] : leaf;

                    const rr = leaf.rr || {};
                    const treatment = (rr.treatment || '').trim() || '-';
                    const sec = (rr.securityConcept || '').trim() || '';
                    const note = (rr.note || '').trim() || '';

                    const path = (meta.breadcrumb || meta?.branch?.name || '').toString();
                    const leafText = (oLeaf.text || oLeaf.name || oLeaf.label || '').toString();
                    const impactName = (path ? (path + ' \u00BB ') : '') + (leafText || '(ohne Text)');

                    const iNorm = (oLeaf.i_norm !== undefined && oLeaf.i_norm !== null && String(oLeaf.i_norm).trim() !== '')
                        ? oLeaf.i_norm
                        : ((origEntry && origEntry.i_norm !== undefined && origEntry.i_norm !== null && String(origEntry.i_norm).trim() !== '')
                            ? origEntry.i_norm
                            : ((rrEntry.i_norm !== undefined && rrEntry.i_norm !== null && String(rrEntry.i_norm).trim() !== '')
                                ? rrEntry.i_norm
                                : (leaf.i_norm !== undefined ? leaf.i_norm : '')));

                    // Original
                    const oRnum = h.riskNum(iNorm, oLeaf.k, oLeaf.s, oLeaf.t, oLeaf.u);
                    const oR = isNaN(oRnum) ? '-' : h.fmtNumComma(oRnum, 2);

                    // Residual: for "Mitigiert" -> rr.K/S/T/U if set
                    const pick = (orig, rrVal) => {
                        const rrs = (rrVal === null || rrVal === undefined) ? '' : String(rrVal).trim();
                        if (treatment === 'Mitigiert' && rrs) return rrs;
                        return (orig === null || orig === undefined) ? '' : String(orig);
                    };

                    const rk = pick(oLeaf.k, rr.k);
                    const rs = pick(oLeaf.s, rr.s);
                    const rt = pick(oLeaf.t, rr.t);
                    const ru = pick(oLeaf.u, rr.u);

                    const rrNum = h.riskNum(iNorm, rk, rs, rt, ru);
                    const rrVal = isNaN(rrNum) ? '-' : h.fmtNumComma(rrNum, 2);
                    const rrClass = isNaN(rrNum) ? riskLabel('Unbekannt') : riskLabel(h.riskClassFromValue(rrNum).label);

                    const prrVec = (treatment === 'Mitigiert') ? h.pVec(rk, rs, rt, ru) : '-';

                    const treeRefId = h.sanitizePdfText(treeId);
                    const impactText = h.sanitizePdfText(String(impactName || ''));

                    // RR: for Accepted/Delegated/empty, RR should equal R
                    const rrTxt = (treatment === 'Mitigiert') ? String(rrVal || '-') : String(oR || '-');

                    rows.push([
                        treeRefId,
                        rootName,
                        impactText,
                        (ri && ri.mapTreatment) ? ri.mapTreatment(treatment, lang) : treatment,
                        oR,
                        rrTxt,
                        sec,
                        note
                    ]);
                });
            });

            if (rows.length === 0) {
                pdf.addText(L.noResidualImpacts);
            } else {
                pdf.addTableGrid(
                    ['', L.colTreeName, L.colImpact, L.colTreatment, L.colR, L.colRR, L.colMeasure, L.colRemark],
                    rows,
                    [14, 22, 35, 20, 11, 11, 77, 77],
                    { zebra: true, noWrapCols: [0, 3, 4, 5], headerFill: [250, 250, 250], headerTextColor: [20, 20, 20], zebraFill: [252, 252, 252], borderColor: [190, 190, 190], headerFontSize: 10, cellFontSize: 9 }
                );
            }
        }

        // =============================================================
        // Residual Risk Tree Visualization (Landscape)
        // =============================================================
        if (risks.length > 0) {
            const sortedTrees = [...risks].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));

            for (let ti = 0; ti < sortedTrees.length; ti++) {
                const entry = sortedTrees[ti];
                let rrSvgText = null;

                try {
                    const rrDot = (typeof window.exportResidualRiskToDot === 'function')
                        ? window.exportResidualRiskToDot(analysis, entry.id)
                        : null;

                    if (rrDot) {
                        if (typeof showToast === 'function') showToast(L.toastRrTree + ' ' + (entry.id || ''), 'info');
                        rrSvgText = await h.renderDotToSvg(rrDot);
                    }
                } catch (_) {
                    rrSvgText = null;
                }

                // A3 landscape page per tree
                try {
                    doc.addPage('a3', 'landscape');
                } catch (_) {
                    doc.addPage([420, 297], 'landscape');
                }

                const rrPageW = doc.internal.pageSize.getWidth();
                const rrPageH = doc.internal.pageSize.getHeight();
                const rrMargin = pdf.margin;

                // Title
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(0);
                doc.text(L.residualTree + ' ' + (entry.id || '') + ': ' + (entry.rootName || ''), rrMargin, rrMargin);
                doc.setFont('helvetica', 'normal');

                // Watermark
                try {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(56);
                    doc.setTextColor(245);
                    doc.text(L.residualWm, rrPageW / 2, rrPageH / 2, { align: 'center', angle: 35 });
                } catch (_) { /* noop */ }
                doc.setTextColor(0);
                doc.setFont('helvetica', 'normal');

                const rrTopY = rrMargin + 10;
                const rrAvailW = rrPageW - rrMargin * 2;
                const rrAvailH = rrPageH - rrTopY - rrMargin;

                if (rrSvgText && rrSvgText.includes('<svg')) {
                    let png = null;
                    // Target ~300 DPI relative to the printed width so large trees stay sharp.
                    const targetPxW = Math.round((rrAvailW / 25.4) * 300);
                    try { png = await h.svgTextToPng(rrSvgText, targetPxW); } catch (e) { png = null; }
                    if (png && png.dataUrl) {
                        const imgRatio = (png.widthPx || 1) / (png.heightPx || 1);
                        let drawW = rrAvailW;
                        let drawH = drawW / imgRatio;
                        if (drawH > rrAvailH) {
                            drawH = rrAvailH;
                            drawW = drawH * imgRatio;
                        }
                        const x = rrMargin + (rrAvailW - drawW) / 2;
                        const y = rrTopY + (rrAvailH - drawH) / 2;
                        try {
                            doc.addImage(png.dataUrl, png.format || 'JPEG', x, y, drawW, drawH);
                        } catch (_) {
                            doc.setFontSize(11);
                            doc.text(L.rrVizEmbedFail, rrMargin, rrTopY);
                        }
                    } else {
                        doc.setFontSize(11);
                        doc.text(L.rrVizSvgFail, rrMargin, rrTopY);
                    }
                } else {
                    doc.setFontSize(11);
                    doc.text(L.rrVizGraphvizFail, rrMargin, rrTopY);
                }
            }

            // Reset builder state
            doc.setTextColor(0);
            doc.setFont('helvetica', 'normal');
            pdf.setY(pdf.margin);
        }

        // =============================================================
        // Signature Page (Approval)
        // =============================================================
        try {
            doc.addPage('a4', 'portrait');
        } catch (_) {
            doc.addPage();
        }
        pdf.setY(pdf.margin);
        pdf.addTitle(L.approval);
        pdf.addH2(L.signatures);
        pdf.addSpacer(8);

        const drawSignatureRow = (roleLabel) => {
            pdf.ensureSpace(18);
            const y0 = pdf.getY();
            const leftX = pdf.margin;
            const signX1 = leftX + 40;
            const signX2 = pdf.pageW - pdf.margin - 55;
            const dateLabelX = signX2 + 6;
            const dateX1 = dateLabelX + 16;
            const dateX2 = pdf.pageW - pdf.margin;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.text(String(roleLabel || ''), leftX, y0);

            // Signature line
            doc.setDrawColor(0);
            doc.line(signX1, y0 + 1.5, signX2, y0 + 1.5);

            // Date
            doc.setFontSize(10);
            doc.text(L.date, dateLabelX, y0);
            doc.line(dateX1, y0 + 1.5, dateX2, y0 + 1.5);

            pdf.setY(y0 + 16);
        };

        drawSignatureRow(L.roleAuthor);
        drawSignatureRow(L.roleReviewer);
        drawSignatureRow(L.roleApprover);

        // =============================================================
        // Page Numbers (Page X of Y)
        // =============================================================
        try {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const w = doc.internal.pageSize.getWidth();
                const hh = doc.internal.pageSize.getHeight();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(120);
                doc.text(L.pageOf(i, pageCount), w - pdf.margin, hh - 8, { align: 'right' });
                doc.setTextColor(0);
            }
        } catch (_) { /* noop */ }

        // =============================================================
        // Save PDF
        // =============================================================
        const langSuffix = lang === 'en' ? 'en' : 'de';
        const fname = h.sanitizeFilename(
            `${L.fileBase}_${analysis.name || analysis.id}_${now.toISOString().substring(0, 10)}_${langSuffix}`
        ) + '.pdf';
        doc.save(fname);
        if (typeof showToast === 'function') showToast((typeof t === 'function' ? t('toast.reportOk', lang) : 'PDF Report erstellt.'), 'success');
    }

    // Expose
    window.generateReportPdf = generateReportPdf;
})();
