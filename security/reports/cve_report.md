# CVE-Scan Report – TARATool

**Scan-Zeitpunkt:** 2026-04-25T06:25:25Z  
**Repository:** SCHUNK-SE-Co-KG/TARATool  
**Abhängigkeiten geprüft:** 9  
**Schwachstellen gefunden:** 1

> ⚠️ **1 Schwachstelle(n) gefunden!**

## Geprüfte Abhängigkeiten

| Paket | Version | Ökosystem | Quelle |
|-------|---------|-----------|--------|
| @fortawesome/fontawesome-free | 6.5.1 | npm | index.html |
| jszip | 3.10.1 | npm | index.html |
| jspdf | 4.2.1 | npm | index.html |
| pytest | 8.0 | PyPI | tests/requirements.txt |
| pytest-playwright | 0.5 | PyPI | tests/requirements.txt |
| playwright | 1.40 | PyPI | tests/requirements.txt |
| pytest-html | 4.0 | PyPI | tests/requirements.txt |
| pytest-xdist | 3.5 | PyPI | tests/requirements.txt |
| pytest-timeout | 2.2 | PyPI | tests/requirements.txt |

## Gefundene Schwachstellen

### GHSA-6w46-j5rx-g56g

- **Paket:** PyPI:pytest@8.0
- **CVSS-Score:** 6.8
- **Schweregrad:** CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:L
- **CVE:** CVE-2025-71176
- **Beschreibung:** pytest has vulnerable tmpdir handling
- **Fix-Version:** 9.0.3
- **Referenzen:**
  - https://nvd.nist.gov/vuln/detail/CVE-2025-71176
  - https://github.com/pytest-dev/pytest/issues/13669
  - https://github.com/pytest-dev/pytest/pull/14343
  - https://github.com/pytest-dev/pytest/commit/95d8423bd24992deea5b9df32555fa1741679e2c
  - https://github.com/pytest-dev/pytes

---
*Automatisch generiert von `security/cve_scanner.py` via [OSV.dev](https://osv.dev).*
