"""
[TARA-0102] Tests: Review-Agent-Pruefkatalog nachschaerfen
(Workflow/Script-Security, Runtime-Pflicht, Schwere-Rubrik)

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, bevor
agents/review_agent/REVIEW_AGENT_WORKFLOW.md um die neuen Abschnitte ergaenzt
wurde (erweiterter Pruefkatalog R-31-R-34, Schwere-/Konfidenz-Rubrik,
Skip-Eskalation fuer R-13-R-30, unabhaengige Diff-Verifikation).
"""
import os

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REVIEW_AGENT_PATH = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.mark.TARA_0102
def test_review_agent_workflow_has_workflow_security_rules():
    """Neuer R-Regelblock fuer agents/scripts/.github/workflows/ Sicherheitspruefungen."""
    content = _read(REVIEW_AGENT_PATH)
    for rule in ("R-31", "R-32", "R-33", "R-34"):
        assert rule in content, f"{rule} fehlt im erweiterten Pruefkatalog"
    assert "Script-Injection" in content or "script-injection" in content.lower()


@pytest.mark.TARA_0102
def test_scope_table_covers_github_workflows():
    """Die Scope-Entscheidungstabelle muss .github/workflows/ mit Pflicht-Checks abdecken."""
    content = _read(REVIEW_AGENT_PATH)
    assert ".github/workflows" in content
    assert "R-31" in content and "R-34" in content


@pytest.mark.TARA_0102
def test_review_agent_workflow_has_severity_rubric():
    """Schwere-Rubrik mit klaren Kriterien pro Stufe und Konfidenz-Mass."""
    content = _read(REVIEW_AGENT_PATH)
    assert "Schwere-Rubrik" in content
    for level in ("Kritisch", "Hoch", "Mittel", "Niedrig"):
        assert level in content
    assert "Konfidenz" in content


@pytest.mark.TARA_0102
def test_runtime_skip_requires_escalation():
    """R-13-R-30-Skip bei fehlender App-URL darf nicht mehr stillschweigend erfolgen."""
    content = _read(REVIEW_AGENT_PATH)
    assert "Eskalation" in content or "eskaliert" in content.lower(), \
        "Skip von R-13-R-30 muss eine Eskalation/Pflicht-Hinweis erzeugen"


@pytest.mark.TARA_0102
def test_review_agent_verifies_diff_independently():
    """Review-Agent muss den PR-Diff selbst verifizieren statt nur die vom
    Dev-Agent uebergebene Dateiliste zu vertrauen."""
    content = _read(REVIEW_AGENT_PATH)
    assert "gh pr diff" in content or "git diff" in content
    assert "unabhaengig" in content.lower() or "unabhängig" in content.lower()
