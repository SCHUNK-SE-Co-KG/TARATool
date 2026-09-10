"""Tests fuer TARA-0085: Kein automatisches Issue-Schliessen per 'Closes #NNN' in PRs.

Prueft:
- PR-Template enthaelt einen Hinweis, 'Closes/Fixes/Resolves #NNN' zu vermeiden
  und stattdessen 'Bezug: #NNN' zu verwenden.
- scripts/process_guard/check_pr_body_no_autoclose.sh erkennt verbotene
  Schluesselwoerter (closes, fixes, resolves + Issue-Referenz) im PR-Body und
  schlaegt in diesem Fall fehl (Exit 1); erlaubte Formulierungen (z.B.
  'Bezug: #NNN') und leere Bodies fuehren zu Exit 0.
- process-guard.yml ruft diesen Check als neuen Schritt (P-19) auf.
"""
import os
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO_ROOT, "scripts", "process_guard", "check_pr_body_no_autoclose.sh")
TEMPLATE = os.path.join(REPO_ROOT, ".github", "pull_request_template.md")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")


def _to_bash_path(path):
    """Wandelt einen Windows-Pfad in ein bash-kompatibles (WSL) Format um."""
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_check(body_text):
    """Schreibt body_text in eine temporaere Datei und ruft das Skript darauf auf."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write(body_text)
        body_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(SCRIPT), _to_bash_path(body_file)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result
    finally:
        os.remove(body_file)


@pytest.mark.TARA_0085
def test_pr_template_contains_no_autoclose_hint():
    """PR-Template muss vor 'Closes/Fixes #NNN' warnen und 'Bezug' als Alternative nennen."""
    with open(TEMPLATE, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Closes" in content or "closes" in content
    assert "Bezug" in content


@pytest.mark.TARA_0085
def test_script_fails_on_closes_keyword():
    result = _run_check("Diese PR loest ein Problem.\n\nCloses #142\n")
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"
    assert "FAIL P-19" in result.stdout


@pytest.mark.TARA_0085
def test_script_fails_on_fixes_keyword_case_insensitive():
    result = _run_check("fixes #7 - kleiner Bugfix")
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"
    assert "FAIL P-19" in result.stdout


@pytest.mark.TARA_0085
def test_script_fails_on_resolves_keyword():
    result = _run_check("Resolves: #99")
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"
    assert "FAIL P-19" in result.stdout


@pytest.mark.TARA_0085
def test_script_passes_on_bezug_reference():
    result = _run_check("## Aenderungen\n\nBezug: #142\n")
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"
    assert "OK P-19" in result.stdout


@pytest.mark.TARA_0085
def test_script_passes_on_empty_body():
    result = _run_check("")
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0085
def test_process_guard_workflow_calls_p19_check():
    with open(WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-19" in content
    assert "check_pr_body_no_autoclose.sh" in content
