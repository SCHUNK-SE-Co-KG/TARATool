"""Tests fuer TARA-0084: Regressionsschutz fuer den Prozess-Guard-Workflow selbst.

Diese Tests bauen temporaere Git-Repositories auf und fuehren die aus
process-guard.yml ausgelagerten Skripte (scripts/process_guard/*.sh) gegen
vier bekannte Szenarien aus, um zukuenftige Regressionen (z.B. die am
2026-09-10 gefundenen Bugs: fehlender pytest-timeout-Install, verschluckter
Exit-Code durch 'set -e', doppeltes --timeout in pytest.ini) zu verhindern.
"""
import os
import shutil
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
CHECK_TEST_FILE_EXISTS = os.path.join(SCRIPTS_DIR, "check_test_file_exists.sh")
CHECK_RED_PHASE = os.path.join(SCRIPTS_DIR, "check_red_phase.sh")


def _to_bash_path(path):
    """Wandelt einen Windows-Pfad in ein bash-kompatibles Format um.

    Unter WSL (bash.exe leitet auf wsl.exe um) werden Pfade im Format
    /mnt/c/... erwartet; unter Git-Bash/Linux genuegt ein Forward-Slash-Pfad.
    """
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_bash(args, cwd):
    """Fuehrt ein Bash-Skript aus (Git-Bash/WSL unter Windows, bash unter Linux/CI)."""
    posix_args = [_to_bash_path(a) for a in args]
    result = subprocess.run(
        ["bash"] + posix_args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return result


def _git(args, cwd):
    result = subprocess.run(
        ["git"] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, f"git {args} fehlgeschlagen: {result.stderr}"
    return result.stdout.strip()


@pytest.fixture
def temp_repo():
    """Erstellt ein minimales, isoliertes Git-Repo fuer Szenario-Tests."""
    tmp_dir = tempfile.mkdtemp(prefix="process_guard_test_")
    try:
        _git(["init", "-q"], cwd=tmp_dir)
        _git(["config", "user.email", "test@example.com"], cwd=tmp_dir)
        _git(["config", "user.name", "Process Guard Test"], cwd=tmp_dir)
        os.makedirs(os.path.join(tmp_dir, "tests"), exist_ok=True)
        with open(os.path.join(tmp_dir, "README.md"), "w", encoding="utf-8") as f:
            f.write("# Test Repo\n")
        _git(["add", "."], cwd=tmp_dir)
        _git(["commit", "-q", "-m", "chore: initial commit"], cwd=tmp_dir)
        yield tmp_dir
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _base_sha(repo_dir):
    return _git(["rev-parse", "HEAD"], cwd=repo_dir)


@pytest.mark.TARA_0084
def test_scenario_missing_test_file_fails_p03(temp_repo):
    """Szenario: Fehlende Testdatei -> P-03 muss FAIL liefern."""
    result = _run_bash([CHECK_TEST_FILE_EXISTS, "feature/TARA-9001-demo"], cwd=temp_repo)
    assert result.returncode == 1, f"P-03 haette fehlschlagen muessen: {result.stdout}{result.stderr}"
    assert "FAIL P-03" in result.stdout


@pytest.mark.TARA_0084
def test_scenario_test_file_present_passes_p03(temp_repo):
    """Szenario: Testdatei vorhanden -> P-03 muss OK liefern."""
    testfile = os.path.join(temp_repo, "tests", "test_TARA_9001.py")
    with open(testfile, "w", encoding="utf-8") as f:
        f.write("def test_dummy():\n    assert True\n")
    result = _run_bash([CHECK_TEST_FILE_EXISTS, "feature/TARA-9001-demo"], cwd=temp_repo)
    assert result.returncode == 0, f"P-03 haette bestehen sollen: {result.stdout}{result.stderr}"
    assert "OK P-03" in result.stdout


@pytest.mark.TARA_0084
def test_scenario_red_commit_without_implementation_passes_p04(temp_repo):
    """Szenario: Red-Commit OHNE Implementierung -> P-04 muss OK liefern."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9002.py"
    testfile_abs = os.path.join(temp_repo, testfile_rel)
    with open(testfile_abs, "w", encoding="utf-8") as f:
        f.write("def test_that_fails():\n    assert False, 'not implemented yet'\n")
    _git(["add", testfile_rel], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: TARA-9002 Red"], cwd=temp_repo)

    result = _run_bash([CHECK_RED_PHASE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 0, f"P-04 haette bestehen sollen: {result.stdout}{result.stderr}"
    assert "OK P-04" in result.stdout


@pytest.mark.TARA_0084
def test_scenario_red_commit_with_implementation_fails_p04(temp_repo):
    """Szenario: Red-Commit MIT Implementierung im selben Commit -> P-04 muss FAIL liefern."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9003.py"
    impl_rel = "impl_module.py"
    with open(os.path.join(temp_repo, testfile_rel), "w", encoding="utf-8") as f:
        f.write("def test_that_fails():\n    assert False\n")
    with open(os.path.join(temp_repo, impl_rel), "w", encoding="utf-8") as f:
        f.write("# Implementierung, die NICHT im Red-Commit sein darf\n")
    _git(["add", testfile_rel, impl_rel], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test+impl: TARA-9003 (Verstoss gegen P-04)"], cwd=temp_repo)

    result = _run_bash([CHECK_RED_PHASE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 1, f"P-04 haette fehlschlagen muessen: {result.stdout}{result.stderr}"
    assert "FAIL P-04" in result.stdout
    assert "Implementierungsdateien" in result.stdout


@pytest.mark.TARA_0084
def test_scenario_green_tests_in_red_commit_fails_p04(temp_repo):
    """Szenario: Tests sind bereits GRUEN im Red-Commit (TDD verletzt) -> P-04 muss FAIL liefern."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9004.py"
    with open(os.path.join(temp_repo, testfile_rel), "w", encoding="utf-8") as f:
        f.write("def test_that_passes_immediately():\n    assert True\n")
    _git(["add", testfile_rel], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: TARA-9004 (aber bereits gruen - TDD verletzt)"], cwd=temp_repo)

    result = _run_bash([CHECK_RED_PHASE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 1, f"P-04 haette fehlschlagen muessen: {result.stdout}{result.stderr}"
    assert "FAIL P-04" in result.stdout
    assert "GRUEN" in result.stdout
