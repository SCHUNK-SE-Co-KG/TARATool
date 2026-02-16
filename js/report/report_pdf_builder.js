// =============================================================
// --- REPORT_PDF_BUILDER.JS: PDF Layout Engine ---
// =============================================================
// Provides the PDF builder (layout primitives).
// Requires jsPDF (UMD) via CDN in index.html.

(function () {
    'use strict';

    function createPdfDoc() {
        const jspdfNS = (window.jspdf || window.jsPDF || null);
        const jsPDF = jspdfNS && (jspdfNS.jsPDF || jspdfNS);
        if (!jsPDF) return null;
        return new jsPDF({ unit: 'mm', format: 'a4' });
    }

    function pdfBuilder(doc) {
        const margin = 15;
        let y = margin;

        // Global spacings (PDF) – intentionally a bit more airy without affecting the web layout
        const sectionGapH1 = 6;
        const sectionGapH2 = 3;
        const lineGapTop = 5;
        const lineGapBottom = 9;

        const ensureSpace = (needed) => {
            if (y + needed <= doc.internal.pageSize.getHeight() - margin) return;
            doc.addPage();
            y = margin;
        };

        const hLine = (top = lineGapTop, bottom = lineGapBottom) => {
            // more spacing around separator lines (better readability)
            ensureSpace(top + bottom + 1);
            y += top;
            doc.setDrawColor(220);
            doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
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
            // Spacing before chapter (intentionally a bit larger)
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
            const lines = doc.splitTextToSize(t, doc.internal.pageSize.getWidth() - margin * 2);
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
            // Dynamic column width for the key (prevents overlap with long labels,
            // e.g. "Autor / Verantwortlich")
            const keyText = k + ':';
            const keyW = Math.min(60, Math.max(28, doc.getTextWidth(keyText) + 3));
            const valX = margin + keyW + 2;
            const valW = doc.internal.pageSize.getWidth() - margin * 2 - keyW - 2;

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

        // Minimal, robust table renderer (without AutoTable)
        const addTable = (headers, rows, colWidths) => {
            if (!Array.isArray(headers) || headers.length === 0) return;
            if (!Array.isArray(rows)) rows = [];

            const totalW = doc.internal.pageSize.getWidth() - margin * 2;
            const widths = Array.isArray(colWidths) && colWidths.length === headers.length
                ? colWidths
                : headers.map(() => totalW / headers.length);

            // Scale column widths to available page width (use full page)
            const sumW = widths.reduce((a, b) => a + b, 0);
            if (sumW > 0 && Math.abs(sumW - totalW) > 0.5) {
                const scale = totalW / sumW;
                for (let i = 0; i < widths.length; i++) widths[i] = widths[i] * scale;
            }

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
            doc.line(margin, y - 4, doc.internal.pageSize.getWidth() - margin, y - 4);

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


        // Table renderer with borders (grid), repeated header and zebra striping.
        // Uses the full page width (within PDF margins) and optimizes for readability.
        const addTableGrid = (headers, rows, colWidths, options = {}) => {
            if (!Array.isArray(headers) || headers.length === 0) return;
            if (!Array.isArray(rows)) rows = [];

            const totalW = doc.internal.pageSize.getWidth() - margin * 2;
            const widths = Array.isArray(colWidths) && colWidths.length === headers.length
                ? colWidths
                : headers.map(() => totalW / headers.length);

            // Scale column widths to available page width (use full page)
            const sumW = widths.reduce((a, b) => a + b, 0);
            if (sumW > 0 && Math.abs(sumW - totalW) > 0.5) {
                const scale = totalW / sumW;
                for (let i = 0; i < widths.length; i++) widths[i] = widths[i] * scale;
            }

            const xPos = [margin];
            for (let i = 0; i < widths.length; i++) xPos[i + 1] = xPos[i] + widths[i];

            const opt = {
                headerFill: options.headerFill || [250, 250, 250],
                headerTextColor: options.headerTextColor || [20, 20, 20],
                zebra: (options.zebra !== undefined) ? options.zebra : true,
                zebraFill: options.zebraFill || [252, 252, 252],
                borderColor: options.borderColor || [190, 190, 190],
                headerFontSize: options.headerFontSize || 10,
                cellFontSize: options.cellFontSize || 8.5,
                cellPadX: options.cellPadX || 1.6,
                cellPadY: options.cellPadY || 1.4,
                lineH: options.lineH || 4.0,
            };
            const noWrapCols = Array.isArray(options.noWrapCols) ? options.noWrapCols : [];
            const _truncateToWidth = (text, maxW) => {
                let s = String(text ?? '');
                if (!s) return '';
                // Fast path
                if (doc.getTextWidth(s) <= maxW) return s;
                const ell = '...';
                const ellW = doc.getTextWidth(ell);
                if (ellW >= maxW) return '';
                // Binary search for max substring length that fits
                let lo = 0, hi = s.length;
                while (lo < hi) {
                    const mid = Math.ceil((lo + hi) / 2);
                    const sub = s.slice(0, mid);
                    if (doc.getTextWidth(sub) + ellW <= maxW) lo = mid;
                    else hi = mid - 1;
                }
                return s.slice(0, lo) + ell;
            };


            const drawHeader = () => {
                const headerLines = headers.map((h, i) => {
                    const w = Math.max(5, widths[i] - opt.cellPadX * 2);
                    return doc.splitTextToSize(String(h ?? ''), w);
                });
                const maxLines = Math.max(1, ...headerLines.map(a => (a ? a.length : 1)));
                const headerH = maxLines * opt.lineH + opt.cellPadY * 2;

                if (y + headerH > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                }

                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(opt.headerFontSize);
                doc.setDrawColor(...opt.borderColor);

                for (let i = 0; i < headers.length; i++) {
                    // Background (light) + border
                    doc.setFillColor(...opt.headerFill);
                    doc.rect(xPos[i], y, widths[i], headerH, 'F');
                    doc.rect(xPos[i], y, widths[i], headerH, 'S');

                    // Text (explicitly dark)
                    doc.setTextColor(...opt.headerTextColor);
                    doc.text(headerLines[i] || [''], xPos[i] + opt.cellPadX, y + opt.cellPadY + opt.lineH - 0.8);
                }

                // reset to default text color
                doc.setTextColor(0);
                y += headerH;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(opt.cellFontSize);
            };

            drawHeader();

            rows.forEach((r, ri) => {
                const cells = Array.isArray(r) ? r : [r];
                const normCells = headers.map((_, i) => (cells[i] !== undefined ? cells[i] : ''));

                const wrapped = normCells.map((c, i) => {
                    const w = Math.max(5, widths[i] - opt.cellPadX * 2);
                    if (noWrapCols.includes(i)) {
                        return [_truncateToWidth(String(c ?? ''), w)];
                    }
                    return doc.splitTextToSize(String(c ?? ''), w);
                });

                const maxLines = Math.max(1, ...wrapped.map(a => (a ? a.length : 1)));
                const rowH = maxLines * opt.lineH + opt.cellPadY * 2;

                if (y + rowH > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                    drawHeader();
                }

                const doZebra = opt.zebra && (ri % 2 === 1);
                doc.setDrawColor(...opt.borderColor);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(opt.cellFontSize);
                doc.setTextColor(20, 20, 20);

                const fill = doZebra ? opt.zebraFill : [255, 255, 255];

                for (let i = 0; i < headers.length; i++) {
                    doc.setFillColor(...fill);
                    // Background + border (per cell) -> print-friendly, no "black boxes"
                    doc.rect(xPos[i], y, widths[i], rowH, 'F');
                    doc.rect(xPos[i], y, widths[i], rowH, 'S');

                    doc.text(wrapped[i] || [''], xPos[i] + opt.cellPadX, y + opt.cellPadY + opt.lineH - 0.8);
                }

                doc.setTextColor(0);

                y += rowH;
            });

            y += 2;
        };

        // Impact matrix as colored table (assets x damage scenarios)
        // - Y: Assets (ID + Name)
        // - X: Damage scenarios (ID + Name)
        // - Cells: Value + Label (High/Medium/Low/N/A) with background color like in UI
        // Impact matrix – dynamically scaled for 1-10+ DS columns.
        // All DS are ALWAYS displayed in a single table (no block splitting).
        // Font size, column widths and row heights adapt dynamically.
        const addImpactMatrixTable = (assets, dsList, impactMatrix) => {
            if (!Array.isArray(assets) || assets.length === 0) return;
            if (!Array.isArray(dsList) || dsList.length === 0) return;

            const totalW = doc.internal.pageSize.getWidth() - margin * 2;
            const dsCount = dsList.length;

            // --- Dynamic sizing ---
            // Asset column: wider with few DS, narrower with many
            const assetW = (dsCount <= 5) ? 55
                         : (dsCount <= 7) ? 45
                         : (dsCount <= 9) ? 38
                         :                  32;

            const dsW = (totalW - assetW) / dsCount;

            // Font sizes dynamic: the more columns, the smaller
            const headerFontSize = (dsCount <= 5) ? 6.5
                                 : (dsCount <= 7) ? 5.8
                                 : (dsCount <= 9) ? 5.2
                                 :                  4.5;

            const cellFontSize = (dsCount <= 5) ? 7
                               : (dsCount <= 7) ? 6.2
                               : (dsCount <= 9) ? 5.5
                               :                  4.8;

            const assetFontSize = (dsCount <= 5) ? 7
                                : (dsCount <= 7) ? 6.5
                                : (dsCount <= 9) ? 6
                                :                  5.5;

            // Row heights dynamic
            const headerH = (dsCount <= 5) ? 14
                          : (dsCount <= 7) ? 12
                          :                  10;

            const rowH = (dsCount <= 5) ? 10
                       : (dsCount <= 7) ? 8.5
                       :                  7.5;

            const cellPad = (dsCount <= 7) ? 1.2 : 0.8;

            // Max character length for asset label
            const assetMaxChars = (dsCount <= 5) ? 45
                                : (dsCount <= 7) ? 35
                                : (dsCount <= 9) ? 28
                                :                  22;

            // Cell text: with narrow columns only digit, with wide columns "3 High" etc.
            const useShortLabels = (dsW < 20);

            const impactStyle = (val) => {
                const v = (val === undefined || val === null || val === '') ? 'N/A' : String(val);
                if (v === '3') return { fill: [245, 183, 177], text: useShortLabels ? '3' : '3 High',     textColor: [0, 0, 0] };
                if (v === '2') return { fill: [248, 231, 159], text: useShortLabels ? '2' : '2 Medium',   textColor: [0, 0, 0] };
                if (v === '1') return { fill: [171, 235, 198], text: useShortLabels ? '1' : '1 Low',      textColor: [0, 0, 0] };
                return                { fill: [125, 206, 160], text: 'N/A',                                textColor: [255, 255, 255] };
            };

            const trunc = (s, n) => {
                const t = String(s || '');
                return t.length > n ? (t.substring(0, Math.max(0, n - 1)) + '\u2026') : t;
            };

            // --- Legend ---
            const drawLegend = () => {
                const topGap = 9;
                ensureSpace(topGap + 10);
                y += topGap;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                doc.text('Legende:', margin, y);

                const items = [
                    { label: 'High (3)',   fill: [245, 183, 177], tc: [0, 0, 0] },
                    { label: 'Medium (2)', fill: [248, 231, 159], tc: [0, 0, 0] },
                    { label: 'Low (1)',    fill: [171, 235, 198], tc: [0, 0, 0] },
                    { label: 'N/A',        fill: [125, 206, 160], tc: [255, 255, 255] },
                ];

                let x = margin + 18;
                const boxW = 18;
                const boxH = 6;
                const gap = 5;

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

            // --- Draw header (also repeated on page break) ---
            const drawHeader = () => {
                const pre = (y > margin + 1) ? 2 : 0;
                ensureSpace(pre + headerH + rowH);
                y += pre;

                const y0 = y;
                const headerFill = [244, 244, 244];
                doc.setDrawColor(180);

                // Asset Header
                doc.setFillColor(...headerFill);
                doc.rect(margin, y0, assetW, headerH, 'F');
                doc.rect(margin, y0, assetW, headerH, 'S');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(Math.min(7, assetFontSize));
                doc.text('Asset', margin + cellPad, y0 + headerH * 0.3);
                doc.text('(ID: Name)', margin + cellPad, y0 + headerH * 0.65);

                // DS Header – single line, font scaled accordingly
                for (let i = 0; i < dsCount; i++) {
                    const ds = dsList[i];
                    const x0 = margin + assetW + i * dsW;

                    doc.setFillColor(...headerFill);
                    doc.rect(x0, y0, dsW, headerH, 'F');
                    doc.rect(x0, y0, dsW, headerH, 'S');

                    // Label: with narrow columns only ID + Short, otherwise ID + Name
                    const shortLabel = ds.short || '';
                    const fullLabel = `${ds.id} ${ds.name || shortLabel}`.trim();
                    const maxLabelW = dsW - 2 * cellPad;

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(headerFontSize);

                    // Find appropriate font size so label fits without wrapping
                    let usedLabel = fullLabel;
                    let usedFontSize = headerFontSize;
                    const minFs = 3.5;

                    // Try full label; if too wide: shorten to ID + Short
                    if (doc.getTextWidth(usedLabel) > maxLabelW && shortLabel) {
                        usedLabel = `${ds.id} ${shortLabel}`.trim();
                    }
                    // If still too wide: only ID
                    if (doc.getTextWidth(usedLabel) > maxLabelW) {
                        usedLabel = String(ds.id || '');
                    }
                    // If ID itself is too wide: reduce font further
                    while (doc.getTextWidth(usedLabel) > maxLabelW && usedFontSize > minFs) {
                        usedFontSize -= 0.3;
                        doc.setFontSize(usedFontSize);
                    }

                    // Centered in cell
                    doc.text(usedLabel, x0 + dsW / 2, y0 + headerH / 2 + 0.5, { align: 'center' });
                }

                y += headerH;
            };

            // --- Draw data row ---
            const drawRow = (asset) => {
                ensureSpace(rowH + 1);

                const y0 = y;
                doc.setDrawColor(200);

                // Asset cell
                doc.rect(margin, y0, assetW, rowH, 'S');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(assetFontSize);
                const aLabel = trunc(`${asset.id || ''}: ${asset.name || ''}`.trim(), assetMaxChars);
                doc.text(aLabel || '-', margin + cellPad, y0 + rowH / 2 + 1);

                // Score cells
                const aRow = (impactMatrix && asset && impactMatrix[asset.id]) ? impactMatrix[asset.id] : {};
                for (let i = 0; i < dsCount; i++) {
                    const ds = dsList[i];
                    const x0 = margin + assetW + i * dsW;
                    const val = (aRow && aRow[ds.id] !== undefined) ? aRow[ds.id] : 'N/A';
                    const st = impactStyle(val);

                    doc.setFillColor(...st.fill);
                    doc.setDrawColor(200);
                    doc.rect(x0, y0, dsW, rowH, 'FD');

                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(cellFontSize);
                    doc.setTextColor(...st.textColor);
                    doc.text(st.text, x0 + dsW / 2, y0 + rowH / 2 + 1, { align: 'center', baseline: 'middle' });
                    doc.setTextColor(0);
                }

                y += rowH;
            };

            // --- Render ---
            drawLegend();

            // New page if barely any space left
            if (y + headerH + rowH > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                y = margin;
            }

            drawHeader();

            for (let ai = 0; ai < assets.length; ai++) {
                if (y + rowH > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                    drawHeader();
                }
                drawRow(assets[ai]);
            }

            y += 4;
        };

        return {
            margin,
            get pageW() { return doc.internal.pageSize.getWidth(); },
            get pageH() { return doc.internal.pageSize.getHeight(); },
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
            addTableGrid,
            addImpactMatrixTable
        };
    }

    // =============================================================
    // Expose via namespace
    // =============================================================
    window.ReportPdfBuilder = {
        createPdfDoc,
        pdfBuilder
    };
})();
