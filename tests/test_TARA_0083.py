"""Tests fuer TARA-0083: Prozess-Guard prueft Board-Status automatisiert (P-02/P-09).

Diese Tests validieren die statische Struktur von
`.github/workflows/process-guard.yml`: Der neue P-02/P-09-Check muss vorhanden
sein, ausschliesslich das SCHUNK-Board referenzieren (keine Bheowulf-IDs) und
darf keine Abhaengigkeit zu den CVE-Workflows einfuehren.
"""
import os
import re

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKFLOW_PATH = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")


def _read_workflow_text():
    return open(WORKFLOW_PATH, encoding="utf-8").read()


@pytest.mark.TARA_0083
def test_process_guard_workflow_file_exists():
    """process-guard.yml muss weiterhin existieren."""
    assert os.path.exists(WORKFLOW_PATH), "process-guard.yml fehlt"


@pytest.mark.TARA_0083
def test_process_guard_has_board_status_step():
    """Ein Schritt zur Pruefung des Board-Status (P-02/P-09) muss existieren."""
    content = _read_workflow_text()
    assert "P-02" in content and "P-09" in content, \
        "P-02/P-09 werden im Workflow-Titel/-Steps nicht referenziert"
    assert "Board-Status" in content, "Kein Board-Status-Check-Schritt gefunden"


@pytest.mark.TARA_0083
def test_process_guard_board_check_uses_schunk_project_only():
    """Der neue Check darf ausschliesslich die SCHUNK-Projekt-/Feld-ID verwenden."""
    content = _read_workflow_text()
    assert "PVT_kwDOBu4dv84BfbaR" in content, "SCHUNK-Projekt-ID fehlt im Board-Status-Check"
    assert "PVT_kwHOBLN4284BfLtb" not in content, \
        "Veraltete Bheowulf-Projekt-ID darf nicht im Prozess-Guard vorkommen"
    assert "BH_PROJECT" not in content and "BH_FIELD" not in content, \
        "Keine Bheowulf-Board-Variablen im Prozess-Guard"


@pytest.mark.TARA_0083
def test_process_guard_board_check_has_no_cve_dependency():
    """Der Board-Status-Check darf keinerlei Abhaengigkeit zu CVE-Workflows einfuehren."""
    content = _read_workflow_text()
    assert "cve-scan" not in content.lower(), "Keine Abhaengigkeit zu cve-scan.yml erlaubt"
    assert "cve-monthly-report" not in content.lower(), \
        "Keine Abhaengigkeit zu cve-monthly-report.yml erlaubt"


@pytest.mark.TARA_0083
def test_process_guard_board_check_fails_on_todo_status():
    """Der Check muss bei Status 'Todo' explizit fehlschlagen (core.setFailed / FAIL)."""
    content = _read_workflow_text()
    assert "currentStatus === 'Todo'" in content, \
        "Check muss expliziten Vergleich mit Status 'Todo' enthalten"
    assert "setFailed" in content, "Check muss den Job bei Verstoss aktiv fehlschlagen lassen"


@pytest.mark.TARA_0083
def test_process_guard_has_project_read_permissions():
    """Workflow-Permissions muessen Lesezugriff auf Repository-Projects gewaehren."""
    content = _read_workflow_text()
    assert re.search(r"repository-projects:\s*read", content), \
        "repository-projects: read fehlt in den Workflow-Permissions"
