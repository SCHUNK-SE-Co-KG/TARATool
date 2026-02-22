# CVE-Scan Report – TARATool

**Scan-Zeitpunkt:** 2026-02-22T06:11:15Z  
**Repository:** SCHUNK-SE-Co-KG/TARATool  
**Abhängigkeiten geprüft:** 9  
**Schwachstellen gefunden:** 3

> ⚠️ **3 Schwachstelle(n) gefunden!**

## Geprüfte Abhängigkeiten

| Paket | Version | Ökosystem | Quelle |
|-------|---------|-----------|--------|
| @fortawesome/fontawesome-free | 6.5.1 | npm | index.html |
| jszip | 3.10.1 | npm | index.html |
| jspdf | 4.1.0 | npm | index.html |
| pytest | 8.0 | PyPI | tests/requirements.txt |
| pytest-playwright | 0.5 | PyPI | tests/requirements.txt |
| playwright | 1.40 | PyPI | tests/requirements.txt |
| pytest-html | 4.0 | PyPI | tests/requirements.txt |
| pytest-xdist | 3.5 | PyPI | tests/requirements.txt |
| pytest-timeout | 2.2 | PyPI | tests/requirements.txt |

## Gefundene Schwachstellen

### GHSA-67pg-wm7f-q7fj

- **Paket:** npm:jspdf@4.1.0
- **CVSS-Score:** 8.7 🔴
- **Schweregrad:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N
- **CVE:** CVE-2026-25535
- **Beschreibung:** jsPDF Affected by Client-Side/Server-Side Denial of Service via Malicious GIF Dimensions
- **Fix-Version:** 4.2.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-67pg-wm7f-q7fj
  - https://github.com/parallax/jsPDF/commit/2e5e156e284d92c7d134bce97e6418756941d5e6
  - https://github.com/ZeroXJacks/CVEs/blob/main/2026/CVE-2026-25535.md
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.2.0

### GHSA-9vjf-qc39-jprp

- **Paket:** npm:jspdf@4.1.0
- **CVSS-Score:** 8.1 🔴
- **Schweregrad:** CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N
- **CVE:** CVE-2026-25755
- **Beschreibung:** jsPDF has a PDF Object Injection via Unsanitized Input in addJS Method
- **Fix-Version:** 4.2.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-9vjf-qc39-jprp
  - https://nvd.nist.gov/vuln/detail/CVE-2026-25755
  - https://github.com/parallax/jsPDF/commit/56b46d45b052346f5995b005a34af5dcdddd5437
  - https://github.com/ZeroXJacks/CVEs/blob/main/2026/CVE-2026-25755.md
  - https://github.com/parallax/jsPDF

### GHSA-p5xg-68wr-hm3m

- **Paket:** npm:jspdf@4.1.0
- **CVSS-Score:** 8.1 🔴
- **Schweregrad:** CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N
- **CVE:** CVE-2026-25940
- **Beschreibung:** jsPDF has a PDF Injection in AcroForm module allows Arbitrary JavaScript Execution (RadioButton.createOption and "AS" property)
- **Fix-Version:** 4.2.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-p5xg-68wr-hm3m
  - https://nvd.nist.gov/vuln/detail/CVE-2026-25940
  - https://github.com/parallax/jsPDF/commit/71ad2dbfa6c7c189ab42b855b782620fa8a38375
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.2.0

---
*Automatisch generiert von `security/cve_scanner.py` via [OSV.dev](https://osv.dev).*
