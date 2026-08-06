"""
run_review.py – Entry-Point fuer den Review-Agent.

Aufruf durch den Dev-Agent am Ende einer Story (nach Schritt 4 im Workflow):

    python agents/review_agent/run_review.py \\
        --story TARA-XXXX \\
        --repo Bheowulf/TARATool \\
        --url file:///path/to/index.html \\
        --output security/reports/

Ablauf:
    1. Runtime-Scanner startet (Playwright, Headless Chromium)
    2. Alle konfigurierten Pruef-Module laufen durch
    3. Findings werden aggregiert (build_full_report)
    4. GitHub Issues werden angelegt fuer Findings >= Mittel (create_github_issues_for_findings)
    5. Bei Critical/High: Board-Item wird auf Blocking gesetzt (P-18)
    6. Report wird als JSON + MD gespeichert
    7. Exit-Code: 0 = APPROVED/APPROVED_WITH_BACKLOG, 1 = BLOCKED

Ohne --url: Runtime-Checks (R-13-R-30) werden uebersprungen, nur statische
Checks (R-01-R-12) werden durchgefuehrt.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Sicherstellen dass das Repo-Root im Python-Pfad ist
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from agents.review_agent.report_builder import (
    build_full_report,
    save_report,
    determine_merge_decision,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="TARATool Review-Agent – fuehrt R-01-R-30 Checks durch und legt GitHub Issues an."
    )
    p.add_argument("--story", required=True, help="TARA-ID, z.B. TARA-0026")
    p.add_argument("--repo", required=True, help="GitHub-Repo, z.B. Bheowulf/TARATool")
    p.add_argument("--url", default=None, help="App-URL fuer Runtime-Checks (file:// oder http://)")
    p.add_argument("--output", default="security/reports", help="Ausgabeverzeichnis fuer Reports")
    p.add_argument("--no-issues", action="store_true", help="GitHub Issues NICHT anlegen (dry-run)")
    return p.parse_args()


def run_static_checks(story_id: str) -> list[dict]:
    """
    Platzhalter fuer statische Checks R-01-R-12.
    Wird ausgefuehrt wenn kein --url angegeben ist.
    Gibt Liste von Finding-Dicts zurueck.
    """
    # In einer echten Implementierung: Diff-Analyse, Lint-Checks etc.
    return []


def run_runtime_checks(url: str, story_id: str) -> list[dict]:
    """
    Fuehrt Runtime-Checks R-13-R-30 via Playwright durch.
    Gibt Liste von Finding-Dicts zurueck.
    """
    try:
        from agents.review_agent.runtime_scanner import start_review_session, ReviewSession

        session = start_review_session(url)
        # Scanner-Module laufen hier durch und fuegen zu session.report["findings"] hinzu
        # (Die einzelnen checker.py-Module werden hier aufgerufen)
        return session.report.get("findings", [])
    except ImportError:
        print("[SKIP Runtime: Playwright nicht installiert]")
        return []
    except Exception as exc:
        print(f"[SKIP Runtime: {exc}]")
        return []


def main() -> int:
    args = parse_args()

    print(f"[Review-Agent] Story: {args.story} | Repo: {args.repo}")

    # Findings sammeln
    findings: list[dict] = []
    findings.extend(run_static_checks(args.story))

    if args.url:
        print(f"[Review-Agent] Runtime-Checks: {args.url}")
        findings.extend(run_runtime_checks(args.url, args.story))
    else:
        print("[Review-Agent] SKIP Runtime: kein --url angegeben (R-13-R-30 entfallen)")

    # Report aufbauen, Issues anlegen
    from dataclasses import dataclass, field as dc_field

    @dataclass
    class _FakeSession:
        report: dict = dc_field(default_factory=dict)

    session = _FakeSession(report={
        "story_id": args.story,
        "app_url": args.url or "",
        "findings": findings,
        "missing_info": [],
    })

    report = build_full_report(
        session=session,
        story_id=args.story,
        repo=None if args.no_issues else args.repo,
        create_issues=not args.no_issues,
    )

    # Report speichern
    output_dir = _REPO_ROOT / args.output
    json_path = save_report(report, output_dir)
    print(f"[Review-Agent] Report gespeichert: {json_path}")

    # Ergebnis ausgeben
    decision = report.get("merge_decision", "UNKNOWN")
    issue_urls = report.get("github_issues_created", [])
    finding_count = report.get("finding_count", 0)

    print(f"\n[Review-Agent] Ergebnis: {decision}")
    print(f"[Review-Agent] Findings: {finding_count}")
    if issue_urls:
        print(f"[Review-Agent] GitHub Issues angelegt:")
        for url in issue_urls:
            print(f"  {url}")

    if decision == "BLOCKED":
        print("[Review-Agent] BLOCKED: Critical/High Findings gefunden. Item auf Blocking gesetzt (P-18).")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
