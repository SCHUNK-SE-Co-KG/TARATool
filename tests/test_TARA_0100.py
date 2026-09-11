"""
[TARA-0100] Tests: Review-Finding-Abschluss-Prozess definieren (Fix vs. Folge-Story)

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, bevor die Dokumentation
(REVIEW_AGENT_WORKFLOW.md, PROCESS_GUARD_AGENT.md, ENTWICKLUNGSPROZESS.md)
um den neuen Abschnitt "Finding-Abschluss" bzw. die Regel P-22 ergaenzt wurde.
"""
import os

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

REVIEW_AGENT_PATH = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")
PROCESS_GUARD_PATH = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
ENTWICKLUNGSPROZESS_PATH = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.mark.TARA_0100
def test_review_agent_workflow_has_finding_closure_section():
    """REVIEW_AGENT_WORKFLOW.md muss einen Abschnitt zum Finding-Abschluss enthalten."""
    content = _read(REVIEW_AGENT_PATH)
    assert "Finding-Abschluss" in content, \
        "Abschnitt 'Finding-Abschluss' fehlt in REVIEW_AGENT_WORKFLOW.md"


@pytest.mark.TARA_0100
def test_review_agent_workflow_describes_direct_fix_case():
    """Fall A (direkter Fix) muss beschrieben sein: sofortiges Schliessen, entkoppelt
    vom Board-Status der Source-Story."""
    content = _read(REVIEW_AGENT_PATH)
    closure_section = content.split("Finding-Abschluss", 1)[1]
    assert "Bezug:" in closure_section, \
        "Referenz-Konvention 'Bezug:' (statt Closes/Fixes) muss im Finding-Abschluss stehen"
    assert "unabhaengig vom" in closure_section or "unabhängig vom" in closure_section, \
        "Muss klarstellen, dass Schliessen unabhaengig vom Source-Story-Status erfolgt"


@pytest.mark.TARA_0100
def test_review_agent_workflow_describes_follow_up_story_case():
    """Fall B (Folge-Story) muss beschrieben sein: neues Story-Issue vor dem Schliessen."""
    content = _read(REVIEW_AGENT_PATH)
    closure_section = content.split("Finding-Abschluss", 1)[1]
    assert "Folge-Story" in closure_section, \
        "Fall 'Folge-Story' muss im Finding-Abschluss-Abschnitt beschrieben sein"
    assert "neue" in closure_section.lower() and "story" in closure_section.lower(), \
        "Muss verlangen, dass ein neues Story-Issue angelegt wird, bevor das Finding schliesst"


@pytest.mark.TARA_0100
def test_review_agent_workflow_forbids_autoclose_keywords_for_findings():
    """Findings duerfen nicht per GitHub-Auto-Close-Keyword geschlossen werden (P-19-konsistent)."""
    content = _read(REVIEW_AGENT_PATH)
    closure_section = content.split("Finding-Abschluss", 1)[1]
    assert "Closes" in closure_section or "closes" in closure_section, \
        "Abschnitt muss explizit erwaehnen, dass Auto-Close-Keywords nicht verwendet werden duerfen"


@pytest.mark.TARA_0100
def test_process_guard_agent_defines_p22():
    """PROCESS_GUARD_AGENT.md muss die neue Regel P-22 definieren."""
    content = _read(PROCESS_GUARD_PATH)
    assert "P-22" in content, "Regel P-22 fehlt in PROCESS_GUARD_AGENT.md"


@pytest.mark.TARA_0100
def test_entwicklungsprozess_references_p22():
    """ENTWICKLUNGSPROZESS.md muss auf die neue Regel P-22 verweisen."""
    content = _read(ENTWICKLUNGSPROZESS_PATH)
    assert "P-22" in content, "Regel P-22 fehlt in ENTWICKLUNGSPROZESS.md"


@pytest.mark.TARA_0100
def test_review_agent_workflow_describes_priority_for_accepted_findings():
    """Vom PO akzeptierte Findings muessen sofort auf 'In Progress' gesetzt und vor
    anderen laufenden Stories priorisiert bearbeitet werden."""
    content = _read(REVIEW_AGENT_PATH)
    closure_section = content.split("Finding-Abschluss", 1)[1]
    assert "Priorisierung" in closure_section or "priorisiert" in closure_section.lower(), \
        "Priorisierungs-Regel fuer akzeptierte Findings fehlt im Finding-Abschluss-Abschnitt"
    assert "In Progress" in closure_section, \
        "Muss verlangen, dass akzeptierte Findings auf 'In Progress' gesetzt werden"
    assert "akzeptiert" in closure_section.lower(), \
        "Muss den PO-Freigabe-Schluesselwortfall 'akzeptiert' referenzieren"


@pytest.mark.TARA_0100
def test_process_guard_p22_mentions_priorisierung():
    """Die P-22-Zeile in PROCESS_GUARD_AGENT.md muss die Priorisierung erwaehnen."""
    content = _read(PROCESS_GUARD_PATH)
    p22_line = next(line for line in content.splitlines() if line.strip().startswith("| P-22"))
    assert "priorisiert" in p22_line.lower(), \
        "P-22-Zeile muss die Priorisierung akzeptierter Findings erwaehnen"


@pytest.mark.TARA_0100
def test_entwicklungsprozess_p22_mentions_priorisierung():
    """Die P-22-Zeile in ENTWICKLUNGSPROZESS.md muss die Priorisierung erwaehnen."""
    content = _read(ENTWICKLUNGSPROZESS_PATH)
    p22_line = next(line for line in content.splitlines() if line.strip().startswith("| **P-22**"))
    assert "priorisiert" in p22_line.lower(), \
        "P-22-Zeile muss die Priorisierung akzeptierter Findings erwaehnen"
