"""TARA-0110: Statusmodell B - PO-Akzeptanz MUSS technisch vor dem Merge
erfolgen (P-25, PO-Akzeptanz-Gate).

Bisher (Modell mit "Freigabe" nach Merge): Der Code wurde bereits nach
`development` gemergt, BEVOR der Product Owner ihn fachlich akzeptiert
hatte. Der Statusname "Freigabe" suggerierte eine bereits erfolgte
Freigabe, obwohl er tatsaechlich "wartet noch auf PO-Akzeptanz" bedeutete
(Namensinversion).

PO-Entscheidung (TARA-0110): Modell B - PO-Abnahme MUSS vor dem Merge
erzwungen werden:

    Review -> PO Acceptance -> Merge -> Done

Der bisherige Board-Status "Freigabe" (Options-ID d98e05b2, unveraendert)
wird umbenannt zu "Accepted" und bedeutet jetzt: "PO hat den aktuellen
PR-Head-SHA nachweislich akzeptiert, Merge ist freigegeben". Erst NACH dem
Merge wird automatisch "Done" gesetzt (kein zweiter PO-Kommentar mehr
noetig, da die Akzeptanz bereits vor dem Merge erfolgt ist).

Dieses Modul (`po_acceptance_gate.py`) implementiert die deterministische
Pruefung (P-25), die als GitHub-Actions-Pflicht-Check das Mergen technisch
verhindert, solange nicht:

1. Ein gueltiger, SHA-aktueller Review-Nachweis vorliegt (P-10, TARA-0107,
   wiederverwendet), UND
2. Ein an die TARA-ID gebundenes PO-Akzeptanz-Kommando (TARA-0109-Format,
   wiederverwendet) von einem berechtigten Nutzer vorliegt, dessen
   Zeitstempel NICHT VOR dem letzten Push auf den PR-Head liegt (sonst:
   die Akzeptanz bezog sich auf einen ueberholten Commit-Stand).
"""
from __future__ import annotations

import importlib.util
import os
import subprocess
import sys

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPT_DIR = os.path.join(REPO_ROOT, "scripts", "process_guard")


def _load_module(name: str, filename: str):
    path = os.path.join(SCRIPT_DIR, filename)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def gate_module():
    return _load_module("po_acceptance_gate", "po_acceptance_gate.py")


@pytest.fixture(scope="module")
def annotate_module():
    return _load_module("annotate_comment_permissions", "annotate_comment_permissions.py")


def _to_bash_path(path: str) -> str:
    """Wandelt einen Windows-Pfad in einen WSL-Pfad (/mnt/c/...) um, sofern
    ein Laufwerksbuchstabe vorhanden ist (lokale Windows-Entwicklung); auf
    Linux (z.B. CI, natives bash) ist der Pfad bereits POSIX-konform und wird
    unveraendert zurueckgegeben (dieselbe Hilfsfunktion wie in
    test_TARA_0108.py/test_TARA_0109.py)."""
    path = path.replace("\\", "/")
    if len(path) > 1 and path[1] == ":":
        drive = path[0].lower()
        path = f"/mnt/{drive}{path[2:]}"
    return path


def _run_wrapper(comments_json: str, tara_id: str, head_sha: str, pushed_at: str):
    script = os.path.join(SCRIPT_DIR, "check_po_acceptance_gate.sh")
    comments_file = os.path.join(REPO_ROOT, "tests", "_tmp_TARA_0110_comments.json")
    with open(comments_file, "w", encoding="utf-8") as f:
        f.write(comments_json)
    try:
        result = subprocess.run(
            [
                "bash",
                _to_bash_path(script),
                _to_bash_path(comments_file),
                tara_id,
                head_sha,
                pushed_at,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    finally:
        os.remove(comments_file)
    return result


REVIEW_PASSED_JSON = """```json
{
  "story": "TARA-0110",
  "pull_request": 200,
  "reviewed_head_sha": "%s",
  "review_profile_version": "2.1",
  "result": "passed",
  "critical": 0,
  "high": 0,
  "timestamp": "2026-01-10T08:00:00Z"
}
```"""


# ---------------------------------------------------------------------------
# find_latest_bound_acceptance()
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0110
def test_find_latest_bound_acceptance_ignores_unpermitted_author(gate_module):
    comments = [
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:00:00Z",
            "permitted": False,
        }
    ]
    assert gate_module.find_latest_bound_acceptance(comments, "TARA-0110") is None


@pytest.mark.TARA_0110
def test_find_latest_bound_acceptance_ignores_different_tara_id(gate_module):
    comments = [
        {
            "body": "akzeptiert TARA-0111",
            "created_at": "2026-01-10T09:00:00Z",
            "permitted": True,
        }
    ]
    assert gate_module.find_latest_bound_acceptance(comments, "TARA-0110") is None


@pytest.mark.TARA_0110
def test_find_latest_bound_acceptance_picks_latest_of_several(gate_module):
    comments = [
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:00:00Z",
            "permitted": True,
        },
        {
            "body": "TARA-0110 ist nun akzeptiert",
            "created_at": "2026-01-10T11:00:00Z",
            "permitted": True,
        },
    ]
    latest = gate_module.find_latest_bound_acceptance(comments, "TARA-0110")
    assert latest is not None
    assert latest["created_at"] == "2026-01-10T11:00:00Z"


# ---------------------------------------------------------------------------
# validate_acceptance_gate()
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0110
def test_gate_fails_without_review_result(gate_module):
    comments = [
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:00:00Z",
            "permitted": True,
        }
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T08:00:00Z"
    )
    assert ok is False
    assert "Review" in msg


@pytest.mark.TARA_0110
def test_gate_fails_without_po_acceptance_comment(gate_module):
    comments = [{"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T08:30:00Z"}]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T08:00:00Z"
    )
    assert ok is False
    assert "Akzeptanz" in msg


@pytest.mark.TARA_0110
def test_gate_fails_when_acceptance_comment_predates_last_push(gate_module):
    """Die PO-Akzeptanz muss NACH dem letzten Push erfolgt sein - sonst
    bezieht sie sich auf einen ueberholten Commit-Stand (analog zur
    SHA-Invalidierung des Review-Nachweises, TARA-0107)."""
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T07:00:00Z"},
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T07:30:00Z",
            "permitted": True,
        },
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T09:00:00Z"
    )
    assert ok is False
    assert "veraltet" in msg or "VOR" in msg


@pytest.mark.TARA_0110
def test_gate_fails_when_review_sha_does_not_match_head(gate_module):
    comments = [
        {"body": REVIEW_PASSED_JSON % "old-sha", "created_at": "2026-01-10T07:00:00Z"},
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:30:00Z",
            "permitted": True,
        },
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "new-sha", "2026-01-10T09:00:00Z"
    )
    assert ok is False


@pytest.mark.TARA_0110
def test_gate_passes_with_valid_review_and_timely_acceptance(gate_module):
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T09:10:00Z"},
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:30:00Z",
            "permitted": True,
        },
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T09:00:00Z"
    )
    assert ok is True


@pytest.mark.TARA_0110
def test_gate_fails_when_acceptance_predates_review_timestamp(gate_module):
    """PO darf nicht VOR dem Review-Nachweis akzeptiert haben (sonst hat der
    PO gar kein gruenes Review-Ergebnis fuer diesen Stand gesehen)."""
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T09:10:00Z"},
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T07:50:00Z",
            "permitted": True,
        },
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T07:00:00Z"
    )
    assert ok is False
    assert "Review-Nachweis" in msg


@pytest.mark.TARA_0110
def test_gate_ignores_acceptance_bound_to_other_tara_id(gate_module):
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T09:10:00Z"},
        {
            "body": "akzeptiert TARA-9999",
            "created_at": "2026-01-10T09:30:00Z",
            "permitted": True,
        },
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T09:00:00Z"
    )
    assert ok is False


@pytest.mark.TARA_0110
def test_gate_ignores_acceptance_from_unpermitted_author(gate_module):
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T09:10:00Z"},
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:30:00Z",
            "permitted": False,
        },
    ]
    ok, msg = gate_module.validate_acceptance_gate(
        comments, "TARA-0110", "abc123", "2026-01-10T09:00:00Z"
    )
    assert ok is False


# ---------------------------------------------------------------------------
# Wrapper-Skript (Bash + CLI)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0110
def test_wrapper_passes_with_valid_gate_state():
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T09:10:00Z", "permitted": True},
        {
            "body": "akzeptiert TARA-0110",
            "created_at": "2026-01-10T09:30:00Z",
            "permitted": True,
        },
    ]
    import json

    result = _run_wrapper(json.dumps(comments), "TARA-0110", "abc123", "2026-01-10T09:00:00Z")
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.TARA_0110
def test_wrapper_fails_without_acceptance_comment():
    comments = [
        {"body": REVIEW_PASSED_JSON % "abc123", "created_at": "2026-01-10T09:10:00Z", "permitted": True},
    ]
    import json

    result = _run_wrapper(json.dumps(comments), "TARA-0110", "abc123", "2026-01-10T09:00:00Z")
    assert result.returncode != 0


# ---------------------------------------------------------------------------
# annotate_comment_permissions.py
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0110
def test_annotate_permissions_marks_write_users_as_permitted(annotate_module, monkeypatch):
    def fake_run(cmd, capture_output, text):
        class FakeResult:
            returncode = 0
            stdout = "write\n"

        return FakeResult()

    monkeypatch.setattr(annotate_module.subprocess, "run", fake_run)
    comments = [{"body": "akzeptiert TARA-0110", "created_at": "x", "author": "po-user"}]
    result = annotate_module.annotate_permissions(comments, "org/repo")
    assert result == [{"body": "akzeptiert TARA-0110", "created_at": "x", "permitted": True}]


@pytest.mark.TARA_0110
def test_annotate_permissions_marks_read_users_as_not_permitted(annotate_module, monkeypatch):
    def fake_run(cmd, capture_output, text):
        class FakeResult:
            returncode = 0
            stdout = "read\n"

        return FakeResult()

    monkeypatch.setattr(annotate_module.subprocess, "run", fake_run)
    comments = [{"body": "akzeptiert TARA-0110", "created_at": "x", "author": "random-user"}]
    result = annotate_module.annotate_permissions(comments, "org/repo")
    assert result[0]["permitted"] is False


@pytest.mark.TARA_0110
def test_annotate_permissions_caches_per_author(annotate_module, monkeypatch):
    call_count = {"n": 0}

    def fake_run(cmd, capture_output, text):
        call_count["n"] += 1

        class FakeResult:
            returncode = 0
            stdout = "write\n"

        return FakeResult()

    monkeypatch.setattr(annotate_module.subprocess, "run", fake_run)
    comments = [
        {"body": "a", "created_at": "1", "author": "po-user"},
        {"body": "b", "created_at": "2", "author": "po-user"},
    ]
    annotate_module.annotate_permissions(comments, "org/repo")
    assert call_count["n"] == 1


@pytest.mark.TARA_0110
def test_annotate_permissions_missing_author_is_not_permitted(annotate_module, monkeypatch):
    def fake_run(cmd, capture_output, text):
        raise AssertionError("should not be called for missing author")

    monkeypatch.setattr(annotate_module.subprocess, "run", fake_run)
    comments = [{"body": "a", "created_at": "1", "author": None}]
    result = annotate_module.annotate_permissions(comments, "org/repo")
    assert result[0]["permitted"] is False


# ---------------------------------------------------------------------------
# auto_set_freigabe_after_merge.py (P-11-Automatisierung, angepasst fuer
# Statusmodell B / P-25: Ziel ist jetzt "Done" statt "Freigabe", nur wenn
# der aktuelle Status "Accepted" ist)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def merge_module():
    return _load_module("auto_set_freigabe_after_merge", "auto_set_freigabe_after_merge.py")


@pytest.mark.TARA_0110
def test_merge_status_update_refuses_when_not_accepted(merge_module, monkeypatch):
    monkeypatch.setattr(merge_module, "get_project_item_id", lambda *a, **k: "ITEM_ID")
    monkeypatch.setattr(merge_module, "get_current_status_name", lambda *a, **k: "inReview")
    called = {"n": 0}
    monkeypatch.setattr(
        merge_module, "post_audit_comment", lambda *a, **k: called.__setitem__("n", called["n"] + 1) or True
    )
    rc = merge_module.main(["Bezug: #180", "owner/repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 1
    assert called["n"] == 0


@pytest.mark.TARA_0110
def test_merge_status_update_confirms_accepted_without_setting_done(merge_module, monkeypatch):
    """TARA-0121 (P-27): 'Done' wird nach dem Merge nicht mehr automatisch
    gesetzt - nur noch nach gebundenem 'PO Release TARA-XXXX'-Kommando
    (check-po-release-Job). Dieses Skript bestaetigt lediglich 'Accepted'."""
    monkeypatch.setattr(merge_module, "get_project_item_id", lambda *a, **k: "ITEM_ID")
    monkeypatch.setattr(merge_module, "get_current_status_name", lambda *a, **k: "Accepted")
    monkeypatch.setattr(merge_module, "post_audit_comment", lambda *a, **k: True)
    rc = merge_module.main(["Bezug: #180", "owner/repo", "PROJ_ID", "FIELD_ID"])
    assert rc == 0
