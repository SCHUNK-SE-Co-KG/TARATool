"""TARA-0049: Consolidated report builder."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from tools.review_agent.runtime_scanner import ReviewSession

SEVERITY_LEVELS = {"Kritisch": 4, "Hoch": 3, "Mittel": 2, "Niedrig": 1}

# TARA-0114 Teil 2: Erlaubte Werte fuer das optionale Finding-Feld
# 'disposition', das steuert, WIE ein Finding abgelegt wird (statt
# pauschal jedes Finding >= Mittel als eigenes review-finding-Issue).
DISPOSITIONS = {"pr_comment", "finding_issue", "backlog_story", "systemic_issue"}


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
    session.report["timestamp"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    session.report["finding_count"] = len(session.report.get("findings", []))
    session.report["merge_decision"] = determine_merge_decision(
        session.report.get("findings", [])
    )

    if repo and create_issues:
        created = create_github_issues_for_findings(
            session.report.get("findings", []), story_id, repo
        )
        session.report["github_issues_created"] = created["issues"]
        session.report["review_pr_comments"] = created["pr_comments"]

    return session.report


def build_review_result_comment(
    story_id: str,
    pull_request: int,
    reviewed_head_sha: str,
    findings: list,
    review_profile_version: str = "1.0",
    findings_issue: int | None = None,
) -> str:
    """TARA-0107: Erzeugt den maschinenlesbaren, SHA-gebundenen P-10-Nachweis
    als PR-Kommentar (Fenced ```json``` Block).

    Ersetzt den faelschbaren Freitext-Marker aus TARA-0089
    ("Review-Agent: OK - keine Findings"). Der Process Guard prueft ueber
    ``scripts/process_guard/review_result_parser.py``, ob ``reviewed_head_sha``
    dem aktuellen PR-Head-SHA entspricht und ob offene Critical/High-Findings
    durch ``findings_issue`` abgedeckt sind.
    """
    critical = sum(1 for f in findings if f.get("severity") == "Kritisch")
    high = sum(1 for f in findings if f.get("severity") == "Hoch")
    decision = determine_merge_decision(findings)
    result = "passed" if decision != "BLOCKED" else "failed"

    payload = {
        "story": story_id,
        "pull_request": pull_request,
        "reviewed_head_sha": reviewed_head_sha,
        "review_profile_version": review_profile_version,
        "result": result,
        "critical": critical,
        "high": high,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if findings_issue is not None:
        payload["findings_issue"] = findings_issue

    body = "Review-Agent-Ergebnis (P-10, TARA-0107):\n\n```json\n"
    body += json.dumps(payload, indent=2, ensure_ascii=False)
    body += "\n```\n"
    return body


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
    timestamp = report.get("timestamp", datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")).replace(":", "-")

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


def get_next_tara_id(repo: str) -> str:
    """Fetch highest TARA-XXXX ID across all issues and return the next one.

    Each review finding must have its own unique TARA ID — the source story
    ID must NOT be reused in the title (process rule: no duplicate TARA IDs).
    """
    import re
    import subprocess

    try:
        result = subprocess.run(
            ["gh", "issue", "list", "--repo", repo, "--state", "all",
             "--limit", "500", "--json", "title"],
            capture_output=True, text=True, timeout=30,
        )
        titles = [item["title"] for item in json.loads(result.stdout or "[]")]
        ids = [int(m) for t in titles for m in re.findall(r"TARA-(\d+)", t)]
        return f"TARA-{(max(ids) + 1):04d}" if ids else "TARA-0001"
    except Exception:
        return "TARA-XXXX"


def _resolve_disposition(finding: dict) -> str | None:
    """TARA-0114 Teil 2: Bestimmt die Ablage-Kategorie eines Findings.

    Nutzt ein explizites 'disposition'-Feld (Review-Agent-Selbsteinschaetzung,
    Uebergangsloesung bis zur deterministischen Heuristik aus TARA-0115/#185).
    Fehlt das Feld oder ist der Wert ungueltig, greift zur Rueckwaertskompatibilitaet
    das bisherige Verhalten: Mittel/Hoch/Kritisch -> 'finding_issue', Niedrig -> None
    (kein Eintrag, wie vor TARA-0114).
    """
    disposition = finding.get("disposition")
    if isinstance(disposition, str) and disposition in DISPOSITIONS:
        return disposition
    severity = finding.get("severity", "Niedrig")
    if SEVERITY_LEVELS.get(severity, 1) >= SEVERITY_LEVELS["Mittel"]:
        return "finding_issue"
    return None


def _format_pr_comment(finding: dict) -> str:
    """TARA-0114 Teil 2: Formatiert ein Finding mit disposition='pr_comment'
    als direkt postbaren PR-Review-Kommentar (kein eigenes Issue)."""
    severity = finding.get("severity", "Niedrig")
    ftype = finding.get("type", "unknown")
    detail = finding.get("detail", finding.get("message", finding.get("text", "-")))
    file_path = finding.get("file", "-")
    line_no = finding.get("line", "-")
    return (
        f"**[{severity}] {ftype}** (`{file_path}`, Zeile {line_no}): {detail}"
    )


def create_github_issues_for_findings(
    findings: list, story_id: str, repo: str
) -> dict:
    """Erstellt je nach Finding-Art (TARA-0114 Teil 2, 'disposition') GitHub
    Issues oder formatiert das Finding als PR-Kommentar.

    Title format je nach Disposition:
      finding_issue:  [TARA-XXXX] REVIEW-FINDING: <type> (<severity>)
      backlog_story:  [TARA-XXXX] STORY: <type> (akzeptierte technische Schuld)
      systemic_issue: [TARA-XXXX] REVIEW-FINDING: <type> (systemisch, <severity>)
      TARA-XXXX ist stets eine NEUE eindeutige ID - die Source-Story steht im Body.

    Labels:
      finding_issue:  review-finding, sp:1
      backlog_story:  story
      systemic_issue: epic ODER enhancement

    Critical/High Findings (unabhaengig von der Disposition) loesen zusaetzlich
    eine Blocked-Markierung auf dem Story-Issue aus (P-18).

    Rueckgabe: {"issues": [<Issue-URLs>], "pr_comments": [<formatierte Texte>]}
    """
    import subprocess

    created: list[str] = []
    pr_comments: list[str] = []
    has_critical_or_high = False

    for finding in findings:
        severity = finding.get("severity", "Niedrig")
        disposition = _resolve_disposition(finding)
        if disposition is None:
            continue

        if SEVERITY_LEVELS.get(severity, 1) >= SEVERITY_LEVELS["Hoch"]:
            has_critical_or_high = True

        if disposition == "pr_comment":
            pr_comments.append(_format_pr_comment(finding))
            continue

        rule = finding.get("rule", "R-??")
        ftype = finding.get("type", "unknown")
        detail = finding.get("detail", finding.get("message", finding.get("text", "–")))
        file_path = finding.get("file", "–")
        line_no = finding.get("line", "–")
        reasoning = finding.get("reasoning", "–")
        evidence = finding.get("evidence", {})
        code_snippet = evidence.get("code_snippet", "–") if isinstance(evidence, dict) else "–"

        # Each finding gets its own unique TARA ID (never reuse story ID)
        finding_id = get_next_tara_id(repo)

        if disposition == "backlog_story":
            title = f"[{finding_id}] STORY: {ftype} (akzeptierte technische Schuld aus Review)"
            labels = ["story"]
            body = (
                f"## Akzeptierte technische Schuld (aus Review von {story_id})\n\n"
                f"**Finding-ID:** {finding_id}  \n"
                f"**Source-Story:** {story_id}  \n"
                f"**Typ:** {ftype}  \n"
                f"**Schwere (im Review):** {severity}  \n"
                f"**Regel:** {rule}  \n"
                f"**Datei:** `{file_path}` (Zeile {line_no})\n\n"
                f"### Beschreibung\n\n{detail}\n\n"
                f"### Begründung\n\n{reasoning}\n"
            )
        elif disposition == "systemic_issue":
            # Titel folgt bewusst dem EPIC-Nomenklaturschema (nicht
            # REVIEW-FINDING), da der Process-Guard-Issue-Checker
            # (agents/process_guard/issue_checker.py) jeden Titel mit dem
            # Praefix "REVIEW-FINDING:" als Typ 'review_finding' erkennt und
            # dafuer zwingend das Label 'review-finding' verlangt - das
            # systemische Problem ist aber kein einzelnes Finding, sondern ein
            # neuer Epic-/Verbesserungs-Issue.
            title = f"[{finding_id}] EPIC: {ftype} (systemisches Problem, {severity})"
            labels = (
                ["epic"]
                if finding.get("recurring_scope") == "multiple"
                else ["epic", "enhancement"]
            )
            body = (
                f"## Wiederkehrendes systemisches Problem (aus Review von {story_id})\n\n"
                f"**Finding-ID:** {finding_id}  \n"
                f"**Source-Story:** {story_id}  \n"
                f"**Typ:** {ftype}  \n"
                f"**Schwere:** {severity}  \n"
                f"**Regel:** {rule}  \n"
                f"**Datei:** `{file_path}` (Zeile {line_no})\n\n"
                f"### Problem\n\n{detail}\n\n"
                f"### Begründung\n\n{reasoning}\n"
            )
        else:  # finding_issue (Standardfall, wie vor TARA-0114)
            title = f"[{finding_id}] REVIEW-FINDING: {ftype} ({severity})"
            labels = ["review-finding", "sp:1"]
            body = (
                f"## Review Finding\n\n"
                f"**Finding-ID:** {finding_id}  \n"
                f"**Source-Story:** {story_id}  \n"
                f"**Typ:** {ftype}  \n"
                f"**Schwere:** {severity}  \n"
                f"**Regel:** {rule}  \n"
                f"**Datei:** `{file_path}` (Zeile {line_no})\n\n"
                f"### Problem\n\n{detail}\n\n"
                f"### Code\n\n```\n{code_snippet}\n```\n\n"
                f"### Begründung\n\n{reasoning}\n"
            )

        cmd = ["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body]
        for label in labels:
            cmd += ["--label", label]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                created.append(result.stdout.strip())
        except Exception:
            pass

    # P-18: Critical/High findings block the story -> mark as blocked
    # (TARA-0121: Label statt Board-Status Blocking, der entfallen ist)
    if has_critical_or_high:
        _set_story_blocked(story_id, repo)

    return {"issues": created, "pr_comments": pr_comments}


def _set_story_blocked(story_id: str, repo: str) -> None:
    """Markiert das Story-Issue ueber das Label "blocked" (P-18).

    TARA-0121: Der bisherige Board-Status Blocking entfaellt (PO-
    Entscheidung) - die zugehoerige Options-ID wurde im Board zu
    "PO Release" umbenannt. Ein Aufruf von `set_story_status.py ... Blocking`
    wuerde daher inzwischen faelschlich die "PO Release"-Spalte setzen.
    Blockierte Items behalten stattdessen ihren aktuellen Board-Status und
    werden ueber das bestehende Issue-Label "blocked" markiert (siehe auch
    `scripts/process_health_check.py`, das bereits per Label filtert)."""
    import subprocess

    tara_num = story_id.replace("TARA-", "")
    try:
        result = subprocess.run(
            [
                "gh", "issue", "list", "--repo", repo,
                "--search", f"TARA-{tara_num} in:title",
                "--state", "all", "--json", "number", "--limit", "1",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        issues = json.loads(result.stdout or "[]")
    except Exception:
        issues = []
    if not issues:
        return
    issue_number = issues[0]["number"]
    try:
        subprocess.run(
            ["gh", "issue", "edit", str(issue_number), "--repo", repo, "--add-label", "blocked"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception:
        pass

