"""
[TARA-0034/0035/0036/0037] Tests: Workflow-Dokumentation & Onboarding
TDD Red-Phase: Alle Tests mÃ¼ssen FEHLSCHLAGEN bevor die Dokumente erstellt sind.
"""
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


# â”€â”€ TARA-0034: Freigabe-Status im Workflow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.TARA_0034
def test_contributing_contains_freigabe_step():
    """CONTRIBUTING.md muss den Freigabe-Schritt im Workflow beschreiben."""
    content = open(os.path.join(REPO_ROOT, 'CONTRIBUTING.md'), encoding='utf-8').read()
    assert 'Freigabe' in content, 'Freigabe-Schritt fehlt in CONTRIBUTING.md'


@pytest.mark.TARA_0034
def test_process_guard_contains_p15():
    """PROCESS_GUARD_AGENT.md muss Regel P-15 (PO-Freigabe vor Done) enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'agents', 'process-guard.policy.md'), encoding='utf-8').read()
    assert 'P-15' in content, 'Regel P-15 fehlt in PROCESS_GUARD_AGENT.md'


@pytest.mark.TARA_0034
def test_process_guard_p11_references_freigabe():
    """P-11 muss auf den Post-Merge-Status verweisen (nicht nur auf Merge).

    Seit TARA-0110 (Statusmodell B) setzt P-11 den Status direkt auf "Done"
    (statt vormals "Freigabe"), da die PO-Akzeptanz jetzt VOR dem Merge
    ueber P-25 erfolgt.
    """
    content = open(os.path.join(REPO_ROOT, '.github', 'agents', 'process-guard.policy.md'), encoding='utf-8').read()
    # Find P-11 line and check it mentions the post-merge status
    p11_line = [l for l in content.splitlines() if 'P-11' in l and '|' in l]
    assert p11_line, 'P-11 nicht in Tabelle gefunden'
    assert 'Done' in p11_line[0], 'P-11 muss auf den Post-Merge-Status (Done) verweisen'


@pytest.mark.TARA_0034
def test_pr_template_contains_freigabe_hint():
    """PR-Template muss Hinweis auf ausstehende PO-Freigabe enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'pull_request_template.md'), encoding='utf-8').read()
    assert 'Freigabe' in content, 'Freigabe-Hinweis fehlt im PR-Template'


# â”€â”€ TARA-0035: GitHub Board Dokumentation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.TARA_0035
def test_github_board_doc_exists():
    """docs/GITHUB_BOARD.md muss existieren."""
    assert os.path.exists(os.path.join(REPO_ROOT, 'docs', 'GITHUB_BOARD.md')), \
        'docs/GITHUB_BOARD.md fehlt'


@pytest.mark.TARA_0035
def test_github_board_doc_contains_project_id():
    """GITHUB_BOARD.md muss die Project-ID enthalten."""
    content = open(os.path.join(REPO_ROOT, 'docs', 'GITHUB_BOARD.md'), encoding='utf-8').read()
    assert 'PVT_kwHOBLN4284BfLtb' in content, 'Project-ID fehlt in GITHUB_BOARD.md'


@pytest.mark.TARA_0035
def test_github_board_doc_contains_status_options():
    """GITHUB_BOARD.md muss alle Status-Optionen (inkl. Freigabe) dokumentieren."""
    content = open(os.path.join(REPO_ROOT, 'docs', 'GITHUB_BOARD.md'), encoding='utf-8').read()
    for status in ['Todo', 'In Progress', 'Review', 'Freigabe', 'Done']:
        assert status in content, f'Status "{status}" fehlt in GITHUB_BOARD.md'


@pytest.mark.TARA_0035
def test_github_board_doc_contains_graphql_example():
    """GITHUB_BOARD.md muss GraphQL-Beispiele enthalten."""
    content = open(os.path.join(REPO_ROOT, 'docs', 'GITHUB_BOARD.md'), encoding='utf-8').read()
    assert 'graphql' in content.lower() or 'mutation' in content, \
        'GraphQL-Beispiele fehlen in GITHUB_BOARD.md'


# â”€â”€ TARA-0036: Dev Agent Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.TARA_0036
def test_onboarding_doc_exists():
    """docs/DEV_AGENT_ONBOARDING.md muss existieren."""
    assert os.path.exists(os.path.join(REPO_ROOT, '.github', 'agents', 'developer.agent.md')), \
        'docs/DEV_AGENT_ONBOARDING.md fehlt'


@pytest.mark.TARA_0036
def test_onboarding_doc_contains_prerequisites():
    """Onboarding-Dok muss Voraussetzungen (git, gh, Node, Python) beschreiben."""
    content = open(os.path.join(REPO_ROOT, '.github', 'agents', 'developer.agent.md'), encoding='utf-8').read()
    for tool in ['git', 'gh', 'node', 'python']:
        assert tool.lower() in content.lower(), f'Voraussetzung "{tool}" fehlt im Onboarding'


@pytest.mark.TARA_0036
def test_onboarding_doc_contains_npm_install():
    """Onboarding-Dok muss npm install Schritt enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'agents', 'developer.agent.md'), encoding='utf-8').read()
    assert 'npm install' in content, 'npm install Schritt fehlt im Onboarding'


@pytest.mark.TARA_0036
def test_onboarding_doc_contains_gh_auth():
    """Onboarding-Dok muss gh auth Login-Schritt mit Scopes enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'agents', 'developer.agent.md'), encoding='utf-8').read()
    assert 'gh auth' in content, 'gh auth Schritt fehlt im Onboarding'
    assert 'project' in content, 'project-Scope fehlt im Onboarding'


@pytest.mark.TARA_0036
def test_onboarding_doc_contains_smoke_test():
    """Onboarding-Dok muss einen Smoke-Test zur Umgebungsverifikation enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'agents', 'developer.agent.md'), encoding='utf-8').read()
    assert 'smoke' in content.lower() or 'verifi' in content.lower() or 'prÃ¼f' in content.lower(), \
        'Smoke-Test fehlt im Onboarding'


# â”€â”€ TARA-0037: Tests README â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.mark.TARA_0037
def test_tests_readme_contains_noconftest():
    """tests/README.md muss --noconftest erklÃ¤ren."""
    content = open(os.path.join(REPO_ROOT, 'tests', 'README.md'), encoding='utf-8').read()
    assert '--noconftest' in content, '--noconftest Workaround fehlt in tests/README.md'


@pytest.mark.TARA_0037
def test_tests_readme_contains_tara_markers():
    """tests/README.md muss TARA-Marker dokumentieren."""
    content = open(os.path.join(REPO_ROOT, 'tests', 'README.md'), encoding='utf-8').read()
    assert 'TARA_' in content, 'TARA-Marker fehlen in tests/README.md'


@pytest.mark.TARA_0037
def test_tests_readme_contains_venv_setup():
    """tests/README.md muss venv-Setup fÃ¼r macOS/Linux enthalten."""
    content = open(os.path.join(REPO_ROOT, 'tests', 'README.md'), encoding='utf-8').read()
    assert '.venv' in content, 'venv-Setup fehlt in tests/README.md'
    assert 'macOS' in content or 'linux' in content.lower(), \
        'macOS/Linux venv-Anleitung fehlt in tests/README.md'
