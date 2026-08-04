/**
 * @file        about.js
 * @description About-Dialog mit Projektinformationen und SBOM (TR-03183-2 konform)
 * @author      Nico Peper
 * @organization SCHUNK SE & Co. KG
 * @copyright   2026 SCHUNK SE & Co. KG
 * @license     GPL-3.0
 */

const TARA_TOOL_VERSION = '1.0.0';

/**
 * @returns {'de'|'en'}
 */
function _aboutLang() {
    return (window.TaraPrefs && TaraPrefs.getLang && TaraPrefs.getLang() === 'en') ? 'en' : 'de';
}

/**
 * Generates a CycloneDX 1.5 SBOM compliant with BSI TR-03183-2.
 * Descriptions follow the current UI language.
 * @returns {Object} CycloneDX BOM object
 */
function generateCycloneDxSbom() {
    const en = _aboutLang() === 'en';
    return {
        "$schema": "http://cyclonedx.org/schema/bom-1.5.schema.json",
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": "urn:uuid:" + crypto.randomUUID(),
        "version": 1,
        "metadata": {
            "timestamp": new Date().toISOString(),
            "tools": [
                {
                    "vendor": "SCHUNK SE & Co. KG",
                    "name": "TARA Tool",
                    "version": TARA_TOOL_VERSION
                }
            ],
            "component": {
                "type": "application",
                "name": "TARATool",
                "version": TARA_TOOL_VERSION,
                "description": en
                    ? "Browser-based tool for threat and risk analyses (TARA) in the context of the EU Cyber Resilience Act (CRA)"
                    : "Browser-basiertes Werkzeug für Bedrohungs- und Risikoanalysen (TARA) im Kontext des EU Cyber Resilience Act (CRA)",
                "licenses": [{ "license": { "id": "GPL-3.0-only" } }],
                "supplier": {
                    "name": "SCHUNK SE & Co. KG",
                    "url": ["https://www.schunk.com"]
                },
                "author": "Nico Peper",
                "purl": "pkg:github/SCHUNK-SE-Co-KG/TARATool@" + TARA_TOOL_VERSION,
                "externalReferences": [
                    { "type": "website",    "url": "https://github.com/SCHUNK-SE-Co-KG/TARATool" },
                    { "type": "vcs",        "url": "https://github.com/SCHUNK-SE-Co-KG/TARATool.git" },
                    { "type": "license",    "url": "https://www.gnu.org/licenses/gpl-3.0.html" },
                    { "type": "other",      "url": "https://kroki.io/",
                      "comment": en ? "External render service for DOT/Graphviz (primary)" : "Externer Render-Service für DOT/Graphviz (primär)" },
                    { "type": "other",      "url": "https://quickchart.io/graphviz",
                      "comment": en ? "External render service for DOT/Graphviz (fallback)" : "Externer Render-Service für DOT/Graphviz (Fallback)" }
                ]
            },
            "manufacture": {
                "name": "SCHUNK SE & Co. KG",
                "url": ["https://www.schunk.com"]
            }
        },
        "components": [
            {
                "type": "library",
                "name": "Font Awesome Free",
                "version": "6.5.1",
                "description": en
                    ? "The iconic SVG, font, and CSS toolkit – UI icons"
                    : "The iconic SVG, font, and CSS toolkit – Icons für die Benutzeroberfläche",
                "licenses": [
                    { "license": { "id": "MIT",        "text": { "content": en ? "Code license" : "Code-Lizenz" } } },
                    { "license": { "id": "OFL-1.1",    "text": { "content": en ? "Font license" : "Font-Lizenz" } } },
                    { "license": { "id": "CC-BY-4.0",  "text": { "content": en ? "Icon license" : "Icon-Lizenz" } } }
                ],
                "purl": "pkg:npm/%40fortawesome/fontawesome-free@6.5.1",
                "scope": "required",
                "externalReferences": [
                    { "type": "website",      "url": "https://fontawesome.com/" },
                    { "type": "distribution", "url": "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" }
                ]
            },
            {
                "type": "library",
                "name": "@hpcc-js/wasm",
                "version": "latest",
                "description": en
                    ? "HPCC Systems WASM wrapper for Graphviz – in-browser DOT rendering of attack trees"
                    : "HPCC Systems WASM-Wrapper für Graphviz – DOT-Rendering der Angriffsbäume im Browser",
                "licenses": [{ "license": { "id": "Apache-2.0" } }],
                "purl": "pkg:npm/%40hpcc-js/wasm",
                "scope": "required",
                "externalReferences": [
                    { "type": "website",      "url": "https://github.com/hpcc-systems/hpcc-js-wasm" },
                    { "type": "distribution", "url": "https://cdn.jsdelivr.net/npm/@hpcc-js/wasm/dist/index.js" }
                ]
            },
            {
                "type": "library",
                "name": "jsPDF",
                "version": "4.2.1",
                "description": en
                    ? "Client-side PDF generation – TARA PDF report"
                    : "Client-seitige PDF-Generierung – Erzeugung des TARA-PDF-Reports",
                "licenses": [{ "license": { "id": "MIT" } }],
                "purl": "pkg:npm/jspdf@4.2.1",
                "scope": "required",
                "externalReferences": [
                    { "type": "website",      "url": "https://github.com/parallax/jsPDF" },
                    { "type": "distribution", "url": "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js" }
                ]
            },
            {
                "type": "library",
                "name": "JSZip",
                "version": "3.10.1",
                "description": en
                    ? "JavaScript library for ZIP archives – tree data ZIP export"
                    : "JavaScript-Bibliothek für ZIP-Archive – Export von Baumdaten als ZIP",
                "licenses": [
                    { "license": { "id": "MIT" } },
                    { "license": { "id": "GPL-3.0-only" } }
                ],
                "purl": "pkg:npm/jszip@3.10.1",
                "scope": "required",
                "externalReferences": [
                    { "type": "website",      "url": "https://stuk.github.io/jszip/" },
                    { "type": "distribution", "url": "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" }
                ]
            }
        ]
    };
}

/**
 * Downloads the CycloneDX SBOM as a JSON file.
 */
function downloadSbom() {
    const sbom = generateCycloneDxSbom();
    const json = JSON.stringify(sbom, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `TARATool_SBOM_CycloneDX_${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Builds the SBOM component table rows.
 */
function _buildSbomTableRows() {
    const comps = generateCycloneDxSbom().components;
    return comps.map(c => {
        const licenses = c.licenses.map(l => l.license.id).join(', ');
        const distRef  = (c.externalReferences || []).find(r => r.type === 'distribution');
        const webRef   = (c.externalReferences || []).find(r => r.type === 'website');
        const link     = webRef ? webRef.url : (distRef ? distRef.url : '#');
        const tip = String(c.description || '').replace(/"/g, '&quot;');
        return `<tr>
            <td><a href="${link}" target="_blank" rel="noopener" title="${tip}">${c.name}</a></td>
            <td>${c.version}</td>
            <td><code>${licenses}</code></td>
            <td>${c.scope || '–'}</td>
            <td style="font-size:0.75em; word-break:break-all;"><code>${c.purl}</code></td>
        </tr>`;
    }).join('');
}

/**
 * Opens the About modal.
 */
function openAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (!modal) return;

    const _t = (key, fallback) => (typeof t === 'function' ? t(key) : fallback);

    document.getElementById('aboutBodyContent').innerHTML = `
        <div class="about-header-block">
            <div class="about-title-row">
                <i class="fas fa-shield-alt about-icon"></i>
                <div>
                    <h2 style="margin:0;">TARA Tool</h2>
                    <span class="about-version-badge">v${TARA_TOOL_VERSION}</span>
                </div>
            </div>
            <p class="about-tagline">
                ${_t('about.tagline', 'Browser-basiertes Werkzeug für Bedrohungs- und Risikoanalysen (TARA)<br>im Kontext des <strong>EU Cyber Resilience Act (CRA)</strong>')}
            </p>
        </div>

        <div class="about-meta-grid">
            <div><strong>${_t('about.author', 'Autor')}:</strong> Nico Peper</div>
            <div><strong>${_t('about.org', 'Organisation')}:</strong> SCHUNK SE &amp; Co. KG</div>
            <div><strong>${_t('about.license', 'Lizenz')}:</strong> GPL-3.0</div>
            <div><strong>${_t('about.repo', 'Repository')}:</strong>
                <a href="https://github.com/SCHUNK-SE-Co-KG/TARATool" target="_blank" rel="noopener">GitHub</a>
            </div>
        </div>

        <div class="about-method-block">
            <strong>${_t('about.method', 'Methodik:')}</strong>
            <span style="color:#777; font-size:0.85em;">${_t('about.methodDetail', 'Komplexität, Skalierung, Zeitaufwand, Nutzen')}</span>
        </div>

        <div class="about-sbom-block">
            <div class="about-sbom-header">
                <div>
                    <h3 style="margin:0 0 4px 0;">${_t('about.sbomTitle', 'Software Bill of Materials (SBOM)')}</h3>
                    <p style="margin:0; font-size:0.85em; color:#666;">${_t('about.sbomSub', 'Konform mit <strong>BSI TR-03183-2</strong> – Format: CycloneDX 1.5')}</p>
                </div>
                <button type="button" class="action-button small" onclick="downloadSbom()"
                        title="${_t('about.sbomExportTip', 'SBOM als CycloneDX-JSON herunterladen')}">
                    <i class="fas fa-download"></i> ${_t('about.sbomExport', 'SBOM exportieren')}
                </button>
            </div>
            <div class="about-sbom-table-wrap">
                <table class="about-sbom-table">
                    <thead>
                        <tr>
                            <th>${_t('about.col.component', 'Komponente')}</th>
                            <th>${_t('about.col.version', 'Version')}</th>
                            <th>${_t('about.col.license', 'Lizenz')}</th>
                            <th>${_t('about.col.scope', 'Scope')}</th>
                            <th>${_t('about.col.purl', 'PURL')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${_buildSbomTableRows()}
                    </tbody>
                </table>
            </div>
            <p class="about-sbom-footer">
                ${_t('about.sbomFooter', 'Die SBOM wird gemäß <strong>BSI TR-03183-2</strong> im CycloneDX-1.5-Format bereitgestellt. Alle Abhängigkeiten werden über CDN geladen – es gibt keine lokalen node_modules und keinen Build-Prozess. Externe Render-Dienste (Kroki, QuickChart) werden nur für die Graphviz-Vorschau genutzt.')}
            </p>
        </div>
    `;

    modal.style.display = 'block';
}
