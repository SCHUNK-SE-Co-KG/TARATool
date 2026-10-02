"""Tests fuer TARA-0125: Neuregelung der Regressionstest-Policy (Issue #208).

PO-Entscheidung: Alle drei vorgeschlagenen Optionen kommen kombiniert zum
Einsatz, PLUS eine risikobasierte Ausnahme, die unabhaengig von A/B/C immer
sofort eine volle Regression erzwingt:

- **Option A** (verfeinertes P-06b/P-06c): nicht mehr "jede Code-Aenderung
  erzwingt sofort volle Regression", sondern nur Risikopfade (P-06c);
  sonstiger gemeinsam genutzter Code wird auf B/C verschoben.
- **Option B** (Epic-Batch-Gate, P-17): nach Merge pruefen, ob alle
  Sub-Issues eines Epics Accepted/PO Release/Done sind; wenn ja, einmalig
  volle Suite + automatischer Release-PR development -> main.
- **Option C** (Monatslauf, P-17b): einmal im Monat volle Suite auf main.
- **Risikobasierte Ausnahme** (P-06c): bestimmte Pfade (Datenmodell,
  Import/Export, Risikoberechnung, Report-Generierung, State-Verwaltung,
  Auth/Security, Basiskomponenten, Build/Deploy-Konfig, Testinfrastruktur)
  loesen IMMER sofort eine volle Regression aus.

Diese Testdatei deckt das Zusammenspiel aller vier Bausteine ab:
- scripts/process_guard/regression_risk_paths.txt (Risikokategorien)
- scripts/process_guard/check_regression_scope.sh (P-06c-Logik, bereits in
  tests/test_TARA_0111.py grundlegend getestet - hier Fokus auf
  Risikopfad-Erkennung je Kategorie)
- scripts/workflow/epic_batch_gate.py (Option B)
- .github/workflows/epic-batch-gate.yml / monthly-regression.yml (Option B/C)
- docs/process_definition.yml + generierte Doku (P-06b/P-06c/P-17/P-17b)
"""
import os
import shutil
import subprocess
import sys
import tempfile
from unittest import mock

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PG_SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
WORKFLOW_SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "workflow")
CHECK_REGRESSION_SCOPE = os.path.join(PG_SCRIPTS_DIR, "check_regression_scope.sh")
RISK_PATHS_FILE = os.path.join(PG_SCRIPTS_DIR, "regression_risk_paths.txt")
EPIC_BATCH_GATE_SCRIPT = os.path.join(WORKFLOW_SCRIPTS_DIR, "epic_batch_gate.py")
EPIC_BATCH_GATE_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "epic-batch-gate.yml")
MONTHLY_REGRESSION_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "monthly-regression.yml")
PROCESS_DEFINITION = os.path.join(REPO_ROOT, "docs", "process_definition.yml")
ENTWICKLUNG_DOC = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
GENERATE_DOCS_SCRIPT = os.path.join(PG_SCRIPTS_DIR, "generate_process_docs.py")

sys.path.insert(0, WORKFLOW_SCRIPTS_DIR)
import epic_batch_gate  # noqa: E402


def _to_bash_path(path):
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_bash(args, cwd):
    posix_args = [_to_bash_path(a) for a in args]
    result = subprocess.run(
        ["bash"] + posix_args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return result


def _git(args, cwd):
    result = subprocess.run(["git"] + args, cwd=cwd, capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, f"git {args} fehlgeschlagen: {result.stderr}"
    return result.stdout.strip()


def _write(repo_dir, rel_path, content):
    abs_path = os.path.join(repo_dir, rel_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, "w", encoding="utf-8") as f:
        f.write(content)


@pytest.fixture
def temp_repo():
    tmp_dir = tempfile.mkdtemp(prefix="process_guard_test_0125_")
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


# ---------------------------------------------------------------------------
# scripts/process_guard/regression_risk_paths.txt
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0125
def test_risk_paths_file_exists():
    assert os.path.isfile(RISK_PATHS_FILE), "regression_risk_paths.txt fehlt"


@pytest.mark.TARA_0125
@pytest.mark.parametrize(
    "example_path",
    [
        "js/core/globals.js",  # Datenmodell
        "config/some_config.json",  # Datenmodell
        "js/report/report_export.js",  # Import/Export + Report-Generierung
        "js/attack_tree/dot_export.js",  # Import/Export
        "js/modules/risk_analysis.js",  # Risikoberechnung
        "js/attack_tree/attack_tree_calc.js",  # Risikoberechnung
        "js/core/analysis_core.js",  # State-Verwaltung
        "js/auth/login.js",  # Auth/Security
        "js/core/utils.js",  # Basiskomponenten
        "css/main.css",  # Basiskomponenten
        "package.json",  # Build/Deploy
        ".github/workflows/ci-tests.yml",  # Build/Deploy
        "scripts/process_guard/check_regression_scope.sh",  # Testinfrastruktur
        "scripts/workflow/transition_engine.py",  # Testinfrastruktur
        "tests/pytest.ini",  # Testinfrastruktur (liegt real in tests/, nicht im Repo-Root)
    ],
)
def test_risk_paths_cover_all_po_categories(example_path):
    with open(RISK_PATHS_FILE, "r", encoding="utf-8") as f:
        patterns = [
            line.strip()
            for line in f
            if line.strip() and not line.strip().startswith("#")
        ]
    import re

    assert any(re.search(p, example_path) for p in patterns), (
        f"Kein Risikopfad-Pattern matcht '{example_path}' - Risikokategorie "
        "aus Issue #208 nicht abgedeckt"
    )


# ---------------------------------------------------------------------------
# scripts/process_guard/check_regression_scope.sh (P-06c Risiko-Erkennung)
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0125
def test_regression_scope_flags_risk_path_as_immediate(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, "tests/test_TARA_0125.py", "def test_x():\n    pass\n")
    _write(temp_repo, "js/modules/risk_analysis.js", "// risk calc change\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: aenderung risikopfad"], cwd=temp_repo)

    result = _run_bash(
        [CHECK_REGRESSION_SCOPE, base, "tests/test_TARA_0125.py", RISK_PATHS_FILE],
        cwd=temp_repo,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "SHARED_CODE_CHANGED=true" in result.stdout
    assert "REGRESSION_NEEDED=true" in result.stdout


@pytest.mark.TARA_0125
def test_regression_scope_defers_non_risk_shared_code(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, "tests/test_TARA_0125.py", "def test_x():\n    pass\n")
    _write(temp_repo, "js/misc/unrelated_helper.js", "// harmless helper\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "test: aenderung nicht-risikopfad"], cwd=temp_repo)

    result = _run_bash(
        [CHECK_REGRESSION_SCOPE, base, "tests/test_TARA_0125.py", RISK_PATHS_FILE],
        cwd=temp_repo,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "SHARED_CODE_CHANGED=true" in result.stdout
    assert "REGRESSION_NEEDED=false" in result.stdout


@pytest.mark.TARA_0125
def test_regression_scope_not_needed_for_doc_only_change(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, "tests/test_TARA_0125.py", "def test_x():\n    pass\n")
    _write(temp_repo, "docs/some_doc.md", "# doc change\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "docs: update"], cwd=temp_repo)

    result = _run_bash(
        [CHECK_REGRESSION_SCOPE, base, "tests/test_TARA_0125.py", RISK_PATHS_FILE],
        cwd=temp_repo,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "SHARED_CODE_CHANGED=false" in result.stdout
    assert "REGRESSION_NEEDED=false" in result.stdout


# ---------------------------------------------------------------------------
# scripts/workflow/epic_batch_gate.py (Option B, reine Entscheidungslogik)
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0125
def test_epic_batch_gate_script_exists():
    assert os.path.isfile(EPIC_BATCH_GATE_SCRIPT), "scripts/workflow/epic_batch_gate.py fehlt"


@pytest.mark.TARA_0125
def test_epic_batch_status_ready_when_all_stories_done():
    statuses = {1: "Accepted", 2: "PO Release", 3: "Done"}
    result = epic_batch_gate.epic_batch_status([1, 2, 3], lambda n: statuses[n])
    assert result["ready"] is True


@pytest.mark.TARA_0125
def test_epic_batch_status_not_ready_when_one_story_in_progress():
    statuses = {1: "Accepted", 2: "In Progress"}
    result = epic_batch_gate.epic_batch_status([1, 2], lambda n: statuses[n])
    assert result["ready"] is False
    assert "2" in result["reason"]


@pytest.mark.TARA_0125
def test_epic_batch_status_not_ready_when_no_sub_issues():
    result = epic_batch_gate.epic_batch_status([], lambda n: None)
    assert result["ready"] is False
    assert "Sub-Issues" in result["reason"]


@pytest.mark.TARA_0125
def test_epic_batch_status_not_ready_when_status_unknown():
    result = epic_batch_gate.epic_batch_status([1], lambda n: None)
    assert result["ready"] is False


@pytest.mark.TARA_0125
def test_main_reports_ready_true_via_epic_argument(capsys):
    with mock.patch.object(
        epic_batch_gate, "fetch_sub_issue_numbers_via_gh", return_value=[1, 2]
    ), mock.patch.object(
        epic_batch_gate, "fetch_status_via_gh", side_effect=lambda n: "Done"
    ):
        rc = epic_batch_gate.main(["--epic", "176", "--repo", "acme/demo"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "EPIC_BATCH_READY=true" in out
    assert "EPIC_NUMBER=176" in out


@pytest.mark.TARA_0125
def test_main_reports_ready_false_via_story_issue_argument(capsys):
    with mock.patch.object(
        epic_batch_gate, "fetch_parent_epic_via_gh", return_value=176
    ), mock.patch.object(
        epic_batch_gate, "fetch_sub_issue_numbers_via_gh", return_value=[1, 2]
    ), mock.patch.object(
        epic_batch_gate, "fetch_status_via_gh", side_effect=lambda n: "Done" if n == 1 else "inReview"
    ):
        rc = epic_batch_gate.main(["--story-issue", "1", "--repo", "acme/demo"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "EPIC_BATCH_READY=false" in out
    assert "EPIC_NUMBER=176" in out


@pytest.mark.TARA_0125
def test_main_handles_story_without_parent_epic(capsys):
    with mock.patch.object(epic_batch_gate, "fetch_parent_epic_via_gh", return_value=None):
        rc = epic_batch_gate.main(["--story-issue", "999", "--repo", "acme/demo"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "EPIC_BATCH_READY=false" in out
    assert "kein verknuepftes Parent-Epic" in out


# ---------------------------------------------------------------------------
# Workflows (Option B/C)
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0125
def test_epic_batch_gate_workflow_exists_and_triggers_on_development_merge():
    assert os.path.isfile(EPIC_BATCH_GATE_WORKFLOW)
    with open(EPIC_BATCH_GATE_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "pull_request" in content
    assert "development" in content
    assert "epic_batch_gate.py" in content


@pytest.mark.TARA_0125
def test_epic_batch_gate_workflow_creates_release_pr_when_ready():
    with open(EPIC_BATCH_GATE_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "gh pr create" in content
    assert "--base main" in content
    assert "--head development" in content


@pytest.mark.TARA_0125
def test_monthly_regression_workflow_exists_and_is_scheduled():
    assert os.path.isfile(MONTHLY_REGRESSION_WORKFLOW)
    with open(MONTHLY_REGRESSION_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "schedule" in content
    assert "cron" in content
    assert "ref: main" in content


# ---------------------------------------------------------------------------
# Prozessdefinition / generierte Doku
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0125
def test_process_definition_contains_new_rules():
    with open(PROCESS_DEFINITION, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-06c:" in content
    assert "P-17b:" in content
    assert "epic_batch_gate.py" in content
    assert "monthly-regression.yml" in content


@pytest.mark.TARA_0125
def test_generated_docs_are_in_sync_with_process_definition():
    result = subprocess.run(
        [sys.executable, GENERATE_DOCS_SCRIPT, "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.TARA_0125
def test_entwicklungsprozess_doc_describes_new_regression_policy():
    with open(ENTWICKLUNG_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-06c" in content
    assert "P-17b" in content
    assert "Epic-Batch" in content
