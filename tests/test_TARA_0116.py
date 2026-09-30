"""
TARA-0116: Dokumentationsinkonsistenzen - maschinenlesbare Prozessquelle
(docs/process_definition.yml).

Deckt ab:
- docs/process_definition.yml existiert, ist valides YAML und enthaelt
  alle Regeln P-01 bis P-27 sowie R-01 bis R-36 mit Titel/Automatisierungs-
  Angabe je Regel.
- scripts/process_guard/generate_process_docs.py generiert aus der YAML-
  Quelle Markdown-Abschnitte, die exakt dem committeten Stand der vier
  Zieldokumente entsprechen (Round-Trip / "--check" ohne Diff).
- Keine sichtbaren Mojibake-Encoding-Fehler (z.B. "â€“", "â†’", "Ã¼") mehr in
  den vier Prozessdokumenten.
- Statusbezeichnung "inReview" und Branchname "development" werden in den
  generierten Abschnitten einheitlich geschrieben.
- Regressionsschutz: Audit-Trail-Kommentar-Beispiel und P-01 ("TARA-ID in
  jeder Chat-Antwort nennen") bleiben unveraendert erhalten.
"""

import subprocess
import sys
from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")

REPO_ROOT = Path(__file__).resolve().parent.parent
PROCESS_DEFINITION = REPO_ROOT / "docs" / "process_definition.yml"
GENERATOR_SCRIPT = REPO_ROOT / "scripts" / "process_guard" / "generate_process_docs.py"

TARGET_DOCS = [
    REPO_ROOT / "agents" / "dev_agent" / "DEV_AGENT_ONBOARDING.md",
    REPO_ROOT / "agents" / "process_guard" / "PROCESS_GUARD_AGENT.md",
    REPO_ROOT / "agents" / "review_agent" / "REVIEW_AGENT_WORKFLOW.md",
    REPO_ROOT / ".github" / "copilot-instructions.md",
]

MOJIBAKE_PATTERNS = ["â€", "â†", "Ã¤", "Ã¶", "Ã¼", "Ã„", "Ã–", "Ãœ", "Ã¸", "ÃŸ"]

EXPECTED_P_RULES = [f"P-{i:02d}" for i in range(1, 28)]
EXPECTED_R_RULES = [f"R-{i:02d}" for i in range(1, 37)]


def _load_definition():
    assert PROCESS_DEFINITION.exists(), (
        "docs/process_definition.yml fehlt - Single Source of Truth fuer "
        "Prozessregeln (P-01..P-27) und Review-Regeln (R-01..R-36) muss existieren"
    )
    with PROCESS_DEFINITION.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def test_process_definition_contains_all_process_rules():
    data = _load_definition()
    assert "rules" in data, "process_definition.yml muss einen 'rules'-Abschnitt (P-Regeln) enthalten"
    for rule_id in EXPECTED_P_RULES:
        assert rule_id in data["rules"], f"Regel {rule_id} fehlt in process_definition.yml"
        rule = data["rules"][rule_id]
        assert rule.get("title"), f"Regel {rule_id} hat keinen 'title'"
        assert rule.get("automation"), f"Regel {rule_id} hat keine 'automation'-Angabe"


def test_process_definition_contains_all_review_rules():
    data = _load_definition()
    assert "review_rules" in data, "process_definition.yml muss einen 'review_rules'-Abschnitt (R-Regeln) enthalten"
    for rule_id in EXPECTED_R_RULES:
        assert rule_id in data["review_rules"], f"Review-Regel {rule_id} fehlt in process_definition.yml"
        rule = data["review_rules"][rule_id]
        assert rule.get("category"), f"Review-Regel {rule_id} hat keine 'category'"
        assert rule.get("description"), f"Review-Regel {rule_id} hat keine 'description'"


def test_process_definition_contains_status_enum():
    data = _load_definition()
    assert "statuses" in data and isinstance(data["statuses"], list) and len(data["statuses"]) >= 6
    # Statusmodell C (TARA-0121): "inReview" muss als eigener Statuswert
    # exakt so (nicht "Review"/"In Review") enthalten sein.
    assert "inReview" in data["statuses"]


def test_generator_script_exists():
    assert GENERATOR_SCRIPT.exists(), (
        "scripts/process_guard/generate_process_docs.py fehlt - Generator fuer "
        "die aus process_definition.yml abgeleiteten Markdown-Abschnitte"
    )


def test_generator_check_mode_reports_no_drift():
    """Round-Trip: die generierten Markdown-Abschnitte in den vier Zieldateien
    entsprechen exakt dem, was aus process_definition.yml erzeugt wuerde
    (kein manuell aus der Quelle gelaufener Duplikat-Text mehr)."""
    result = subprocess.run(
        [sys.executable, str(GENERATOR_SCRIPT), "--check"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        "generate_process_docs.py --check meldet Drift zwischen "
        f"process_definition.yml und den generierten Doku-Abschnitten:\n{result.stdout}\n{result.stderr}"
    )


@pytest.mark.parametrize("doc_path", TARGET_DOCS, ids=lambda p: p.name)
def test_no_mojibake_in_process_docs(doc_path):
    assert doc_path.exists(), f"{doc_path} fehlt"
    text = doc_path.read_text(encoding="utf-8")
    found = [pattern for pattern in MOJIBAKE_PATTERNS if pattern in text]
    assert not found, f"{doc_path.name} enthaelt Mojibake-Zeichenfolgen: {found}"


def test_audit_trail_example_and_p01_unchanged():
    """Regressionsschutz (PO-Entscheidung Frage 1): Audit-Trail-Kommentare
    und P-01 duerfen durch die Konsolidierung NICHT versehentlich entfernt
    werden."""
    instructions = (REPO_ROOT / ".github" / "copilot-instructions.md").read_text(encoding="utf-8")
    assert "Status Todo -> In Progress" in instructions
    assert "P-01" in instructions

    process_guard_doc = (REPO_ROOT / "agents" / "process_guard" / "PROCESS_GUARD_AGENT.md").read_text(
        encoding="utf-8"
    )
    assert "TARA-ID in jeder Chat-Antwort" in process_guard_doc


def test_process_violation_and_review_finding_labels_documented_distinctly():
    """PO-Entscheidung Frage 2: 'process-violation' (Process Guard) und
    'review-finding' (Review-Agent) muessen in beiden Agenten-Dokumenten klar
    voneinander abgegrenzt referenziert sein."""
    process_guard_doc = (REPO_ROOT / "agents" / "process_guard" / "PROCESS_GUARD_AGENT.md").read_text(
        encoding="utf-8"
    )
    review_doc = (REPO_ROOT / "agents" / "review_agent" / "REVIEW_AGENT_WORKFLOW.md").read_text(encoding="utf-8")
    assert "process-violation" in process_guard_doc
    assert "process-violation" in review_doc
    assert "review-finding" in review_doc
