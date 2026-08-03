"""
[TARA-0020] Tests: Prettier installieren und Projektkonfiguration erstellen
TDD Red-Phase: Diese Tests müssen FEHLSCHLAGEN bevor Prettier eingerichtet ist.
"""
import os
import json
import subprocess
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.mark.TARA_0020
def test_package_json_exists():
    """package.json muss im Repo-Root existieren."""
    assert os.path.isfile(os.path.join(REPO_ROOT, "package.json")), \
        "package.json fehlt – npm init ausführen"


@pytest.mark.TARA_0020
def test_prettier_in_dev_dependencies():
    """prettier muss in devDependencies stehen."""
    pkg = json.load(open(os.path.join(REPO_ROOT, "package.json")))
    assert "prettier" in pkg.get("devDependencies", {}), \
        "prettier fehlt in devDependencies"


@pytest.mark.TARA_0020
def test_prettierrc_exists():
    """.prettierrc muss im Repo-Root existieren."""
    assert os.path.isfile(os.path.join(REPO_ROOT, ".prettierrc")), \
        ".prettierrc fehlt"


@pytest.mark.TARA_0020
def test_prettierrc_valid_json():
    """.prettierrc muss valides JSON mit sinnvollen Projekteinstellungen sein."""
    path = os.path.join(REPO_ROOT, ".prettierrc")
    config = json.load(open(path))
    assert "printWidth" in config, "printWidth fehlt in .prettierrc"
    assert "tabWidth" in config, "tabWidth fehlt in .prettierrc"


@pytest.mark.TARA_0020
def test_prettierignore_exists():
    """.prettierignore muss im Repo-Root existieren."""
    assert os.path.isfile(os.path.join(REPO_ROOT, ".prettierignore")), \
        ".prettierignore fehlt"


@pytest.mark.TARA_0020
def test_prettierignore_contains_key_entries():
    """.prettierignore muss node_modules und .venv ausschließen."""
    content = open(os.path.join(REPO_ROOT, ".prettierignore")).read()
    assert "node_modules" in content, "node_modules fehlt in .prettierignore"
    assert ".venv" in content, ".venv fehlt in .prettierignore"


@pytest.mark.TARA_0020
def test_package_json_format_scripts():
    """package.json muss format:check und format:write Scripts enthalten."""
    pkg = json.load(open(os.path.join(REPO_ROOT, "package.json")))
    scripts = pkg.get("scripts", {})
    assert "format:check" in scripts, "format:check Script fehlt"
    assert "format:write" in scripts, "format:write Script fehlt"
    assert "prettier --check" in scripts["format:check"], \
        "format:check muss 'prettier --check' enthalten"
    assert "prettier --write" in scripts["format:write"], \
        "format:write muss 'prettier --write' enthalten"


@pytest.mark.TARA_0020
def test_prettier_check_passes():
    """prettier --check muss auf dem aktuellen Codestand fehlerfrei laufen."""
    result = subprocess.run(
        ["npx", "prettier", "--check", "."],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"prettier --check hat Fehler gefunden:\n{result.stdout}\n{result.stderr}"
    )
