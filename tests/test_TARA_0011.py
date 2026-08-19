"""
[TARA-0011] Tests: i18n DE/EN vollständig implementieren
TDD Red-Phase: Tests MÜSSEN fehlschlagen vor der Implementierung.

Akzeptanzkriterien:
  1. 100% UI-Strings in i18n.js (keine hartkodierte Strings in HTML/JS)
  2. Sprachumschalter DE <-> EN im Header vorhanden und funktioniert
  3. PDF-Report verwendet aktive Sprache
  4. Tests für beide Sprachversionen
"""
import os
import re
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
I18N_PATH = os.path.join(REPO_ROOT, "js", "core", "i18n.js")
INDEX_PATH = os.path.join(REPO_ROOT, "index.html")
ASSETS_PATH = os.path.join(REPO_ROOT, "js", "modules", "assets.js")
REPORT_EXPORT_PATH = os.path.join(REPO_ROOT, "js", "report", "report_export.js")
REPORT_I18N_PATH = os.path.join(REPO_ROOT, "js", "report", "report_i18n.js")


def _i18n_content():
    return open(I18N_PATH, encoding="utf-8").read()


def _i18n_de_block():
    """Gibt nur den DE-Block aus i18n.js zurück."""
    content = _i18n_content()
    # DE-Block liegt zwischen 'de: {' und dem nächsten '\n    en: {'
    match = re.search(r'\bde:\s*\{(.+?)\n\s{0,4}en:\s*\{', content, re.DOTALL)
    return match.group(1) if match else ""


def _i18n_en_block():
    """Gibt nur den EN-Block aus i18n.js zurück."""
    content = _i18n_content()
    match = re.search(r'\ben:\s*\{(.+?)\n\s*\}\s*;', content, re.DOTALL)
    return match.group(1) if match else ""


def _html_content():
    return open(INDEX_PATH, encoding="utf-8").read()


def _assets_content():
    return open(ASSETS_PATH, encoding="utf-8").read()


# ── Grundvoraussetzungen ──────────────────────────────────────────────────────

@pytest.mark.TARA_0011
def test_i18n_js_exists():
    assert os.path.isfile(I18N_PATH)


@pytest.mark.TARA_0011
def test_index_html_exists():
    assert os.path.isfile(INDEX_PATH)


# ── AC-1a: Pflicht-Keys vorhanden (DE + EN) ───────────────────────────────────

@pytest.mark.TARA_0011
def test_prefs_dark_title_key_de():
    """prefs.darkTitle muss im DE-Block stehen."""
    assert "'prefs.darkTitle'" in _i18n_de_block(), "prefs.darkTitle fehlt im DE-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_dark_title_key_en():
    """prefs.darkTitle muss im EN-Block stehen."""
    assert "'prefs.darkTitle'" in _i18n_en_block(), "prefs.darkTitle fehlt im EN-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_lang_title_key_de():
    """prefs.langTitle muss im DE-Block stehen."""
    assert "'prefs.langTitle'" in _i18n_de_block(), "prefs.langTitle fehlt im DE-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_lang_title_key_en():
    """prefs.langTitle muss im EN-Block stehen."""
    assert "'prefs.langTitle'" in _i18n_en_block(), "prefs.langTitle fehlt im EN-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_dark_aria_label_key_de():
    """prefs.darkAriaLabel muss im DE-Block stehen."""
    assert "'prefs.darkAriaLabel'" in _i18n_de_block(), "prefs.darkAriaLabel fehlt im DE-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_dark_aria_label_key_en():
    """prefs.darkAriaLabel muss im EN-Block stehen."""
    assert "'prefs.darkAriaLabel'" in _i18n_en_block(), "prefs.darkAriaLabel fehlt im EN-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_lang_aria_label_key_de():
    """prefs.langAriaLabel muss im DE-Block stehen."""
    assert "'prefs.langAriaLabel'" in _i18n_de_block(), "prefs.langAriaLabel fehlt im DE-Block von i18n.js"


@pytest.mark.TARA_0011
def test_prefs_lang_aria_label_key_en():
    """prefs.langAriaLabel muss im EN-Block stehen."""
    assert "'prefs.langAriaLabel'" in _i18n_en_block(), "prefs.langAriaLabel fehlt im EN-Block von i18n.js"


# ── AC-1b: Keine hartkodierte Strings im HTML (title/aria-label der Toggles) ──

@pytest.mark.TARA_0011
def test_dark_toggle_label_no_hardcoded_title():
    """label.prefs-switch für Dark-Mode darf kein hardkodiertes title= haben."""
    html = _html_content()
    assert 'title="Dark Mode"' not in html, (
        'Hardkodiertes title="Dark Mode" in index.html gefunden — bitte data-i18n-title verwenden'
    )


@pytest.mark.TARA_0011
def test_lang_toggle_label_no_hardcoded_title():
    """label.prefs-switch für Sprache darf kein hardkodiertes title= haben."""
    html = _html_content()
    assert 'title="Language / Sprache"' not in html, (
        'Hardkodiertes title="Language / Sprache" in index.html gefunden — bitte data-i18n-title verwenden'
    )


@pytest.mark.TARA_0011
def test_dark_toggle_label_has_data_i18n_title():
    """label.prefs-switch für Dark-Mode muss data-i18n-title haben."""
    html = _html_content()
    assert 'data-i18n-title="prefs.darkTitle"' in html, (
        'data-i18n-title="prefs.darkTitle" fehlt auf dem Dark-Mode-Toggle-Label'
    )


@pytest.mark.TARA_0011
def test_lang_toggle_label_has_data_i18n_title():
    """label.prefs-switch für Sprache muss data-i18n-title haben."""
    html = _html_content()
    assert 'data-i18n-title="prefs.langTitle"' in html, (
        'data-i18n-title="prefs.langTitle" fehlt auf dem Sprach-Toggle-Label'
    )


@pytest.mark.TARA_0011
def test_dark_toggle_input_has_data_i18n_aria_label():
    """toggleTheme input muss data-i18n-aria-label haben."""
    html = _html_content()
    assert 'data-i18n-aria-label="prefs.darkAriaLabel"' in html, (
        'data-i18n-aria-label="prefs.darkAriaLabel" fehlt auf #toggleTheme'
    )


@pytest.mark.TARA_0011
def test_lang_toggle_input_has_data_i18n_aria_label():
    """toggleLang input muss data-i18n-aria-label haben."""
    html = _html_content()
    assert 'data-i18n-aria-label="prefs.langAriaLabel"' in html, (
        'data-i18n-aria-label="prefs.langAriaLabel" fehlt auf #toggleLang'
    )


# ── AC-1c: applyUiI18n unterstützt data-i18n-aria-label ──────────────────────

@pytest.mark.TARA_0011
def test_apply_ui_i18n_handles_aria_label():
    """applyUiI18n in i18n.js muss data-i18n-aria-label verarbeiten."""
    content = _i18n_content()
    assert "data-i18n-aria-label" in content, (
        "applyUiI18n behandelt data-i18n-aria-label nicht — muss in i18n.js ergänzt werden"
    )


# ── AC-1d: DE/EN Key-Parität ──────────────────────────────────────────────────

@pytest.mark.TARA_0011
def test_de_en_key_parity():
    """DE und EN müssen exakt dieselben Keys haben."""
    de_keys = set(re.findall(r"'([a-z][a-z0-9._]+)':", _i18n_de_block()))
    en_keys = set(re.findall(r"'([a-z][a-z0-9._]+)':", _i18n_en_block()))
    missing_in_en = de_keys - en_keys
    missing_in_de = en_keys - de_keys
    assert not missing_in_en, f"Keys in DE aber nicht EN: {sorted(missing_in_en)}"
    assert not missing_in_de, f"Keys in EN aber nicht DE: {sorted(missing_in_de)}"


# ── AC-1e: Asset-Typ ist bilingualer User-Text ───────────────────────────────

@pytest.mark.TARA_0011
def test_asset_type_render_uses_localized_field():
    """Asset-Typ darf nicht roh aus asset.type gerendert werden."""
    content = _assets_content()
    assert "_loc(asset, 'type')" in content, "renderAssets muss asset.type via getLocalizedField lesen"
    assert "escapeHtml(asset.type || '-')" not in content, "renderAssets rendert asset.type noch hartkodiert"


@pytest.mark.TARA_0011
def test_asset_type_save_uses_set_localized_field():
    """Asset-Typ muss sprachspezifisch gespeichert werden."""
    content = _assets_content()
    assert "setLocalizedField(updated, 'type'" in content, "Edit speichert type nicht bilingual"
    assert "setLocalizedField(created, 'type'" in content, "New speichert type nicht bilingual"
    assert "type: typeField.value" not in content, "saveAsset schreibt type noch roh"


@pytest.mark.TARA_0011
def test_asset_type_edit_uses_raw_localized_value_and_hint():
    """Asset-Typ-Input muss die aktuelle Sprache editieren und DE-Hinweis zeigen können."""
    content = _assets_content()
    assert "getLocalizedField(asset, 'type', undefined, { raw: true })" in content
    assert "syncLocalizedInputHint(typeEl, asset, 'type'" in content
    assert "document.getElementById('assetType').value = asset.type || ''" not in content


# ── AC-2: Sprachumschalter vorhanden ─────────────────────────────────────────

@pytest.mark.TARA_0011
def test_language_toggle_exists_in_html():
    """Sprach-Toggle #toggleLang muss in index.html existieren."""
    html = _html_content()
    assert 'id="toggleLang"' in html, "#toggleLang fehlt in index.html"


@pytest.mark.TARA_0011
def test_dark_mode_toggle_exists_in_html():
    """Dark-Mode-Toggle #toggleTheme muss in index.html existieren."""
    html = _html_content()
    assert 'id="toggleTheme"' in html, "#toggleTheme fehlt in index.html"


# ── AC-3: PDF-Report verwendet aktive Sprache ─────────────────────────────────

@pytest.mark.TARA_0011
def test_pdf_report_export_exists():
    assert os.path.isfile(REPORT_EXPORT_PATH), "report_export.js nicht gefunden"


@pytest.mark.TARA_0011
def test_pdf_report_uses_report_lang():
    """report_export.js muss getReportLang() oder getLang() verwenden."""
    content = open(REPORT_EXPORT_PATH, encoding="utf-8").read()
    assert "getReportLang" in content or "getLang" in content, (
        "report_export.js verwendet keine Sprach-Funktion für den PDF-Report"
    )


@pytest.mark.TARA_0011
def test_report_i18n_has_de_and_en():
    """report_i18n.js muss DE- und EN-Strings enthalten."""
    assert os.path.isfile(REPORT_I18N_PATH), "report_i18n.js nicht gefunden"
    content = open(REPORT_I18N_PATH, encoding="utf-8").read()
    assert "de:" in content or "'de'" in content, "Keine DE-Strings in report_i18n.js"
    assert "en:" in content or "'en'" in content, "Keine EN-Strings in report_i18n.js"


# ── AC-1: applyUiI18n schreibt title-Attribute (Regressions-Check) ────────────

@pytest.mark.TARA_0011
def test_apply_ui_i18n_handles_title_attr():
    """applyUiI18n muss data-i18n-title bereits unterstützen."""
    content = _i18n_content()
    assert "data-i18n-title" in content, "applyUiI18n behandelt data-i18n-title nicht"


@pytest.mark.TARA_0011
def test_apply_ui_i18n_handles_placeholder():
    """applyUiI18n muss data-i18n-placeholder unterstützen."""
    content = _i18n_content()
    assert "data-i18n-placeholder" in content, "applyUiI18n behandelt data-i18n-placeholder nicht"
