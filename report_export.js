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
        let y = margin;

        // Globale Abstaende (PDF) – bewusst etwas luftiger, ohne das Web-Layout zu beeinflussen
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
            // mehr Abstand um Trennlinien (bessere Lesbarkeit)
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
            // Dynamische Spaltenbreite fuer den Key (verhindert Ueberlappung bei langen Labels,
            // z.B. "Autor / Verantwortlich")
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

        // Minimaler, robuster Tabellenrenderer (ohne AutoTable)
        const addTable = (headers, rows, colWidths) => {
            if (!Array.isArray(headers) || headers.length === 0) return;
            if (!Array.isArray(rows)) rows = [];

            const totalW = doc.internal.pageSize.getWidth() - margin * 2;
            const widths = Array.isArray(colWidths) && colWidths.length === headers.length
                ? colWidths
                : headers.map(() => totalW / headers.length);

            // Skaliere Spaltenbreiten auf verfügbare Seitenbreite (ganze Seite nutzen)
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


        // Tabellenrenderer mit Rahmen (grid), wiederholtem Header und Zebra-Striping
        // Nutzt die gesamte Seitenbreite (innerhalb der PDF-Margins) und optimiert auf Lesbarkeit.
        const addTableGrid = (headers, rows, colWidths, options = {}) => {
            if (!Array.isArray(headers) || headers.length === 0) return;
            if (!Array.isArray(rows)) rows = [];

            const totalW = doc.internal.pageSize.getWidth() - margin * 2;
            const widths = Array.isArray(colWidths) && colWidths.length === headers.length
                ? colWidths
                : headers.map(() => totalW / headers.length);

            // Skaliere Spaltenbreiten auf verfügbare Seitenbreite (ganze Seite nutzen)
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
                    // Hintergrund (hell) + Rahmen
                    doc.setFillColor(...opt.headerFill);
                    doc.rect(xPos[i], y, widths[i], headerH, 'F');
                    doc.rect(xPos[i], y, widths[i], headerH, 'S');

                    // Text (explizit dunkel)
                    doc.setTextColor(...opt.headerTextColor);
                    doc.text(headerLines[i] || [''], xPos[i] + opt.cellPadX, y + opt.cellPadY + opt.lineH - 0.8);
                }

                // zurück auf Standard-Textfarbe
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
                    // Hintergrund + Rahmen (pro Zelle) -> druckfreundlich, keine "schwarzen Kästen"
                    doc.rect(xPos[i], y, widths[i], rowH, 'F');
                    doc.rect(xPos[i], y, widths[i], rowH, 'S');

                    doc.text(wrapped[i] || [''], xPos[i] + opt.cellPadX, y + opt.cellPadY + opt.lineH - 0.8);
                }

                doc.setTextColor(0);

                y += rowH;
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

            const totalW = doc.internal.pageSize.getWidth() - margin * 2;
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
                if (y + headerH + rowH > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                }

                let dsW = drawHeader(dsSubset, bi, blocks.length);

                // Rows (mit Seitenumbruechen + wiederholtem Header)
                for (let ai = 0; ai < assets.length; ai++) {
                    if (y + rowH > doc.internal.pageSize.getHeight() - margin) {
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
            const sorted = [...risks].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
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


        // Visualisierung Angriffsbäume (A3 Querformat) – je Baum eine Seite
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
                        if (typeof showToast === 'function') showToast('Erzeuge Angriffsbaum (SVG)… ' + (entry.id || ''), 'info');
                        svgText = await _renderDotToSvg(dotContent);
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
                const margin = pdf.margin;

                // Title
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(18);
                doc.setTextColor(0);
                doc.text('Angriffsbaum ' + (entry.id || '') + ': ' + (entry.rootName || ''), margin, margin);
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

                const topY = margin + 10;
                const availW = pageW - margin * 2;
                const availH = pageH - topY - margin;

                if (svgText && svgText.includes('<svg')) {
                    let png = null;
                    try { png = await _svgTextToPng(svgText, 3800); } catch (e) { png = null; }
                    if (png && png.dataUrl) {
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
            }

            // Reset builder state (next chapter will add an A4 portrait page explicitly)
            doc.setTextColor(0);
            doc.setFont('helvetica', 'normal');
            pdf.setY(pdf.margin);
        }

        // =============================================================
        // Security Objectives (Kapitel)
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
        // Restrisikoanalyse (Kapitel)
        // =============================================================
        try {
            if (typeof ensureResidualRiskSynced === 'function') {
                ensureResidualRiskSynced(analysis);
            } else if (typeof syncResidualRiskFromRiskAnalysis === 'function') {
                syncResidualRiskFromRiskAnalysis(analysis, false);
            }
        } catch (_) { /* noop */ }
        // Bewertung der Restrisiken (Tabellarisch)
        try {
            doc.addPage('a4', 'landscape');
        } catch (_) {
            doc.addPage();
        }
        pdf.setY(pdf.margin);
        pdf.addH1('Restrisikoanalyse');
        pdf.addH2('Bewertung der Restrisiken');
        const rrEntries = (analysis.residualRisk && Array.isArray(analysis.residualRisk.entries)) ? analysis.residualRisk.entries : [];

        const _fmtNumComma = (val, digits = 2) => {
            const n = parseFloat(String(val ?? '').replace(',', '.'));
            if (isNaN(n)) return '-';
            return n.toFixed(digits).replace('.', ',');
        };

        const _pVec = (k, s, t, u) => {
            const f = (x) => {
                if (x === null || x === undefined) return '-';
                const xs = String(x).trim();
                if (!xs) return '-';
                return xs.replace('.', ',');
            };
            return `${f(k)} / ${f(s)} / ${f(t)} / ${f(u)}`;
        };
        const _sanitizePdfText = (input) => {
            let s = String(input ?? '');
            // Replace problematic glyphs (WinAnsi/Helvetica) for better print readability
            s = s.replace(/\u00A0/g, ' ');            // NBSP
            s = s.replace(/[→⇒]/g, '->');
            s = s.replace(/[←⇐]/g, '<-');
            s = s.replace(/[–—−]/g, '-');
            s = s.replace(/[“”„‟]/g, '"');
            s = s.replace(/[’‘‚‛]/g, "'");
            s = s.replace(/…/g, '...');
            s = s.replace(/[•·]/g, '*');
            s = s.replace(/›/g, '/');
            s = s.replace(/\s+/g, ' ').trim();

            // Replace non-Latin1 chars (code > 255), which can show up as black boxes
            s = Array.from(s).map(ch => (ch.charCodeAt(0) <= 255 ? ch : '?')).join('');
            return s;
        };


        const _riskNum = (iNorm, k, s, t, u) => {
            const i = parseFloat(String(iNorm ?? '').replace(',', '.')) || 0;
            const kk = parseFloat(String(k ?? '').replace(',', '.')) || 0;
            const ss = parseFloat(String(s ?? '').replace(',', '.')) || 0;
            const tt = parseFloat(String(t ?? '').replace(',', '.')) || 0;
            const uu = parseFloat(String(u ?? '').replace(',', '.')) || 0;
            return i * (kk + ss + tt + uu);
        };

        if (!rrEntries || rrEntries.length === 0 || typeof rrIterateLeaves !== 'function') {
            pdf.addText('Keine Restrisikoanalyse-Daten vorhanden.');
        } else {
            const rows = [];

            rrEntries.forEach((rrEntry) => {
                if (!rrEntry) return;
                const treeId = (rrEntry.id || rrEntry.uid || '').toString();
                const origEntry = (analysis.riskEntries || []).find(e => String(e.id) === String(rrEntry.id));
                const rootName = _sanitizePdfText((rrEntry.rootName || origEntry?.rootName || rrEntry.name || rrEntry.root || '').toString());

                // Map leafKey -> original leaf (so R/RR can fall back correctly even if rrEntry has missing KSTU)
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
                    const impactName =                    (path ? (path + ' -> ') : '') + (leafText || '(ohne Text)');

                    const iNorm = (oLeaf.i_norm !== undefined && oLeaf.i_norm !== null && String(oLeaf.i_norm).trim() !== '')
                        ? oLeaf.i_norm
                        : ((origEntry && origEntry.i_norm !== undefined && origEntry.i_norm !== null && String(origEntry.i_norm).trim() !== '')
                            ? origEntry.i_norm
                            : ((rrEntry.i_norm !== undefined && rrEntry.i_norm !== null && String(rrEntry.i_norm).trim() !== '')
                                ? rrEntry.i_norm
                                : (leaf.i_norm !== undefined ? leaf.i_norm : '')));

                    // Original
                    const oRnum = _riskNum(iNorm, oLeaf.k, oLeaf.s, oLeaf.t, oLeaf.u);
                    const oR = isNaN(oRnum) ? '-' : _fmtNumComma(oRnum, 2);

                    // Residual: bei Mitigiert -> rr.K/S/T/U sofern gesetzt
                    const pick = (orig, rrVal) => {
                        const rrs = (rrVal === null || rrVal === undefined) ? '' : String(rrVal).trim();
                        if (treatment === 'Mitigiert' && rrs) return rrs;
                        return (orig === null || orig === undefined) ? '' : String(orig);
                    };

                    const rk = pick(oLeaf.k, rr.k);
                    const rs = pick(oLeaf.s, rr.s);
                    const rt = pick(oLeaf.t, rr.t);
                    const ru = pick(oLeaf.u, rr.u);

                    const rrNum = _riskNum(iNorm, rk, rs, rt, ru);
                    const rrVal = isNaN(rrNum) ? '-' : _fmtNumComma(rrNum, 2);
                    const rrClass = isNaN(rrNum) ? 'Unbekannt' : _riskClassFromValue(rrNum).label;

                    const prrVec = (treatment === 'Mitigiert') ? _pVec(rk, rs, rt, ru) : '-';

                    const treeRefId = _sanitizePdfText(treeId);
                    const impactText = _sanitizePdfText(String(impactName || ''));

                    // RR: bei Akzeptiert/Delegiert/leer soll RR = R sein
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
                // Menschenlesbare Tabelle: ganze Breite, Rahmen, Zebra-Striping
                // Spaltenbreiten (mm) für Querformat-A4:
                // - R und RR jeweils 1,5x breiter
                // - Maßnahme und Anmerkung ebenfalls 1,5x breiter
                // -> übrige Breite wird aus "Baum Name" und "Auswirkung" genommen, damit die Gesamttabelle weiterhin die Seitenbreite ausnutzt.
                 pdf.addTableGrid(
                    ['', 'Baum Name', 'Auswirkung', 'Behandlung', 'R', 'RR', 'Maßnahme', 'Anmerkung'],
                    rows,
                    [14, 22, 35, 20, 11, 11, 77, 77],
                    { zebra: true, noWrapCols: [0,3,4,5], headerFill: [250,250,250], headerTextColor: [20,20,20], zebraFill: [252,252,252], borderColor: [190,190,190], headerFontSize: 10, cellFontSize: 9 }
                );
}
        }


        // Visualisierung Restrisiko-Bäume (Querformat) – je Baum eine Seite
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
                        if (typeof showToast === 'function') showToast('Erzeuge Restrisiko-Baum (SVG)… ' + (entry.id || ''), 'info');
                        rrSvgText = await _renderDotToSvg(rrDot);
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
                    try { png = await _svgTextToPng(rrSvgText, 3800); } catch (e) { png = null; }
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

            // Reset builder state (next section switches to A4 explicitly)
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
