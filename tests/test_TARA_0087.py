"""Tests fuer TARA-0087: Harte Checkliste/Gate in Agenten-Doku vor jedem
Commit/PR.

Prueft (statische Inhaltspruefung, analog zu TARA-0083/0088):
- .github/copilot-instructions.md enthaelt eine explizite, als Gate
  bezeichnete Checkliste mit den beiden Pflichtpunkten (Board-Status
  "In Progress" VOR erstem Commit, Board-Status "inReview" VOR
  'gh pr create').
- agents/dev_agent/DEV_AGENT_ONBOARDING.md verweist auf dieses Gate an den
  richtigen Stellen im Kurzworkflow (vor Schritt 3 und vor 'PR öffnen').
- agents/process_guard/PROCESS_GUARD_AGENT.md dokumentiert die neue Regel
  P-21 als nicht automatisierbare, verbindliche Pflicht.
"""
import os

import pytest

INSTRUCTIONS = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    ".github",
    "copilot-instructions.md",
)
ONBOARDING = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "agents",
    "dev_agent",
    "DEV_AGENT_ONBOARDING.md",
)
PROCESS_GUARD_AGENT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "agents",
    "process_guard",
    "PROCESS_GUARD_AGENT.md",
)


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


@pytest.mark.TARA_0087
def test_copilot_instructions_has_hard_gate_checklist():
    content = _read(INSTRUCTIONS)
    assert "GATE" in content.upper()
    assert "In Progress" in content
    assert "inReview" in content
    assert "gh pr create" in content
    assert "VOR dem ersten Commit" in content or "vor dem ersten Commit" in content.lower()


@pytest.mark.TARA_0087
def test_copilot_instructions_gate_is_not_skippable():
    content = _read(INSTRUCTIONS)
    assert "nicht ueberspringbar" in content.lower() or "nicht überspringbar" in content.lower()


@pytest.mark.TARA_0087
def test_dev_agent_onboarding_references_gate_before_first_commit_and_pr():
    content = _read(ONBOARDING)
    assert "GATE 1" in content
    assert "GATE 2" in content
    assert "copilot-instructions.md" in content


@pytest.mark.TARA_0098
def test_copilot_instructions_gate_does_not_reference_unmerged_rules():
    """TARA-0098: Solange P-19 (PR #149) und P-20 (PR #150) nicht in
    'development' gemergt sind, darf die Gate-Checkliste keine aktiven
    Referenzen auf 'P-02/P-20', 'P-09/P-20' oder ein abschliessendes
    '(P-19)?' enthalten - diese Regeln existieren im Prozess-Guard-Dokument
    dieses Branches nicht. Der erklaerende Hinweistext, der explizit auf den
    noch ausstehenden Merge verweist, ist davon ausgenommen."""
    content = _read(INSTRUCTIONS)
    gate_start = content.index("VERBINDLICHES GATE")
    gate_end = content.index("Hinweis (TARA-0098)")
    gate_checklist = content[gate_start:gate_end]
    forbidden = ["P-02/P-20", "P-09/P-20", "(P-19)?", "(P-20)?"]
    for token in forbidden:
        assert token not in gate_checklist, f"Verweis auf noch nicht gemergte Regel '{token}' gefunden"


@pytest.mark.TARA_0098
def test_copilot_instructions_does_not_overclaim_full_p_range():
    """TARA-0098: Die Behauptung 'P-01-P-21 vollstaendig'/'P-01-P-21' (ohne
    Einschraenkung) ist falsch, solange P-19/P-20 fehlen - muss die Luecke
    benennen."""
    content = _read(INSTRUCTIONS)
    assert "P-01-P-21 vollstaendig" not in content
    assert "P-19/P-20" in content, "Muss auf die noch ausstehenden Regeln P-19/P-20 hinweisen"


@pytest.mark.TARA_0087
def test_process_guard_agent_documents_p21():
    content = _read(PROCESS_GUARD_AGENT)
    assert "P-21" in content
    assert "nicht ueberspringbar" in content.lower() or "nicht überspringbar" in content.lower()


@pytest.mark.TARA_0098
def test_copilot_instructions_does_not_overclaim_full_p_range():
    """TARA-0098: Die Behauptung 'P-01-P-21 vollstaendig'/'P-01-P-21' (ohne
    Einschraenkung) ist falsch, solange P-19/P-20 fehlen - muss die Luecke
    benennen."""
    content = _read(INSTRUCTIONS)
    assert "P-01-P-21 vollstaendig" not in content
    assert "P-19/P-20" in content, "Muss auf die noch ausstehenden Regeln P-19/P-20 hinweisen"
