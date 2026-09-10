"""Tests fuer TARA-0088: Entfernung stale Bheowulf-Projekt-Referenzen.

Nach der Umstellung auf ein einziges Repository (SCHUNK-SE-Co-KG/TARATool)
duerfen keine Verweise auf das alte, jetzt private Bheowulf-Board mehr in
Workflows oder Dokumentation vorkommen.
"""
import os

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STALE_IDS = [
    'PVT_kwHOBLN4284BfLtb',
    'PVTSSF_lAHOBLN4284BfLtbzhZgYuI',
    'PVTF_lAHOBLN4284BfLtbzhZgbzQ',
]


@pytest.mark.TARA_0088
def test_po_approve_workflow_has_no_bheowulf_ids():
    """po-approve.yml darf keine alten Bheowulf-Projekt/Feld-IDs mehr enthalten."""
    path = os.path.join(REPO_ROOT, '.github', 'workflows', 'po-approve.yml')
    content = open(path, encoding='utf-8').read()
    for stale_id in STALE_IDS:
        assert stale_id not in content, \
            f'Veraltete Bheowulf-ID "{stale_id}" darf nicht mehr in po-approve.yml vorkommen'


@pytest.mark.TARA_0088
def test_po_approve_workflow_has_no_bh_project_env():
    """po-approve.yml darf keine BH_PROJECT/BH_FIELD-Umgebungsvariablen (zweites Board) mehr setzen."""
    path = os.path.join(REPO_ROOT, '.github', 'workflows', 'po-approve.yml')
    content = open(path, encoding='utf-8').read()
    assert 'BH_PROJECT' not in content, 'BH_PROJECT (Bheowulf-Board) darf nicht mehr referenziert werden'
    assert 'BH_FIELD' not in content, 'BH_FIELD (Bheowulf-Board) darf nicht mehr referenziert werden'
    assert 'SK_PROJECT' in content or 'PVT_kwDOBu4dv84BfbaR' in content, \
        'SCHUNK-Projekt muss weiterhin referenziert werden'


@pytest.mark.TARA_0088
def test_github_board_doc_has_no_bheowulf_ids():
    """GITHUB_BOARD.md darf keine alten Bheowulf-Projekt/Feld-IDs mehr enthalten (auch nicht in GraphQL-Beispielen)."""
    path = os.path.join(REPO_ROOT, 'docs', 'GITHUB_BOARD.md')
    content = open(path, encoding='utf-8').read()
    for stale_id in STALE_IDS:
        assert stale_id not in content, \
            f'Veraltete Bheowulf-ID "{stale_id}" darf nicht mehr in GITHUB_BOARD.md vorkommen'


@pytest.mark.TARA_0088
def test_github_board_doc_uses_schunk_story_points_id():
    """GITHUB_BOARD.md muss die tatsaechliche SCHUNK Story-Points-Feld-ID dokumentieren."""
    path = os.path.join(REPO_ROOT, 'docs', 'GITHUB_BOARD.md')
    content = open(path, encoding='utf-8').read()
    assert 'PVTF_lADOBu4dv84BfbaRzhZ1jLA' in content, \
        'SCHUNK Story-Points-Feld-ID fehlt in GITHUB_BOARD.md'


@pytest.mark.TARA_0088
def test_project_id_test_no_longer_expects_bheowulf_id():
    """test_TARA_0034_0037.py darf nicht mehr die alte Bheowulf-Projekt-ID als Anforderung fuehren."""
    path = os.path.join(REPO_ROOT, 'tests', 'test_TARA_0034_0037.py')
    content = open(path, encoding='utf-8').read()
    assert 'PVT_kwHOBLN4284BfLtb' not in content, \
        'test_TARA_0034_0037.py darf die veraltete Bheowulf-Projekt-ID nicht mehr referenzieren'
    assert 'PVT_kwDOBu4dv84BfbaR' in content, \
        'test_TARA_0034_0037.py muss die aktuelle SCHUNK-Projekt-ID pruefen'
