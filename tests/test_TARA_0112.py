"""Tests for TARA-0112: Drei Teststufen (test:unit/test:integration/test:e2e)
statt pauschalem --noconftest.

PO-Entscheidungen (Issue #182):
1. Zuordnung Testdatei -> Stufe erfolgt ueber Namenskonvention/Verzeichnis:
   - tests/          (flach, Root)   -> test:unit          (kein Playwright)
   - tests/integration/               -> test:integration   (Playwright-Paket
     noetig, aber KEINE tests/conftest.py-Fixtures - eigene Session)
   - tests/e2e/                       -> test:e2e           (Playwright +
     tests/e2e/conftest.py-Fixtures, volle Browser-Interaktion)
2. Groesserer Umbau (physische Verzeichnisse, Dateien verschoben).
"""
import json
import re
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TESTS_DIR = PROJECT_ROOT / "tests"

# Files that use tests/conftest.py's Playwright fixtures directly
# (`from conftest import ...`) -> full E2E tier.
E2E_FILES = [
    "test_core.py",
    "test_assets.py",
    "test_calculations.py",
    "test_config.py",
    "test_damage_scenarios.py",
    "test_risk_analysis.py",
    "test_security_goals.py",
    "test_residual_risk.py",
    "test_residual_debug.py",
    "test_report_versioning.py",
    "test_tree_export.py",
    "test_e2e_workflow.py",
    "test_devses_features.py",
    "test_devses_security.py",
    "test_backward_compat.py",
    "test_security_fixes.py",
]

# Files that need the Playwright package/browser but manage their own
# session (Review-Agent runtime-scanner tests) -> integration tier.
INTEGRATION_FILES = [f"test_TARA_00{n}.py" for n in range(39, 56)]


@pytest.mark.TARA_0112
def test_e2e_directory_exists_and_contains_expected_files():
    e2e_dir = TESTS_DIR / "e2e"
    assert e2e_dir.is_dir(), "tests/e2e/ muss existieren"
    for name in E2E_FILES:
        assert (e2e_dir / name).is_file(), f"tests/e2e/{name} fehlt"


@pytest.mark.TARA_0112
def test_integration_directory_exists_and_contains_expected_files():
    integration_dir = TESTS_DIR / "integration"
    assert integration_dir.is_dir(), "tests/integration/ muss existieren"
    for name in INTEGRATION_FILES:
        assert (integration_dir / name).is_file(), f"tests/integration/{name} fehlt"


@pytest.mark.TARA_0112
def test_old_flat_paths_no_longer_exist():
    """Verschobene Dateien duerfen nicht mehr am alten (flachen) Ort liegen."""
    for name in E2E_FILES + INTEGRATION_FILES:
        assert not (TESTS_DIR / name).is_file(), (
            f"tests/{name} sollte nach tests/e2e/ oder tests/integration/ "
            "verschoben worden sein"
        )


@pytest.mark.TARA_0112
def test_e2e_conftest_has_playwright_fixtures():
    e2e_conftest = TESTS_DIR / "e2e" / "conftest.py"
    assert e2e_conftest.is_file(), "tests/e2e/conftest.py muss existieren"
    content = e2e_conftest.read_text(encoding="utf-8")
    assert "from playwright.sync_api import" in content
    assert "def app(" in content
    assert "def browser_context_args(" in content


@pytest.mark.TARA_0112
def test_root_conftest_no_longer_imports_playwright():
    """Root-conftest.py bleibt fuer Kollisions-Ignorierung, aber ohne
    Playwright-Import, damit test:unit ohne Playwright-Installation laeuft."""
    root_conftest = TESTS_DIR / "conftest.py"
    assert root_conftest.is_file(), "tests/conftest.py (Root) muss erhalten bleiben"
    content = root_conftest.read_text(encoding="utf-8")
    assert "import playwright" not in content.lower()
    assert "from playwright" not in content.lower()
    assert "collect_ignore_glob" in content


@pytest.mark.TARA_0112
def test_integration_tests_use_own_playwright_session_not_conftest_fixtures():
    """Integration-Tests duerfen KEINE tests/e2e/conftest.py-Fixtures per
    Parameter anfordern (sie verwalten Playwright selbst)."""
    fixture_pattern = re.compile(
        r"def test_\w+\([^)]*\b(app|app_with_analysis|page|browser_context)\b\s*[,)]"
    )
    for name in INTEGRATION_FILES:
        content = (TESTS_DIR / "integration" / name).read_text(encoding="utf-8")
        assert not fixture_pattern.search(content), (
            f"tests/integration/{name} darf keine conftest-Fixtures anfordern"
        )


@pytest.mark.TARA_0112
def test_integration_files_sys_path_points_to_project_root():
    """Nach dem Verschieben um eine Ebene tiefer muss sys.path.insert auf
    parent.parent.parent (Projekt-Root) zeigen, nicht mehr parent.parent."""
    for name in INTEGRATION_FILES:
        content = (TESTS_DIR / "integration" / name).read_text(encoding="utf-8")
        if "sys.path.insert" in content:
            assert "parent.parent.parent" in content, (
                f"tests/integration/{name}: sys.path.insert muss nach dem "
                "Verschieben auf parent.parent.parent zeigen"
            )


@pytest.mark.TARA_0112
def test_package_json_has_three_tier_scripts():
    package_json = json.loads((PROJECT_ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = package_json.get("scripts", {})
    assert "test:unit" in scripts
    assert "test:integration" in scripts
    assert "test:e2e" in scripts


@pytest.mark.TARA_0112
def test_unit_script_uses_noconftest_and_ignores_other_tiers():
    package_json = json.loads((PROJECT_ROOT / "package.json").read_text(encoding="utf-8"))
    script = package_json["scripts"]["test:unit"]
    assert "--noconftest" in script
    assert "tests/e2e" in script
    assert "tests/integration" in script


@pytest.mark.TARA_0112
def test_integration_and_e2e_scripts_do_not_use_noconftest():
    package_json = json.loads((PROJECT_ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = package_json["scripts"]
    assert "--noconftest" not in scripts["test:integration"]
    assert "--noconftest" not in scripts["test:e2e"]
    assert "tests/integration" in scripts["test:integration"]
    assert "tests/e2e" in scripts["test:e2e"]


@pytest.mark.TARA_0112
def test_ci_tests_yml_playwright_job_no_longer_uses_noconftest():
    ci_yml = (PROJECT_ROOT / ".github" / "workflows" / "ci-tests.yml").read_text(encoding="utf-8")
    # Isolate the playwright-tests job body
    match = re.search(r"playwright-tests:.*", ci_yml, re.DOTALL)
    assert match, "playwright-tests-Job nicht gefunden"
    job_body = match.group(0)
    assert "--noconftest" not in job_body, (
        "playwright-tests-Job darf --noconftest nicht mehr verwenden "
        "(Playwright/conftest-Fixtures sind dort installiert/erforderlich)"
    )


@pytest.mark.TARA_0112
def test_ci_tests_yml_playwright_job_also_runs_on_pull_request():
    ci_yml = (PROJECT_ROOT / ".github" / "workflows" / "ci-tests.yml").read_text(encoding="utf-8")
    match = re.search(r"playwright-tests:.*", ci_yml, re.DOTALL)
    assert match
    job_body = match.group(0)
    assert "github.event_name == 'push'" not in job_body, (
        "Vor Merge/Release (PR nach development/main) muss test:e2e "
        "verpflichtend mitlaufen, nicht nur bei push"
    )


@pytest.mark.TARA_0112
def test_readme_documents_three_tiers_not_blanket_noconftest():
    readme = (TESTS_DIR / "README.md").read_text(encoding="utf-8")
    assert "test:unit" in readme
    assert "test:integration" in readme
    assert "test:e2e" in readme
    assert "immer" not in readme.lower() or "--noconftest` immer angeben" not in readme


@pytest.mark.TARA_0112
def test_process_guard_agent_doc_references_test_tiers():
    doc = (PROJECT_ROOT / ".github" / "agents" / "process-guard.policy.md").read_text(
        encoding="utf-8"
    )
    assert "test:unit" in doc
    assert "test:integration" in doc
    assert "test:e2e" in doc


@pytest.mark.TARA_0112
def test_pytest_ini_still_resolves_new_story_tests_at_root():
    """Neue Story-Tests (z.B. dieses TARA-0112) bleiben am flachen
    tests/-Root (test:unit-Standardort) - Regressionsschutz fuer
    resolve_tara_testfile.sh, das 'tests/test_TARA_XXXX.py' erwartet."""
    assert (TESTS_DIR / "test_TARA_0112.py").is_file()
