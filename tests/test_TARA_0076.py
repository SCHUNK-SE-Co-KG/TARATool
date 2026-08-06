"""
[TARA-0076] Tests: CVE-Fix jsPDF 4.2.0 -> 4.2.1
TDD Red-Phase: CHANGELOG-Eintrag fehlt, CVE-Verifikation nicht dokumentiert.

Referenz-CVEs:
  CVE-2026-31898 (CVSS 8.1) - GHSA-7x6v-j9x4-qf24
  CVE-2026-31938 (CVSS 9.6) - GHSA-wfv2-pwc8-crg5
"""
import re
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_HTML = os.path.join(REPO_ROOT, "index.html")
ABOUT_JS   = os.path.join(REPO_ROOT, "js", "core", "about.js")
CHANGELOG  = os.path.join(REPO_ROOT, "CHANGELOG.md")
README     = os.path.join(REPO_ROOT, "README.md")


# ── CDN-Version in index.html ────────────────────────────────────

@pytest.mark.TARA_0076
def test_jspdf_cdn_version_at_least_4_2_1():
    """index.html muss jsPDF >= 4.2.1 via CDN laden."""
    html = open(INDEX_HTML, encoding="utf-8").read()
    match = re.search(r'jspdf@(\d+\.\d+\.\d+)', html, re.IGNORECASE)
    assert match, "Kein jsPDF CDN-Script-Tag in index.html gefunden"
    version = tuple(int(x) for x in match.group(1).split("."))
    assert version >= (4, 2, 1), (
        f"jsPDF CDN-Version {match.group(1)} ist < 4.2.1 "
        f"(CVE-2026-31898 und CVE-2026-31938 bleiben offen)"
    )


@pytest.mark.TARA_0076
def test_jspdf_cdn_has_integrity_hash():
    """jsPDF CDN-Tag muss SRI integrity-Attribut haben."""
    html = open(INDEX_HTML, encoding="utf-8").read()
    match = re.search(r'<script[^>]*jspdf[^>]*>', html, re.IGNORECASE)
    assert match, "jsPDF script-Tag nicht in index.html gefunden"
    tag = match.group(0)
    assert 'integrity=' in tag, (
        "jsPDF CDN-Script-Tag fehlt integrity-Attribut (SRI erforderlich)"
    )
    assert 'crossorigin=' in tag, (
        "jsPDF CDN-Script-Tag fehlt crossorigin-Attribut (SRI erforderlich)"
    )


# ── about.js SBOM-Eintrag ────────────────────────────────────────

@pytest.mark.TARA_0076
def test_about_js_jspdf_purl_version():
    """about.js SBOM-Eintrag muss jsPDF >= 4.2.1 ausweisen."""
    content = open(ABOUT_JS, encoding="utf-8").read()
    match = re.search(r'pkg:npm/jspdf@(\d+\.\d+\.\d+)', content)
    assert match, "SBOM-Eintrag 'pkg:npm/jspdf@...' in about.js nicht gefunden"
    version = tuple(int(x) for x in match.group(1).split("."))
    assert version >= (4, 2, 1), (
        f"about.js SBOM verweist auf jsPDF {match.group(1)} statt >= 4.2.1"
    )


# ── README Dependency-Tabelle ────────────────────────────────────

@pytest.mark.TARA_0076
def test_readme_jspdf_version():
    """README.md Dependency-Tabelle muss jsPDF 4.2.1 ausweisen."""
    content = open(README, encoding="utf-8").read()
    match = re.search(r'jsPDF.*?(\d+\.\d+\.\d+)', content)
    assert match, "jsPDF-Eintrag in README.md nicht gefunden"
    version = tuple(int(x) for x in match.group(1).split("."))
    assert version >= (4, 2, 1), (
        f"README.md verweist auf jsPDF {match.group(1)} statt >= 4.2.1"
    )


# ── CHANGELOG-Dokumentation ──────────────────────────────────────

@pytest.mark.TARA_0076
def test_changelog_documents_cve_fix():
    """CHANGELOG.md muss einen Eintrag zum CVE-2026-31898/31938-Fix enthalten."""
    content = open(CHANGELOG, encoding="utf-8").read()
    assert "CVE-2026-31898" in content or "GHSA-7x6v-j9x4-qf24" in content, (
        "CHANGELOG.md dokumentiert CVE-2026-31898 nicht "
        "(jsPDF PDF Object Injection via FreeText color)"
    )
    assert "CVE-2026-31938" in content or "GHSA-wfv2-pwc8-crg5" in content, (
        "CHANGELOG.md dokumentiert CVE-2026-31938 nicht "
        "(jsPDF HTML Injection in New Window paths)"
    )
