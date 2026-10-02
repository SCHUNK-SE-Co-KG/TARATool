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
    REPO_ROOT, ".github", "agents", "process-guard.policy.md"
)
ENTWICKLUNGSPROZESS_PATH = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
ONBOARDING_PATH = os.path.join(
    REPO_ROOT, ".github", "agents", "developer.agent.md"
)


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.mark.TARA_0105
def test_process_guard_documents_p24():
    """P-24 muss in der vollstaendigen Regeltabelle von
    PROCESS_GUARD_AGENT.md auftauchen. Seit TARA-0113 lautet die
    Kernaussage nicht mehr "Epic-Body im selben Arbeitsschritt nachtragen"
    (manuelle Text-Checkliste), sondern "native Sub-Issue-Verknuepfung per
    Skript" - siehe tests/test_TARA_0113.py fuer die Details der neuen
    Fassung."""
    content = _read(PROCESS_GUARD_PATH)
    assert "P-24" in content
    assert "Epic" in content
    assert "Sub-Issue" in content


@pytest.mark.TARA_0105
def test_entwicklungsprozess_documents_p24():
    """P-24 muss auch in docs/ENTWICKLUNGSPROZESS.md in der Regeltabelle
    stehen (Konsistenz zwischen beiden massgeblichen Dokumenten)."""
    content = _read(ENTWICKLUNGSPROZESS_PATH)
    assert "P-24" in content
    assert "Epic" in content


@pytest.mark.TARA_0105
def test_onboarding_mentions_epic_body_update_step():
    """developer.agent.md (ehemals DEV_AGENT_ONBOARDING.md) muss bei der
    Story-Anlage ausschliesslich die native Sub-Issue-Verknuepfung per
    Skript beschreiben (seit TARA-0113/TARA-0123) - NICHT mehr die alte
    manuelle Epic-Body-Text-Checkliste ("Enthaltene Stories")."""
    content = _read(ONBOARDING_PATH)
    assert "P-24" in content
    assert "link_epic_subissue.sh" in content
    assert "Enthaltene Stories" not in content


@pytest.mark.TARA_0105
def test_epic_close_precondition_checks_all_bezug_references():
    """Vor dem Schliessen eines Epics muss dokumentiert sein, dass alle
    Issues mit 'Bezug: #<Epic>' im Epic-Body gelistet sein muessen."""
    content = _read(PROCESS_GUARD_PATH)
    assert "Bezug:" in content
    assert "P-24" in content


@pytest.mark.TARA_0105
def test_p24_not_falsely_marked_as_automatable():
    """Bis TARA-0113 war P-24 rein manuell und durfte NICHT faelschlich als
    automatisiert gelten. Seit TARA-0113 ist P-24 tatsaechlich automatisiert
    (scripts/workflow/link_epic_subissue.sh, siehe tests/test_TARA_0113.py)
    und wurde deshalb bewusst aus der 'Nicht automatisierbar'-Aufzaehlung
    entfernt - das ist keine Regression, sondern der beabsichtigte Zustand
    nach TARA-0113. Dieser Test stellt sicher, dass P-24 dort NICHT mehr
    (faelschlich) als weiterhin rein manuell gelistet ist."""
    content = _read(PROCESS_GUARD_PATH)
    assert "Nicht automatisierbar" in content
    non_automatable_line = [
        line for line in content.splitlines() if "Nicht automatisierbar" in line
    ][0]
    assert "P-24" not in non_automatable_line
    assert "link_epic_subissue.sh" in content
