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


@pytest.mark.TARA_0083
def test_process_guard_board_check_uses_project_token():
    """Der Board-Status-Check muss ein PAT mit Projects-Scope (PROJECT_TOKEN) verwenden,
    da der Standard-GITHUB_TOKEN keinen GraphQL-Zugriff auf organisationseigene
    Projects-V2-Boards hat ('Resource not accessible by integration')."""
    content = _read_workflow_text()
    board_section = content.split("P-02/P-09")[1].split("P-03")[0]
    assert "secrets.PROJECT_TOKEN" in board_section, \
        "Board-Status-Check muss secrets.PROJECT_TOKEN statt secrets.GITHUB_TOKEN verwenden"


def _board_section():
    content = _read_workflow_text()
    start = content.index("id: board_status")
    end = content.index("- name: P-03", start)
    return content[start:end]


@pytest.mark.TARA_0083
def test_process_guard_board_check_fails_on_missing_status_field():
    """TARA-0090: Fehlt das Statusfeld (z.B. umbenannt/nicht mitgeliefert), muss der
    Check explizit fehlschlagen statt 'unknown' stillschweigend als 'nicht Todo' zu werten."""
    section = _board_section()
    assert "!statusField" in section, \
        "Check muss explizit auf fehlendes Statusfeld pruefen (!statusField)"
    # setFailed muss vor der reinen currentStatus === 'Todo'-Pruefung erreichbar sein
    assert section.index("!statusField") < section.index("currentStatus === 'Todo'"), \
        "Fehlendes-Statusfeld-Check muss vor der Todo-Pruefung erfolgen"
    assert "'unknown'" not in section, \
        "Der stillschweigende 'unknown'-Fallback (TARA-0090) darf nicht mehr vorkommen"


@pytest.mark.TARA_0083
def test_process_guard_board_check_uses_exact_tara_id_match():
    """TARA-0091: Exaktes Matching der TARA-ID im Titel statt Substring-Vergleich
    (verhindert Fehltreffer wie TARA-0083 vs. TARA-00831)."""
    section = _board_section()
    assert ".includes(taraId)" not in section, \
        "Substring-Matching per includes(taraId) darf nicht mehr verwendet werden"
    assert "taraIdPattern" in section and "\\\\b" in section, \
        "Exaktes Wortgrenzen-Matching (RegExp mit \\b) fuer die TARA-ID fehlt"


@pytest.mark.TARA_0083
def test_process_guard_board_check_handles_graphql_errors():
    """TARA-0092: Der GraphQL-Aufruf muss gegen transiente Fehler abgesichert sein,
    damit ein API-/Token-/Rate-Limit-Fehler nicht den gesamten Compliance-Check crasht."""
    section = _board_section()
    assert "try {" in section and "catch (error)" in section, \
        "GraphQL-Aufruf muss in try/catch gekapselt sein"
    assert "core.warning" in section, \
        "Bei GraphQL-Fehler muss core.warning verwendet werden (soft-skip statt Crash)"
