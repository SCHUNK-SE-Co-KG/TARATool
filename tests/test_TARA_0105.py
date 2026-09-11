"""
[TARA-0105] Tests: Epic-Sync-Pflicht - Stories muessen im zugeordneten Epic
nachgezogen werden (neue Prozessregel P-24)

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, solange P-24 noch nicht in
den massgeblichen Prozessdokumenten (PROCESS_GUARD_AGENT.md,
ENTWICKLUNGSPROZESS.md, DEV_AGENT_ONBOARDING.md) dokumentiert ist.
"""
import os

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROCESS_GUARD_PATH = os.path.join(
    REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md"
)
ENTWICKLUNGSPROZESS_PATH = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
ONBOARDING_PATH = os.path.join(
    REPO_ROOT, "agents", "dev_agent", "DEV_AGENT_ONBOARDING.md"
)


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.mark.TARA_0105
def test_process_guard_documents_p24():
    """P-24 muss in der vollstaendigen Regeltabelle von
    PROCESS_GUARD_AGENT.md auftauchen, inkl. Kernaussage (Epic-Body
    Nachtragen im selben Arbeitsschritt)."""
    content = _read(PROCESS_GUARD_PATH)
    assert "P-24" in content
    assert "Epic" in content
    assert "gleichen Arbeitsschritt" in content or "gleichen Zug" in content


@pytest.mark.TARA_0105
def test_entwicklungsprozess_documents_p24():
    """P-24 muss auch in docs/ENTWICKLUNGSPROZESS.md in der Regeltabelle
    stehen (Konsistenz zwischen beiden massgeblichen Dokumenten)."""
    content = _read(ENTWICKLUNGSPROZESS_PATH)
    assert "P-24" in content
    assert "Epic" in content


@pytest.mark.TARA_0105
def test_onboarding_mentions_epic_body_update_step():
    """DEV_AGENT_ONBOARDING.md muss den Pflicht-Teilschritt "Epic-Body
    aktualisieren" bei der Story-Anlage dokumentieren."""
    content = _read(ONBOARDING_PATH)
    assert "P-24" in content or "Epic-Body" in content


@pytest.mark.TARA_0105
def test_epic_close_precondition_checks_all_bezug_references():
    """Vor dem Schliessen eines Epics muss dokumentiert sein, dass alle
    Issues mit 'Bezug: #<Epic>' im Epic-Body gelistet sein muessen."""
    content = _read(PROCESS_GUARD_PATH)
    assert "Bezug:" in content
    assert "P-24" in content


@pytest.mark.TARA_0105
def test_p24_not_falsely_marked_as_automatable():
    """P-24 ist (noch) nicht automatisiert - muss in der
    'Nicht automatisierbar'-Aufzaehlung der PROCESS_GUARD_AGENT.md stehen."""
    content = _read(PROCESS_GUARD_PATH)
    assert "Nicht automatisierbar" in content
    non_automatable_line = [
        line for line in content.splitlines() if "Nicht automatisierbar" in line
    ][0]
    assert "P-24" in non_automatable_line
