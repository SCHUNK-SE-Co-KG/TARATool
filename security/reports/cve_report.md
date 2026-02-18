# CVE-Scan Report – TARATool

**Scan-Zeitpunkt:** 2026-02-18T12:48:11Z  
**Repository:** SCHUNK-SE-Co-KG/TARATool  
**Abhängigkeiten geprüft:** 9  
**Schwachstellen gefunden:** 7

> ⚠️ **7 Schwachstelle(n) gefunden!**

## Geprüfte Abhängigkeiten

| Paket | Version | Ökosystem | Quelle |
|-------|---------|-----------|--------|
| @fortawesome/fontawesome-free | 6.5.1 | npm | index.html |
| jszip | 3.10.1 | npm | index.html |
| jspdf | 2.5.1 | npm | index.html |
| pytest | 8.0 | PyPI | tests/requirements.txt |
| pytest-playwright | 0.5 | PyPI | tests/requirements.txt |
| playwright | 1.40 | PyPI | tests/requirements.txt |
| pytest-html | 4.0 | PyPI | tests/requirements.txt |
| pytest-xdist | 3.5 | PyPI | tests/requirements.txt |
| pytest-timeout | 2.2 | PyPI | tests/requirements.txt |

## Gefundene Schwachstellen

### GHSA-8mvj-3j78-4qmw

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 8.7 🔴
- **Schweregrad:** CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H
- **CVE:** CVE-2025-57810
- **Beschreibung:** jsPDF Denial of Service (DoS)
- **Fix-Version:** 3.0.2
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-8mvj-3j78-4qmw
  - https://nvd.nist.gov/vuln/detail/CVE-2025-57810
  - https://github.com/parallax/jsPDF/pull/3880
  - https://github.com/parallax/jsPDF/commit/4cf3ab619e565d9b88b4b130bff901b91d8688e9
  - https://github.com/parallax/jsPDF

### GHSA-95fx-jjr5-f39c

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 8.7 🔴
- **Schweregrad:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N
- **CVE:** CVE-2026-24133
- **Beschreibung:** jsPDF Vulnerable to Denial of Service (DoS) via Unvalidated BMP Dimensions in BMPDecoder
- **Fix-Version:** 4.1.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-95fx-jjr5-f39c
  - https://nvd.nist.gov/vuln/detail/CVE-2026-24133
  - https://github.com/parallax/jsPDF/commit/ae4b93f76d8fc1baa5614bd5fdb5d174c3b85f0d
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.1.0

### GHSA-cjw8-79x6-5cj4

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 6.3
- **Schweregrad:** CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N
- **CVE:** CVE-2026-24040
- **Beschreibung:** jsPDF has Shared State Race Condition in addJS Plugin
- **Fix-Version:** 4.1.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-cjw8-79x6-5cj4
  - https://nvd.nist.gov/vuln/detail/CVE-2026-24040
  - https://github.com/parallax/jsPDF/commit/2863e5c26afef211a545e8c174ab4d5fce3b8c0e
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.1.0

### GHSA-f8cm-6447-x5h2

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 9.2 🔴
- **Schweregrad:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:H/SI:N/SA:N
- **CVE:** CVE-2025-68428
- **Beschreibung:** jsPDF has Local File Inclusion/Path Traversal vulnerability
- **Fix-Version:** 4.0.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-f8cm-6447-x5h2
  - https://nvd.nist.gov/vuln/detail/CVE-2025-68428
  - https://github.com/parallax/jsPDF/commit/a688c8f479929b24a6543b1fa2d6364abb03066d
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.0.0

### GHSA-pqxr-3g65-p328

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 8.1 🔴
- **Schweregrad:** CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N
- **CVE:** CVE-2026-24737
- **Beschreibung:** jsPDF has PDF Injection in AcroFormChoiceField that allows Arbitrary JavaScript Execution
- **Fix-Version:** 4.1.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-pqxr-3g65-p328
  - https://nvd.nist.gov/vuln/detail/CVE-2026-24737
  - https://github.com/parallax/jsPDF/commit/da291a5f01b96282545c9391996702cdb8879f79
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.1.0

### GHSA-vm32-vv63-w422

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 6.9
- **Schweregrad:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:L/SA:N
- **CVE:** CVE-2026-24043
- **Beschreibung:** jsPDF Vulnerable to Stored XMP Metadata Injection (Spoofing & Integrity Violation)
- **Fix-Version:** 4.1.0
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-vm32-vv63-w422
  - https://nvd.nist.gov/vuln/detail/CVE-2026-24043
  - https://github.com/parallax/jsPDF/commit/efe54bf50f3f5e5416b2495e3c24624fc80b6cff
  - https://github.com/parallax/jsPDF
  - https://github.com/parallax/jsPDF/releases/tag/v4.1.0

### GHSA-w532-jxjh-hjhj

- **Paket:** npm:jspdf@2.5.1
- **CVSS-Score:** 8.7 🔴
- **Schweregrad:** CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N
- **CVE:** CVE-2025-29907
- **Beschreibung:** jsPDF Bypass Regular Expression Denial of Service (ReDoS)
- **Fix-Version:** 3.0.1
- **Referenzen:**
  - https://github.com/parallax/jsPDF/security/advisories/GHSA-w532-jxjh-hjhj
  - https://nvd.nist.gov/vuln/detail/CVE-2025-29907
  - https://github.com/parallax/jsPDF/commit/b167c43c27c466eb914b927885b06073708338df
  - https://github.com/parallax/jsPDF

---
*Automatisch generiert von `security/cve_scanner.py` via [OSV.dev](https://osv.dev).*
