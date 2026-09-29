"""TARA-0121: PO Accepted und PO Release als geschuetzte Board-Status.

Ersetzt die bisherige, ausschliesslich auf freien Keywords ("akzeptiert",
"OK", ...) basierende Erkennung fuer die beiden KRITISCHEN
Statusuebergaenge

    Todo -> PO Accepted            (Bearbeitungserlaubnis)
    Accepted -> PO Release -> Done (fachliche/releasebezogene Abnahme)

durch zwei eigene, an eine TARA-ID gebundene Kommandos ("PO Accepted
TARA-XXXX" / "PO Release TARA-XXXX"), die technisch nur vom PO (Nutzer mit
Schreibrechten) ausgeloest werden koennen und deterministisch getestet
sind (P-26/P-27). Agenten/Skripte duerfen diese beiden Status nicht selbst
per `set_story_status.py` setzen.

Der bisherige Board-Status "Blocking" entfaellt bewusst (PO-Entscheidung);
blockierte Items werden stattdessen ueber das bestehende Issue-Label
"blocked" markiert (Board-Status bleibt unveraendert).
"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import tempfile

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPT_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")
SET_STORY_STATUS = os.path.join(REPO_ROOT, "scripts", "set_story_status.py")
REPORT_BUILDER = os.path.join(REPO_ROOT, "agents", "review_agent", "report_builder.py")
GITHUB_BOARD_DOC = os.path.join(REPO_ROOT, "docs", "GITHUB_BOARD.md")
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
ENTWICKLUNGSPROZESS_DOC = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")
PO_APPROVE_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "po-approve.yml")
PROCESS_GUARD_WORKFLOW = os.path.join(REPO_ROOT, ".github", "workflows", "process-guard.yml")


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _to_bash_path(path: str) -> str:
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _load_module(name: str, filename: str):
    path = os.path.join(SCRIPT_DIR, filename)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def parser_module():
    return _load_module("po_approval_parser", "po_approval_parser.py")


@pytest.fixture(scope="module")
def release_gate_module():
    return _load_module("po_release_gate", "po_release_gate.py")


# ---------------------------------------------------------------------------
# Parser: neue gebundene Kommandos "PO Accepted <ID>" / "PO Release <ID>"
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0121
class TestPoAcceptedParser:
    def test_bound_command_keyword_first(self, parser_module):
        assert parser_module.extract_po_accepted_ids("PO Accepted TARA-0121") == ["TARA-0121"]

    def test_bound_command_id_first(self, parser_module):
        assert parser_module.extract_po_accepted_ids("TARA-0121 ist PO Accepted") == ["TARA-0121"]

    def test_generic_old_keyword_alone_does_not_trigger_po_accepted(self, parser_module):
        """Das alte, lose Keyword "akzeptiert" darf NICHT mehr ausreichen,
        um den kritischen Uebergang Todo -> PO Accepted auszuloesen."""
        assert parser_module.extract_po_accepted_ids("akzeptiert TARA-0121") == []

    def test_negation_is_respected(self, parser_module):
        assert parser_module.extract_po_accepted_ids("noch nicht PO Accepted TARA-0121") == []

    def test_quoted_command_is_ignored(self, parser_module):
        assert parser_module.extract_po_accepted_ids("> PO Accepted TARA-0121") == []


@pytest.mark.TARA_0121
class TestPoReleaseParser:
    def test_bound_command_keyword_first(self, parser_module):
        assert parser_module.extract_po_release_ids("PO Release TARA-0121") == ["TARA-0121"]

    def test_bound_command_id_first(self, parser_module):
        assert parser_module.extract_po_release_ids("TARA-0121 PO Release") == ["TARA-0121"]

    def test_generic_old_keyword_alone_does_not_trigger_po_release(self, parser_module):
        assert parser_module.extract_po_release_ids("akzeptiert TARA-0121") == []

    def test_po_accepted_command_does_not_trigger_po_release(self, parser_module):
        """Die beiden Kommandos duerfen sich nicht gegenseitig ausloesen -
        sonst koennte eine reine Bearbeitungserlaubnis (PO Accepted)
        faelschlich als finale Abnahme (PO Release) interpretiert werden."""
        assert parser_module.extract_po_release_ids("PO Accepted TARA-0121") == []
        assert parser_module.extract_po_accepted_ids("PO Release TARA-0121") == []

    def test_negation_is_respected(self, parser_module):
        assert parser_module.extract_po_release_ids("kein PO Release TARA-0121") == []


# ---------------------------------------------------------------------------
# Shell-Wrapper (analog TARA-0109 check_po_approval_keyword.sh)
# ---------------------------------------------------------------------------


def _run_wrapper(script_name, comment_body):
    script = os.path.join(SCRIPT_DIR, script_name)
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write(comment_body)
        comment_file = f.name
    try:
        return subprocess.run(
            ["bash", _to_bash_path(script), _to_bash_path(comment_file)],
            capture_output=True,
            text=True,
            timeout=30,
        )
    finally:
        os.remove(comment_file)


@pytest.mark.TARA_0121
class TestWrapperScripts:
    def test_check_po_accepted_keyword_script_exists(self):
        assert os.path.isfile(os.path.join(SCRIPT_DIR, "check_po_accepted_keyword.sh"))

    def test_check_po_release_keyword_script_exists(self):
        assert os.path.isfile(os.path.join(SCRIPT_DIR, "check_po_release_keyword.sh"))

    def test_check_po_accepted_keyword_matches(self):
        result = _run_wrapper("check_po_accepted_keyword.sh", "PO Accepted TARA-0121")
        assert result.returncode == 0
        assert "TARA-0121" in result.stdout

    def test_check_po_accepted_keyword_no_match(self):
        result = _run_wrapper("check_po_accepted_keyword.sh", "akzeptiert TARA-0121")
        assert result.returncode == 1

    def test_check_po_release_keyword_matches(self):
        result = _run_wrapper("check_po_release_keyword.sh", "PO Release TARA-0121")
        assert result.returncode == 0
        assert "TARA-0121" in result.stdout

    def test_check_po_release_keyword_no_match(self):
        result = _run_wrapper("check_po_release_keyword.sh", "akzeptiert TARA-0121")
        assert result.returncode == 1


# ---------------------------------------------------------------------------
# PO-Release-Gate (P-27): SHA-/Zeitpunkt-gebunden, analog P-25
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0121
class TestPoReleaseGate:
    def test_ok_when_permitted_bound_comment_after_merge(self, release_gate_module):
        comments = [
            {
                "body": "PO Release TARA-0121",
                "created_at": "2026-09-29T12:00:00Z",
                "permitted": True,
            }
        ]
        ok, msg = release_gate_module.validate_release_gate(
            comments, "TARA-0121", "Accepted", "2026-09-29T10:00:00Z"
        )
        assert ok, msg

    def test_fails_when_no_matching_comment(self, release_gate_module):
        ok, _ = release_gate_module.validate_release_gate(
            [], "TARA-0121", "Accepted", "2026-09-29T10:00:00Z"
        )
        assert not ok

    def test_fails_when_commenter_not_permitted(self, release_gate_module):
        comments = [
            {
                "body": "PO Release TARA-0121",
                "created_at": "2026-09-29T12:00:00Z",
                "permitted": False,
            }
        ]
        ok, _ = release_gate_module.validate_release_gate(
            comments, "TARA-0121", "Accepted", "2026-09-29T10:00:00Z"
        )
        assert not ok

    def test_fails_when_comment_predates_acceptance(self, release_gate_module):
        """Ein "PO Release"-Kommentar, der VOR dem Erreichen von "Accepted"
        gepostet wurde, kann sich nicht auf den tatsaechlich gemergten,
        akzeptierten Stand beziehen."""
        comments = [
            {
                "body": "PO Release TARA-0121",
                "created_at": "2026-09-29T09:00:00Z",
                "permitted": True,
            }
        ]
        ok, _ = release_gate_module.validate_release_gate(
            comments, "TARA-0121", "Accepted", "2026-09-29T10:00:00Z"
        )
        assert not ok

    def test_fails_when_current_status_is_not_accepted(self, release_gate_module):
        comments = [
            {
                "body": "PO Release TARA-0121",
                "created_at": "2026-09-29T12:00:00Z",
                "permitted": True,
            }
        ]
        ok, _ = release_gate_module.validate_release_gate(
            comments, "TARA-0121", "inReview", "2026-09-29T10:00:00Z"
        )
        assert not ok

    def test_fails_for_wrong_tara_id(self, release_gate_module):
        comments = [
            {
                "body": "PO Release TARA-9999",
                "created_at": "2026-09-29T12:00:00Z",
                "permitted": True,
            }
        ]
        ok, _ = release_gate_module.validate_release_gate(
            comments, "TARA-0121", "Accepted", "2026-09-29T10:00:00Z"
        )
        assert not ok


# ---------------------------------------------------------------------------
# set_story_status.py darf "PO Accepted"/"PO Release" nicht direkt setzen
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0121
class TestSetStoryStatusGuard:
    def _run(self, tara_num, status):
        return subprocess.run(
            [sys.executable, SET_STORY_STATUS, tara_num, status],
            capture_output=True,
            text=True,
            timeout=15,
        )

    def test_rejects_po_accepted(self):
        result = self._run("0121", "PO Accepted")
        assert result.returncode != 0
        assert "PO Accepted" in (result.stdout + result.stderr)

    def test_rejects_po_release(self):
        result = self._run("0121", "PO Release")
        assert result.returncode != 0
        assert "PO Release" in (result.stdout + result.stderr)

    def test_blocking_status_removed_from_mapping(self):
        """'Blocking' ist keine gueltige Board-Spalte mehr (Options-ID wurde
        zu 'PO Release' umbenannt) - ein Aufruf mit 'Blocking' darf NICHT
        stillschweigend die 'PO Release'-Spalte treffen."""
        source = _read(SET_STORY_STATUS)
        assert '"Blocking"' not in source

    def test_status_mapping_documents_new_columns(self):
        source = _read(SET_STORY_STATUS)
        assert "PO Accepted" in source
        assert "PO Release" in source


# ---------------------------------------------------------------------------
# review_agent/report_builder.py: Blockierung ueber Label statt Board-Status
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0121
class TestReviewAgentBlockedLabel:
    def test_no_longer_sets_blocking_board_status(self):
        source = _read(REPORT_BUILDER)
        assert '"Blocking"' not in source
        assert "'Blocking'" not in source

    def test_applies_blocked_label_instead(self):
        source = _read(REPORT_BUILDER)
        assert "blocked" in source


# ---------------------------------------------------------------------------
# Dokumentation
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0121
class TestDocumentation:
    def test_github_board_documents_po_accepted_option(self):
        content = _read(GITHUB_BOARD_DOC)
        assert "PO Accepted" in content
        assert "d2d86c41" in content

    def test_github_board_documents_po_release_option(self):
        content = _read(GITHUB_BOARD_DOC)
        assert "PO Release" in content

    def test_github_board_no_longer_lists_blocking_as_status_option(self):
        content = _read(GITHUB_BOARD_DOC)
        assert "**Blocking**" not in content

    def test_process_guard_doc_mentions_po_accepted_and_release_gates(self):
        content = _read(PROCESS_GUARD_DOC)
        assert "PO Accepted" in content
        assert "PO Release" in content

    def test_entwicklungsprozess_mentions_po_accepted_and_release(self):
        content = _read(ENTWICKLUNGSPROZESS_DOC)
        assert "PO Accepted" in content
        assert "PO Release" in content


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------


@pytest.mark.TARA_0121
class TestWorkflows:
    def test_po_approve_has_check_po_accepted_job(self):
        content = _read(PO_APPROVE_WORKFLOW)
        assert "check-po-accepted" in content

    def test_po_approve_has_check_po_release_job(self):
        content = _read(PO_APPROVE_WORKFLOW)
        assert "check-po-release" in content

    def test_process_guard_checks_po_accepted_before_in_progress(self):
        content = _read(PROCESS_GUARD_WORKFLOW)
        assert "PO Accepted" in content
