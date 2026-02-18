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

        const analysis = h.getActiveAnalysis();
        if (!analysis) {
            if (typeof showToast === 'function') showToast('Keine aktive Analyse ausgewählt.', 'warning');
            return;
        }

        const doc = b.createPdfDoc();
        if (!doc) {
            if (typeof showToast === 'function') showToast('PDF-Erzeugung nicht verfügbar (jsPDF nicht geladen).', 'error');
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
        pdf.addTitle('Bedrohungs- und Risikoanalyse');
        pdf.addText('Projektbeschreibung', 12, 6);
        pdf.hLine();
        pdf.addSpacer(2.5);

        pdf.addH1('Projektbeschreibung');
        pdf.addKeyValue('Analysename', analysis.name || '-');
        pdf.addKeyValue('Autor / Verantwortlich', (analysis.metadata && analysis.metadata.author) || analysis.author || '-');
        pdf.addKeyValue('Version', (analysis.metadata && analysis.metadata.version) || '-');
        pdf.addKeyValue('Datum', h.formatDate((analysis.metadata && analysis.metadata.date) || ''));
        pdf.addKeyValue('Systembeschreibung', analysis.description || '-');
        pdf.addKeyValue('Verwendungszweck', analysis.intendedUse || '-');
        pdf.addKeyValue('Report erstellt', generatedAt);

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

        pdf.addH1('Management-Zusammenfassung');
        pdf.addText(
            `Diese Zusammenfassung bietet einen Management-Überblick über die aktuelle Risikoanalyse. ` +
            `Detaillierte Informationen (Assets, Schadensszenarien, Impact-Matrix und Angriffsbäume) folgen in den nachfolgenden Kapiteln.`
        );

        pdf.addSpacer(1.8);

        pdf.addTable(
            ['Kennzahl', 'Wert'],
            [
                ['Assets', String(assets.length)],
                ['Schadensszenarien (gesamt)', String(dsList.length)],
                ['Risiken / Angriffsbäume', String(risks.length)],
                ['Risikoverteilung', `Kritisch: ${dist.Kritisch} | Hoch: ${dist.Hoch} | Mittel: ${dist.Mittel} | Niedrig: ${dist.Niedrig} | Unbekannt: ${dist.Unbekannt}`]
            ],
            [55, (pdf.pageW - pdf.margin * 2) - 55]
        );

        // Top risks table
        pdf.addH2('Top Risiken');
        const topOnlyHighCritical = riskSorted.filter(r => r._riskLabel === 'Hoch' || r._riskLabel === 'Kritisch');
        if (topOnlyHighCritical.length === 0) {
            pdf.addText('Keine Top-Risiken in den Klassen Hoch oder Kritisch vorhanden.');
        } else {
            const topN = topOnlyHighCritical.slice(0, 5);
            pdf.addTable(
                ['ID', 'Beschreibung', 'R', 'Klasse'],
                topN.map(r => [r.id || '-', r.rootName || '-', (r.rootRiskValue ?? '-').toString(), r._riskLabel || 'Unbekannt']),
                [14, 110, 14, (pdf.pageW - pdf.margin * 2) - 14 - 110 - 14]
            );
        }

        // =============================================================
        // Chapter 3: Assets
        // =============================================================
        pdf.ensureSpace(12);
        doc.addPage();
        pdf.setY(pdf.margin);

        pdf.addTitle('Bedrohungs- und Risikoanalyse');
        pdf.addText(`Analyse: ${analysis.name || analysis.id}`, 12, 6);
        pdf.hLine();

        pdf.addH1('Assets');
        if (assets.length === 0) {
            pdf.addText('Keine Assets erfasst.');
        } else {
            pdf.addTable(
                ['ID', 'Name', 'Typ', 'C', 'I', 'A', 'Schutzbedarf'],
                assets.map(a => [
                    a.id || '-',
                    a.name || '-',
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
        pdf.addH1('Schadensszenarien');
        if (dsList.length === 0) {
            pdf.addText('Keine Schadensszenarien definiert.');
        } else {
            pdf.addTable(
                ['ID', 'Kurz', 'Name', 'Beschreibung'],
                dsList.map(ds => [ds.id, ds.short || '-', ds.name || '-', ds.description || '-']),
                [14, 18, 55, (pdf.pageW - pdf.margin * 2) - (14 + 18 + 55)]
            );
        }

        // =============================================================
        // Chapter 5: Impact Matrix
        // =============================================================
        doc.addPage();
        pdf.setY(pdf.margin);
        pdf.addH1('Schadensauswirkungsmatrix');
        const impact = analysis.impactMatrix || {};
        if (assets.length === 0 || dsList.length === 0) {
            pdf.addText('Impact-Matrix kann nicht dargestellt werden (Assets oder Szenarien fehlen).');
        } else {
            pdf.addText('Tabelle: Assets (Y-Achse) vs. Schadensszenarien (X-Achse) mit farbiger Bewertung (High/Medium/Low/N/A).', 9, 4.2);
            pdf.addImpactMatrixTable(assets, dsList, impact);
        }

        // =============================================================
        // Chapter 6: Risk Analysis & Attack Trees
        // =============================================================
        doc.addPage();
        pdf.setY(pdf.margin);
        pdf.addH1('Risikoanalyse & Angriffsbäume');
        if (risks.length === 0) {
            pdf.addText('Keine Angriffsbäume vorhanden.');
        } else {
            const sorted = [...risks].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
            sorted.forEach(entry => {
                const cls = h.riskClassFromValue(entry.rootRiskValue);
                pdf.addH2(`${entry.id || ''}: ${entry.rootName || ''}`);
                pdf.addKeyValue('Risk Score (R)', entry.rootRiskValue ?? '-');
                pdf.addKeyValue('Risikoklasse', cls.label);
                pdf.addSpacer(1);
                pdf.addText('siehe Visualisierung Angriffsbäume', 9, 4.2);
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
                        if (typeof showToast === 'function') showToast('Erzeuge Angriffsbaum (SVG)\u2026 ' + (entry.id || ''), 'info');
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
                doc.text('Angriffsbaum ' + (entry.id || '') + ': ' + (entry.rootName || ''), treeMargin, treeMargin);
                doc.setFont('helvetica', 'normal');

                // Watermark
                try {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(60);
                    doc.setTextColor(245);
                    doc.text('Angriffsbaum', pageW / 2, pageH / 2, { align: 'center', angle: 35 });
                } catch (_) { /* noop */ }
                doc.setTextColor(0);
                doc.setFont('helvetica', 'normal');

                const topY = treeMargin + 10;
                const availW = pageW - treeMargin * 2;
                const availH = pageH - topY - treeMargin;

                if (svgText && svgText.includes('<svg')) {
                    let png = null;
                    try { png = await h.svgTextToPng(svgText, 3800); } catch (e) { png = null; }
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
                            doc.addImage(png.dataUrl, 'PNG', x, y, drawW, drawH);
                        } catch (_) {
                            doc.setFontSize(11);
                            doc.text('Visualisierung konnte nicht eingebettet werden (Bildkonvertierung fehlgeschlagen).', treeMargin, topY);
                        }
                    } else {
                        doc.setFontSize(11);
                        doc.text('Visualisierung konnte nicht erzeugt werden (SVG-Konvertierung fehlgeschlagen).', treeMargin, topY);
                    }
                } else {
                    doc.setFontSize(11);
                    doc.text('Visualisierung konnte nicht erzeugt werden (Graphviz-Service nicht erreichbar).', treeMargin, topY);
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
        pdf.addH1('Security Objectives');

        const secGoals = Array.isArray(analysis.securityGoals) ? analysis.securityGoals : [];
        if (secGoals.length === 0) {
            pdf.addText('Keine Security Objectives definiert.');
        } else {
            const sortedSG = [...secGoals].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
            
            pdf.addTable(
                ['ID', 'Name', 'Beschreibung', 'Ref. Risiken'],
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
        pdf.addH1('Restrisikoanalyse');
        pdf.addH2('Bewertung der Restrisiken');
        const rrEntries = (analysis.residualRisk && Array.isArray(analysis.residualRisk.entries)) ? analysis.residualRisk.entries : [];

        if (!rrEntries || rrEntries.length === 0 || typeof rrIterateLeaves !== 'function') {
            pdf.addText('Keine Restrisikoanalyse-Daten vorhanden.');
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
                    const impactName = (path ? (path + ' -> ') : '') + (leafText || '(ohne Text)');

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
                    const rrClass = isNaN(rrNum) ? 'Unbekannt' : h.riskClassFromValue(rrNum).label;

                    const prrVec = (treatment === 'Mitigiert') ? h.pVec(rk, rs, rt, ru) : '-';

                    const treeRefId = h.sanitizePdfText(treeId);
                    const impactText = h.sanitizePdfText(String(impactName || ''));

                    // RR: for Accepted/Delegated/empty, RR should equal R
                    const rrTxt = (treatment === 'Mitigiert') ? String(rrVal || '-') : String(oR || '-');

                    rows.push([
                        treeRefId,
                        rootName,
                        impactText,
                        treatment,
                        oR,
                        rrTxt,
                        sec,
                        note
                    ]);
                });
            });

            if (rows.length === 0) {
                pdf.addText('Keine Auswirkungen in der Restrisikoanalyse gefunden.');
            } else {
                pdf.addTableGrid(
                    ['', 'Baum Name', 'Auswirkung', 'Behandlung', 'R', 'RR', 'Ma\u00dfnahme', 'Anmerkung'],
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
                        if (typeof showToast === 'function') showToast('Erzeuge Restrisiko-Baum (SVG)\u2026 ' + (entry.id || ''), 'info');
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
                doc.text('Restrisiko-Baum ' + (entry.id || '') + ': ' + (entry.rootName || ''), rrMargin, rrMargin);
                doc.setFont('helvetica', 'normal');

                // Watermark
                try {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(56);
                    doc.setTextColor(245);
                    doc.text('Restrisiko', rrPageW / 2, rrPageH / 2, { align: 'center', angle: 35 });
                } catch (_) { /* noop */ }
                doc.setTextColor(0);
                doc.setFont('helvetica', 'normal');

                const rrTopY = rrMargin + 10;
                const rrAvailW = rrPageW - rrMargin * 2;
                const rrAvailH = rrPageH - rrTopY - rrMargin;

                if (rrSvgText && rrSvgText.includes('<svg')) {
                    let png = null;
                    try { png = await h.svgTextToPng(rrSvgText, 3800); } catch (e) { png = null; }
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
                            doc.addImage(png.dataUrl, 'PNG', x, y, drawW, drawH);
                        } catch (_) {
                            doc.setFontSize(11);
                            doc.text('Restrisiko-Visualisierung konnte nicht eingebettet werden (Bildkonvertierung fehlgeschlagen).', rrMargin, rrTopY);
                        }
                    } else {
                        doc.setFontSize(11);
                        doc.text('Restrisiko-Visualisierung konnte nicht erzeugt werden (SVG-Konvertierung fehlgeschlagen).', rrMargin, rrTopY);
                    }
                } else {
                    doc.setFontSize(11);
                    doc.text('Restrisiko-Visualisierung konnte nicht erzeugt werden (Graphviz-Service nicht erreichbar).', rrMargin, rrTopY);
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
        pdf.addTitle('Freigabe');
        pdf.addH2('Unterschriften');
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
            doc.text('Datum', dateLabelX, y0);
            doc.line(dateX1, y0 + 1.5, dateX2, y0 + 1.5);

            pdf.setY(y0 + 16);
        };

        drawSignatureRow('1. Autor');
        drawSignatureRow('2. Reviewer');
        drawSignatureRow('3. Genehmiger');

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
                doc.text(`Seite ${i} von ${pageCount}`, w - pdf.margin, hh - 8, { align: 'right' });
                doc.setTextColor(0);
            }
        } catch (_) { /* noop */ }

        // =============================================================
        // Save PDF
        // =============================================================
        const fname = h.sanitizeFilename(`Bedrohungs_und_Risikoanalyse_${analysis.name || analysis.id}_${now.toISOString().substring(0, 10)}`) + '.pdf';
        doc.save(fname);
        if (typeof showToast === 'function') showToast('PDF Report erstellt.', 'success');
    }

    // Expose
    window.generateReportPdf = generateReportPdf;
})();
