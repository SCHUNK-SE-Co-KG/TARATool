# CVE-Scan Report – TARATool

**Scan-Zeitpunkt:** 2026-03-18T06:18:04Z  
**Repository:** SCHUNK-SE-Co-KG/TARATool  
**Abhängigkeiten geprüft:** 9  
**Schwachstellen gefunden:** 2

> ⚠️ **2 Schwachstelle(n) gefunden!**

## Geprüfte Abhängigkeiten

| Paket | Version | Ökosystem | Quelle |
|-------|---------|-----------|--------|
| @fortawesome/fontawesome-free | 6.5.1 | npm | index.html |
| jszip | 3.10.1 | npm | index.html |
| jspdf | 4.2.0 | npm | index.html |
| pytest | 8.0 | PyPI | tests/requirements.txt |
| pytest-playwright | 0.5 | PyPI | tests/requirements.txt |
| playwright | 1.40 | PyPI | tests/requirements.txt |
| pytest-html | 4.0 | PyPI | tests/requirements.txt |
| pytest-xdist | 3.5 | PyPI | tests/requirements.txt |
| pytest-timeout | 2.2 | PyPI | tests/requirements.txt |

## Gefundene Schwachstellen

### GHSA-7x6v-j9x4-qf24

- **Paket:** npm:jspdf@4.2.0
- **CVSS-Score:** 8.1 🔴
- **Schweregrad:** CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N
- **CVE:** CVE-2026-31898
- **Beschreibung:** jsPDF has a PDF Object Injection via FreeText color
- **Fix-Version:** 4.2.1
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-7x6v-j9x4-qf24
  - https://github.com/parallax/jsPDF/commit/4155c4819d5eca284168e51e0e1e81126b4f14b8
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.2.1

### GHSA-wfv2-pwc8-crg5

- **Paket:** npm:jspdf@4.2.0
- **CVSS-Score:** 9.6 🔴
- **Schweregrad:** CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:L
- **CVE:** CVE-2026-31938
- **Beschreibung:** jsPDF has HTML Injection in New Window paths
- **Fix-Version:** 4.2.1
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-wfv2-pwc8-crg5
  - https://github.com/parallax/jsPDF/commit/87a40bbd07e6b30575196370670b41f264aa78d7
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.2.1

---
*Automatisch generiert von `security/cve_scanner.py` via [OSV.dev](https://osv.dev).*
