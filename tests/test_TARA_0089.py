"""Tests fuer TARA-0089: P-10 Review-Agent-Aufruf technisch erzwingen (CI-Check).

Waehrend der Bulk-Bearbeitung von TARA-0083 bis TARA-0088 wurde der
Review-Agent fuer keine der PRs aktiviert, obwohl die Dev-Agent-Onboarding-Doku
dies als Pflichtschritt vorsieht. Es gab keine technische Durchsetzung.

Diese Tests decken den neuen P-10-Check ab:
- scripts/process_guard/check_review_agent_invoked.sh erkennt einen
  maschinenlesbaren Nachweis ("Review-Agent: OK - keine Findings" ODER
  "Review-Agent: Findings siehe #<NNN>") in den PR-Kommentaren und gibt bei
  Vorhandensein Exit 0 zurueck; fehlt der Nachweis, Exit 1 (FAIL).
- process-guard.yml ruft diesen Check als neuen Schritt (P-10) auf.
- Die Agenten-Doku (REVIEW_AGENT_WORKFLOW.md, DEV_AGENT_ONBOARDING.md)
  referenziert den neuen automatisierten P-10-Check.
"""
import os
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO_ROOT, "scripts", "process_guard", "check_review_agent_invoked.sh")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")
REVIEW_DOC = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")
ONBOARDING_DOC = os.path.join(REPO_ROOT, "agents", "dev_agent", "DEV_AGENT_ONBOARDING.md")


def _to_bash_path(path):
    """Wandelt einen Windows-Pfad in ein bash-kompatibles (WSL) Format um."""
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_check(comments_text):
    """Schreibt comments_text in eine temporaere Datei und ruft das Skript darauf auf."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write(comments_text)
        comments_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(SCRIPT), _to_bash_path(comments_file)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result
    finally:
        os.remove(comments_file)


@pytest.mark.TARA_0089
def test_script_exists():
    assert os.path.isfile(SCRIPT), "check_review_agent_invoked.sh fehlt"


@pytest.mark.TARA_0089
def test_script_passes_on_ok_marker():
    result = _run_check("Review-Agent: OK - keine Findings\n")
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"
    assert "OK P-10" in result.stdout


@pytest.mark.TARA_0089
def test_script_passes_on_findings_marker():
    result = _run_check("Review-Agent: Findings siehe #170\n")
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"
    assert "OK P-10" in result.stdout


@pytest.mark.TARA_0089
def test_script_passes_on_marker_among_other_comments():
    result = _run_check(
        "Irgendein anderer Kommentar.\n---\nReview-Agent: OK - keine Findings\n---\nNoch ein Kommentar.\n"
    )
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0089
def test_script_fails_without_marker():
    result = _run_check("Normaler PR-Kommentar ohne Review-Agent-Nachweis.\n")
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"
    assert "FAIL P-10" in result.stdout


@pytest.mark.TARA_0089
def test_script_fails_on_missing_file():
    result = subprocess.run(
        ["bash", _to_bash_path(SCRIPT), "/tmp/does-not-exist-12345.txt"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 1
    assert "FAIL P-10" in result.stdout


@pytest.mark.TARA_0089
def test_process_guard_workflow_calls_p10_check():
    with open(WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-10" in content
    assert "check_review_agent_invoked.sh" in content


@pytest.mark.TARA_0089
def test_review_agent_doc_references_p10_check():
    with open(REVIEW_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-10" in content
    assert "check_review_agent_invoked.sh" in content or "Review-Agent: OK - keine Findings" in content


@pytest.mark.TARA_0089
def test_onboarding_doc_references_p10_check():
    with open(ONBOARDING_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-10" in content
