"""
[TARA-0082] Tests: About-Fenster - Schliessen-Button (X) funktioniert nicht

Bug: Der X-Button im About-Modal ruft closeAboutModal() auf (index.html),
diese Funktion war jedoch in js/core/about.js nicht definiert.
"""
import re
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_HTML = os.path.join(REPO_ROOT, "index.html")
ABOUT_JS = os.path.join(REPO_ROOT, "js", "core", "about.js")


@pytest.mark.TARA_0082
def test_index_html_about_close_button_calls_closeAboutModal():
    """index.html muss den X-Button im About-Modal mit closeAboutModal() verdrahten."""
    html = open(INDEX_HTML, encoding="utf-8").read()
    match = re.search(
        r'<div id="aboutModal".*?</div>\s*</div>', html, re.DOTALL
    )
    assert match, "aboutModal-Block nicht in index.html gefunden"
    assert "closeAboutModal()" in match.group(0), (
        "Close-Button des About-Modals ruft closeAboutModal() nicht auf"
    )


@pytest.mark.TARA_0082
def test_about_js_defines_closeAboutModal_function():
    """about.js muss die Funktion closeAboutModal() definieren."""
    content = open(ABOUT_JS, encoding="utf-8").read()
    assert re.search(r'function\s+closeAboutModal\s*\(', content), (
        "closeAboutModal() ist in about.js nicht definiert"
    )


@pytest.mark.TARA_0082
def test_close_about_modal_sets_display_none():
    """closeAboutModal() muss das Modal per display='none' ausblenden."""
    content = open(ABOUT_JS, encoding="utf-8").read()
    match = re.search(
        r'function\s+closeAboutModal\s*\([^)]*\)\s*\{(.*?)\n\}', content, re.DOTALL
    )
    assert match, "Body von closeAboutModal() konnte nicht extrahiert werden"
    body = match.group(1)
    assert "aboutModal" in body, "closeAboutModal() referenziert #aboutModal nicht"
    assert re.search(r"display\s*=\s*['\"]none['\"]", body), (
        "closeAboutModal() setzt modal.style.display nicht auf 'none'"
    )
