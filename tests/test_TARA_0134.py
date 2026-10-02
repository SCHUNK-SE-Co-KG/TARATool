"""Tests fuer TARA-0134: Playwright-UI-Tests risikobasiert skopieren statt
bei jedem PR (ci-tests.yml).

Hintergrund (siehe Issue #230): Reale CI-Laufzeiten zeigten, dass der
Playwright-Job in `ci-tests.yml` (`test:integration` + `test:e2e`, 33 Tests,
Chromium-Install) bei JEDEM PR ~9,7 Minuten lief - unabhaengig davon, ob
ueberhaupt UI-/Browser-relevanter Code veraendert wurde. Analog zur bereits
bestehenden risikobasierten Python-Regressionspolitik (TARA-0125/P-06c,
`check_regression_scope.sh`) wird hier dieselbe Idee auf den teureren
Playwright-Job uebertragen:

- scripts/process_guard/regression_risk_paths_ui.txt: UI-/Browser-relevante
  Risikopfade (JS, CSS, index.html, Testinfrastruktur fuer
  integration/e2e, ci-tests.yml selbst, package.json/-lock.json).
- scripts/process_guard/check_playwright_scope.sh: entscheidet anhand des
  Diffs gegen den Basis-SHA, ob PLAYWRIGHT_NEEDED=true/false ist.
- .github/workflows/ci-tests.yml: Playwright-Job wird uebersprungen, wenn
  PLAYWRIGHT_NEEDED=false (PR-Event) - bei push-Events (z.B. nach Merge)
  bleibt der Job als Sicherheitsnetz immer aktiv.
- .github/workflows/epic-batch-gate.yml / monthly-regression.yml: fuehren
  seit dieser Story AUCH die Playwright-Suite aus (bisher per
  --ignore=tests/e2e --ignore=tests/integration komplett ausgeschlossen -
  das waere nach Einfuehrung des PR-Skips eine Luecke, in der Playwright-
  Tests nie mehr automatisiert liefen).
"""
import os
import re
import shutil
import subprocess
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PG_SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
RISK_PATHS_UI_FILE = os.path.join(PG_SCRIPTS_DIR, "regression_risk_paths_ui.txt")
CHECK_PLAYWRIGHT_SCOPE = os.path.join(PG_SCRIPTS_DIR, "check_playwright_scope.sh")
CI_TESTS_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "ci-tests.yml")
EPIC_BATCH_GATE_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "epic-batch-gate.yml")
MONTHLY_REGRESSION_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "monthly-regression.yml")
PROCESS_DEFINITION = os.path.join(REPO_ROOT, "docs", "process_definition.yml")
ENTWICKLUNG_DOC = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
GENERATE_DOCS_SCRIPT = os.path.join(PG_SCRIPTS_DIR, "generate_process_docs.py")


def _to_bash_path(path):
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_bash(args, cwd):
    posix_args = [_to_bash_path(a) for a in args]
    result = subprocess.run(["bash"] + posix_args, cwd=cwd, capture_output=True, text=True, timeout=60)
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
    tmp_dir = tempfile.mkdtemp(prefix="process_guard_test_0134_")
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
# scripts/process_guard/regression_risk_paths_ui.txt
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0134
def test_risk_paths_ui_file_exists():
    assert os.path.isfile(RISK_PATHS_UI_FILE), "regression_risk_paths_ui.txt fehlt"


@pytest.mark.TARA_0134
@pytest.mark.parametrize(
    "example_path",
    [
        "index.html",
        "js/core/globals.js",
        "js/modules/risk_analysis.js",
        "css/main.css",
        "tests/integration/test_TARA_0041.py",
        "tests/e2e/test_some_flow.py",
        "tests/conftest.py",
        "package.json",
        "package-lock.json",
        ".github/workflows/ci-tests.yml",
    ],
)
def test_risk_paths_ui_cover_expected_categories(example_path):
    with open(RISK_PATHS_UI_FILE, "r", encoding="utf-8") as f:
        patterns = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
    assert any(re.search(p, example_path) for p in patterns), (
        f"Kein UI-Risikopfad-Pattern matcht '{example_path}' - Kategorie nicht abgedeckt"
    )


# ---------------------------------------------------------------------------
# scripts/process_guard/check_playwright_scope.sh
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0134
def test_check_playwright_scope_script_exists():
    assert os.path.isfile(CHECK_PLAYWRIGHT_SCOPE), "check_playwright_scope.sh fehlt"


@pytest.mark.TARA_0134
def test_playwright_scope_needed_for_js_change(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, "js/modules/risk_analysis.js", "// ui-relevant change\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "feat: js change"], cwd=temp_repo)

    result = _run_bash([CHECK_PLAYWRIGHT_SCOPE, base, RISK_PATHS_UI_FILE], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PLAYWRIGHT_NEEDED=true" in result.stdout


@pytest.mark.TARA_0134
def test_playwright_scope_not_needed_for_python_only_change(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, "scripts/some_unrelated_script.py", "# python only change\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "feat: python change"], cwd=temp_repo)

    result = _run_bash([CHECK_PLAYWRIGHT_SCOPE, base, RISK_PATHS_UI_FILE], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PLAYWRIGHT_NEEDED=false" in result.stdout


@pytest.mark.TARA_0134
def test_playwright_scope_not_needed_for_doc_only_change(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, "docs/some_doc.md", "# doc change\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "docs: update"], cwd=temp_repo)

    result = _run_bash([CHECK_PLAYWRIGHT_SCOPE, base, RISK_PATHS_UI_FILE], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PLAYWRIGHT_NEEDED=false" in result.stdout


@pytest.mark.TARA_0134
def test_playwright_scope_needed_for_ci_workflow_change(temp_repo):
    base = _base_sha(temp_repo)
    _write(temp_repo, ".github/workflows/ci-tests.yml", "# workflow change\n")
    _git(["add", "."], cwd=temp_repo)
    _git(["commit", "-q", "-m", "ci: workflow change"], cwd=temp_repo)

    result = _run_bash([CHECK_PLAYWRIGHT_SCOPE, base, RISK_PATHS_UI_FILE], cwd=temp_repo)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PLAYWRIGHT_NEEDED=true" in result.stdout


# ---------------------------------------------------------------------------
# .github/workflows/ci-tests.yml: Playwright-Job skopiert bei PR, Sicherheits-
# netz bei push
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0134
def test_ci_tests_workflow_has_scope_gate_step():
    with open(CI_TESTS_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "check_playwright_scope.sh" in content


@pytest.mark.TARA_0134
def test_ci_tests_workflow_always_runs_playwright_on_push():
    with open(CI_TESTS_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    # Sicherheitsnetz: bei push (z.B. nach Merge nach development) soll der
    # Playwright-Job NICHT uebersprungen werden koennen, nur bei pull_request.
    assert "github.event_name == 'push'" in content or "github.event_name != 'pull_request'" in content


# ---------------------------------------------------------------------------
# Epic-Batch-Gate / Monatslauf: Playwright als Sicherheitsnetz ergaenzen
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0134
def test_epic_batch_gate_workflow_also_runs_playwright_suite():
    with open(EPIC_BATCH_GATE_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "playwright install" in content
    assert "test:integration" in content
    assert "test:e2e" in content


@pytest.mark.TARA_0134
def test_monthly_regression_workflow_also_runs_playwright_suite():
    with open(MONTHLY_REGRESSION_WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "playwright install" in content
    assert "test:integration" in content
    assert "test:e2e" in content


# ---------------------------------------------------------------------------
# Prozessdefinition / generierte Doku
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0134
def test_process_definition_contains_playwright_scope_rule():
    with open(PROCESS_DEFINITION, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-06d" in content
    assert "check_playwright_scope.sh" in content


@pytest.mark.TARA_0134
def test_generated_docs_are_in_sync_with_process_definition():
    result = subprocess.run(
        [os.sys.executable, GENERATE_DOCS_SCRIPT, "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.TARA_0134
def test_entwicklungsprozess_doc_describes_playwright_scope_policy():
    with open(ENTWICKLUNG_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "P-06d" in content
