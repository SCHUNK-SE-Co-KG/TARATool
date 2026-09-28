"""Tests fuer TARA-0083: Prozess-Guard prueft Board-Status automatisiert (P-02/P-09).

HINWEIS (TARA-0108): Die urspruengliche Implementierung nutzte einen
`actions/github-script`-Schritt, der lediglich pruefte, dass der Board-Status
zum Zeitpunkt des PR-Checks nicht mehr "Todo" war (naeherungsweise, nicht
zeitlich exakt nachweisbar). TARA-0108 ersetzt diesen Ansatz durch einen
deterministischen Vergleich unveraenderlicher Zeitstempel (Audit-Trail-
Kommentar auf dem Story-Issue vs. erster Commit/PR-Erstellung, siehe
`scripts/process_guard/status_timing_check.py` und `tests/test_TARA_0108.py`).
Diese Tests wurden entsprechend angepasst, um die neue Implementierung zu
validieren, statt die veraltete github-script-Variante vorauszusetzen.
"""
import os
import re

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKFLOW_PATH = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")


def _read_workflow_text():
    return open(WORKFLOW_PATH, encoding="utf-8").read()


def _board_section():
    content = _read_workflow_text()
    start = content.index("id: board_status")
    end = content.index("- name: P-03", start)
    return content[start:end]


@pytest.mark.TARA_0083
def test_process_guard_workflow_file_exists():
    """process-guard.yml muss weiterhin existieren."""
    assert os.path.exists(WORKFLOW_PATH), "process-guard.yml fehlt"


@pytest.mark.TARA_0083
def test_process_guard_has_board_status_step():
    """Ein Schritt zur deterministischen Pruefung des Statuswechsel-Zeitpunkts
    (P-02/P-09) muss existieren (TARA-0108: check_status_transition_timing.sh)."""
    content = _read_workflow_text()
    assert "P-02" in content and "P-09" in content, \
        "P-02/P-09 werden im Workflow-Titel/-Steps nicht referenziert"
    assert "check_status_transition_timing.sh" in content, \
        "Deterministischer Zeitstempel-Check (TARA-0108) fehlt"


@pytest.mark.TARA_0083
def test_process_guard_board_check_has_no_cve_dependency():
    """Der Board-Status-Check darf keinerlei Abhaengigkeit zu CVE-Workflows einfuehren."""
    content = _read_workflow_text()
    assert "cve-scan" not in content.lower(), "Keine Abhaengigkeit zu cve-scan.yml erlaubt"
    assert "cve-monthly-report" not in content.lower(), \
        "Keine Abhaengigkeit zu cve-monthly-report.yml erlaubt"


@pytest.mark.TARA_0083
def test_process_guard_has_project_read_permissions():
    """Workflow-Permissions muessen Lesezugriff auf Repository-Projects gewaehren."""
    content = _read_workflow_text()
    assert re.search(r"repository-projects:\s*read", content), \
        "repository-projects: read fehlt in den Workflow-Permissions"


@pytest.mark.TARA_0083
def test_process_guard_board_check_extracts_issue_from_bezug():
    """TARA-0108: Der Check muss die Issue-Nummer aus der PR-Body-Pflichtangabe
    'Bezug: #NNN' extrahieren (wiederverwendet extract_issue_number), statt den
    Boardstatus per TARA-ID-Substring im Branch-Namen zu suchen."""
    section = _board_section()
    assert "extract_issue_number" in section, \
        "Muss extract_issue_number aus status_timing_check.py wiederverwenden"
    assert "Bezug: #NNN" in section, \
        "Muss auf fehlende Bezug-Angabe pruefen (graceful skip)"


@pytest.mark.TARA_0083
def test_process_guard_board_check_uses_audit_trail_comments():
    """TARA-0108: Der Check muss die Issue-Kommentare (Audit-Trail) des per
    'Bezug: #NNN' referenzierten Story-Issues abrufen, nicht den Board-Status
    direkt per GraphQL abfragen."""
    section = _board_section()
    assert "issues/${ISSUE_NUMBER}/comments" in section, \
        "Muss Issue-Kommentare des referenzierten Story-Issues abrufen"


@pytest.mark.TARA_0083
def test_process_guard_board_check_compares_first_commit_and_pr_created():
    """TARA-0108: P-02 wird gegen den Zeitstempel des ersten Commits, P-09 gegen
    die PR-Erstellung (created_at) geprueft - beides unveraenderliche GitHub-
    Zeitstempel, keine Momentaufnahme des aktuellen Boardstatus."""
    section = _board_section()
    assert "FIRST_COMMIT_ISO" in section, "P-02-Referenzereignis (erster Commit) fehlt"
    assert "PR_CREATED_AT" in section, "P-09-Referenzereignis (PR-Erstellung) fehlt"
