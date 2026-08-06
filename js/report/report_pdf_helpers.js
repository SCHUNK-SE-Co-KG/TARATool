/**
 * @file        report_pdf_helpers.js
 * @description Graphviz rendering and utility functions for PDF reports
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

(function () {
  'use strict';

  // =============================================================
  // Graphviz rendering (DOT -> SVG) for PDF embedding
  // =============================================================
  // Primary: local @hpcc-js/wasm (offline / file:// / corporate firewall).
  // Fallback: Kroki / QuickChart (online only; DOT leaves the browser).
  const GRAPHVIZ_RENDERERS = [
    {
      name: 'Kroki',
      url: 'https://kroki.io/graphviz/svg',
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: (dot) => dot,
    },
    {
      name: 'QuickChart',
      url: 'https://quickchart.io/graphviz',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: (dot) => JSON.stringify({ graph: dot, format: 'svg', layout: 'dot' }),
    },
  ];

  let _localGraphviz = null;
  let _localGraphvizLoading = null;

  async function _getLocalGraphviz() {
    if (_localGraphviz) return _localGraphviz;
    if (_localGraphvizLoading) return _localGraphvizLoading;

    _localGraphvizLoading = (async () => {
      // Module import in index.html is async – wait briefly if not ready yet
      let Graphviz = window.GraphvizLib && window.GraphvizLib.Graphviz;
      if (!Graphviz) {
        for (let i = 0; i < 40 && !Graphviz; i++) {
          await new Promise((r) => setTimeout(r, 100));
          Graphviz = window.GraphvizLib && window.GraphvizLib.Graphviz;
        }
      }
      if (!Graphviz) {
        console.warn('[report] GraphvizLib not available (CDN/WASM not loaded).');
        return null;
      }
      try {
        // hpcc-js/wasm: Graphviz.load() (Promise) — older builds may expose .load as Promise
        const loaded =
          typeof Graphviz.load === 'function' ? await Graphviz.load() : await Graphviz.load;
        if (loaded && (typeof loaded.dot === 'function' || typeof loaded.layout === 'function')) {
          _localGraphviz = loaded;
          return loaded;
        }
      } catch (e) {
        console.warn('[report] Local Graphviz WASM failed to load:', e);
      }
      return null;
    })();

    try {
      return await _localGraphvizLoading;
    } finally {
      _localGraphvizLoading = null;
    }
  }

  async function _renderDotLocal(dotString) {
    const gv = await _getLocalGraphviz();
    if (!gv) return null;
    try {
      let svg = null;
      if (typeof gv.layout === 'function') {
        svg = gv.layout(dotString, 'svg', 'dot');
      } else if (typeof gv.dot === 'function') {
        svg = gv.dot(dotString);
      }
      if (svg && String(svg).includes('<svg')) return String(svg);
    } catch (e) {
      console.warn('[report] Local Graphviz layout failed:', e);
    }
    return null;
  }

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

    // 1) Local WASM first (works offline / behind firewall)
    const localSvg = await _renderDotLocal(dotString);
    if (localSvg) return localSvg;

    // 2) Online fallbacks
    for (const r of GRAPHVIZ_RENDERERS) {
      try {
        const res = await _fetchWithTimeout(
          r.url,
          {
            method: r.method,
            headers: r.headers,
            body: r.body(dotString),
          },
          25000
        );
        if (!res || !res.ok) continue;
        const txt = await res.text();
        if (txt && txt.includes('<svg')) return txt;
      } catch (_) {
        // try next renderer
      }
    }
    return null;
  }

  async function svgTextToPng(svgText, targetPxWidth = 3600, jpegQuality = 0.95, opts = {}) {
    // Rasterizes Graphviz SVG for PDF embedding.
    // Sharpness first (high JPEG / optional PNG), memory via canvas caps + cleanup.
    // Returns { dataUrl, widthPx, heightPx, format } or null.
    if (!svgText || !svgText.includes('<svg')) return null;

    const preferJpeg = opts.preferJpeg !== false;
    const MAX_SIDE = opts.maxSide || 6000;
    const MAX_AREA = opts.maxArea || 12 * 1000 * 1000; // ~12 MP
    const MAX_PNG_BYTES = 6 * 1024 * 1024;

    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    let canvas = null;
    let img = null;

    try {
      img = new Image();
      const loaded = await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('SVG image load failed'));
        img.src = url;
      });
      void loaded;

      const w = img.naturalWidth || img.width || 1;
      const h = img.naturalHeight || img.height || 1;

      let scale = (targetPxWidth > 0 ? targetPxWidth : w) / w;
      if (w * scale > MAX_SIDE) scale = MAX_SIDE / w;
      if (h * scale > MAX_SIDE) scale = MAX_SIDE / h;
      if (w * scale * (h * scale) > MAX_AREA) {
        scale = Math.sqrt(MAX_AREA / (w * h));
      }

      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));

      canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
      if (!ctx) return null;

      // Line-art / text: no soft blur when scaling SVG → canvas
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      let format = 'JPEG';
      let dataUrl = null;
      if (preferJpeg) {
        dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      } else {
        dataUrl = canvas.toDataURL('image/png');
        if (!dataUrl || dataUrl.length > MAX_PNG_BYTES) {
          const jpg = canvas.toDataURL('image/jpeg', jpegQuality);
          if (jpg) {
            dataUrl = jpg;
            format = 'JPEG';
          } else format = 'PNG';
        } else {
          format = 'PNG';
        }
      }
      if (!dataUrl) return null;

      return { dataUrl, widthPx: cw, heightPx: ch, format };
    } catch (_) {
      return null;
    } finally {
      try {
        URL.revokeObjectURL(url);
      } catch (_) {
        /* noop */
      }
      try {
        if (img) {
          img.onload = null;
          img.onerror = null;
          img.src = '';
        }
      } catch (_) {
        /* noop */
      }
      try {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch (_) {
        /* noop */
      }
      canvas = null;
      img = null;
    }
  }

  /**
   * Adaptive print DPI for A3 tree pages.
   * Floor stays high enough for readable node text; only slight drop for many trees.
   */
  function treeRasterDpi(treeCount) {
    const n = Number(treeCount) || 1;
    if (n >= 12) return 250;
    if (n >= 8) return 270;
    if (n >= 4) return 290;
    return 300;
  }

  function yieldToUi() {
    // Short pause so GC can reclaim canvas/dataURL between trees
    return new Promise((resolve) => setTimeout(resolve, 40));
  }

  // NOTE: We keep the conversion intentionally dependency-free (no svg2pdf).
  // Graphviz SVG is converted to JPEG via canvas and embedded using doc.addImage.

  // =============================================================
  // General Utility Functions
  // =============================================================

  // Delegates to the global getActiveAnalysis() from utils.js
  // (kept as local alias for backward-compatible ReportHelpers.getActiveAnalysis namespace)

  function riskClassFromValue(rVal) {
    // Delegates to the global getRiskMeta() (utils.js) for single source of truth
    const meta = getRiskMeta(rVal);
    return { label: meta.label, color: meta.colorRGB || [127, 140, 141] };
  }

  function formatDate(iso) {
    if (!iso) return '';
    // Expects YYYY-MM-DD
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
    if (typeof window.getDisplayDamageScenarios === 'function') {
      return window.getDisplayDamageScenarios(analysis);
    }
    let displayDS = JSON.parse(JSON.stringify(DEFAULT_DAMAGE_SCENARIOS || []));
    const defaultIds = new Set(displayDS.map((d) => d.id));
    if (analysis && Array.isArray(analysis.damageScenarios)) {
      analysis.damageScenarios.forEach((ds) => {
        if (!defaultIds.has(ds.id)) displayDS.push(ds);
      });
    }
    displayDS.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
    );
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

  function sanitizePdfText(input, preserveNewlines) {
    let s = String(input ?? '');

    // Unescape common HTML entities (data may arrive HTML-escaped)
    s = s.replace(/&amp;/g, '&');
    s = s.replace(/&lt;/g, '<');
    s = s.replace(/&gt;/g, '>');
    s = s.replace(/&quot;/g, '"');
    s = s.replace(/&#0?39;/g, "'");

    // Replace problematic glyphs (WinAnsi/Helvetica) for better print readability
    s = s.replace(/\u00A0/g, ' '); // NBSP
    s = s.replace(/[→⇒]/g, '\u00BB'); // » (WinAnsi 0xBB) – jsPDF 4.x has issues with >
    s = s.replace(/[←⇐]/g, '\u00AB'); // « (WinAnsi 0xAB)
    s = s.replace(/->/g, '\u00BB'); // ASCII arrow -> to »
    s = s.replace(/<-/g, '\u00AB'); // ASCII arrow <- to «
    s = s.replace(/[–—−]/g, '-');
    s = s.replace(/[""„‟]/g, '"');
    s = s.replace(/[''‚‛]/g, "'");
    s = s.replace(/…/g, '...');
    s = s.replace(/[•·]/g, '*');
    s = s.replace(/›/g, '/');

    // Collapse whitespace but optionally preserve line breaks
    if (preserveNewlines) {
      s = s.replace(/[^\S\n]+/g, ' '); // collapse horizontal WS only
      s = s.replace(/\n{3,}/g, '\n\n'); // max 2 consecutive newlines
      s = s.trim();
    } else {
      s = s.replace(/\s+/g, ' ').trim();
    }

    // Replace non-Latin1 chars (code > 255), which can show up as black boxes
    s = Array.from(s)
      .map((ch) => (ch.charCodeAt(0) <= 255 ? ch : '?'))
      .join('');
    return s;
  }

  // Delegates to global computeRiskScore() (utils.js) — signature kept for backward compatibility
  function riskNum(iNorm, k, s, t, u) {
    return computeRiskScore(iNorm, { k, s, t, u });
  }

  // =============================================================
  // Expose via namespace
  // =============================================================
  window.ReportHelpers = {
    renderDotToSvg,
    svgTextToPng,
    treeRasterDpi,
    yieldToUi,
    getActiveAnalysis,
    riskClassFromValue,
    formatDate,
    sanitizeFilename,
    getDisplayDamageScenarios,
    kstuToString,
    fmtNumComma,
    pVec,
    sanitizePdfText,
    riskNum,
  };
})();
