"""
[TARA-0006] Tests: parse_trivy Skripte konsolidieren (obsolete Dateien entfernen)
TDD Red-Phase: Diese Tests müssen FEHLSCHLAGEN solange die Dateien noch existieren.
"""
import os
import subprocess
import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@pytest.mark.TARA_0006
def test_parse_trivy_py_removed():
    """parse_trivy.py darf nicht mehr im Repo existieren – obsoletes Fremdprojekt-Skript."""
    path = os.path.join(REPO_ROOT, "parse_trivy.py")
    assert not os.path.isfile(path), (
        "parse_trivy.py muss entfernt werden (hardcoded Windows-Pfade, grasp-sensor Projekt)"
    )


@pytest.mark.TARA_0006
def test_parse_trivy2_py_removed():
    """parse_trivy2.py darf nicht mehr im Repo existieren – obsoletes Fremdprojekt-Skript."""
    path = os.path.join(REPO_ROOT, "parse_trivy2.py")
    assert not os.path.isfile(path), (
        "parse_trivy2.py muss entfernt werden (hardcoded Windows-Pfade, grasp-sensor Projekt)"
    )


@pytest.mark.TARA_0006
def test_trivy_output_txt_in_gitignore():
    """trivy_output.txt muss in .gitignore stehen."""
    gitignore_path = os.path.join(REPO_ROOT, ".gitignore")
    assert os.path.isfile(gitignore_path), ".gitignore fehlt"
    content = open(gitignore_path).read()
    assert "trivy_output.txt" in content, (
        "trivy_output.txt fehlt in .gitignore"
    )


@pytest.mark.TARA_0006
def test_trivy_output_txt_not_tracked_by_git():
    """trivy_output.txt darf nicht von git getrackt werden."""
    result = subprocess.run(
        ["git", "ls-files", "trivy_output.txt"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == "", (
        "trivy_output.txt wird noch von git getrackt – 'git rm --cached trivy_output.txt' ausführen"
    )


@pytest.mark.TARA_0006
def test_no_other_trivy_json_artifacts_tracked():
    """Keine *_trivy.json Dateien dürfen von git getrackt werden."""
    result = subprocess.run(
        ["git", "ls-files", "--", ":(glob)**/*_trivy.json"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == "", (
        f"Getrackte Trivy-JSON-Artefakte in Unterverzeichnissen gefunden: {result.stdout.strip()}"
    )
