"""TARA-0049: Consolidated report builder."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession

SEVERITY_LEVELS = {"Kritisch": 4, "Hoch": 3, "Mittel": 2, "Niedrig": 1}


def build_full_report(
    session: "ReviewSession",
    story_id: str,
    repo: str | None = None,
    create_issues: bool = True,
) -> dict:
    """Aggregate all partial findings into a full report.

    If ``repo`` is provided and ``create_issues`` is True, GitHub Issues are
    created for all findings >= Mittel (Critical/High additionally trigger
    Blocking status via P-18).
    """
    session.report["story_id"] = story_id
    session.report["timestamp"] = datetime.utcnow().isoformat() + "Z"
    session.report["finding_count"] = len(session.report.get("findings", []))
    session.report["merge_decision"] = determine_merge_decision(
        session.report.get("findings", [])
    )

    if repo and create_issues:
        created = create_github_issues_for_findings(
            session.report.get("findings", []), story_id, repo
        )
        session.report["github_issues_created"] = created

    return session.report


def determine_merge_decision(findings: list) -> str:
    """
    'APPROVED' | 'APPROVED_WITH_BACKLOG' | 'BLOCKED'
    - No findings -> APPROVED
    - Only Niedrig/Mittel -> APPROVED_WITH_BACKLOG
    - Hoch/Kritisch -> BLOCKED
    """
    if not findings:
        return "APPROVED"

    max_level = max(
        SEVERITY_LEVELS.get(f.get("severity", "Niedrig"), 1) for f in findings
    )
    if max_level >= SEVERITY_LEVELS["Hoch"]:
        return "BLOCKED"
    return "APPROVED_WITH_BACKLOG"


def save_report(report: dict, output_dir: Path) -> Path:
    """Save JSON and Markdown report."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    story_id = report.get("story_id", "UNKNOWN")
    timestamp = report.get("timestamp", datetime.utcnow().isoformat() + "Z").replace(":", "-")

    clean_report = {k: v for k, v in report.items() if not k.startswith("_")}

    json_path = output_dir / f"review_{story_id}_{timestamp[:19].replace(':', '-')}.json"
    json_path.write_text(
        json.dumps(clean_report, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    md_path = output_dir / f"review_{story_id}_{timestamp[:19].replace(':', '-')}.md"
    findings = clean_report.get("findings", [])
    decision = clean_report.get("merge_decision", determine_merge_decision(findings))

    lines = [
        f"# Review Report: {story_id}",
        f"",
        f"**Timestamp:** {clean_report.get('timestamp', '')}",
        f"**App URL:** {clean_report.get('app_url', '')}",
        f"**Merge Decision:** {decision}",
        f"",
        f"## Findings ({len(findings)})",
        "",
    ]
    for f in findings:
        lines.append(
            f"- **[{f.get('severity', '?')}]** `{f.get('type', '?')}`: {f.get('detail', f.get('message', f.get('text', '')))}"
        )

    if clean_report.get("missing_info"):
        lines += ["", "## Missing Info", ""]
        for mi in clean_report["missing_info"]:
            lines.append(f"- {mi}")

    md_path.write_text("\n".join(lines), encoding="utf-8")

    return json_path


def create_github_issues_for_findings(
    findings: list, story_id: str, repo: str
) -> list:
    """Create review-finding issues via gh CLI for findings >= Mittel.

    Title format:  [TARA-REVIEW] TARA-XXXX – <type> (<severity>)
    Labels:        review-finding, sp:1
    Body:          Formatted markdown per REVIEW_AGENT_WORKFLOW.md

    Critical/High findings also trigger a Blocking status on the board
    (P-18: pre-transition check violation).
    """
    import subprocess

    created = []
    has_critical_or_high = False

    for finding in findings:
        severity = finding.get("severity", "Niedrig")
        if SEVERITY_LEVELS.get(severity, 1) < SEVERITY_LEVELS["Mittel"]:
            continue

        if SEVERITY_LEVELS.get(severity, 1) >= SEVERITY_LEVELS["Hoch"]:
            has_critical_or_high = True

        rule = finding.get("rule", "R-??")
        ftype = finding.get("type", "unknown")
        detail = finding.get("detail", finding.get("message", finding.get("text", "–")))
        file_path = finding.get("file", "–")
        line_no = finding.get("line", "–")
        reasoning = finding.get("reasoning", "–")
        evidence = finding.get("evidence", {})
        code_snippet = evidence.get("code_snippet", "–") if isinstance(evidence, dict) else "–"

        title = f"[TARA-REVIEW] {story_id} – {ftype} ({severity})"

        body = (
            f"## Review Finding\n\n"
            f"**Story:** {story_id}  \n"
            f"**Typ:** {ftype}  \n"
            f"**Schwere:** {severity}  \n"
            f"**Regel:** {rule}  \n"
            f"**Datei:** `{file_path}` (Zeile {line_no})\n\n"
            f"### Problem\n\n{detail}\n\n"
            f"### Code\n\n```\n{code_snippet}\n```\n\n"
            f"### Begründung\n\n{reasoning}\n"
        )

        try:
            result = subprocess.run(
                [
                    "gh", "issue", "create",
                    "--repo", repo,
                    "--title", title,
                    "--body", body,
                    "--label", "review-finding",
                    "--label", "sp:1",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                created.append(result.stdout.strip())
        except Exception as exc:
            pass

    # P-18: Critical/High findings block the story -> set to Blocking
    if has_critical_or_high:
        _set_story_blocking(story_id, repo)

    return created


def _set_story_blocking(story_id: str, repo: str) -> None:
    """Set the board item for story_id to Blocking status (P-18)."""
    import subprocess

    tara_num = story_id.replace("TARA-", "")
    script = Path(__file__).parent.parent.parent / "scripts" / "set_story_status.py"
    if script.exists():
        subprocess.run(
            ["python", str(script), tara_num, "Blocking"],
            capture_output=True,
            text=True,
            timeout=30,
        )
