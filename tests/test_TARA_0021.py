"""
[TARA-0021] Tests: ESLint lokale Projektkonfiguration erstellen
TDD Red-Phase: Diese Tests müssen FEHLSCHLAGEN bevor ESLint konfiguriert ist.
"""
import os
import subprocess
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.mark.TARA_0021
def test_eslint_config_exists():
    """eslint.config.js muss im Repo-Root existieren (Flat Config)."""
    assert os.path.isfile(os.path.join(REPO_ROOT, "eslint.config.js")), \
        "eslint.config.js fehlt – ESLint Flat Config anlegen"


@pytest.mark.TARA_0021
def test_eslint_in_dev_dependencies():
    """eslint muss in devDependencies stehen."""
    import json
    pkg = json.load(open(os.path.join(REPO_ROOT, "package.json")))
    assert "eslint" in pkg.get("devDependencies", {}), \
        "eslint fehlt in devDependencies"


@pytest.mark.TARA_0021
def test_eslint_config_references_browser_globals():
    """eslint.config.js muss Browser-Globals konfigurieren."""
    content = open(os.path.join(REPO_ROOT, "eslint.config.js")).read()
    assert "browser" in content, \
        "Browser-Globals fehlen in eslint.config.js"


@pytest.mark.TARA_0021
def test_eslint_config_references_project_globals():
    """eslint.config.js muss projektspezifische Globals definieren (ASSESSMENT_CONFIG etc.)."""
    content = open(os.path.join(REPO_ROOT, "eslint.config.js")).read()
    assert "ASSESSMENT_CONFIG" in content, \
        "Projektglobal ASSESSMENT_CONFIG fehlt in eslint.config.js"
    assert "analysisData" in content, \
        "Projektglobal analysisData fehlt in eslint.config.js"


@pytest.mark.TARA_0021
def test_package_json_lint_script():
    """package.json muss ein lint Script enthalten."""
    import json
    pkg = json.load(open(os.path.join(REPO_ROOT, "package.json")))
    scripts = pkg.get("scripts", {})
    assert "lint" in scripts, "lint Script fehlt in package.json"
    assert "eslint" in scripts["lint"], "lint Script muss eslint aufrufen"


@pytest.mark.TARA_0021
def test_eslint_passes_on_js_folder():
    """eslint js/ muss mit Exit-Code 0 durchlaufen (keine Errors)."""
    result = subprocess.run(
        ["npx", "eslint", "js/"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"ESLint-Fehler in js/:\n{result.stdout}\n{result.stderr}"
    )
