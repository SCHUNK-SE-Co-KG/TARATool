#!/usr/bin/env python3
"""
Process Guard – Issue Nomenclature & Content Compliance Checker

Triggered by GitHub Actions on every `issues: opened` event.
Validates:
  - P-14: TARA-ID uniqueness (no ID reuse across issues)
  - Nomenclature: title matches expected pattern for its type
  - Body completeness: required sections present per issue type
  - Label compliance: correct labels for each issue type

Exit codes:
  0 = compliant
  1 = violations found (workflow posts comment and adds label)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Known issue types and their title patterns
# ---------------------------------------------------------------------------

PATTERNS = {
    "story":             re.compile(r"^\[TARA-(\d{4})\] STORY: \S"),
    "epic":              re.compile(r"^\[TARA-(\d{4})\] EPIC: \S"),
    "review_finding":    re.compile(r"^\[TARA-(\d{4})\] REVIEW-FINDING: \S"),
    "process_violation": re.compile(r"^\[TARA-(\d{4})\] PROCESS-VIOLATION: \S"),
}

# Required body sections per type (markdown headings or bold labels)
REQUIRED_BODY = {
    "review_finding":    ["**Finding-ID:**", "**Source-Story:**", "**Schwere:**"],
    "process_violation": ["**Branch:**",     "**Commit:**",       "### Verstösse"],
    "story":             [],
    "epic":              [],
}

# Expected labels per type (at least one must be present)
EXPECTED_LABELS = {
    "review_finding":    ["review-finding"],
    "process_violation": ["process-violation"],
    "story":             ["story"],
    "epic":              ["epic"],
}


# ---------------------------------------------------------------------------
# Dataclass for a finding
# ---------------------------------------------------------------------------

@dataclass
class Finding:
    rule: str
    severity: str   # Kritisch | Hoch | Mittel | Niedrig
    message: str
    action: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def gh(args: list[str]) -> dict | list:
    """Run a gh CLI command and return parsed JSON."""
    result = subprocess.run(
        ["gh"] + args, capture_output=True, timeout=30
    )
    if result.returncode != 0:
        return {}
    try:
        text = result.stdout.decode("utf-8-sig", errors="replace")
        return json.loads(text)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def get_all_issue_titles(repo: str, exclude_number: int) -> dict[str, int]:
    """Return {tara_id: issue_number} for all open+closed issues except the new one."""
    items = gh([
        "issue", "list", "--repo", repo, "--state", "all",
        "--limit", "500", "--json", "number,title",
    ])
    result: dict[str, int] = {}
    for item in items if isinstance(items, list) else []:
        if item["number"] == exclude_number:
            continue
        for m in re.findall(r"TARA-(\d{4})", item.get("title", "")):
            result[m] = item["number"]
    return result


def detect_type(title: str) -> str | None:
    """Return issue type string or None if unrecognised."""
    if PATTERNS["process_violation"].match(title):
        return "process_violation"
    if PATTERNS["review_finding"].match(title):
        return "review_finding"
    if PATTERNS["epic"].match(title):
        return "epic"
    if PATTERNS["story"].match(title):
        return "story"
    return None


def extract_tara_ids(title: str) -> list[str]:
    return re.findall(r"TARA-(\d{4})", title)


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

def check_nomenclature(title: str, issue_type: str | None) -> list[Finding]:
    findings: list[Finding] = []

    if issue_type is None:
        findings.append(Finding(
            rule="P-14 / Nomenklatur",
            severity="Hoch",
            message=(
                f'Titel `{title}` entspricht keinem der erwarteten Formate:\n'
                '- Story:              `[TARA-XXXX] STORY: <Beschreibung>`\n'
                '- Epic:               `[TARA-XXXX] EPIC: <Beschreibung>`\n'
                '- Review-Finding:     `[TARA-XXXX] REVIEW-FINDING: <Beschreibung>`\n'
                '- Process-Violation:  `[TARA-XXXX] PROCESS-VIOLATION: <Beschreibung>`'
            ),
            action=(
                'Bitte Titel entsprechend dem Nomenklatur-Schema anpassen.\n'
                'Referenz: `agents/process_guard/PROCESS_GUARD_AGENT.md`'
            ),
        ))

    return findings


def check_p14_uniqueness(
    title: str, issue_number: int, all_ids: dict[str, int]
) -> list[Finding]:
    findings: list[Finding] = []
    for tara_id in extract_tara_ids(title):
        if tara_id in all_ids:
            existing = all_ids[tara_id]
            findings.append(Finding(
                rule="P-14",
                severity="Kritisch",
                message=(
                    f'TARA-ID **TARA-{tara_id}** ist bereits in Issue **#{existing}** vergeben.\n'
                    'P-14: TARA-IDs sind atomar und unveränderlich – keine ID darf mehrfach verwendet werden.'
                ),
                action=(
                    f'Dieses Issue muss eine neue, eindeutige TARA-ID erhalten.\n'
                    f'Nächste freie ID ermitteln: '
                    f'`gh issue list --state all --limit 500 --json title` '
                    f'und die höchste TARA-XXXX-ID +1 verwenden.'
                ),
            ))
    return findings


def check_body(body: str, issue_type: str | None) -> list[Finding]:
    findings: list[Finding] = []
    if issue_type is None:
        return findings

    required = REQUIRED_BODY.get(issue_type, [])
    for section in required:
        if section not in body:
            findings.append(Finding(
                rule="Inhalt",
                severity="Mittel",
                message=f'Pflichtabschnitt `{section}` fehlt im Issue-Body.',
                action=f'Bitte `{section}` Abschnitt ergänzen.',
            ))
    return findings


def check_labels(labels: list[str], issue_type: str | None) -> list[Finding]:
    findings: list[Finding] = []
    if issue_type is None:
        return findings

    expected = EXPECTED_LABELS.get(issue_type, [])
    for lbl in expected:
        if lbl not in labels:
            findings.append(Finding(
                rule="Labels",
                severity="Niedrig",
                message=f'Pflichtlabel `{lbl}` fehlt für Issue-Typ `{issue_type}`.',
                action=f'Label `{lbl}` hinzufügen.',
            ))
    return findings


# ---------------------------------------------------------------------------
# Report builder
# ---------------------------------------------------------------------------

def build_comment(
    issue_number: int,
    title: str,
    issue_type: str | None,
    findings: list[Finding],
) -> str:
    type_label = issue_type or "unbekannt"
    lines = [
        "## 🔍 Prozess-Guard – Issue-Compliance-Bericht",
        "",
        f"**Issue:** #{issue_number} `{title}`  ",
        f"**Erkannter Typ:** `{type_label}`  ",
        f"**Befunde:** {len(findings)}",
        "",
    ]

    if not findings:
        lines += [
            "✅ **Alle Prüfungen bestanden** – Nomenklatur und Inhalt sind prozesskonform.",
        ]
        return "\n".join(lines)

    lines += ["| Regel | Schwere | Problem |", "|-------|---------|---------|"]
    for f in findings:
        lines.append(f"| `{f.rule}` | **{f.severity}** | {f.message.splitlines()[0]} |")

    lines += ["", "---", ""]
    for i, f in enumerate(findings, 1):
        lines += [
            f"### Finding {i}: {f.rule} ({f.severity})",
            "",
            f"**Problem:** {f.message}",
            "",
            f"**Aktion:** {f.action}",
            "",
        ]

    lines += [
        "---",
        "",
        "> Dieser Kommentar wurde automatisch vom **Prozess-Guard** generiert.",
        "> Referenz: `agents/process_guard/PROCESS_GUARD_AGENT.md`",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    repo    = os.environ.get("GITHUB_REPOSITORY", "")
    number  = int(os.environ.get("ISSUE_NUMBER", "0"))
    title   = os.environ.get("ISSUE_TITLE", "")
    body    = os.environ.get("ISSUE_BODY", "")
    labels_raw = os.environ.get("ISSUE_LABELS", "")  # comma-separated

    if not repo or not number or not title:
        print("ERROR: GITHUB_REPOSITORY, ISSUE_NUMBER, ISSUE_TITLE must be set", file=sys.stderr)
        return 2

    labels = [l.strip() for l in labels_raw.split(",") if l.strip()]

    print(f"Checking issue #{number}: {title}")

    issue_type = detect_type(title)
    print(f"  Detected type: {issue_type}")

    all_ids = get_all_issue_titles(repo, exclude_number=number)

    findings: list[Finding] = []
    findings += check_nomenclature(title, issue_type)
    findings += check_p14_uniqueness(title, number, all_ids)
    findings += check_body(body, issue_type)
    findings += check_labels(labels, issue_type)

    comment = build_comment(number, title, issue_type, findings)

    # Always post the comment (pass or fail)
    subprocess.run(
        ["gh", "issue", "comment", str(number), "--repo", repo, "--body", comment],
        timeout=30,
    )

    if findings:
        # Add process-violation label for any finding >= Mittel
        critical = [f for f in findings if f.severity in ("Kritisch", "Hoch")]
        label_to_add = "process-violation"
        # Ensure label exists, create if not
        subprocess.run(
            ["gh", "label", "create", label_to_add, "--repo", repo,
             "--color", "B60205", "--description", "Prozess-Guard: Regelverstoß erkannt",
             "--force"],
            capture_output=True, timeout=30,
        )
        subprocess.run(
            ["gh", "issue", "edit", str(number), "--repo", repo,
             "--add-label", label_to_add],
            capture_output=True, timeout=30,
        )

        severity_counts = {"Kritisch": 0, "Hoch": 0, "Mittel": 0, "Niedrig": 0}
        for f in findings:
            severity_counts[f.severity] = severity_counts.get(f.severity, 0) + 1

        print(f"  VIOLATIONS: {len(findings)} "
              f"(Kritisch:{severity_counts['Kritisch']} "
              f"Hoch:{severity_counts['Hoch']} "
              f"Mittel:{severity_counts['Mittel']} "
              f"Niedrig:{severity_counts['Niedrig']})")
        return 1

    print("  COMPLIANT - all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
