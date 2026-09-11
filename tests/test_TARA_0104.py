"""
[TARA-0104] Tests: po-approve.yml Board-Status-Schreibrechte reparieren

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, solange po-approve.yml noch
die veraltete Bheowulf-Board-Referenz (BH_PROJECT/BH_FIELD) enthaelt, den
schreibenden Projects-v2-Aufruf mit dem rechtlosen GITHUB_TOKEN statt einem
PAT mit Projects-Schreibrechten (PROJECT_TOKEN) durchfuehrt, und Fehler beim
Board-Update still per try/catch verschluckt statt den Job fehlschlagen zu
lassen.
"""
import os
import re

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKFLOW_PATH = os.path.join(REPO_ROOT, ".github", "workflows", "po-approve.yml")


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.mark.TARA_0104
def test_po_approve_workflow_exists():
    assert os.path.isfile(WORKFLOW_PATH), "po-approve.yml muss weiterhin existieren"


@pytest.mark.TARA_0104
def test_stale_bheowulf_project_references_removed():
    """Die veraltete BH_PROJECT/BH_FIELD-Referenz auf das fremde Bheowulf-Board
    darf nicht mehr im Workflow vorkommen (analog TARA-0088)."""
    content = _read(WORKFLOW_PATH)
    assert "BH_PROJECT" not in content
    assert "BH_FIELD" not in content
    assert "PVT_kwHOBLN4284BfLtb" not in content


@pytest.mark.TARA_0104
def test_project_write_step_uses_project_token_not_default_token():
    """Der Schritt, der das Projects-v2-Statusfeld schreibend aendert, muss
    ein Token mit tatsaechlichen Projects-Schreibrechten (secrets.PROJECT_TOKEN)
    verwenden - das Default-GITHUB_TOKEN hat keine Projects-v2-Berechtigung."""
    content = _read(WORKFLOW_PATH)
    # Der Abschnitt beginnt bei "Freigabe verarbeiten" und reicht bis zum
    # naechsten "- name:" Step-Header.
    match = re.search(
        r"- name: Freigabe verarbeiten\b.*?(?=\n\s*- name:|\Z)",
        content,
        re.DOTALL,
    )
    assert match, "Step 'Freigabe verarbeiten' nicht gefunden"
    step_block = match.group(0)
    assert "secrets.PROJECT_TOKEN" in step_block, (
        "Freigabe verarbeiten muss secrets.PROJECT_TOKEN verwenden - "
        "das Default-GITHUB_TOKEN hat keine Projects-v2-Schreibrechte"
    )


@pytest.mark.TARA_0104
def test_project_update_failure_is_not_silently_swallowed():
    """Schlaegt die Board-Status-Mutation fehl, darf der Job NICHT weiterhin
    als 'success' gemeldet werden (kein stiller try/catch-Erfolg mehr) -
    core.setFailed muss im Fehlerfall aufgerufen werden."""
    content = _read(WORKFLOW_PATH)
    assert "core.setFailed" in content, (
        "Ein fehlgeschlagenes Board-Update muss den Workflow-Job ueber "
        "core.setFailed sichtbar fehlschlagen lassen"
    )


@pytest.mark.TARA_0104
def test_only_single_sk_project_referenced():
    """Nur noch ein einziges (TARATool-)Board wird referenziert."""
    content = _read(WORKFLOW_PATH)
    assert content.count("PVT_kwDOBu4dv84BfbaR") >= 1
    assert re.search(r"PVT_kw\w+", content), "Projekt-ID-Referenz fehlt"
