"""
[TARA-0024] Tests: Canvas-Prototyp – Knoten zeichnen/ziehen/verbinden
TDD Red-Phase: Diese Tests müssen FEHLSCHLAGEN bevor canvas_prototype.html existiert.
"""
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROTO = os.path.join(REPO_ROOT, 'canvas_prototype.html')


@pytest.mark.TARA_0024
def test_prototype_file_exists():
    """canvas_prototype.html muss existieren."""
    assert os.path.exists(PROTO), 'canvas_prototype.html fehlt'


@pytest.mark.TARA_0024
def test_prototype_loads_vis_network():
    """vis-network CDN muss eingebunden sein."""
    content = open(PROTO).read()
    assert 'vis-network' in content, 'vis-network CDN fehlt'


@pytest.mark.TARA_0024
def test_prototype_loads_vue():
    """Vue 3 CDN muss eingebunden sein."""
    content = open(PROTO).read()
    assert 'vue' in content.lower(), 'Vue 3 CDN fehlt'


@pytest.mark.TARA_0024
def test_prototype_has_canvas_container():
    """Ein Container-Element für den Graph muss vorhanden sein."""
    content = open(PROTO).read()
    assert 'id="canvas"' in content or 'id="network"' in content or 'id="graph"' in content, \
        'Kein Canvas-Container gefunden'


@pytest.mark.TARA_0024
def test_prototype_has_add_node_button():
    """Button zum Hinzufügen von Knoten muss vorhanden sein."""
    content = open(PROTO).read()
    assert 'knoten' in content.lower() or 'add' in content.lower() or 'node' in content.lower(), \
        'Kein Knoten-hinzufügen Button gefunden'


@pytest.mark.TARA_0024
def test_prototype_has_label_input():
    """Ein Textfeld zum Beschriften von Knoten muss vorhanden sein."""
    content = open(PROTO).read()
    assert '<input' in content or '<textarea' in content, \
        'Kein Eingabefeld für Knotenbeschriftung gefunden'


@pytest.mark.TARA_0024
def test_prototype_is_standalone():
    """Prototyp darf keine lokalen Abhängigkeiten außer CDN haben."""
    content = open(PROTO).read()
    assert '../js/' not in content, 'Lokale JS-Abhängigkeiten gefunden – muss standalone sein'
    assert 'node_modules' not in content, 'node_modules Referenz gefunden'
