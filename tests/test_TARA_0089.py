"""Tests fuer TARA-0089: P-10 Review-Agent-Aufruf technisch erzwingen (CI-Check).

Waehrend der Bulk-Bearbeitung von TARA-0083 bis TARA-0088 wurde der
Review-Agent fuer keine der PRs aktiviert, obwohl die Dev-Agent-Onboarding-Doku
dies als Pflichtschritt vorsieht. Es gab keine technische Durchsetzung.

Der urspruengliche Nachweis dieser Story (Freitext-Marker
"Review-Agent: OK - keine Findings" / "Review-Agent: Findings siehe #<NNN>",
1 Argument = Rohtext-Datei) wurde durch TARA-0107 bewusst als faelschungssicher
ABGELOEST: der Freitext-Marker bewies keine Bindung an den geprueften Commit
und war von jedem (Mensch oder Agent) frei schreibbar. Seit TARA-0107 verlangt
`check_review_agent_invoked.sh` zwingend einen SHA-gebundenen JSON-Block und
2 Argumente (<COMMENTS_JSON_FILE> <PR_HEAD_SHA>). Diese Tests wurden daher an
die neue Schnittstelle angepasst; die reinen Freitext-Marker-Tests sind
bewusst nicht mehr auf "OK" pruefbar (siehe tests/test_TARA_0107.py fuer den
expliziten Regressionstest "alter Marker wird jetzt abgelehnt").

Verbleibende, weiterhin gueltige Kernaussagen dieser Story:
- scripts/process_guard/check_review_agent_invoked.sh existiert und liefert
  bei fehlendem/unvollstaendigem Nachweis Exit 1 (FAIL P-10).
- process-guard.yml ruft diesen Check als Schritt (P-10) auf.
- Die Agenten-Doku (REVIEW_AGENT_WORKFLOW.md, DEV_AGENT_ONBOARDING.md)
  referenziert den automatisierten P-10-Check.
"""
import json
import os
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO_ROOT, "scripts", "process_guard", "check_review_agent_invoked.sh")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")
REVIEW_DOC = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")
ONBOARDING_DOC = os.path.join(REPO_ROOT, "agents", "dev_agent", "DEV_AGENT_ONBOARDING.md")

HEAD_SHA = "abc123def456abc123def456abc123def456abc"


def _to_bash_path(path):
    """Wandelt einen Windows-Pfad in ein bash-kompatibles (WSL) Format um."""
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_check(comment_bodies, head_sha=HEAD_SHA):
    """Schreibt comment_bodies (Liste von Strings) als JSON-Kommentar-Array
    in eine Temp-Datei und ruft das Skript mit (comments_file, head_sha) auf."""
    comments = [{"body": body, "created_at": "2026-09-28T08:00:00Z"} for body in comment_bodies]
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(comments, f)
        comments_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(SCRIPT), _to_bash_path(comments_file), head_sha],
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
def test_script_rejects_freetext_ok_marker_without_json():
    """Seit TARA-0107 reicht der alte Freitext-Marker allein nicht mehr aus."""
    result = _run_check(["Review-Agent: OK - keine Findings\n"])
    assert result.returncode == 1, f"Erwartete FAIL (Breaking Change TARA-0107): {result.stdout}{result.stderr}"
    assert "FAIL P-10" in result.stdout


@pytest.mark.TARA_0089
def test_script_rejects_freetext_findings_marker_without_json():
    """Seit TARA-0107 reicht der alte Freitext-Marker allein nicht mehr aus."""
    result = _run_check(["Review-Agent: Findings siehe #170\n"])
    assert result.returncode == 1, f"Erwartete FAIL (Breaking Change TARA-0107): {result.stdout}{result.stderr}"
    assert "FAIL P-10" in result.stdout


@pytest.mark.TARA_0089
def test_script_fails_without_marker():
    result = _run_check(["Normaler PR-Kommentar ohne Review-Agent-Nachweis."])
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"
    assert "FAIL P-10" in result.stdout


@pytest.mark.TARA_0089
def test_script_fails_on_missing_file():
    result = subprocess.run(
        ["bash", _to_bash_path(SCRIPT), "/tmp/does-not-exist-12345.txt", HEAD_SHA],
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
