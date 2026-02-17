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
 * Generates a CycloneDX 1.5 SBOM compliant with BSI TR-03183-2.
 * @returns {Object} CycloneDX BOM object
 */
function generateCycloneDxSbom() {
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
                "description": "Browser-basiertes Werkzeug für Bedrohungs- und Risikoanalysen (TARA) im Kontext des EU Cyber Resilience Act (CRA)",
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
                    { "type": "other",      "url": "https://kroki.io/",           "comment": "Externer Render-Service für DOT/Graphviz (primär)" },
                    { "type": "other",      "url": "https://quickchart.io/graphviz", "comment": "Externer Render-Service für DOT/Graphviz (Fallback)" }
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
                "description": "The iconic SVG, font, and CSS toolkit – Icons für die Benutzeroberfläche",
                "licenses": [
                    { "license": { "id": "MIT",        "text": { "content": "Code-Lizenz" } } },
                    { "license": { "id": "OFL-1.1",    "text": { "content": "Font-Lizenz" } } },
                    { "license": { "id": "CC-BY-4.0",  "text": { "content": "Icon-Lizenz" } } }
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
                "description": "HPCC Systems WASM-Wrapper für Graphviz – DOT-Rendering der Angriffsbäume im Browser",
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
                "version": "2.5.1",
                "description": "Client-seitige PDF-Generierung – Erzeugung des TARA-PDF-Reports",
                "licenses": [{ "license": { "id": "MIT" } }],
                "purl": "pkg:npm/jspdf@2.5.1",
                "scope": "required",
                "externalReferences": [
                    { "type": "website",      "url": "https://github.com/parallax/jsPDF" },
                    { "type": "distribution", "url": "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" }
                ]
            },
            {
                "type": "library",
                "name": "JSZip",
                "version": "3.10.1",
                "description": "JavaScript-Bibliothek für ZIP-Archive – Export von Baumdaten als ZIP",
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
        return `<tr>
            <td><a href="${link}" target="_blank" rel="noopener" title="${c.description || ''}">${c.name}</a></td>
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
                Browser-basiertes Werkzeug für Bedrohungs- und Risikoanalysen (TARA)<br>
                im Kontext des <strong>EU Cyber Resilience Act (CRA)</strong>
            </p>
        </div>

        <div class="about-meta-grid">
            <div class="about-meta-item">
                <i class="fas fa-user"></i>
                <div><strong>Autor</strong><br>Nico Peper</div>
            </div>
            <div class="about-meta-item">
                <i class="fas fa-building"></i>
                <div><strong>Organisation</strong><br>SCHUNK SE &amp; Co. KG</div>
            </div>
            <div class="about-meta-item">
                <i class="fas fa-gavel"></i>
                <div><strong>Lizenz</strong><br><a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener">GPL-3.0</a></div>
            </div>
            <div class="about-meta-item">
                <i class="fab fa-github"></i>
                <div><strong>Repository</strong><br><a href="https://github.com/SCHUNK-SE-Co-KG/TARATool" target="_blank" rel="noopener">SCHUNK-SE-Co-KG/TARATool</a></div>
            </div>
        </div>

        <div class="about-methodology">
            <i class="fas fa-calculator"></i>
            <div>
                <strong>Methodik:</strong> SCHASAM – R = I<sub>norm</sub> × (K + S + T + U)<br>
                <span style="color:#777; font-size:0.85em;">Komplexität, Skalierung, Zeitaufwand, Nutzen</span>
            </div>
        </div>

        <hr class="about-divider">

        <div class="about-sbom-section">
            <div class="about-sbom-header">
                <div>
                    <h3 style="margin:0;"><i class="fas fa-list-check"></i> Software Bill of Materials (SBOM)</h3>
                    <p style="margin:4px 0 0; color:#777; font-size:0.85em;">
                        Konform mit <strong>BSI TR-03183-2</strong> – Format: CycloneDX 1.5
                    </p>
                </div>
                <button onclick="downloadSbom()" class="action-button small" title="SBOM als CycloneDX-JSON herunterladen">
                    <i class="fas fa-download"></i> SBOM exportieren
                </button>
            </div>

            <table class="about-sbom-table">
                <thead>
                    <tr>
                        <th>Komponente</th>
                        <th>Version</th>
                        <th>Lizenz</th>
                        <th>Scope</th>
                        <th>PURL</th>
                    </tr>
                </thead>
                <tbody>
                    ${_buildSbomTableRows()}
                </tbody>
            </table>

            <div class="about-sbom-footer">
                <i class="fas fa-info-circle"></i>
                <span>
                    Die SBOM wird gemäß <strong>BSI TR-03183-2</strong> im CycloneDX-1.5-Format bereitgestellt. 
                    Alle Abhängigkeiten werden über CDN geladen – es gibt keine lokalen node_modules und keinen Build-Prozess.
                    Externe Render-Dienste (Kroki, QuickChart) werden nur für die Graphviz-Vorschau genutzt.
                </span>
            </div>
        </div>
    `;

    modal.style.display = 'block';
}

/**
 * Closes the About modal.
 */
function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.style.display = 'none';
}

// Expose globally
window.openAboutModal  = openAboutModal;
window.closeAboutModal = closeAboutModal;
window.downloadSbom    = downloadSbom;
window.generateCycloneDxSbom = generateCycloneDxSbom;
window.TARA_TOOL_VERSION = TARA_TOOL_VERSION;
