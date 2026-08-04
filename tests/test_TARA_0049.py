"""Tests for TARA-0049: Consolidated report builder."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.mark.TARA_0049
def test_determine_merge_decision_no_findings():
    from agents.review_agent.report_builder import determine_merge_decision
    assert determine_merge_decision([]) == "APPROVED"


@pytest.mark.TARA_0049
def test_determine_merge_decision_low():
    from agents.review_agent.report_builder import determine_merge_decision
    assert determine_merge_decision([{"severity": "Niedrig"}]) == "APPROVED_WITH_BACKLOG"


@pytest.mark.TARA_0049
def test_determine_merge_decision_medium():
    from agents.review_agent.report_builder import determine_merge_decision
    assert determine_merge_decision([{"severity": "Mittel"}]) == "APPROVED_WITH_BACKLOG"


@pytest.mark.TARA_0049
def test_determine_merge_decision_high():
    from agents.review_agent.report_builder import determine_merge_decision
    assert determine_merge_decision([{"severity": "Hoch"}]) == "BLOCKED"


@pytest.mark.TARA_0049
def test_determine_merge_decision_critical():
    from agents.review_agent.report_builder import determine_merge_decision
    assert determine_merge_decision([{"severity": "Kritisch"}]) == "BLOCKED"


@pytest.mark.TARA_0049
def test_save_report_creates_json_and_md(tmp_path):
    from agents.review_agent.report_builder import save_report

    report = {
        "story_id": "TARA-0049",
        "timestamp": "2026-08-04T10:00:00Z",
        "app_url": "file:///test.html",
        "findings": [{"type": "test_finding", "severity": "Niedrig", "detail": "test"}],
        "raw": {},
        "missing_info": [],
        "merge_decision": "APPROVED_WITH_BACKLOG",
    }

    json_path = save_report(report, tmp_path)

    assert json_path.exists()
    assert json_path.suffix == ".json"

    data = json.loads(json_path.read_text(encoding="utf-8"))
    assert data["story_id"] == "TARA-0049"

    md_files = list(tmp_path.glob("*.md"))
    assert len(md_files) == 1
    md_content = md_files[0].read_text(encoding="utf-8")
    assert "TARA-0049" in md_content
    assert "APPROVED_WITH_BACKLOG" in md_content
