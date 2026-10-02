"""Tests fuer TARA-0108: Process Guard als deterministische Policy Engine
(kein LLM-Agent).

Ersetzt die bisherige Dev-Agent-Selbstattestierung fuer P-02 (Status "In
Progress" *vor* Arbeitsbeginn), P-09 (Status "inReview" *vor* PR-Erstellung)
und P-11 (Status "Freigabe" nach Merge, nicht direkt "Done") durch
deterministische, GitHub-API-basierte Pruefungen/Automatisierung:

- scripts/process_guard/status_timing_check.py: vergleicht Audit-Trail-
  Kommentar-Zeitstempel gegen Referenzereignisse (erster Commit / PR-Erstellung).
- scripts/process_guard/check_status_transition_timing.sh: Bash-Wrapper
  fuer den P-02/P-09-Check als CI-Schritt.
- scripts/process_guard/auto_set_freigabe_after_merge.py: setzt den
  Board-Status nach einem Merge automatisch auf "Freigabe" (P-11), statt
  dass der Dev-Agent dies manuell/eigenverantwortlich nachtraegt.
- agents/process_guard/PROCESS_GUARD_AGENT.md: Rollenbeschreibung als
  deterministische Policy Engine (kein LLM-Entscheidungstraeger),
  Automatisierungsmatrix aktualisiert (mind. P-02, P-09, P-10, P-11).
"""
import json
import os
import subprocess
import sys
import tempfile
from unittest.mock import patch

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
TIMING_SCRIPT = os.path.join(SCRIPTS_DIR, "check_status_transition_timing.sh")
TIMING_MODULE_PATH = os.path.join(SCRIPTS_DIR, "status_timing_check.py")
AUTO_FREIGABE_MODULE_PATH = os.path.join(SCRIPTS_DIR, "auto_set_freigabe_after_merge.py")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")
POST_MERGE_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "post-merge-status.yml")
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, ".github", "agents", "process-guard.policy.md")


def _to_bash_path(path):
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_timing_check(comments, pattern, event_iso, rule_label="P-02"):
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(comments, f)
        comments_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(TIMING_SCRIPT), _to_bash_path(comments_file), pattern, event_iso, rule_label],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result
    finally:
        os.remove(comments_file)


@pytest.fixture()
def timing_module():
    sys.path.insert(0, SCRIPTS_DIR)
    import status_timing_check  # noqa: E402
    yield status_timing_check
    sys.path.remove(SCRIPTS_DIR)
    sys.modules.pop("status_timing_check", None)


@pytest.fixture()
def auto_freigabe_module():
    sys.path.insert(0, SCRIPTS_DIR)
    import status_timing_check  # noqa: F401,E402  (Abhaengigkeit von auto_set_freigabe_after_merge)
    import auto_set_freigabe_after_merge  # noqa: E402
    yield auto_set_freigabe_after_merge
    sys.path.remove(SCRIPTS_DIR)
    sys.modules.pop("auto_set_freigabe_after_merge", None)
    sys.modules.pop("status_timing_check", None)


# ---------------------------------------------------------------------------
# Existenz
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0108
def test_timing_script_exists():
    assert os.path.isfile(TIMING_SCRIPT)


@pytest.mark.TARA_0108
def test_timing_module_exists():
    assert os.path.isfile(TIMING_MODULE_PATH)


@pytest.mark.TARA_0108
def test_auto_freigabe_module_exists():
    assert os.path.isfile(AUTO_FREIGABE_MODULE_PATH)


@pytest.mark.TARA_0108
def test_post_merge_workflow_exists():
    assert os.path.isfile(POST_MERGE_WORKFLOW)


# ---------------------------------------------------------------------------
# extract_issue_number (P-19-Bezug-Extraktion, Basis fuer P-11-Automatisierung)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0108
def test_extract_issue_number_finds_bezug(timing_module):
    assert timing_module.extract_issue_number("Bezug: #178") == 178


@pytest.mark.TARA_0108
def test_extract_issue_number_none_without_bezug(timing_module):
    assert timing_module.extract_issue_number("Kein Bezug hier.") is None


# ---------------------------------------------------------------------------
# Unit-Tests: find_earliest_transition_comment / validate_transition_before_event
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0108
def test_find_earliest_transition_comment_picks_earliest(timing_module):
    comments = [
        {"body": "P-02: Status Todo -> In Progress (zweiter Kommentar)", "created_at": "2026-09-28T09:00:00Z"},
        {"body": "P-02: Status Todo -> In Progress (erster Kommentar)", "created_at": "2026-09-28T08:00:00Z"},
    ]
    result = timing_module.find_earliest_transition_comment(comments, "In Progress")
    assert "erster" in result["body"]


@pytest.mark.TARA_0108
def test_validate_transition_before_event_passes_when_comment_before_event(timing_module):
    comments = [{"body": "P-02: Status Todo -> In Progress", "created_at": "2026-09-28T07:00:00Z"}]
    ok, message = timing_module.validate_transition_before_event(
        comments, "In Progress", "2026-09-28T08:00:00Z", "P-02"
    )
    assert ok is True
    assert "P-02" in message


@pytest.mark.TARA_0108
def test_validate_transition_before_event_fails_when_comment_after_event(timing_module):
    comments = [{"body": "P-02: Status Todo -> In Progress", "created_at": "2026-09-28T09:00:00Z"}]
    ok, message = timing_module.validate_transition_before_event(
        comments, "In Progress", "2026-09-28T08:00:00Z", "P-02"
    )
    assert ok is False


@pytest.mark.TARA_0108
def test_validate_transition_before_event_fails_without_matching_comment(timing_module):
    comments = [{"body": "Irgendein anderer Kommentar.", "created_at": "2026-09-28T07:00:00Z"}]
    ok, message = timing_module.validate_transition_before_event(
        comments, "In Progress", "2026-09-28T08:00:00Z", "P-02"
    )
    assert ok is False

@pytest.mark.TARA_0108
def test_find_earliest_transition_comment_ignores_beilaeufige_erwaehnung(timing_module):
    """Review-Finding PR #192: Ein Kommentar, der 'In Progress' nur beilaeufig
    erwaehnt (ohne '-> In Progress'-Uebergangsmuster), darf NICHT als
    P-02-Nachweis akzeptiert werden."""
    comments = [
        {"body": "Wir verschieben das jetzt nach In Progress, oder?", "created_at": "2026-09-28T06:00:00Z"},
    ]
    result = timing_module.find_earliest_transition_comment(comments, "In Progress")
    assert result is None


@pytest.mark.TARA_0108
def test_find_earliest_transition_comment_does_not_confuse_source_and_target(timing_module):
    """Review-Finding PR #192: 'In Progress' ist Teilstring/Quelle des P-09-
    Uebergangs 'Status In Progress -> inReview'. Dieser Kommentar darf NICHT
    faelschlich als P-02-Nachweis (Ziel 'In Progress') herangezogen werden."""
    comments = [
        {"body": "P-09: Status In Progress -> inReview", "created_at": "2026-09-28T05:00:00Z"},
    ]
    result = timing_module.find_earliest_transition_comment(comments, "In Progress")
    assert result is None


@pytest.mark.TARA_0108
def test_validate_transition_before_event_passes_at_exact_same_timestamp(timing_module):
    comments = [{"body": "P-09: Status In Progress -> inReview", "created_at": "2026-09-28T08:00:00Z"}]
    ok, message = timing_module.validate_transition_before_event(
        comments, "inReview", "2026-09-28T08:00:00Z", "P-09"
    )
    assert ok is True


# ---------------------------------------------------------------------------
# End-to-End Tests ueber das Bash-Skript
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0108
def test_script_passes_p02_before_first_commit():
    comments = [{"body": "P-02: Status Todo -> In Progress", "created_at": "2026-09-28T07:00:00Z"}]
    result = _run_timing_check(comments, "In Progress", "2026-09-28T08:00:00Z", "P-02")
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0108
def test_script_fails_p02_status_set_after_first_commit():
    comments = [{"body": "P-02: Status Todo -> In Progress", "created_at": "2026-09-28T09:00:00Z"}]
    result = _run_timing_check(comments, "In Progress", "2026-09-28T08:00:00Z", "P-02")
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0108
def test_script_passes_p09_before_pr_created():
    comments = [{"body": "P-09: Status In Progress -> inReview", "created_at": "2026-09-28T07:30:00Z"}]
    result = _run_timing_check(comments, "inReview", "2026-09-28T08:00:00Z", "P-09")
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0108
def test_script_fails_without_comments_file():
    result = subprocess.run(
        ["bash", _to_bash_path(TIMING_SCRIPT), "/tmp/does-not-exist-tara-0108.json", "In Progress", "2026-09-28T08:00:00Z", "P-02"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 1


# ---------------------------------------------------------------------------
# auto_set_freigabe_after_merge.py (P-11-Automatisierung)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0108
def test_auto_freigabe_main_fails_without_bezug(auto_freigabe_module):
    rc = auto_freigabe_module.main(["Kein Bezug hier.", "owner/repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 1


@pytest.mark.TARA_0108
def test_auto_freigabe_main_confirms_accepted_without_setting_done(auto_freigabe_module):
    """TARA-0121 (P-27): Nach dem Merge wird NICHT mehr automatisch 'Done'
    gesetzt - das wuerde das neue PO-Release-Gate umgehen. Das Skript
    bestaetigt nur den Status 'Accepted' und postet einen Audit-Kommentar."""
    with patch.object(auto_freigabe_module, "get_project_item_id", return_value="ITEM_ID"), \
         patch.object(auto_freigabe_module, "get_current_status_name", return_value="Accepted"), \
         patch.object(auto_freigabe_module, "post_audit_comment", return_value=True) as mock_comment:
        rc = auto_freigabe_module.main(["Bezug: #178", "owner/repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 0
    mock_comment.assert_called_once_with("owner/repo", 178)
    assert not hasattr(auto_freigabe_module, "set_status_done"), (
        "set_status_done wurde entfernt (TARA-0121) - Done wird nur noch "
        "ueber den check-po-release-Job (P-27) gesetzt"
    )


@pytest.mark.TARA_0108
def test_auto_freigabe_main_fails_when_item_not_found(auto_freigabe_module):
    with patch.object(auto_freigabe_module, "get_project_item_id", return_value=None):
        rc = auto_freigabe_module.main(["Bezug: #178", "owner/repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 1


@pytest.mark.TARA_0108
def test_auto_freigabe_main_fails_when_status_not_accepted(auto_freigabe_module):
    with patch.object(auto_freigabe_module, "get_project_item_id", return_value="ITEM_ID"), \
         patch.object(auto_freigabe_module, "get_current_status_name", return_value="inReview"):
        rc = auto_freigabe_module.main(["Bezug: #178", "owner/repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 1


@pytest.mark.TARA_0108
def test_auto_freigabe_main_fails_on_malformed_repo(auto_freigabe_module):
    rc = auto_freigabe_module.main(["Bezug: #178", "not-a-valid-repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 1


# ---------------------------------------------------------------------------
# Doku / Workflow-Referenzen
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0108
def test_workflow_contains_p02_and_p09_steps():
    with open(WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "check_status_transition_timing.sh" in content
    assert "P-02" in content
    assert "P-09" in content


@pytest.mark.TARA_0108
def test_post_merge_workflow_calls_auto_freigabe_script():
    with open(POST_MERGE_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "auto_set_freigabe_after_merge.py" in content
    assert "closed" in content
    assert "merged" in content.lower()


@pytest.mark.TARA_0108
def test_process_guard_doc_describes_deterministic_role():
    with open(PROCESS_GUARD_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "deterministisch" in content.lower()
    assert "keine LLM" in content or "kein LLM" in content


@pytest.mark.TARA_0108
def test_process_guard_doc_automation_matrix_updated():
    with open(PROCESS_GUARD_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    # P-02 und P-11 muessen nun als automatisiert (GitHub Actions) gefuehrt werden,
    # nicht mehr als "Manuell" (Regressionsschutz gegen Story #177/TARA-0107s P-10-Migration).
    assert "| P-02 |" in content
    assert "| P-11 |" in content
    p02_line = next(line for line in content.splitlines() if line.startswith("| P-02 |"))
    p11_line = next(line for line in content.splitlines() if line.startswith("| P-11 |"))
    assert "GitHub Actions" in p02_line
    assert "GitHub Actions" in p11_line
