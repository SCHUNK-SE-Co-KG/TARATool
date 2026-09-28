"""Tests fuer TARA-0113: Epic-Synchronisation ueber native Sub-Issues statt
Text-Checklisten (P-24 Neufassung).

Bisher (P-24 alt): Der Dev-Agent musste bei jeder Story mit `Bezug:
#<Epic-Nr>` manuell eine Markdown-Checkliste ("Enthaltene Stories") im
Epic-Issue-Body nachfuehren. Das erzeugt zwei parallele Wahrheiten (Freitext
`Bezug:`-Verweis im Story-Body vs. manuell gepflegte Checkliste im
Epic-Body), die auseinanderlaufen koennen.

Neu (P-24 ab TARA-0113): Neu angelegte Stories werden per
`scripts/workflow/link_epic_subissue.sh` als native GitHub-Sub-Issue-
Beziehung mit ihrem Epic verknuepft (REST-Endpunkt
`POST /repos/{owner}/{repo}/issues/{epic}/sub_issues`). Diese Beziehung ist
die neue Source of Truth fuer "Epic enthaelt Story X".

PO-Entscheidung (Issue #183): Die Migration gilt NUR fuer neu angelegte
Epics/Stories ab dieser Story. Bestehende Epics (z.B. #176 mit den Stories
#177-#182) behalten ihre Text-Checklisten unveraendert als historisches
Artefakt - es findet KEINE rueckwirkende Migration statt.
"""
import json
import os
import shlex
import subprocess
import sys
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(REPO_ROOT, "scripts", "workflow", "link_epic_subissue.sh")
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
BOARD_DOC = os.path.join(REPO_ROOT, "docs", "GITHUB_BOARD.md")
ENTWICKLUNG_DOC = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")


def _to_bash_path(path):
    """Wandelt einen Windows-Pfad in ein bash-kompatibles (WSL/Git-Bash) Format um."""
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


FAKE_GH_TEMPLATE = """#!/usr/bin/env bash
# Fake gh-Binary fuer Tests - protokolliert Aufrufe nach $CALL_LOG und
# antwortet je nach Sub-Kommando mit einer festen Antwort, ohne echte
# GitHub-API-Aufrufe zu machen.
echo "$@" >> "$CALL_LOG"
if [[ "$1" == "api" && "$2" == repos/*/issues/*/sub_issues ]]; then
{sub_issues_behavior}
elif [[ "$1" == "api" ]]; then
  # gh api repos/OWNER/REPO/issues/<story> --jq .id
  echo "{story_db_id}"
else
  echo "FAKE_GH: unbekannter Aufruf: $*" >&2
  exit 1
fi
"""


def _make_fake_gh(tmpdir, story_db_id=555111222, sub_issues_exit=0, sub_issues_stderr=""):
    call_log = os.path.join(tmpdir, "calls.log")
    fake_gh_path = os.path.join(tmpdir, "gh")
    if sub_issues_exit == 0:
        behavior = "  echo '{}'"
    else:
        behavior = f"  echo '{sub_issues_stderr}' >&2\n  exit {sub_issues_exit}"
    content = FAKE_GH_TEMPLATE.format(
        sub_issues_behavior=behavior, story_db_id=story_db_id
    )
    with open(fake_gh_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    os.chmod(fake_gh_path, 0o755)
    with open(call_log, "w", encoding="utf-8") as f:
        f.write("")
    return fake_gh_path, call_log


def _run_script(args, fake_gh_path, call_log):
    # Hinweis: Das lokale `bash` auf diesem Windows-Rechner ist WSL-bash, das
    # Umgebungsvariablen NICHT ueber die Prozessgrenze hinweg von Windows in
    # den WSL-Prozess uebernimmt (subprocess.run(env=...) wirkt hier nicht).
    # Daher werden GH_BIN/CALL_LOG explizit auf der bash-Kommandozeile
    # gesetzt statt ueber env= - das funktioniert identisch unter nativem
    # Linux-bash (z.B. in GitHub Actions).
    cmd = "GH_BIN={} CALL_LOG={} bash {} {}".format(
        shlex.quote(_to_bash_path(fake_gh_path)),
        shlex.quote(_to_bash_path(call_log)),
        shlex.quote(_to_bash_path(SCRIPT)),
        " ".join(shlex.quote(a) for a in args),
    )
    result = subprocess.run(
        ["bash", "-c", cmd],
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result


@pytest.mark.TARA_0113
def test_script_exists():
    assert os.path.isfile(SCRIPT), "scripts/workflow/link_epic_subissue.sh fehlt"


@pytest.mark.TARA_0113
def test_script_fails_on_missing_arguments():
    with tempfile.TemporaryDirectory() as tmp:
        fake_gh, call_log = _make_fake_gh(tmp)
        result = _run_script(["--owner", "acme", "--repo", "demo"], fake_gh, call_log)
        assert result.returncode == 1
        assert "FAIL" in result.stdout + result.stderr


@pytest.mark.TARA_0113
def test_script_fails_on_non_numeric_issue_numbers():
    with tempfile.TemporaryDirectory() as tmp:
        fake_gh, call_log = _make_fake_gh(tmp)
        result = _run_script(
            ["--owner", "acme", "--repo", "demo", "--epic", "abc", "--story", "183"],
            fake_gh,
            call_log,
        )
        assert result.returncode == 1
        assert "FAIL" in result.stdout + result.stderr


@pytest.mark.TARA_0113
def test_script_resolves_story_database_id_and_links_sub_issue():
    with tempfile.TemporaryDirectory() as tmp:
        fake_gh, call_log = _make_fake_gh(tmp, story_db_id=987654321)
        result = _run_script(
            ["--owner", "SCHUNK-SE-Co-KG", "--repo", "TARATool", "--epic", "176", "--story", "183"],
            fake_gh,
            call_log,
        )
        assert result.returncode == 0, f"stdout={result.stdout} stderr={result.stderr}"
        assert "OK" in result.stdout
        with open(call_log, "r", encoding="utf-8") as f:
            calls = f.read()
        # Story-Datenbank-ID muss abgefragt worden sein (REST issues/{story}, nicht node_id)...
        assert "issues/183" in calls
        # ...und als sub_issue_id an den sub_issues-Endpunkt des EPICS uebergeben worden sein.
        assert "issues/176/sub_issues" in calls
        assert "987654321" in calls


@pytest.mark.TARA_0113
def test_script_fails_when_gh_api_call_fails():
    with tempfile.TemporaryDirectory() as tmp:
        fake_gh, call_log = _make_fake_gh(
            tmp, sub_issues_exit=1, sub_issues_stderr="422 already a sub-issue"
        )
        result = _run_script(
            ["--owner", "SCHUNK-SE-Co-KG", "--repo", "TARATool", "--epic", "176", "--story", "183"],
            fake_gh,
            call_log,
        )
        assert result.returncode == 1
        assert "FAIL" in result.stdout + result.stderr


@pytest.mark.TARA_0113
def test_script_defaults_to_real_gh_binary_when_gh_bin_unset():
    """Ohne GH_BIN-Override muss das Skript auf den Namen 'gh' zurueckfallen
    (Produktivbetrieb in GitHub Actions), nicht auf einen hartcodierten Pfad."""
    with open(SCRIPT, "r", encoding="utf-8") as f:
        content = f.read()
    assert 'GH_BIN="${GH_BIN:-gh}"' in content


# ---------------------------------------------------------------------------
# Doku-Referenzen: P-24 Neufassung + Grandfathering bestehender Epics
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0113
def test_process_guard_doc_describes_native_sub_issues_for_p24():
    with open(PROCESS_GUARD_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "link_epic_subissue.sh" in content
    assert "Sub-Issue" in content


@pytest.mark.TARA_0113
def test_process_guard_doc_grandfathers_existing_epics():
    with open(PROCESS_GUARD_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "TARA-0113" in content
    # Muss klarstellen, dass bestehende Epics (Text-Checkliste) nicht migriert werden.
    assert "#176" in content or "bestehende" in content.lower()


@pytest.mark.TARA_0113
def test_entwicklungsprozess_doc_updated_for_p24():
    with open(ENTWICKLUNG_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "Sub-Issue" in content


@pytest.mark.TARA_0113
def test_github_board_doc_documents_sub_issue_endpoint():
    with open(BOARD_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "sub_issues" in content
    assert "link_epic_subissue.sh" in content


@pytest.mark.TARA_0113
def test_script_is_executable_bash():
    with open(SCRIPT, "r", encoding="utf-8") as f:
        first_line = f.readline()
    assert first_line.startswith("#!"), "Skript braucht Shebang"
