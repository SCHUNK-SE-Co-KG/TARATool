"""
[TARA-0004] Tests: Branch-Strategie, TDD-Workflow, Prozess-Guard Dokumentation
TDD Red-Phase: Diese Tests müssen FEHLSCHLAGEN bevor die Dokumente erstellt sind.
"""
import os
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── Datei-Existenz ────────────────────────────────────────────────

@pytest.mark.TARA_0004
def test_contributing_md_exists():
    assert os.path.isfile(os.path.join(REPO_ROOT, "CONTRIBUTING.md"))

@pytest.mark.TARA_0004
def test_pr_template_exists():
    assert os.path.isfile(os.path.join(REPO_ROOT, ".github", "pull_request_template.md"))

@pytest.mark.TARA_0004
def test_review_agent_workflow_exists():
    assert os.path.isfile(os.path.join(REPO_ROOT, "docs", "REVIEW_AGENT_WORKFLOW.md"))

@pytest.mark.TARA_0004
def test_process_guard_agent_exists():
    assert os.path.isfile(os.path.join(REPO_ROOT, ".github", "PROCESS_GUARD_AGENT.md"))

# ── CONTRIBUTING.md Inhalte ───────────────────────────────────────

@pytest.mark.TARA_0004
def test_contributing_contains_branch_strategy():
    path = os.path.join(REPO_ROOT, "CONTRIBUTING.md")
    content = open(path).read()
    assert "feature/TARA-XXXX" in content, "Branch-Naming-Convention fehlt"
    assert "Development" in content, "Development-Branch fehlt"
    assert "main" in content, "main-Branch fehlt"

@pytest.mark.TARA_0004
def test_contributing_contains_tdd_workflow():
    path = os.path.join(REPO_ROOT, "CONTRIBUTING.md")
    content = open(path).read()
    assert "TDD" in content or "Test-Driven" in content, "TDD-Workflow fehlt"
    assert "Red" in content, "Red-Phase fehlt"
    assert "fehlschlagen" in content or "FAILED" in content, "Hinweis auf initiales Fehlschlagen fehlt"

@pytest.mark.TARA_0004
def test_contributing_contains_process_guard():
    path = os.path.join(REPO_ROOT, "CONTRIBUTING.md")
    content = open(path).read()
    assert "PROCESS_GUARD" in content or "Prozess-Guard" in content, "Prozess-Guard-Referenz fehlt"
    assert "PROCESS OK" in content, "PROCESS OK Freigabe fehlt"

@pytest.mark.TARA_0004
def test_contributing_contains_commit_format():
    path = os.path.join(REPO_ROOT, "CONTRIBUTING.md")
    content = open(path).read()
    assert "TARA-XXXX" in content, "Commit-Message-Format mit TARA-ID fehlt"

# ── PR-Template Inhalte ───────────────────────────────────────────

@pytest.mark.TARA_0004
def test_pr_template_contains_tdd_checklist():
    path = os.path.join(REPO_ROOT, ".github", "pull_request_template.md")
    content = open(path).read()
    assert "fehlgeschlagen" in content or "Red" in content, "TDD Red-Phase Checkbox fehlt"
    assert "pytest" in content, "pytest-Befehl fehlt"

@pytest.mark.TARA_0004
def test_pr_template_contains_process_guard():
    path = os.path.join(REPO_ROOT, ".github", "pull_request_template.md")
    content = open(path).read()
    assert "PROCESS OK" in content, "Prozess-Guard Freigabe Checkbox fehlt"

# ── Prozess-Guard Inhalte ─────────────────────────────────────────

@pytest.mark.TARA_0004
def test_process_guard_contains_all_rules():
    path = os.path.join(REPO_ROOT, ".github", "PROCESS_GUARD_AGENT.md")
    content = open(path).read()
    for rule in ["P-01", "P-02", "P-03", "P-04", "P-05",
                 "P-06", "P-07", "P-08", "P-09", "P-10", "P-11"]:
        assert rule in content, f"Pflicht-Regel {rule} fehlt im PROCESS_GUARD_AGENT.md"

@pytest.mark.TARA_0004
def test_review_agent_workflow_contains_all_rules():
    path = os.path.join(REPO_ROOT, "docs", "REVIEW_AGENT_WORKFLOW.md")
    content = open(path).read()
    for rule in ["R-01", "R-02", "R-03", "R-04", "R-05",
                 "R-06", "R-07", "R-08", "R-09", "R-10", "R-11", "R-12"]:
        assert rule in content, f"Prüfregel {rule} fehlt in REVIEW_AGENT_WORKFLOW.md"

@pytest.mark.TARA_0004
def test_process_guard_contains_tdd_rules():
    path = os.path.join(REPO_ROOT, ".github", "PROCESS_GUARD_AGENT.md")
    content = open(path).read()
    assert "TDD" in content or "Tests vor" in content, "TDD-Regel fehlt im Process Guard"
    assert "fehlgeschlagen" in content or "Red" in content, "Red-Phase Regel fehlt"
