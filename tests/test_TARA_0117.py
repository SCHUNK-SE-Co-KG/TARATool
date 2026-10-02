"""
TARA-0117: Weiterfuehrende Automatisierung - zentrale Transition-API statt
direkter Boardaenderungen (P-18).

Deckt ab:
- scripts/workflow/transition_engine.py existiert und implementiert eine
  deterministische Vorbedingungspruefung (Statemachine) fuer die beiden bisher
  NICHT automatisierten, agentengetriebenen Uebergaenge "PO Accepted -> In
  Progress" (P-02) und "In Progress -> inReview" (P-09).
- Geschuetzte Status ("Todo", "PO Accepted", "Accepted", "PO Release", "Done")
  werden von der Transition-Engine abgelehnt (sie laufen bereits automatisiert
  ueber .github/workflows/po-approve.yml bzw. post-merge-status.yml).
- run_transition() setzt Status + Audit-Kommentar nur bei erfuellter
  Vorbedingung (atomar, in dieser Reihenfolge) und postet bei Fehlschlag
  automatisch einen process-violation-Kommentar statt still zu scheitern.
- P-18: keine andere Python-Datei unter scripts/ ruft die Status-Feld-
  GraphQL-Mutation mehr direkt auf; scripts/set_story_status.py delegiert die
  eigentliche Mutation an transition_engine.py.
- P-16: Branch-Loeschung ist an den Merge-Workflow gekoppelt.
- Dokumentation (DEV_AGENT_ONBOARDING.md, CONTRIBUTING.md) verweist auf die
  neue Transition-Workflow-API statt auf manuelle GraphQL-Mutationen.
"""

import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSITION_ENGINE = REPO_ROOT / "scripts" / "workflow" / "transition_engine.py"
TRANSITION_SH = REPO_ROOT / "scripts" / "workflow" / "transition.sh"
SET_STORY_STATUS = REPO_ROOT / "scripts" / "set_story_status.py"
TRANSITION_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "transition.yml"
POST_MERGE_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "post-merge-status.yml"

sys.path.insert(0, str(TRANSITION_ENGINE.parent))
import transition_engine as te  # noqa: E402

MUTATION_STRING = "updateProjectV2ItemFieldValue"


def test_transition_engine_and_cli_exist():
    assert TRANSITION_ENGINE.exists(), "scripts/workflow/transition_engine.py fehlt"
    assert TRANSITION_SH.exists(), "scripts/workflow/transition.sh fehlt"
    assert TRANSITION_WORKFLOW.exists(), ".github/workflows/transition.yml fehlt (PO-Entscheidung 1: nur aus Actions aufrufbar)"


# ---------------------------------------------------------------------------
# Vorbedingungspruefung (Statemachine)
# ---------------------------------------------------------------------------


def test_allows_expected_predecessor_in_progress():
    ok, msg = te.validate_precondition("PO Accepted", "In Progress", None)
    assert ok, msg


def test_allows_expected_predecessor_inreview():
    ok, msg = te.validate_precondition("In Progress", "inReview", "abc123")
    assert ok, msg


def test_rejects_wrong_predecessor_in_progress():
    ok, msg = te.validate_precondition("Todo", "In Progress", None)
    assert not ok
    assert "Todo" in msg


def test_rejects_wrong_predecessor_inreview():
    ok, msg = te.validate_precondition("PO Accepted", "inReview", "abc123")
    assert not ok


def test_requires_head_sha_for_inreview():
    ok, msg = te.validate_precondition("In Progress", "inReview", None)
    assert not ok
    assert "head-sha" in msg.lower()


@pytest.mark.parametrize("protected", ["Todo", "PO Accepted", "Accepted", "PO Release", "Done"])
def test_rejects_protected_statuses(protected):
    ok, msg = te.validate_precondition("irrelevant", protected, "sha")
    assert not ok
    assert "po-approve.yml" in msg


def test_rejects_unknown_status():
    ok, msg = te.validate_precondition("In Progress", "Nonsense", "sha")
    assert not ok


# ---------------------------------------------------------------------------
# run_transition(): atomare Mutation + Audit-Kommentar, Fehlerpfad
# ---------------------------------------------------------------------------


def _make_item(status="PO Accepted", issue_number=999):
    return {"id": "ITEM_ID", "status": status, "issue_number": issue_number}


def test_run_transition_success_mutates_then_comments_in_order():
    calls = []
    item = _make_item("PO Accepted")
    ok, msg = te.run_transition(
        "TARA-9999",
        "In Progress",
        None,
        fetch_item=lambda tid: item,
        mutate_status=lambda item_id, option_id: calls.append(("mutate", item_id, option_id)) or True,
        post_comment=lambda issue_number, body: calls.append(("comment", issue_number, body)) or True,
        post_process_violation=lambda issue_number, body: calls.append(("violation", issue_number, body)) or True,
    )
    assert ok, msg
    assert [c[0] for c in calls] == ["mutate", "comment"]
    assert calls[0][1] == "ITEM_ID"
    assert calls[1][1] == 999
    assert "P-02" in calls[1][2]


def test_run_transition_failure_does_not_mutate_but_posts_violation():
    calls = []
    item = _make_item("Todo")  # falscher Vorgaenger fuer "In Progress"
    ok, msg = te.run_transition(
        "TARA-9999",
        "In Progress",
        None,
        fetch_item=lambda tid: item,
        mutate_status=lambda *a: calls.append(("mutate",)) or True,
        post_comment=lambda *a: calls.append(("comment",)) or True,
        post_process_violation=lambda issue_number, body: calls.append(("violation", issue_number, body)) or True,
    )
    assert not ok
    assert calls == [("violation", 999, msg)]


def test_run_transition_success_but_comment_fails_surfaces_warning():
    """Review-Finding (Mittel): Mutation erfolgreich, Audit-Kommentar (P-20)
    schlaegt fehl -> darf NICHT als reines "OK" verschwinden, sonst geht der
    Nachweis der Nachvollziehbarkeit unbemerkt verloren."""
    item = _make_item("PO Accepted")
    ok, msg = te.run_transition(
        "TARA-9999",
        "In Progress",
        None,
        fetch_item=lambda tid: item,
        mutate_status=lambda *a: True,
        post_comment=lambda *a: False,
        post_process_violation=lambda *a: True,
    )
    assert ok, "Status-Mutation selbst war erfolgreich, muss weiterhin ok=True liefern"
    assert "Audit-Kommentar" in msg
    assert "NICHT" in msg


def test_run_transition_unknown_item_fails_without_side_effects():
    calls = []
    ok, msg = te.run_transition(
        "TARA-0000",
        "In Progress",
        None,
        fetch_item=lambda tid: None,
        mutate_status=lambda *a: calls.append(("mutate",)) or True,
        post_comment=lambda *a: calls.append(("comment",)) or True,
        post_process_violation=lambda *a: calls.append(("violation",)) or True,
    )
    assert not ok
    assert calls == []


# ---------------------------------------------------------------------------
# P-18: keine direkte Board-Mutation ausserhalb der Transition-Engine
# ---------------------------------------------------------------------------


def test_no_other_python_script_calls_the_mutation_directly():
    scripts_dir = REPO_ROOT / "scripts"
    offenders = []
    for path in scripts_dir.rglob("*.py"):
        if path == TRANSITION_ENGINE:
            continue
        text = path.read_text(encoding="utf-8")
        if MUTATION_STRING in text:
            offenders.append(str(path.relative_to(REPO_ROOT)))
    assert not offenders, f"Direkte Board-Mutation ausserhalb transition_engine.py in: {offenders}"


# ---------------------------------------------------------------------------
# TARA-0133-Vorarbeit: fetch_item_via_gh() nutzt GraphQL statt
# "gh project item-list --owner <org>" (Bugfix: Owner-Aufloesung scheiterte
# in CI mit "unknown owner type" mangels read:org-Token-Scope).
# ---------------------------------------------------------------------------


def test_fetch_item_via_gh_does_not_use_owner_flag(monkeypatch):
    captured_args = []

    def fake_run(args, timeout=30):
        captured_args.append(args)
        payload = (
            '{"data":{"node":{"items":{"pageInfo":{"hasNextPage":false,"endCursor":null},'
            '"nodes":[{"id":"ITEM1","content":{"number":221,"title":"[TARA-0133] STORY: X"},'
            '"fieldValueByName":{"name":"PO Accepted"}}]}}}}'
        )
        return subprocess.CompletedProcess(args, 0, stdout=payload, stderr="")

    monkeypatch.setattr(te, "_run_gh", fake_run)
    item = te.fetch_item_via_gh("TARA-0133")

    assert item == {"id": "ITEM1", "status": "PO Accepted", "issue_number": 221}
    joined = " ".join(" ".join(a) for a in captured_args)
    assert "--owner" not in joined, "fetch_item_via_gh darf 'gh project item-list --owner' nicht mehr nutzen"
    assert "graphql" in joined


def test_fetch_item_via_gh_returns_none_on_gh_error(monkeypatch):
    def fake_run(args, timeout=30):
        return subprocess.CompletedProcess(args, 1, stdout="", stderr="unknown owner type")

    monkeypatch.setattr(te, "_run_gh", fake_run)
    assert te.fetch_item_via_gh("TARA-0133") is None


def test_set_story_status_still_rejects_protected_statuses():
    result = subprocess.run(
        [sys.executable, str(SET_STORY_STATUS), "0117", "PO Accepted"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode != 0
    assert "PO Accepted" in (result.stdout + result.stderr)


def test_set_story_status_delegates_mutation_to_transition_engine():
    source = SET_STORY_STATUS.read_text(encoding="utf-8")
    assert "transition_engine" in source
    assert MUTATION_STRING not in source


# ---------------------------------------------------------------------------
# P-16: Branch-Loeschung an Merge-Workflow gekoppelt
# ---------------------------------------------------------------------------


def test_post_merge_workflow_deletes_branch():
    text = POST_MERGE_WORKFLOW.read_text(encoding="utf-8")
    assert "git/refs/heads" in text and "DELETE" in text


# ---------------------------------------------------------------------------
# Dokumentation verweist auf transition-Workflow statt manueller Mutation
# ---------------------------------------------------------------------------


def test_onboarding_references_transition_workflow():
    text = (REPO_ROOT / ".github" / "agents" / "developer.agent.md").read_text(encoding="utf-8")
    assert "transition.yml" in text


def test_contributing_references_transition_workflow():
    text = (REPO_ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
    assert "transition" in text.lower()
