"""
[TARA-0022] Tests: Prettier + ESLint als Pflichtschritte in Entwickler-Workflow
TDD Red-Phase: Diese Tests müssen FEHLSCHLAGEN bevor CONTRIBUTING.md und
PROCESS_GUARD_AGENT.md aktualisiert sind.
"""
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.mark.TARA_0022
def test_contributing_contains_prettier_step():
    """CONTRIBUTING.md muss Prettier als Pflichtschritt vor Tests beschreiben."""
    content = open(os.path.join(REPO_ROOT, 'CONTRIBUTING.md'), encoding='utf-8').read()
    assert 'format:check' in content or 'prettier' in content.lower(), \
        'Prettier-Schritt fehlt in CONTRIBUTING.md'


@pytest.mark.TARA_0022
def test_contributing_contains_eslint_step():
    """CONTRIBUTING.md muss ESLint als Pflichtschritt vor Tests beschreiben."""
    content = open(os.path.join(REPO_ROOT, 'CONTRIBUTING.md'), encoding='utf-8').read()
    assert 'eslint' in content.lower(), \
        'ESLint-Schritt fehlt in CONTRIBUTING.md'


@pytest.mark.TARA_0022
def test_contributing_prettier_before_tests():
    """Im 'Schritt 4' Block muss Prettier VOR pytest stehen."""
    content = open(os.path.join(REPO_ROOT, 'CONTRIBUTING.md'), encoding='utf-8').read()
    schritt4_start = content.find('Schritt 4')
    assert schritt4_start != -1, "'Schritt 4' nicht in CONTRIBUTING.md"
    schritt4 = content[schritt4_start:]
    prettier_pos = schritt4.lower().find('prettier')
    pytest_pos = schritt4.lower().find('pytest')
    assert prettier_pos != -1, 'prettier nicht in Schritt 4'
    assert pytest_pos != -1, 'pytest nicht in Schritt 4'
    assert prettier_pos < pytest_pos, \
        'Prettier (4a) muss vor pytest (4c) in Schritt 4 stehen'


@pytest.mark.TARA_0022
def test_contributing_eslint_before_tests():
    """Im 'Schritt 4' Block muss ESLint VOR pytest stehen."""
    content = open(os.path.join(REPO_ROOT, 'CONTRIBUTING.md'), encoding='utf-8').read()
    schritt4_start = content.find('Schritt 4')
    assert schritt4_start != -1, "'Schritt 4' nicht in CONTRIBUTING.md"
    schritt4 = content[schritt4_start:]
    eslint_pos = schritt4.lower().find('eslint')
    pytest_pos = schritt4.lower().find('pytest')
    assert eslint_pos != -1, 'eslint nicht in Schritt 4'
    assert pytest_pos != -1, 'pytest nicht in Schritt 4'
    assert eslint_pos < pytest_pos, \
        'ESLint (4b) muss vor pytest (4c) in Schritt 4 stehen'


@pytest.mark.TARA_0022
def test_process_guard_contains_p12():
    """PROCESS_GUARD_AGENT.md muss Regel P-12 (Prettier) enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'PROCESS_GUARD_AGENT.md'), encoding='utf-8').read()
    assert 'P-12' in content, 'Regel P-12 (Prettier) fehlt in PROCESS_GUARD_AGENT.md'


@pytest.mark.TARA_0022
def test_process_guard_contains_p13():
    """PROCESS_GUARD_AGENT.md muss Regel P-13 (ESLint) enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'PROCESS_GUARD_AGENT.md'), encoding='utf-8').read()
    assert 'P-13' in content, 'Regel P-13 (ESLint) fehlt in PROCESS_GUARD_AGENT.md'


@pytest.mark.TARA_0022
def test_pr_template_contains_prettier_checkbox():
    """PR-Template muss Prettier-Checkbox enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'pull_request_template.md'), encoding='utf-8').read()
    assert 'prettier' in content.lower() or 'format:check' in content, \
        'Prettier-Checkbox fehlt im PR-Template'


@pytest.mark.TARA_0022
def test_pr_template_contains_eslint_checkbox():
    """PR-Template muss ESLint-Checkbox enthalten."""
    content = open(os.path.join(REPO_ROOT, '.github', 'pull_request_template.md'), encoding='utf-8').read()
    assert 'eslint' in content.lower(), \
        'ESLint-Checkbox fehlt im PR-Template'
