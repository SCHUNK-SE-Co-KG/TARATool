// =============================================================
// --- REPORT_EXPORT.JS: PDF Management Report + Detailreport ---
// =============================================================
// Benötigt jsPDF (UMD) via CDN in index.html

(function () {
    'use strict';

    // =============================================================
    // Graphviz rendering (DOT -> SVG) for PDF embedding
    // =============================================================
    // Default: use Kroki (public). Fallback: QuickChart.
    // NOTE: DOT content is sent to a third-party service.
    const GRAPHVIZ_RENDERERS = [
        {
            name: 'Kroki',
            url: 'https://kroki.io/graphviz/svg',
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: (dot) => dot
        },
        {
            name: 'QuickChart',
            url: 'https://quickchart.io/graphviz',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: (dot) => JSON.stringify({ graph: dot, format: 'svg', layout: 'dot' })
        }
    ];

    async function _fetchWithTimeout(url, options, timeoutMs = 20000) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            return res;
        } finally {
            clearTimeout(t);
        }
    }

    async function _renderDotToSvg(dotString) {
        if (!dotString) return null;
        for (const r of GRAPHVIZ_RENDERERS) {
            try {
                const res = await _fetchWithTimeout(r.url, {
                    method: r.method,
                    headers: r.headers,
                    body: r.body(dotString)
                }, 25000);
                if (!res || !res.ok) continue;
                const txt = await res.text();
                if (txt && txt.includes('<svg')) return txt;
            } catch (_) {
                // try next renderer
            }
        }
        return null;
    }

    async function _svgTextToPng(svgText, maxPxWidth = 3200) {
        // Converts SVG text to a PNG dataURL using an in-memory canvas.
        // Returns { dataUrl, widthPx, heightPx } or null.
        if (!svgText || !svgText.includes('<svg')) return null;

        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        try {
            const img = new Image();
            // Important: keep as same-origin (blob URL), so canvas isn't tainted.
            const loaded = await new Promise((resolve, reject) => {
                img.onload = () => resolve(true);
                img.onerror = () => reject(new Error('SVG image load failed'));
                img.src = url;
            });
            void loaded;

            const w = img.naturalWidth || img.width || 1;
            const h = img.naturalHeight || img.height || 1;

            const scale = (w > maxPxWidth) ? (maxPxWidth / w) : 1;
            const cw = Math.max(1, Math.floor(w * scale));
            const ch = Math.max(1, Math.floor(h * scale));

            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;

            ctx.clearRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            const dataUrl = canvas.toDataURL('image/png');
            return { dataUrl, widthPx: cw, heightPx: ch };
        } catch (_) {
            return null;
        } finally {
            try { URL.revokeObjectURL(url); } catch (_) { /* noop */ }
        }
    }

    // NOTE: We keep the conversion intentionally dependency-free (no svg2pdf).
    // Graphviz SVG is converted to PNG via canvas and embedded using doc.addImage.

    function _getActiveAnalysis() {
        try {
            return analysisData.find(a => a.id === activeAnalysisId) || null;
        } catch (e) {
            return null;
        }
    }

    function _riskClassFromValue(rVal) {
        const v = parseFloat(rVal);
        if (isNaN(v)) return { label: 'Unbekannt', color: [127, 140, 141] };
        if (v >= 2.0) return { label: 'Kritisch', color: [192, 57, 43] };
        if (v >= 1.6) return { label: 'Hoch', color: [230, 126, 34] };
        if (v >= 0.8) return { label: 'Mittel', color: [243, 156, 18] };
        return { label: 'Niedrig', color: [39, 174, 96] };
    }

    function _formatDate(iso) {
        if (!iso) return '';
        // Erwartet YYYY-MM-DD
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return String(iso);
        return `${m[3]}.${m[2]}.${m[1]}`;
    }

    function _sanitizeFilename(s) {
        return String(s || 'report')
            .trim()
            .replace(/[\\/?:*"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 80);
    }

    function _getDisplayDamageScenarios(analysis) {
        let displayDS = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS || []));
        const defaultIds = new Set(displayDS.map(d => d.id));
        if (analysis && Array.isArray(analysis.damageScenarios)) {
            analysis.damageScenarios.forEach(ds => {
                if (!defaultIds.has(ds.id)) displayDS.push(ds);
            });
        }
        displayDS.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
        return displayDS;
    }

    function _kstuToString(kstu) {
        if (!kstu) return '';
        const k = (kstu.k ?? '').toString();
        const s = (kstu.s ?? '').toString();
        const t = (kstu.t ?? '').toString();
        const u = (kstu.u ?? '').toString();
        return `K:${k}  S:${s}  T:${t}  U:${u}`;
    }

    // --------------------
    // PDF Layout Helpers
    // --------------------

    function _createPdfDoc() {
        const jspdfNS = (window.jspdf || window.jsPDF || null);
        const jsPDF = jspdfNS && (jspdfNS.jsPDF || jspdfNS);
        if (!jsPDF) return null;
        return new jsPDF({ unit: 'mm', format: 'a4' });
    }

    function _pdfBuilder(doc) {
        const margin = 15;
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        let y = margin;

        // Globale Abstaende (PDF) – bewusst etwas luftiger, ohne das Web-Layout zu beeinflussen
        const sectionGapH1 = 6;
        const sectionGapH2 = 3;
        const lineGapTop = 5;
        const lineGapBottom = 9;

        const ensureSpace = (needed) => {
            if (y + needed <= pageH - margin) return;
            doc.addPage();
            y = margin;
        };

        const hLine = (top = lineGapTop, bottom = lineGapBottom) => {
            // mehr Abstand um Trennlinien (bessere Lesbarkeit)
            ensureSpace(top + bottom + 1);
            y += top;
            doc.setDrawColor(220);
            doc.line(margin, y, pageW - margin, y);
            y += bottom;
        };

        const addTitle = (text) => {
            ensureSpace(12);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(String(text || ''), margin, y);
            doc.setFont('helvetica', 'normal');
            y += 10;
        };

        const addH1 = (text) => {
            // Abstand zu vorherigem Kapitel (bewusst etwas groesser)
            const pre = (y > margin + 0.5) ? sectionGapH1 : 0;
            ensureSpace(pre + 10);
            y += pre;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(String(text || ''), margin, y);
            doc.setFont('helvetica', 'normal');
            y += 9;
        };

        const addH2 = (text) => {
            const pre = (y > margin + 0.5) ? sectionGapH2 : 0;
            ensureSpace(pre + 8);
            y += pre;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(String(text || ''), margin, y);
            doc.setFont('helvetica', 'normal');
            y += 7.5;
        };

        const addText = (text, fontSize = 10, spacing = 5) => {
            const t = String(text || '');
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(t, pageW - margin * 2);
            ensureSpace(lines.length * spacing);
            doc.text(lines, margin, y);
            y += lines.length * spacing;
        };

        const addSpacer = (mm = 4) => {
            const v = Math.max(0, Number(mm) || 0);
            ensureSpace(v);
            y += v;
        };

        const addKeyValue = (key, value) => {
            const k = String(key || '');
            const v = value === null || value === undefined || value === '' ? '-' : String(value);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            // Dynamische Spaltenbreite fuer den Key (verhindert Ueberlappung bei langen Labels,
            // z.B. "Autor / Verantwortlich")
            const keyText = k + ':';
            const keyW = Math.min(60, Math.max(28, doc.getTextWidth(keyText) + 3));
            const valX = margin + keyW + 2;
            const valW = pageW - margin * 2 - keyW - 2;

            const keyLines = doc.splitTextToSize(keyText, keyW);
            doc.setFont('helvetica', 'normal');
            const valLines = doc.splitTextToSize(v, valW);

            const rowLines = Math.max(keyLines.length, valLines.length);
            const lineH = 6;
            const needed = Math.max(6, rowLines * lineH);
            ensureSpace(needed);

            doc.setFont('helvetica', 'bold');
            doc.text(keyLines, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.text(valLines, valX, y);
            y += needed;
        };

        // Minimaler, robuster Tabellenrenderer (ohne AutoTable)
        const addTable = (headers, rows, colWidths) => {
            if (!Array.isArray(headers) || headers.length === 0) return;
            if (!Array.isArray(rows)) rows = [];

            const totalW = pageW - margin * 2;
            const widths = Array.isArray(colWidths) && colWidths.length === headers.length
                ? colWidths
                : headers.map(() => totalW / headers.length);

            const xPos = [margin];
            for (let i = 0; i < widths.length; i++) xPos[i + 1] = xPos[i] + widths[i];

            const cellPadding = 1.5;
            const fontSizeHeader = 10;
            const fontSizeCell = 9;
            const lineH = 4.5;

            // Header
            ensureSpace(8);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(fontSizeHeader);
            for (let i = 0; i < headers.length; i++) {
                const txt = String(headers[i] || '');
                doc.text(txt, xPos[i] + cellPadding, y);
            }
            doc.setFont('helvetica', 'normal');
            y += 6;
            doc.setDrawColor(220);
            doc.line(margin, y - 4, pageW - margin, y - 4);

            // Rows
            doc.setFontSize(fontSizeCell);
            rows.forEach(r => {
                const cells = Array.isArray(r) ? r : [r];
                const wrapped = cells.map((c, idx) => {
                    const w = widths[idx] - cellPadding * 2;
                    return doc.splitTextToSize(String(c ?? ''), w);
                });
                const rowH = Math.max(...wrapped.map(a => a.length)) * lineH;
                ensureSpace(rowH + 2);

                for (let i = 0; i < headers.length; i++) {
                    doc.text(wrapped[i] || [''], xPos[i] + cellPadding, y);
                }
                y += rowH;
                y += 2;
            });

            y += 2;
        };


        // Schadensauswirkungsmatrix als farbige Tabelle (Assets x Schadensszenarien)
        // - Y: Assets (ID + Name)
        // - X: Damage Szenarien (ID + Name)
        // - Zellen: Wert + Label (High/Medium/Low/N/A) mit Hintergrundfarbe wie im UI
        const addImpactMatrixTable = (assets, dsList, impactMatrix) => {
            if (!Array.isArray(assets) || assets.length === 0) return;
            if (!Array.isArray(dsList) || dsList.length === 0) return;

            const totalW = pageW - margin * 2;
            const assetW = 55; // ausreichend fuer "ID: Name" in einer Zeile
            const desiredDsW = 25; // Zielbreite je DS-Spalte (wird je Block angepasst)
            const maxCols = Math.max(1, Math.floor((totalW - assetW) / desiredDsW));

            const blocks = [];
            for (let i = 0; i < dsList.length; i += maxCols) blocks.push(dsList.slice(i, i + maxCols));

            const cellPad = 1.2;
            const headerH = 14;
            const rowH = 10;

            const impactStyle = (val) => {
                const v = (val === undefined || val === null || val === '') ? 'N/A' : String(val);
                if (v === '3') return { fill: [245, 183, 177], text: '3 High', textColor: [0, 0, 0] };
                if (v === '2') return { fill: [248, 231, 159], text: '2 Medium', textColor: [0, 0, 0] };
                if (v === '1') return { fill: [171, 235, 198], text: '1 Low', textColor: [0, 0, 0] };
                return { fill: [125, 206, 160], text: 'N/A', textColor: [255, 255, 255] };
            };

            const trunc = (s, n) => {
                const t = String(s || '');
                return t.length > n ? (t.substring(0, Math.max(0, n - 1)) + '…') : t;
            };

            const drawLegend = () => {
                // mehr Abstand zur vorherigen Zeile gewuenscht
                const topGap = 9;
                ensureSpace(topGap + 10);
                y += topGap;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text('Legende:', margin, y);

                const items = [
                    { label: 'High', fill: [245, 183, 177], tc: [0, 0, 0] },
                    { label: 'Medium', fill: [248, 231, 159], tc: [0, 0, 0] },
                    { label: 'Low', fill: [171, 235, 198], tc: [0, 0, 0] },
                    { label: 'N/A', fill: [125, 206, 160], tc: [255, 255, 255] },
                ];

                let x = margin + 18;
                const boxW = 16;
                const boxH = 6;
                const gap = 6;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                for (const it of items) {
                    doc.setDrawColor(200);
                    doc.setFillColor(...it.fill);
                    doc.rect(x, y - 4.5, boxW, boxH, 'FD');
                    doc.setTextColor(...it.tc);
                    doc.text(it.label, x + boxW / 2, y - 1.2, { align: 'center' });
                    doc.setTextColor(0);
                    x += boxW + gap;
                }
                y += 9;
            };

            const drawHeader = (dsSubset, blockIndex, blockCount) => {
                // kleiner Abstand zwischen Bloecken
                const pre = (y > margin + 1) ? 2 : 0;
                ensureSpace(pre + headerH + rowH);
                y += pre;

                if (blockCount > 1) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(120);
                    doc.text(`Matrix Teil ${blockIndex + 1}/${blockCount} (DS ${dsSubset[0].id} – ${dsSubset[dsSubset.length - 1].id})`, margin, y);
                    doc.setTextColor(0);
                    y += 5;
                    ensureSpace(headerH + rowH);
                }

                const dsW = (totalW - assetW) / dsSubset.length;
                const y0 = y;

                // Header-Hintergrund explizit setzen (verhindert schwarze Header in manchen Viewern)
                const headerFill = [244, 244, 244];
                doc.setDrawColor(180);

                // Asset Header
                doc.setFillColor(...headerFill);
                doc.rect(margin, y0, assetW, headerH, 'F');
                doc.rect(margin, y0, assetW, headerH, 'S');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.text('Asset', margin + cellPad, y0 + 4);
                doc.text('(ID: Name)', margin + cellPad, y0 + 8);

                // DS Header
                for (let i = 0; i < dsSubset.length; i++) {
                    const ds = dsSubset[i];
                    const x0 = margin + assetW + i * dsW;

                    doc.setFillColor(...headerFill);
                    doc.rect(x0, y0, dsW, headerH, 'F');
                    doc.rect(x0, y0, dsW, headerH, 'S');

                    const label = `${ds.id} ${ds.name || ds.short || ''}`.trim();
                    const lines = doc.splitTextToSize(label, dsW - 2 * cellPad).slice(0, 3);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(6.5);
                    let ty = y0 + 4;
                    for (const ln of lines) {
                        doc.text(String(ln), x0 + dsW / 2, ty, { align: 'center' });
                        ty += 3.2;
                    }
                }

                y += headerH;
                return dsW;
            };

            const drawRow = (asset, dsSubset, dsW) => {
                ensureSpace(rowH + 1);

                const y0 = y;
                doc.setDrawColor(200);

                // Asset cell
                doc.rect(margin, y0, assetW, rowH, 'S');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                const aLabel = trunc(`${asset.id || ''}: ${asset.name || ''}`.trim(), 45);
                doc.text(aLabel || '-', margin + cellPad, y0 + 6.5);

                // Score cells
                const aRow = (impactMatrix && asset && impactMatrix[asset.id]) ? impactMatrix[asset.id] : {};
                for (let i = 0; i < dsSubset.length; i++) {
                    const ds = dsSubset[i];
                    const x0 = margin + assetW + i * dsW;
                    const val = (aRow && aRow[ds.id] !== undefined) ? aRow[ds.id] : 'N/A';
                    const st = impactStyle(val);

                    doc.setFillColor(...st.fill);
                    doc.setDrawColor(200);
                    doc.rect(x0, y0, dsW, rowH, 'FD');

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    doc.setTextColor(...st.textColor);
                    doc.text(st.text, x0 + dsW / 2, y0 + rowH / 2 + 1, { align: 'center', baseline: 'middle' });
                    doc.setTextColor(0);
                }

                y += rowH;
            };

            // Legende einmal vor der Matrix
            drawLegend();

            // Matrix als Spaltenbloecke (falls zu viele DS fuer eine Seite)
            blocks.forEach((dsSubset, bi) => {
                // Neue Seite, falls kaum Platz fuer Block uebrig
                if (y + headerH + rowH > pageH - margin) {
                    doc.addPage();
                    y = margin;
                }

                let dsW = drawHeader(dsSubset, bi, blocks.length);

                // Rows (mit Seitenumbruechen + wiederholtem Header)
                for (let ai = 0; ai < assets.length; ai++) {
                    if (y + rowH > pageH - margin) {
                        doc.addPage();
                        y = margin;
                        dsW = drawHeader(dsSubset, bi, blocks.length);
                    }
                    drawRow(assets[ai], dsSubset, dsW);
                }

                // kleiner Abstand nach Block
                y += 4;
            });
        };

        return {
            margin,
            pageW,
            pageH,
            getY: () => y,
            setY: (v) => { y = v; },
            ensureSpace,
            hLine,
            addTitle,
            addH1,
            addH2,
            addText,
            addSpacer,
            addKeyValue,
            addTable,
            addImpactMatrixTable
        };
    }

    // --------------------
    // Report Generation
    // --------------------

    async function generateReportPdf() {
        const analysis = _getActiveAnalysis();
        if (!analysis) {
            if (typeof showToast === 'function') showToast('Keine aktive Analyse ausgewählt.', 'warning');
            return;
        }

        const doc = _createPdfDoc();
        if (!doc) {
            if (typeof showToast === 'function') showToast('PDF-Erzeugung nicht verfügbar (jsPDF nicht geladen).', 'error');
            return;
        }

        const pdf = _pdfBuilder(doc);
        const now = new Date();
        const generatedAt = `${_formatDate(now.toISOString().substring(0, 10))} ${now.toTimeString().substring(0, 5)}`;

        const assets = Array.isArray(analysis.assets) ? analysis.assets : [];
        const dsList = _getDisplayDamageScenarios(analysis);
        const risks = Array.isArray(analysis.riskEntries) ? analysis.riskEntries : [];

        // --- Projektbeschreibung (Kapitel 1) ---
        // Wichtig: Kapitel 1 soll bereits auf Seite 1 beginnen (ohne vorgeschaltete "Cover"-Seite).
        // Daher wird hier direkt das Kapitel inkl. Inhalte gesetzt.
        pdf.addTitle('Bedrohungs- und Risikoanalyse');
        pdf.addText('Projektbeschreibung', 12, 6);
        pdf.hLine();
        pdf.addSpacer(2.5);

        pdf.addH1('Projektbeschreibung');
        pdf.addKeyValue('Analysename', analysis.name || '-');
        pdf.addKeyValue('Autor / Verantwortlich', (analysis.metadata && analysis.metadata.author) || analysis.author || '-');
        pdf.addKeyValue('Version', (analysis.metadata && analysis.metadata.version) || '-');
        pdf.addKeyValue('Datum', _formatDate((analysis.metadata && analysis.metadata.date) || ''));
        pdf.addKeyValue('Systembeschreibung', analysis.description || '-');
        pdf.addKeyValue('Verwendungszweck', analysis.intendedUse || '-');
        pdf.addKeyValue('Report erstellt', generatedAt);

        // --- Management-Zusammenfassung (Kapitel 2) ---
        // Projektbeschreibung und Management-Zusammenfassung duerfen auf einer Seite stehen.
        // Daher KEIN erzwungener Seitenumbruch hier; falls der Platz nicht reicht, sorgt ensureSpace
        // innerhalb der Layout-Helper automatisch fuer Folgeseiten.
        pdf.addSpacer(6);

        // Risk distribution
        const dist = { Kritisch: 0, Hoch: 0, Mittel: 0, Niedrig: 0, Unbekannt: 0 };
        const riskSorted = [...risks].map(r => {
            const v = parseFloat(r.rootRiskValue);
            const cls = _riskClassFromValue(v);
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

        // --- Detailkapitel (ohne separates "Detailreport"-Kapitel) ---
        // Gewuenschte Struktur: 1) Projektbeschreibung, 2) Management-Zusammenfassung, 3) Assets, ...
        // Daher wird kein eigenstaendiges Kapitel "Detailreport" ausgegeben.
        pdf.ensureSpace(12);
        doc.addPage();
        pdf.setY(pdf.margin);

        pdf.addTitle('Bedrohungs- und Risikoanalyse');
        pdf.addText(`Analyse: ${analysis.name || analysis.id}`, 12, 6);
        pdf.hLine();

        // Assets
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

        // Damage scenarios
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

        // Impact matrix (immer auf neuer Seite starten)
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


        // Risk entries (immer auf neuer Seite starten)
        doc.addPage();
        pdf.setY(pdf.margin);
        pdf.addH1('Risikoanalyse & Angriffsbäume');
        if (risks.length === 0) {
            pdf.addText('Keine Angriffsbäume vorhanden.');
        } else {
            const sorted = [...risks].sort((a, b) => (parseFloat(b.rootRiskValue) || 0) - (parseFloat(a.rootRiskValue) || 0));
            sorted.forEach(entry => {
                const cls = _riskClassFromValue(entry.rootRiskValue);
                pdf.addH2(`${entry.id || ''}: ${entry.rootName || ''}`);
                pdf.addKeyValue('Risk Score (R)', entry.rootRiskValue ?? '-');
                pdf.addKeyValue('Risikoklasse', cls.label);

                // Hinweis: Im PDF werden pro Risikobaum nur die Wurzelangaben ausgegeben.
                // Zwischenpfade und Blaetter sind im Tool einsehbar.
                pdf.addSpacer(1);
                pdf.addText('siehe Visualisierung Angriffsbäume', 9, 4.2);
                pdf.hLine();
            });
        }

        // Visualisierung Angriffsbäume (A3 Querformat)
        if (risks.length > 0) {
            let svgText = null;
            try {
                const dotContent = (typeof window.exportRiskAnalysisToDot === 'function')
                    ? window.exportRiskAnalysisToDot(analysis)
                    : null;

                if (dotContent) {
                    if (typeof showToast === 'function') showToast('Erzeuge Angriffsbäume (SVG)…', 'info');
                    svgText = await _renderDotToSvg(dotContent);
                }
            } catch (_) {
                svgText = null;
            }

            // A3 landscape page for the SVG
            try {
                doc.addPage('a3', 'landscape');
            } catch (_) {
                // Fallback: custom size in mm (A3 landscape ~ 420 x 297)
                doc.addPage([420, 297], 'landscape');
            }

            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const margin = pdf.margin;

            // Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor(0);
            doc.text('Angriffsbäume', margin, margin);
            doc.setFont('helvetica', 'normal');

            // Light watermark behind (optional, very subtle)
            try {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(60);
                doc.setTextColor(245);
                doc.text('Angriffsbäume', pageW / 2, pageH / 2, { align: 'center', angle: 35 });
            } catch (_) { /* noop */ }
            doc.setTextColor(0);
            doc.setFont('helvetica', 'normal');

            const topY = margin + 10;
            const availW = pageW - margin * 2;
            const availH = pageH - topY - margin;

            if (svgText && svgText.includes('<svg')) {
                // Convert SVG to PNG and embed
                const png = await _svgTextToPng(svgText, 3800);
                if (png && png.dataUrl) {
                    // Fit preserving aspect ratio
                    const imgRatio = (png.widthPx || 1) / (png.heightPx || 1);
                    let drawW = availW;
                    let drawH = drawW / imgRatio;
                    if (drawH > availH) {
                        drawH = availH;
                        drawW = drawH * imgRatio;
                    }
                    const x = margin + (availW - drawW) / 2;
                    const y = topY + (availH - drawH) / 2;
                    try {
                        doc.addImage(png.dataUrl, 'PNG', x, y, drawW, drawH);
                    } catch (_) {
                        // fallback text
                        doc.setFontSize(11);
                        doc.text('Visualisierung konnte nicht eingebettet werden (Bildkonvertierung fehlgeschlagen).', margin, topY);
                    }
                } else {
                    doc.setFontSize(11);
                    doc.text('Visualisierung konnte nicht erzeugt werden (SVG-Konvertierung fehlgeschlagen).', margin, topY);
                }
            } else {
                doc.setFontSize(11);
                doc.text('Visualisierung konnte nicht erzeugt werden (Graphviz-Service nicht erreichbar).', margin, topY);
            }

            // Reset builder Y for following pages (we will switch back to A4)
            doc.setTextColor(0);
            doc.setFont('helvetica', 'normal');
            pdf.setY(pdf.margin);
        }

        // Freigabe (neue Seite): Unterschriften + Datum
        // Freigabe wieder in A4 Hochformat
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

            // Unterschrift-Linie
            doc.setDrawColor(0);
            doc.line(signX1, y0 + 1.5, signX2, y0 + 1.5);

            // Datum
            doc.setFontSize(10);
            doc.text('Datum', dateLabelX, y0);
            doc.line(dateX1, y0 + 1.5, dateX2, y0 + 1.5);

            pdf.setY(y0 + 16);
        };

        drawSignatureRow('1. Autor');
        drawSignatureRow('2. Reviewer');
        drawSignatureRow('3. Genehmiger');

        // Seitenzahlen (Seite X von Y)
        try {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                const w = doc.internal.pageSize.getWidth();
                const h = doc.internal.pageSize.getHeight();
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(120);
                doc.text(`Seite ${i} von ${pageCount}`, w - pdf.margin, h - 8, { align: 'right' });
                doc.setTextColor(0);
            }
        } catch (_) { /* noop */ }

        const fname = _sanitizeFilename(`Bedrohungs_und_Risikoanalyse_${analysis.name || analysis.id}_${now.toISOString().substring(0, 10)}`) + '.pdf';
        doc.save(fname);
        if (typeof showToast === 'function') showToast('PDF Report erstellt.', 'success');
    }

    // Expose
    window.generateReportPdf = generateReportPdf;
})();
