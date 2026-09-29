"""
[TARA-0114] Tests: Review-Prozess verbessern
(Reviewdimensionen R-35/R-36, Finding-Triage-Ablage, Review-Agent-Unabhaengigkeit)

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, bevor
agents/review_agent/REVIEW_AGENT_WORKFLOW.md und
agents/review_agent/report_builder.py um folgende Teile ergaenzt wurden:

Teil 1 - Priorisierte neue Reviewdimensionen (PO-Entscheidung: nur
    Datenmigration/Rueckwaertskompatibilitaet und Dependency-/
    Lizenzaenderungen, nicht alle 14 aus der Story):
    R-35 (Datenmigration/Rueckwaertskompatibilitaet) und
    R-36 (Dependency-/Lizenzaenderungen).

Teil 2 - Finding-Ablage-Differenzierung statt "jedes Finding >= Mittel wird
    ein Issue": Direkt behebbares PR-Problem -> PR-Kommentar (kein Issue),
    Blockierendes Problem -> Finding-Issue (wie bisher), Akzeptierte
    technische Schuld -> Backlog-Story, Wiederkehrendes systemisches
    Problem -> Epic/Improvement-Issue. Interim: Review-Agent-
    Selbsteinschaetzung ueber ein 'disposition'-Feld je Finding (PO-
    Entscheidung, deterministische Heuristik folgt in TARA-0115/#185).

Teil 3 - Formal dokumentierte Unabhaengigkeits-Kriterien (separater
    Kontext, keine Uebernahme der Dev-Agent-Begruendung, eigene Diff-/
    Story-Verifikation, SHA-Bindung (#177/TARA-0107), Rollentrennung
    (#178/TARA-0108), Modell-Wahl, Least-Privilege-Zugriff).
"""
import json
import os
import sys
from unittest import mock

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REVIEW_AGENT_PATH = os.path.join(REPO_ROOT, "agents", "review_agent", "REVIEW_AGENT_WORKFLOW.md")
PROCESS_GUARD_DOC = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
REPORT_BUILDER_DIR = os.path.join(REPO_ROOT, "agents", "review_agent")


def _read(path):
    return open(path, encoding="utf-8").read()


@pytest.fixture()
def report_builder_module():
    sys.path.insert(0, os.path.join(REPO_ROOT, "agents"))
    from agents.review_agent import report_builder  # noqa: E402
    yield report_builder
    sys.modules.pop("agents.review_agent.report_builder", None)
    if os.path.join(REPO_ROOT, "agents") in sys.path:
        sys.path.remove(os.path.join(REPO_ROOT, "agents"))


# ---------------------------------------------------------------------------
# Teil 1 - R-35/R-36 (priorisierte neue Reviewdimensionen)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0114
def test_review_agent_workflow_has_data_migration_rule():
    content = _read(REVIEW_AGENT_PATH)
    assert "R-35" in content
    assert "Datenmigration" in content or "Rueckwaertskompatibilitaet" in content or \
        "Rückwärtskompatibilität" in content


@pytest.mark.TARA_0114
def test_review_agent_workflow_has_dependency_license_rule():
    content = _read(REVIEW_AGENT_PATH)
    assert "R-36" in content
    assert "Abhäng" in content or "Abhaeng" in content
    assert "Lizenz" in content


@pytest.mark.TARA_0114
def test_scope_table_covers_r35_r36():
    """Die Scope-Entscheidungstabelle muss die neuen Regeln einem Aenderungs-
    Muster zuordnen (z.B. package.json/requirements.txt/localStorage-Schema)."""
    content = _read(REVIEW_AGENT_PATH)
    assert "R-35" in content and "R-36" in content
    # Muss in der Scope-Tabelle (nicht nur im Pruefkatalog) referenziert sein -
    # daher mindestens zwei Vorkommen von R-35 im Dokument erwarten.
    assert content.count("R-35") >= 2
    assert content.count("R-36") >= 2


@pytest.mark.TARA_0114
def test_teil1_scope_reflects_po_prioritization():
    """PO hat sich fuer eine priorisierte/gestufte Umsetzung entschieden -
    nicht alle 14 urspruenglich vorgeschlagenen Dimensionen. R-37 (naechste
    freie ID nach R-36) darf daher noch nicht existieren."""
    content = _read(REVIEW_AGENT_PATH)
    assert "R-37" not in content


# ---------------------------------------------------------------------------
# Teil 2 - Finding-Ablage-Differenzierung (Dokumentation)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0114
def test_review_agent_doc_has_finding_ablage_table():
    content = _read(REVIEW_AGENT_PATH)
    for phrase in (
        "PR-Kommentar",
        "Backlog-Story",
        "Finding-Issue",
    ):
        assert phrase in content, f"'{phrase}' fehlt in der Finding-Ablage-Tabelle"
    assert "disposition" in content.lower()


@pytest.mark.TARA_0114
def test_review_agent_doc_documents_interim_self_assessment():
    content = _read(REVIEW_AGENT_PATH)
    assert "TARA-0115" in content or "#185" in content, \
        "Verweis auf die Folge-Story mit der deterministischen Heuristik fehlt"


# ---------------------------------------------------------------------------
# Teil 2 - Finding-Ablage-Differenzierung (report_builder.py Logik)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0114
def test_resolve_disposition_respects_explicit_value(report_builder_module):
    finding = {"severity": "Niedrig", "disposition": "systemic_issue"}
    assert report_builder_module._resolve_disposition(finding) == "systemic_issue"


@pytest.mark.TARA_0114
def test_resolve_disposition_ignores_invalid_value(report_builder_module):
    finding = {"severity": "Hoch", "disposition": "not-a-real-disposition"}
    assert report_builder_module._resolve_disposition(finding) == "finding_issue"


@pytest.mark.TARA_0114
def test_resolve_disposition_defaults_to_finding_issue_for_mittel_plus(report_builder_module):
    for severity in ("Mittel", "Hoch", "Kritisch"):
        finding = {"severity": severity}
        assert report_builder_module._resolve_disposition(finding) == "finding_issue"


@pytest.mark.TARA_0114
def test_resolve_disposition_none_for_niedrig_without_explicit_value(report_builder_module):
    finding = {"severity": "Niedrig"}
    assert report_builder_module._resolve_disposition(finding) is None


@pytest.mark.TARA_0114
def test_create_issues_skips_gh_issue_create_for_pr_comment_disposition(report_builder_module):
    findings = [
        {
            "severity": "Niedrig",
            "disposition": "pr_comment",
            "type": "style",
            "detail": "Trivialer Tippfehler im Kommentar.",
            "file": "js/foo.js",
            "line": 12,
        }
    ]
    with mock.patch("subprocess.run") as mocked_run:
        result = report_builder_module.create_github_issues_for_findings(
            findings, "TARA-0114", "SCHUNK-SE-Co-KG/TARATool"
        )
    mocked_run.assert_not_called()
    assert result["issues"] == []
    assert len(result["pr_comments"]) == 1
    assert "Tippfehler" in result["pr_comments"][0]


@pytest.mark.TARA_0114
def test_create_issues_creates_finding_issue_for_blocking_disposition(report_builder_module):
    findings = [
        {
            "severity": "Hoch",
            "disposition": "finding_issue",
            "type": "security",
            "detail": "Fehlende Eingabevalidierung.",
            "file": "js/bar.js",
            "line": 5,
        }
    ]
    fake_result = mock.Mock(returncode=0, stdout="https://github.com/x/y/issues/999\n")
    with mock.patch("subprocess.run", return_value=fake_result) as mocked_run:
        with mock.patch.object(report_builder_module, "get_next_tara_id", return_value="TARA-0999"):
            result = report_builder_module.create_github_issues_for_findings(
                findings, "TARA-0114", "SCHUNK-SE-Co-KG/TARATool"
            )
    assert mocked_run.called
    call_args = mocked_run.call_args_list[0].args[0]
    assert "review-finding" in call_args
    assert result["issues"] == ["https://github.com/x/y/issues/999"]
    assert result["pr_comments"] == []


@pytest.mark.TARA_0114
def test_create_issues_creates_backlog_story_for_accepted_debt_disposition(report_builder_module):
    findings = [
        {
            "severity": "Mittel",
            "disposition": "backlog_story",
            "type": "architecture",
            "detail": "Akzeptierte technische Schuld: Modul sollte spaeter aufgeteilt werden.",
            "file": "js/baz.js",
            "line": 1,
        }
    ]
    fake_result = mock.Mock(returncode=0, stdout="https://github.com/x/y/issues/1000\n")
    with mock.patch("subprocess.run", return_value=fake_result) as mocked_run:
        with mock.patch.object(report_builder_module, "get_next_tara_id", return_value="TARA-1000"):
            result = report_builder_module.create_github_issues_for_findings(
                findings, "TARA-0114", "SCHUNK-SE-Co-KG/TARATool"
            )
    call_args = mocked_run.call_args_list[0].args[0]
    assert "story" in call_args
    assert "review-finding" not in call_args
    assert result["issues"] == ["https://github.com/x/y/issues/1000"]


@pytest.mark.TARA_0114
def test_create_issues_creates_systemic_issue_for_recurring_problem_disposition(report_builder_module):
    findings = [
        {
            "severity": "Mittel",
            "disposition": "systemic_issue",
            "type": "process",
            "detail": "Wiederkehrendes Muster: stille Bypaesse in mehreren Skripten.",
            "file": "scripts/foo.sh",
            "line": 1,
        }
    ]
    fake_result = mock.Mock(returncode=0, stdout="https://github.com/x/y/issues/1001\n")
    with mock.patch("subprocess.run", return_value=fake_result) as mocked_run:
        with mock.patch.object(report_builder_module, "get_next_tara_id", return_value="TARA-1001"):
            result = report_builder_module.create_github_issues_for_findings(
                findings, "TARA-0114", "SCHUNK-SE-Co-KG/TARATool"
            )
    call_args = mocked_run.call_args_list[0].args[0]
    assert "epic" in call_args or "enhancement" in call_args
    assert result["issues"] == ["https://github.com/x/y/issues/1001"]


@pytest.mark.TARA_0114
def test_create_issues_niedrig_without_disposition_is_skipped_entirely(report_builder_module):
    """Rueckwaertskompatibilitaet: Ein Niedrig-Finding ohne explizite
    Disposition wird wie bisher weder als Issue noch als PR-Kommentar
    erzeugt (kein Verhaltensbruch fuer bestehende Aufrufer)."""
    findings = [{"severity": "Niedrig", "type": "style", "detail": "kosmetisch"}]
    with mock.patch("subprocess.run") as mocked_run:
        result = report_builder_module.create_github_issues_for_findings(
            findings, "TARA-0114", "SCHUNK-SE-Co-KG/TARATool"
        )
    mocked_run.assert_not_called()
    assert result["issues"] == []
    assert result["pr_comments"] == []


@pytest.mark.TARA_0114
def test_create_issues_returns_dict_with_issues_and_pr_comments_keys(report_builder_module):
    with mock.patch("subprocess.run"):
        result = report_builder_module.create_github_issues_for_findings(
            [], "TARA-0114", "SCHUNK-SE-Co-KG/TARATool"
        )
    assert set(result.keys()) == {"issues", "pr_comments"}


@pytest.mark.TARA_0114
def test_build_full_report_stores_both_issues_and_pr_comments(report_builder_module):
    from dataclasses import dataclass, field as dc_field

    @dataclass
    class _FakeSession:
        report: dict = dc_field(default_factory=dict)

    session = _FakeSession(report={
        "findings": [
            {"severity": "Niedrig", "disposition": "pr_comment", "type": "style", "detail": "x"},
        ]
    })
    with mock.patch("subprocess.run"):
        report = report_builder_module.build_full_report(
            session, "TARA-0114", repo="SCHUNK-SE-Co-KG/TARATool", create_issues=True
        )
    assert "github_issues_created" in report
    assert "review_pr_comments" in report
    assert len(report["review_pr_comments"]) == 1


# ---------------------------------------------------------------------------
# Teil 3 - Formal dokumentierte Unabhaengigkeits-Kriterien
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0114
def test_review_agent_doc_has_independence_section():
    content = _read(REVIEW_AGENT_PATH)
    assert "Unabh" in content  # Unabhaengigkeit / Unabhängigkeit


@pytest.mark.TARA_0114
def test_independence_section_lists_separate_context_requirement():
    content = _read(REVIEW_AGENT_PATH)
    assert "separater Kontext" in content or "Separater Kontext" in content or \
        "eigenen Kontext" in content


@pytest.mark.TARA_0114
def test_independence_section_forbids_reusing_dev_agent_reasoning():
    content = _read(REVIEW_AGENT_PATH)
    assert "Begründung" in content or "Begruendung" in content


@pytest.mark.TARA_0114
def test_independence_section_references_sha_binding_story():
    content = _read(REVIEW_AGENT_PATH)
    assert "TARA-0107" in content or "#177" in content


@pytest.mark.TARA_0114
def test_independence_section_references_role_separation_story():
    content = _read(REVIEW_AGENT_PATH)
    assert "TARA-0108" in content or "#178" in content


@pytest.mark.TARA_0114
def test_independence_section_documents_least_privilege():
    content = _read(REVIEW_AGENT_PATH)
    assert "Least-Privilege" in content or "least-privilege" in content.lower()
    assert "Schreibrecht" in content or "Schreibzugriff" in content


@pytest.mark.TARA_0114
def test_independence_section_documents_model_decision():
    """PO-Entscheidung (TARA-0114): kein separates Pflicht-Modell, aber der
    Review-Agent laeuft als eigener Sub-Agent-Typ, unabhaengig vom Modell
    der Dev-Agent-Story-Implementierung."""
    content = _read(REVIEW_AGENT_PATH)
    assert "Modell" in content
    assert "Sub-Agent" in content or "sub-agent" in content.lower() or \
        "code-review" in content


# ---------------------------------------------------------------------------
# Querverweis: Process-Guard-Doku (optional, aber falls vorhanden konsistent)
# ---------------------------------------------------------------------------

@pytest.mark.TARA_0114
def test_process_guard_doc_still_references_sha_bound_proof():
    """Regressionsschutz: der bestehende P-10-Verweis auf den SHA-gebundenen
    Nachweis darf durch TARA-0114 nicht verloren gehen."""
    content = _read(PROCESS_GUARD_DOC)
    assert "reviewed_head_sha" in content or "SHA-gebunden" in content
