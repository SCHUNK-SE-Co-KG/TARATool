"""Tests fuer TARA-0111: Robusterer TDD-Nachweis (finaler Red-Green-Vergleich).

P-04 (check_red_phase.sh) beweist bislang nur, dass IRGENDEINE fruehe Version
der Testdatei am Anfang fehlgeschlagen ist - nicht, dass der FINALE Teststand
(PR-Head) tatsaechlich etwas Sinnvolles prueft. Diese Tests decken das neue,
zusaetzliche Gate ab:

- check_final_red_green.sh: Der finale Testinhalt (aktueller Workdir-Stand)
  muss beim Code des Basis-Branches fehlschlagen und beim Code des PR-Head
  bestehen.
- check_regression_scope.sh: Ermittelt, ob ausser der Story-Testdatei auch
  "gemeinsam genutzter Code" veraendert wurde (dann muss die volle
  Regressionssuite laufen, sonst genuegt die Story-Testdatei - PO-Entscheidung
  TARA-0111 Frage 3).
"""
import json
import os
import shutil
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
CHECK_FINAL_RED_GREEN = os.path.join(SCRIPTS_DIR, "check_final_red_green.sh")
CHECK_REGRESSION_SCOPE = os.path.join(SCRIPTS_DIR, "check_regression_scope.sh")


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


def _run_bash(args, cwd, env=None):
    """Fuehrt ein Bash-Skript aus (Git-Bash/WSL unter Windows, bash unter Linux/CI)."""
    posix_args = [_to_bash_path(a) for a in args]
    run_env = None
    if env is not None:
        run_env = dict(os.environ)
        run_env.update(env)
    result = subprocess.run(
        ["bash"] + posix_args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=120,
        env=run_env,
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
    tmp_dir = tempfile.mkdtemp(prefix="process_guard_test_0111_")
    try:
        _git(["init", "-q"], cwd=tmp_dir)
        _git(["config", "user.email", "test@example.com"], cwd=tmp_dir)
        _git(["config", "user.name", "Process Guard Test"], cwd=tmp_dir)
        os.makedirs(os.path.join(tmp_dir, "tests"), exist_ok=True)
        os.makedirs(os.path.join(tmp_dir, "scripts"), exist_ok=True)
        with open(os.path.join(tmp_dir, "README.md"), "w", encoding="utf-8") as f:
            f.write("# Test Repo\n")
        _git(["add", "."], cwd=tmp_dir)
        _git(["commit", "-q", "-m", "chore: initial commit"], cwd=tmp_dir)
        yield tmp_dir
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _base_sha(repo_dir):
    return _git(["rev-parse", "HEAD"], cwd=repo_dir)


def _write(repo_dir, rel_path, content):
    abs_path = os.path.join(repo_dir, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content)


# ---------------------------------------------------------------------------
# check_final_red_green.sh
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0111
def test_final_red_green_missing_testfile_is_skipped(temp_repo):
    """Testdatei existiert nicht -> Check wird uebersprungen (INFO, exit 0)."""
    base = _base_sha(temp_repo)
    result = _run_bash(
        [CHECK_FINAL_RED_GREEN, base, "tests/test_TARA_9101.py"], cwd=temp_repo
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "INFO" in result.stdout


@pytest.mark.TARA_0111
def test_final_red_green_passes_when_base_fails_and_head_passes(temp_repo):
    """Regelfall: finaler Testinhalt schlaegt am Basis-Code fehl, besteht am
    PR-Head -> OK."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9102.py"
    impl_rel = "impl_9102.py"

    # Implementierung + finaler Testinhalt am (simulierten) PR-Head-Workdir:
    _write(temp_repo, impl_rel, "def answer():\n    return 42\n")
    _write(
        temp_repo,
        testfile_rel,
        "import sys, os\n"
        "sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))\n"
        "from impl_9102 import answer\n\n"
        "def test_answer():\n"
        "    assert answer() == 42\n",
    )
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "feat+test: TARA-9102"], cwd=temp_repo)

    result = _run_bash([CHECK_FINAL_RED_GREEN, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "OK" in result.stdout


@pytest.mark.TARA_0111
def test_final_red_green_fails_when_test_already_passes_at_base(temp_repo):
    """Szenario (PO-Empfehlung, Gap in P-04): Der finale Test wuerde auch OHNE
    die neue Implementierung am Basis-Code bereits bestehen (z.B. trivialer
    oder inhaltsloser Test) -> das muss als FAIL erkannt werden, auch wenn
    irgendein FRUEHERER Commit auf dem Branch mal rot war."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9103.py"

    _write(temp_repo, testfile_rel, "def test_trivial():\n    assert True\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: TARA-9103 (inhaltsloser Test - Luecke in altem P-04)"], cwd=temp_repo)

    result = _run_bash([CHECK_FINAL_RED_GREEN, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 1, result.stdout + result.stderr
    assert "FAIL" in result.stdout


@pytest.mark.TARA_0111
def test_final_red_green_fails_when_head_does_not_pass(temp_repo):
    """Der finale Testinhalt schlaegt auch am PR-Head fehl (kaputte
    Implementierung) -> FAIL."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9104.py"

    _write(temp_repo, testfile_rel, "def test_broken():\n    assert False, 'noch nicht fertig'\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: TARA-9104 (Implementierung fehlt noch)"], cwd=temp_repo)

    result = _run_bash([CHECK_FINAL_RED_GREEN, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 1, result.stdout + result.stderr
    assert "FAIL" in result.stdout


# ---------------------------------------------------------------------------
# check_regression_scope.sh
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0111
def test_regression_scope_not_needed_for_test_file_only_change(temp_repo):
    """Nur die Story-Testdatei wurde geaendert -> keine volle Regression noetig."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9105.py"
    _write(temp_repo, testfile_rel, "def test_ok():\n    assert True\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: TARA-9105"], cwd=temp_repo)

    result = _run_bash([CHECK_REGRESSION_SCOPE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "REGRESSION_NEEDED=false" in result.stdout


@pytest.mark.TARA_0111
def test_regression_scope_needed_for_shared_script_change(temp_repo):
    """Zusaetzlich zur Story-Testdatei wurde gemeinsam genutzter Code unter
    scripts/ veraendert -> volle Regression noetig."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9106.py"
    _write(temp_repo, testfile_rel, "def test_ok():\n    assert True\n")
    _write(temp_repo, "scripts/shared_helper.py", "def helper():\n    return 1\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "feat+test: TARA-9106"], cwd=temp_repo)

    result = _run_bash([CHECK_REGRESSION_SCOPE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "REGRESSION_NEEDED=true" in result.stdout


@pytest.mark.TARA_0111
def test_regression_scope_not_needed_for_docs_only_change(temp_repo):
    """Zusaetzliche Doku-Aenderungen (docs/, agents/*.md) loesen keine volle
    Regression aus, da sie pytest nicht beeinflussen."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9107.py"
    _write(temp_repo, testfile_rel, "def test_ok():\n    assert True\n")
    _write(temp_repo, "docs/SOME_DOC.md", "# Doku\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "docs+test: TARA-9107"], cwd=temp_repo)

    result = _run_bash([CHECK_REGRESSION_SCOPE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "REGRESSION_NEEDED=false" in result.stdout


@pytest.mark.TARA_0111
def test_regression_scope_not_fooled_by_readme_prefixed_code_filename(temp_repo):
    """Review-Finding (High, Code-Review PR #196): eine Code-Datei, deren Name
    lediglich mit 'README'/'CONTRIBUTING'/'CHANGELOG' BEGINNT (z.B. eine
    absichtlich so benannte Implementierungsdatei), darf NICHT faelschlich
    als reine Doku-Datei durchgehen und die volle Regression umgehen."""
    base = _base_sha(temp_repo)
    testfile_rel = "tests/test_TARA_9108.py"
    _write(temp_repo, testfile_rel, "def test_ok():\n    assert True\n")
    _write(temp_repo, "README_exploit.py", "# eigentlich Implementierungscode, kein Markdown\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "feat+test: TARA-9108 (Tarnung als Doku)"], cwd=temp_repo)

    result = _run_bash([CHECK_REGRESSION_SCOPE, base, testfile_rel], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "REGRESSION_NEEDED=true" in result.stdout


@pytest.mark.TARA_0111
def test_workflow_p06b_excludes_playwright_tests_like_ci_tests_yml():
    """Review-Regression: der P-06b-Schritt in process-guard.yml lief zunaechst
    OHNE Playwright-Ausschlussliste und schlug deshalb bei jeder ausgeloesten
    vollen Regression fehl (Playwright ist in diesem Job nicht installiert).
    Die Ignore-Liste muss dieselben Playwright-Testverzeichnisse ausschliessen
    wie der 'test:unit'-Skript in package.json (TARA-0112: seit der
    Verzeichnis-Umstellung auf tests/e2e/ und tests/integration/ statt
    einzelner Dateinamen)."""
    package_json_path = os.path.join(REPO_ROOT, "package.json")
    process_guard_path = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")
    with open(package_json_path, "r", encoding="utf-8") as f:
        package_json = json.load(f)
    with open(process_guard_path, "r", encoding="utf-8") as f:
        pg_content = f.read()

    import re

    unit_script = package_json["scripts"]["test:unit"]
    unit_ignores = set(re.findall(r"--ignore=([^\s;\\]+)", unit_script))
    assert unit_ignores, "test:unit sollte eine Playwright-Ignore-Liste enthalten"

    p06b_start = pg_content.index("P-06b – Regressionssuite")
    p06b_section = pg_content[p06b_start : p06b_start + 4000]
    pg_ignores = set(re.findall(r"--ignore=([^\s;\\]+)", p06b_section))

    missing = unit_ignores - pg_ignores
    assert not missing, (
        f"P-06b-Schritt fehlen Playwright-Ignores aus test:unit: {missing} "
        "(P-06b wuerde sonst bei ausgeloester voller Regression an "
        "Playwright-Setup-Fehlern scheitern)"
    )


# ---------------------------------------------------------------------------
# Workflow-Verdrahtung
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0111
def test_workflow_wires_final_red_green_and_regression_scope_checks():
    """process-guard.yml ruft die neuen P-04b/P-06b-Skripte auf (TARA-0111)."""
    workflow_path = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")
    with open(workflow_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "check_final_red_green.sh" in content
    assert "check_regression_scope.sh" in content
    assert "P-04b" in content
    assert "P-06b" in content


@pytest.mark.TARA_0111
def test_process_guard_doc_describes_red_green_refactor():
    """PROCESS_GUARD_AGENT.md beschreibt den finalen Red-Green-Nachweis
    (nicht mehr nur 'erster Commit war rot')."""
    doc_path = os.path.join(REPO_ROOT, ".github", "agents", "process-guard.policy.md")
    with open(doc_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-04b" in content
    assert "Mutation Testing" in content
