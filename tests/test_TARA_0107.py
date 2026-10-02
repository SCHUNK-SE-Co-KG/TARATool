"""Tests fuer TARA-0107: Faelschungssicherer, SHA-gebundener Review-Nachweis (P-10).

Ersetzt den bisherigen Freitext-Marker-Ansatz aus TARA-0089
(`Review-Agent: OK - keine Findings` / `Review-Agent: Findings siehe #<NNN>`),
der keinerlei Bindung an den tatsaechlich geprueften Commit hatte und von
jedem (Mensch oder Agent) geschrieben werden konnte.

Neuer Nachweis: Der Review-Agent veroeffentlicht einen maschinenlesbaren
JSON-Block (Fenced Code Block ```json ... ```) als PR-Kommentar, mit
mindestens den Feldern:

    story, pull_request, reviewed_head_sha, review_profile_version,
    result, critical, high, timestamp

`scripts/process_guard/check_review_agent_invoked.sh` (aufgerufen mit
<COMMENTS_JSON_FILE> <PR_HEAD_SHA>) validiert ueber
`scripts/process_guard/review_result_parser.py`:

1. Es existiert ein solcher JSON-Block in den PR-Kommentaren.
2. `reviewed_head_sha` entspricht dem uebergebenen, aktuellen PR-Head-SHA
   (ein Push NACH dem Review invalidiert den Nachweis automatisch).
3. `critical == 0 and high == 0`, ODER es ist ein `findings_issue` referenziert.

Alte reine Freitext-Marker ohne JSON-Block werden NICHT mehr akzeptiert.
"""
import json
import os
import subprocess
import sys
import tempfile

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
SCRIPT = os.path.join(SCRIPTS_DIR, "check_review_agent_invoked.sh")
PARSER_MODULE_PATH = os.path.join(SCRIPTS_DIR, "review_result_parser.py")
WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")
REVIEW_DOC = os.path.join(REPO_ROOT, ".github", "agents", "reviewer.agent.md")
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, ".github", "agents", "process-guard.policy.md")
REPORT_BUILDER = os.path.join(REPO_ROOT, "agents", "review_agent", "report_builder.py")

HEAD_SHA = "abc123def456abc123def456abc123def456abc"
OTHER_SHA = "0000000000000000000000000000000000000f"


def _to_bash_path(path):
    """Wandelt einen Windows-Pfad in ein bash-kompatibles (WSL/Git-Bash) Format um."""
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_check(comments, head_sha=HEAD_SHA):
    """Schreibt `comments` (Liste von Dicts) als JSON in eine Temp-Datei und
    ruft check_review_agent_invoked.sh mit <comments_file> <head_sha> auf."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump(comments, f)
        comments_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(SCRIPT), _to_bash_path(comments_file), head_sha],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result
    finally:
        os.remove(comments_file)


def _review_comment_body(**overrides):
    payload = {
        "story": "TARA-0107",
        "pull_request": 123,
        "reviewed_head_sha": HEAD_SHA,
        "review_profile_version": "2.1",
        "result": "passed",
        "critical": 0,
        "high": 0,
        "timestamp": "2026-09-28T08:00:00Z",
    }
    payload.update(overrides)
    return "Review-Agent-Ergebnis:\n\n```json\n" + json.dumps(payload) + "\n```\n"


# ---------------------------------------------------------------------------
# Existenz der neuen Bausteine
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0107
def test_script_exists():
    assert os.path.isfile(SCRIPT), "check_review_agent_invoked.sh fehlt"


@pytest.mark.TARA_0107
def test_parser_module_exists():
    assert os.path.isfile(PARSER_MODULE_PATH), "review_result_parser.py fehlt"


# ---------------------------------------------------------------------------
# Unit-Tests fuer review_result_parser.py (direkter Import)
# ---------------------------------------------------------------------------

@pytest.fixture()
def parser_module():
    sys.path.insert(0, SCRIPTS_DIR)
    import review_result_parser  # noqa: E402  (dynamischer Import nach sys.path-Insert)
    yield review_result_parser
    sys.path.remove(SCRIPTS_DIR)
    sys.modules.pop("review_result_parser", None)


@pytest.mark.TARA_0107
def test_extract_latest_review_result_finds_json_block(parser_module):
    comments = [
        {"body": "Ganz normaler Kommentar ohne JSON.", "created_at": "2026-09-28T07:00:00Z"},
        {"body": _review_comment_body(), "created_at": "2026-09-28T08:00:00Z"},
    ]
    result = parser_module.extract_latest_review_result(comments)
    assert result is not None
    assert result["reviewed_head_sha"] == HEAD_SHA
    assert result["critical"] == 0
    assert result["high"] == 0


@pytest.mark.TARA_0107
def test_extract_latest_review_result_ignores_incomplete_json(parser_module):
    incomplete = "```json\n{\"foo\": \"bar\"}\n```"
    comments = [{"body": incomplete, "created_at": "2026-09-28T07:00:00Z"}]
    assert parser_module.extract_latest_review_result(comments) is None


@pytest.mark.TARA_0107
def test_extract_latest_review_result_picks_last_matching(parser_module):
    older = _review_comment_body(critical=1, high=0, findings_issue=170)
    newer = _review_comment_body(critical=0, high=0)
    comments = [
        {"body": older, "created_at": "2026-09-28T07:00:00Z"},
        {"body": newer, "created_at": "2026-09-28T08:00:00Z"},
    ]
    result = parser_module.extract_latest_review_result(comments)
    assert result["critical"] == 0


@pytest.mark.TARA_0107
def test_validate_review_result_passes_on_matching_sha_no_findings(parser_module):
    result = json.loads(
        _review_comment_body().split("```json\n", 1)[1].rsplit("\n```", 1)[0]
    )
    ok, message = parser_module.validate_review_result(result, HEAD_SHA)
    assert ok is True
    assert "OK" in message or message


@pytest.mark.TARA_0107
def test_validate_review_result_fails_on_none():
    sys.path.insert(0, SCRIPTS_DIR)
    import review_result_parser as prm
    ok, message = prm.validate_review_result(None, HEAD_SHA)
    assert ok is False
    assert "Nachweis" in message
    sys.path.remove(SCRIPTS_DIR)
    sys.modules.pop("review_result_parser", None)


@pytest.mark.TARA_0107
def test_validate_review_result_fails_on_sha_mismatch(parser_module):
    payload = json.loads(
        _review_comment_body(reviewed_head_sha=OTHER_SHA)
        .split("```json\n", 1)[1]
        .rsplit("\n```", 1)[0]
    )
    ok, message = parser_module.validate_review_result(payload, HEAD_SHA)
    assert ok is False
    assert "veraltet" in message.lower() or "sha" in message.lower()


@pytest.mark.TARA_0107
def test_validate_review_result_fails_on_blocking_findings_without_issue(parser_module):
    payload = json.loads(
        _review_comment_body(critical=1, high=0)
        .split("```json\n", 1)[1]
        .rsplit("\n```", 1)[0]
    )
    ok, message = parser_module.validate_review_result(payload, HEAD_SHA)
    assert ok is False
    assert "finding" in message.lower()


@pytest.mark.TARA_0107
def test_validate_review_result_passes_on_blocking_findings_with_issue(parser_module):
    payload = json.loads(
        _review_comment_body(critical=0, high=1, findings_issue=170)
        .split("```json\n", 1)[1]
        .rsplit("\n```", 1)[0]
    )
    ok, message = parser_module.validate_review_result(payload, HEAD_SHA)
    assert ok is True


# ---------------------------------------------------------------------------
# End-to-End Tests ueber das Bash-Skript (subprocess)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0107
def test_script_passes_on_valid_json_matching_sha():
    comments = [{"body": _review_comment_body(), "created_at": "2026-09-28T08:00:00Z"}]
    result = _run_check(comments, head_sha=HEAD_SHA)
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"
    assert "OK P-10" in result.stdout


@pytest.mark.TARA_0107
def test_script_fails_on_sha_mismatch_after_push():
    comments = [{"body": _review_comment_body(), "created_at": "2026-09-28T08:00:00Z"}]
    result = _run_check(comments, head_sha=OTHER_SHA)
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"
    assert "FAIL P-10" in result.stdout


@pytest.mark.TARA_0107
def test_script_fails_on_blocking_findings_without_issue_ref():
    comments = [
        {"body": _review_comment_body(critical=1, high=0), "created_at": "2026-09-28T08:00:00Z"}
    ]
    result = _run_check(comments, head_sha=HEAD_SHA)
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0107
def test_script_passes_on_blocking_findings_with_issue_ref():
    comments = [
        {
            "body": _review_comment_body(critical=0, high=1, findings_issue=170),
            "created_at": "2026-09-28T08:00:00Z",
        }
    ]
    result = _run_check(comments, head_sha=HEAD_SHA)
    assert result.returncode == 0, f"Erwartete OK: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0107
def test_script_rejects_old_freetext_marker_without_json():
    """Regressionsschutz: Der alte, faelschbare Freitext-Marker aus TARA-0089
    darf ohne begleitenden JSON-Block NICHT mehr als gueltiger Nachweis zaehlen."""
    comments = [
        {"body": "Review-Agent: OK - keine Findings", "created_at": "2026-09-28T08:00:00Z"}
    ]
    result = _run_check(comments, head_sha=HEAD_SHA)
    assert result.returncode == 1, f"Erwartete FAIL: {result.stdout}{result.stderr}"


@pytest.mark.TARA_0107
def test_script_fails_on_missing_head_sha_argument():
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        json.dump([{"body": _review_comment_body(), "created_at": "2026-09-28T08:00:00Z"}], f)
        comments_file = f.name
    try:
        result = subprocess.run(
            ["bash", _to_bash_path(SCRIPT), _to_bash_path(comments_file)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 1
        assert "FAIL P-10" in result.stdout
    finally:
        os.remove(comments_file)


@pytest.mark.TARA_0107
def test_script_fails_on_missing_comments_file():
    result = subprocess.run(
        ["bash", _to_bash_path(SCRIPT), "/tmp/does-not-exist-tara-0107.json", HEAD_SHA],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 1
    assert "FAIL P-10" in result.stdout


# ---------------------------------------------------------------------------
# Doku-/Workflow-Referenzen
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0107
def test_process_guard_workflow_passes_head_sha():
    with open(WORKFLOW, "r", encoding="utf-8") as f:
        content = f.read()
    assert "check_review_agent_invoked.sh" in content
    assert "head.sha" in content


@pytest.mark.TARA_0107
def test_review_agent_doc_describes_json_schema():
    with open(REVIEW_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "reviewed_head_sha" in content
    assert "review_profile_version" in content


@pytest.mark.TARA_0107
def test_process_guard_doc_references_sha_bound_proof():
    with open(PROCESS_GUARD_DOC, "r", encoding="utf-8") as f:
        content = f.read()
    assert "reviewed_head_sha" in content or "SHA-gebunden" in content


@pytest.mark.TARA_0107
def test_report_builder_has_review_result_helper():
    with open(REPORT_BUILDER, "r", encoding="utf-8") as f:
        content = f.read()
    assert "reviewed_head_sha" in content
