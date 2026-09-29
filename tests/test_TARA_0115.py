"""
[TARA-0115] Tests: Verfeinerung Review-Agent - Heuristik fuer
Finding-Klassifikation (behebbar vs. blockierend)

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, bevor
agents/review_agent/REVIEW_AGENT_WORKFLOW.md und
agents/review_agent/report_builder.py um die deterministische
Ablage-Heuristik ergaenzt wurden.

PO-Entscheidungen (Issue #185):
- Frage 1: Leitplanke mit begruendeter Abweichungsmoeglichkeit (kein
  striktes, unumstoessliches Regelwerk).
- Frage 2: Automatisierte Wiederholungserkennung. Bei Wiederholung muss
  eine STORY angelegt werden, die den Harness auf Prozessluecken bzgl.
  wiederholter Findings untersucht (nicht nur ein generisches Epic).
"""
import json
import os
import sys
from unittest import mock

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REVIEW_AGENT_PATH = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.fixture()
def report_builder_module():
    sys.path.insert(0, REPO_ROOT)
    from agents.review_agent import report_builder  # noqa: E402
    yield report_builder
    sys.modules.pop("agents.review_agent.report_builder", None)
    if REPO_ROOT in sys.path:
        sys.path.remove(REPO_ROOT)


# ---------------------------------------------------------------------------
# Dokumentation
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_doc_has_heuristic_section():
    content = _read(REVIEW_AGENT_PATH)
    assert "Ablage-Heuristik" in content


@pytest.mark.TARA_0115
def test_doc_documents_guideline_with_deviation_po_decision():
    content = _read(REVIEW_AGENT_PATH)
    assert "Leitplanke" in content
    assert "override_reason" in content


@pytest.mark.TARA_0115
def test_doc_documents_automated_repetition_detection_creates_story():
    content = _read(REVIEW_AGENT_PATH)
    assert "automatisiert" in content.lower()
    assert "Prozessluecken" in content or "Prozesslücken" in content
    assert "STORY:" in content


@pytest.mark.TARA_0115
def test_doc_documents_security_safety_net():
    content = _read(REVIEW_AGENT_PATH)
    assert "Sicherheitsnetz" in content


# ---------------------------------------------------------------------------
# count_similar_prior_findings
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_count_similar_prior_findings_returns_match_count(report_builder_module):
    fake_result = mock.Mock(returncode=0, stdout=json.dumps([{"number": 1}, {"number": 2}]))
    with mock.patch("subprocess.run", return_value=fake_result):
        count = report_builder_module.count_similar_prior_findings(
            {"rule": "R-02", "type": "bug"}, "SCHUNK-SE-Co-KG/TARATool"
        )
    assert count == 2


@pytest.mark.TARA_0115
def test_count_similar_prior_findings_returns_zero_on_error(report_builder_module):
    with mock.patch("subprocess.run", side_effect=Exception("boom")):
        count = report_builder_module.count_similar_prior_findings(
            {"rule": "R-02", "type": "bug"}, "SCHUNK-SE-Co-KG/TARATool"
        )
    assert count == 0


@pytest.mark.TARA_0115
def test_count_similar_prior_findings_returns_zero_without_rule_or_type(report_builder_module):
    with mock.patch("subprocess.run") as mocked_run:
        count = report_builder_module.count_similar_prior_findings({}, "SCHUNK-SE-Co-KG/TARATool")
    assert count == 0
    mocked_run.assert_not_called()


@pytest.mark.TARA_0115
def test_count_similar_prior_findings_requires_both_rule_and_type(report_builder_module):
    """Nur rule ODER nur type allein reicht nicht als Identitaetsmerkmal
    aus (sonst falsch-positive Wiederholungserkennung, z.B. bei
    Runtime-Findings ohne 'rule')."""
    with mock.patch("subprocess.run") as mocked_run:
        count_rule_only = report_builder_module.count_similar_prior_findings(
            {"rule": "R-02"}, "SCHUNK-SE-Co-KG/TARATool"
        )
        count_type_only = report_builder_module.count_similar_prior_findings(
            {"type": "console_error"}, "SCHUNK-SE-Co-KG/TARATool"
        )
    assert count_rule_only == 0
    assert count_type_only == 0
    mocked_run.assert_not_called()


# ---------------------------------------------------------------------------
# resolve_disposition_heuristic
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_heuristic_security_safety_net_forces_finding_issue(report_builder_module):
    finding = {
        "severity": "Hoch",
        "category": "Sicherheit",
        "fix_scope": "in_diff",  # would otherwise suggest pr_comment
    }
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "finding_issue"
    assert result["deviated"] is False


@pytest.mark.TARA_0115
def test_heuristic_repetition_yields_systemic_issue(report_builder_module):
    finding = {"severity": "Mittel", "repeat_count": 2}
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "systemic_issue"
    assert result["repeat_count"] == 2


@pytest.mark.TARA_0115
def test_heuristic_accepted_debt_yields_backlog_story(report_builder_module):
    finding = {"severity": "Mittel", "accepted_debt": True}
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "backlog_story"


@pytest.mark.TARA_0115
def test_heuristic_in_diff_low_severity_yields_pr_comment(report_builder_module):
    finding = {"severity": "Niedrig", "fix_scope": "in_diff"}
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "pr_comment"


@pytest.mark.TARA_0115
def test_heuristic_falls_back_to_severity_based_rule_without_features(report_builder_module):
    finding = {"severity": "Hoch"}
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "finding_issue"


@pytest.mark.TARA_0115
def test_heuristic_niedrig_without_features_yields_none(report_builder_module):
    finding = {"severity": "Niedrig"}
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] is None


@pytest.mark.TARA_0115
def test_heuristic_respects_explicit_override_with_reason(report_builder_module):
    finding = {
        "severity": "Niedrig",
        "disposition": "finding_issue",
        "override_reason": "Betrifft Auth-Modul, hoeheres Risiko als Schwere-Rubrik andeutet.",
    }
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "finding_issue"
    assert result["deviated"] is True
    assert "Auth-Modul" in result["reasoning"]


@pytest.mark.TARA_0115
def test_heuristic_ignores_override_without_reason(report_builder_module):
    """Leitplanke: Ohne override_reason wird die Heuristik durchgesetzt,
    nicht die abweichende explizite Selbsteinschaetzung."""
    finding = {
        "severity": "Hoch",
        "category": "Sicherheit",
        "disposition": "pr_comment",  # widerspricht dem Sicherheitsnetz
    }
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "finding_issue"
    assert result["deviated"] is False


@pytest.mark.TARA_0115
def test_heuristic_security_safety_net_cannot_be_overridden_even_with_reason(report_builder_module):
    """Sicherheitsnetz ist NICHT abweichbar - auch ein explizites
    override_reason darf Sicherheit+Schwere>=Hoch nicht auf pr_comment
    umleiten (Regression fuer TARA-0115-Code-Review-Finding)."""
    finding = {
        "severity": "Hoch",
        "category": "Sicherheit",
        "disposition": "pr_comment",
        "override_reason": "Ich denke, das ist trotzdem nur ein PR-Kommentar wert.",
    }
    result = report_builder_module.resolve_disposition_heuristic(
        finding, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert result["disposition"] == "finding_issue"
    assert result["deviated"] is False


# ---------------------------------------------------------------------------
# apply_disposition_heuristic
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_apply_disposition_heuristic_sets_disposition_and_collects_deviations(report_builder_module):
    findings = [
        {"severity": "Niedrig", "fix_scope": "in_diff"},
        {
            "severity": "Niedrig",
            "disposition": "finding_issue",
            "override_reason": "Sicherheitsrelevant trotz niedriger Schwere.",
        },
    ]
    updated, deviations = report_builder_module.apply_disposition_heuristic(
        findings, "SCHUNK-SE-Co-KG/TARATool"
    )
    assert updated[0]["disposition"] == "pr_comment"
    assert updated[1]["disposition"] == "finding_issue"
    assert len(deviations) == 1
    assert "Sicherheitsrelevant" in deviations[0]["reasoning"]


@pytest.mark.TARA_0115
def test_apply_disposition_heuristic_caches_repeat_lookup_per_rule_and_type(report_builder_module):
    """Zwei Findings mit identischer (rule, type)-Kombination duerfen nur
    EINEN gh-Aufruf zur Wiederholungserkennung ausloesen (Performance/
    Rate-Limit-Schutz, Regression fuer TARA-0115-Code-Review-Finding)."""
    findings = [
        {"severity": "Mittel", "rule": "R-02", "type": "bug"},
        {"severity": "Mittel", "rule": "R-02", "type": "bug"},
    ]
    fake_result = mock.Mock(returncode=0, stdout=json.dumps([{"number": 1}]))
    with mock.patch("subprocess.run", return_value=fake_result) as mocked_run:
        report_builder_module.apply_disposition_heuristic(findings, "SCHUNK-SE-Co-KG/TARATool")
    assert mocked_run.call_count == 1


# ---------------------------------------------------------------------------
# create_github_issues_for_findings: Prozessluecken-Story bei Wiederholung
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_create_issues_creates_story_not_epic_for_repeated_finding(report_builder_module):
    findings = [
        {
            "severity": "Mittel",
            "disposition": "systemic_issue",
            "_heuristic_repeat_count": 3,
            "type": "process",
            "detail": "Wiederholt aufgetretener stiller Bypass.",
        }
    ]
    fake_result = mock.Mock(returncode=0, stdout="https://github.com/x/y/issues/2001\n")
    with mock.patch("subprocess.run", return_value=fake_result) as mocked_run:
        with mock.patch.object(report_builder_module, "get_next_tara_id", return_value="TARA-2001"):
            result = report_builder_module.create_github_issues_for_findings(
                findings, "TARA-0115", "SCHUNK-SE-Co-KG/TARATool"
            )
    call_args = mocked_run.call_args_list[0].args[0]
    assert "story" in call_args
    title_index = call_args.index("--title") + 1
    assert call_args[title_index].startswith("[TARA-2001] STORY:")
    assert result["issues"] == ["https://github.com/x/y/issues/2001"]


@pytest.mark.TARA_0115
def test_create_issues_keeps_epic_format_without_repeat_marker(report_builder_module):
    """Rueckwaertskompatibilitaet zu TARA-0114: ohne Wiederholungs-Marker
    bleibt das bisherige EPIC-Format fuer manuell zugeordnete systemische
    Findings unveraendert."""
    findings = [
        {
            "severity": "Mittel",
            "disposition": "systemic_issue",
            "type": "process",
            "detail": "Manuell als systemisch eingestuft.",
        }
    ]
    fake_result = mock.Mock(returncode=0, stdout="https://github.com/x/y/issues/2002\n")
    with mock.patch("subprocess.run", return_value=fake_result) as mocked_run:
        with mock.patch.object(report_builder_module, "get_next_tara_id", return_value="TARA-2002"):
            report_builder_module.create_github_issues_for_findings(
                findings, "TARA-0115", "SCHUNK-SE-Co-KG/TARATool"
            )
    call_args = mocked_run.call_args_list[0].args[0]
    assert "epic" in call_args


# ---------------------------------------------------------------------------
# build_full_report: Heuristik-Integration
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_build_full_report_stores_disposition_deviations(report_builder_module):
    from dataclasses import dataclass, field as dc_field

    @dataclass
    class _FakeSession:
        report: dict = dc_field(default_factory=dict)

    session = _FakeSession(report={
        "findings": [
            {
                "severity": "Niedrig",
                "disposition": "finding_issue",
                "override_reason": "Sicherheitsrelevant trotz niedriger Schwere.",
                "type": "style",
                "detail": "x",
            },
        ]
    })
    with mock.patch("subprocess.run"):
        report = report_builder_module.build_full_report(
            session, "TARA-0115", repo="SCHUNK-SE-Co-KG/TARATool", create_issues=True
        )
    assert "disposition_deviations" in report
    assert len(report["disposition_deviations"]) == 1


# ---------------------------------------------------------------------------
# Rueckbezug auf #184 (TARA-0114 Frage 3)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0115
def test_doc_cross_references_tara_0114_open_question():
    content = _read(REVIEW_AGENT_PATH)
    assert "TARA-0115" in content
    assert "Frage 3" in content or "#185" in content
