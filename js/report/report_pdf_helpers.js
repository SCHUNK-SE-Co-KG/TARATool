// =============================================================
// --- REPORT_PDF_HELPERS.JS: Graphviz-Rendering & Hilfsfunktionen ---
// =============================================================
// Stellt Utility-Funktionen für den PDF-Report bereit.
// Wird von report_pdf_builder.js und report_export.js verwendet.

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

    async function renderDotToSvg(dotString) {
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

    async function svgTextToPng(svgText, maxPxWidth = 3200) {
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

    // =============================================================
    // Allgemeine Hilfsfunktionen
    // =============================================================

    function getActiveAnalysis() {
        try {
            return analysisData.find(a => a.id === activeAnalysisId) || null;
        } catch (e) {
            return null;
        }
    }

    function riskClassFromValue(rVal) {
        const v = parseFloat(rVal);
        if (isNaN(v)) return { label: 'Unbekannt', color: [127, 140, 141] };
        if (v >= 2.0) return { label: 'Kritisch', color: [192, 57, 43] };
        if (v >= 1.6) return { label: 'Hoch', color: [230, 126, 34] };
        if (v >= 0.8) return { label: 'Mittel', color: [243, 156, 18] };
        return { label: 'Niedrig', color: [39, 174, 96] };
    }

    function formatDate(iso) {
        if (!iso) return '';
        // Erwartet YYYY-MM-DD
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return String(iso);
        return `${m[3]}.${m[2]}.${m[1]}`;
    }

    function sanitizeFilename(s) {
        return String(s || 'report')
            .trim()
            .replace(/[\\/?:*"<>|]+/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 80);
    }

    function getDisplayDamageScenarios(analysis) {
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

    function kstuToString(kstu) {
        if (!kstu) return '';
        const k = (kstu.k ?? '').toString();
        const s = (kstu.s ?? '').toString();
        const t = (kstu.t ?? '').toString();
        const u = (kstu.u ?? '').toString();
        return `K:${k}  S:${s}  T:${t}  U:${u}`;
    }

    function fmtNumComma(val, digits = 2) {
        const n = parseFloat(String(val ?? '').replace(',', '.'));
        if (isNaN(n)) return '-';
        return n.toFixed(digits).replace('.', ',');
    }

    function pVec(k, s, t, u) {
        const f = (x) => {
            if (x === null || x === undefined) return '-';
            const xs = String(x).trim();
            if (!xs) return '-';
            return xs.replace('.', ',');
        };
        return `${f(k)} / ${f(s)} / ${f(t)} / ${f(u)}`;
    }

    function sanitizePdfText(input) {
        let s = String(input ?? '');
        // Replace problematic glyphs (WinAnsi/Helvetica) for better print readability
        s = s.replace(/\u00A0/g, ' ');            // NBSP
        s = s.replace(/[→⇒]/g, '->');
        s = s.replace(/[←⇐]/g, '<-');
        s = s.replace(/[–—−]/g, '-');
        s = s.replace(/[""„‟]/g, '"');
        s = s.replace(/[''‚‛]/g, "'");
        s = s.replace(/…/g, '...');
        s = s.replace(/[•·]/g, '*');
        s = s.replace(/›/g, '/');
        s = s.replace(/\s+/g, ' ').trim();

        // Replace non-Latin1 chars (code > 255), which can show up as black boxes
        s = Array.from(s).map(ch => (ch.charCodeAt(0) <= 255 ? ch : '?')).join('');
        return s;
    }

    function riskNum(iNorm, k, s, t, u) {
        const i = parseFloat(String(iNorm ?? '').replace(',', '.')) || 0;
        const kk = parseFloat(String(k ?? '').replace(',', '.')) || 0;
        const ss = parseFloat(String(s ?? '').replace(',', '.')) || 0;
        const tt = parseFloat(String(t ?? '').replace(',', '.')) || 0;
        const uu = parseFloat(String(u ?? '').replace(',', '.')) || 0;
        return i * (kk + ss + tt + uu);
    }

    // =============================================================
    // Expose via namespace
    // =============================================================
    window.ReportHelpers = {
        renderDotToSvg,
        svgTextToPng,
        getActiveAnalysis,
        riskClassFromValue,
        formatDate,
        sanitizeFilename,
        getDisplayDamageScenarios,
        kstuToString,
        fmtNumComma,
        pVec,
        sanitizePdfText,
        riskNum
    };
})();
