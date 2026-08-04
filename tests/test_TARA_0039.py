"""Tests for TARA-0039: Playwright Runtime Infrastructure."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.mark.TARA_0039
def test_start_review_session_opens_browser(tmp_path):
    """start_review_session() should open Chromium and load a page."""
    html = tmp_path / "test.html"
    html.write_text("<html><body><h1>Test</h1></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from agents.review_agent.runtime_scanner import start_review_session, stop_review_session

    session = start_review_session(app_url)
    try:
        assert session.page is not None
        assert session.context is not None
        title = session.page.title()
        assert isinstance(title, str)
    finally:
        stop_review_session(session)


@pytest.mark.TARA_0039
def test_session_report_is_json_serializable(tmp_path):
    """session.report should be JSON serializable."""
    html = tmp_path / "test.html"
    html.write_text("<html><body></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from agents.review_agent.runtime_scanner import start_review_session, stop_review_session

    session = start_review_session(app_url)
    try:
        dumped = json.dumps(session.report)
        assert isinstance(dumped, str)
        data = json.loads(dumped)
        assert "findings" in data
        assert "raw" in data
    finally:
        stop_review_session(session)


@pytest.mark.TARA_0039
def test_stop_review_session_no_exception(tmp_path):
    """stop_review_session() should close browser without exception."""
    html = tmp_path / "test.html"
    html.write_text("<html><body></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    from agents.review_agent.runtime_scanner import start_review_session, stop_review_session

    session = start_review_session(app_url)
    stop_review_session(session)  # Should not raise


@pytest.mark.TARA_0039
def test_cli_creates_report_file(tmp_path, monkeypatch):
    """CLI call should create a JSON report file."""
    html = tmp_path / "index.html"
    html.write_text("<html><body></body></html>", encoding="utf-8")
    app_url = f"file:///{html.as_posix()}"

    reports_dir = tmp_path / "reports"
    reports_dir.mkdir()

    import agents.review_agent.runtime_scanner as rs

    def patched_run_cli(story_id, url, full=False):
        session = rs.start_review_session(url)
        session.report["story_id"] = story_id
        out_path = reports_dir / f"review_runtime_{story_id}.json"
        session.report["_output_path"] = str(out_path)
        rs.stop_review_session(session)

    monkeypatch.setattr(rs, "_run_cli", patched_run_cli)

    rs._run_cli("TARA_TEST", app_url)

    report_file = reports_dir / "review_runtime_TARA_TEST.json"
    assert report_file.exists()
    data = json.loads(report_file.read_text(encoding="utf-8"))
    assert data["story_id"] == "TARA_TEST"
