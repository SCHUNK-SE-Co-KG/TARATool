"""
TARA-0124: Menschenlesbare Gesamtdokumentation des Entwicklungsharness

Deckt ab (Akzeptanzkriterien aus Issue #203):
- Neue Datei `docs/HARNESS_UEBERBLICK.md` existiert.
- Sie enthaelt einen Abschnitt zu den Agent-Rollen (Dev-, Review-,
  Requirements-, Acceptance-Agent, Prozess-Guard) mit Verweis auf die
  jeweilige `.github/agents/*`-Datei.
- Sie enthaelt ein ASCII-Diagramm des Board-Status-Zustandsautomaten
  (Statusmodell C, TARA-0121: Todo -> PO Accepted -> In Progress ->
  inReview -> Accepted -> PO Release -> Done).
- Sie enthaelt ein ASCII-Diagramm/eine Darstellung des Story-Lebenszyklus
  (Red-Green-TDD-Ablauf, Gate 1/Gate 2).
- Sie enthaelt eine kompakte Uebersichtstabelle aller Prozessregeln P-01
  bis P-27 (Kurzbeschreibung + Verweis auf process-guard.policy.md fuer
  Details - kein Duplikat der Volltexte).
- `.github/copilot-instructions.md` und `docs/ENTWICKLUNGSPROZESS.md`
  verlinken auf die neue Datei.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent

HARNESS_OVERVIEW = REPO_ROOT / "docs" / "HARNESS_UEBERBLICK.md"
COPILOT_INSTRUCTIONS = REPO_ROOT / ".github" / "copilot-instructions.md"
ENTWICKLUNGSPROZESS = REPO_ROOT / "docs" / "ENTWICKLUNGSPROZESS.md"
PROCESS_DEFINITION = REPO_ROOT / "docs" / "process_definition.yml"

AGENT_ROLE_REFERENCES = {
    "developer.agent.md": "Dev-Agent",
    "reviewer.agent.md": "Review-Agent",
    "requirements.agent.md": "Requirements-Agent",
    "acceptance.agent.md": "Acceptance-Agent",
    "process-guard.policy.md": "Prozess-Guard",
}

BOARD_STATUSES = ["Todo", "PO Accepted", "In Progress", "inReview", "Accepted", "PO Release", "Done"]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _load_rule_ids() -> list[str]:
    import yaml

    data = yaml.safe_load(_read(PROCESS_DEFINITION))
    return list(data["rules"].keys())


# ---------------------------------------------------------------------------
# Datei existiert
# ---------------------------------------------------------------------------


def test_harness_overview_exists():
    assert HARNESS_OVERVIEW.exists(), "docs/HARNESS_UEBERBLICK.md fehlt"


# ---------------------------------------------------------------------------
# Agent-Rollen-Abschnitt
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("filename,role_label", sorted(AGENT_ROLE_REFERENCES.items()))
def test_harness_overview_references_agent_role(filename, role_label):
    text = _read(HARNESS_OVERVIEW)
    assert role_label in text, f"Rolle '{role_label}' fehlt im Harness-Ueberblick"
    assert filename in text, f"Verweis auf .github/agents/{filename} fehlt im Harness-Ueberblick"


# ---------------------------------------------------------------------------
# Board-Status-Zustandsautomat (ASCII-Diagramm)
# ---------------------------------------------------------------------------


def test_harness_overview_contains_board_status_diagram():
    text = _read(HARNESS_OVERVIEW)
    code_blocks = re.findall(r"```(?:text|ascii)?\n(.*?)```", text, re.DOTALL)
    assert code_blocks, "Kein Code-Block (ASCII-Diagramm) im Harness-Ueberblick gefunden"
    combined = "\n".join(code_blocks)
    for status in BOARD_STATUSES:
        assert status in combined, f"Board-Status '{status}' fehlt im ASCII-Diagramm"


# ---------------------------------------------------------------------------
# Story-Lebenszyklus (Red-Green-TDD)
# ---------------------------------------------------------------------------


def test_harness_overview_contains_story_lifecycle_section():
    text = _read(HARNESS_OVERVIEW)
    assert "Red" in text and "Green" in text
    assert "Gate 1" in text
    assert "Gate 2" in text


# ---------------------------------------------------------------------------
# Prozessregel-Uebersichtstabelle P-01..P-27
# ---------------------------------------------------------------------------


def test_harness_overview_contains_rule_summary_table_with_all_rule_ids():
    text = _read(HARNESS_OVERVIEW)
    for rule_id in _load_rule_ids():
        assert rule_id in text, f"Regel-ID {rule_id} fehlt in der Uebersichtstabelle"
    assert "process-guard.policy.md" in text


def test_harness_overview_does_not_duplicate_full_rule_texts():
    """Die Tabelle soll kompakt sein (Kurzbeschreibung + Verweis), kein
    1:1-Duplikat der vollen Regeltexte aus process-guard.policy.md."""
    text = _read(HARNESS_OVERVIEW)
    word_count = len(text.split())
    assert word_count <= 3000, f"HARNESS_UEBERBLICK.md hat {word_count} Woerter - zu ausfuehrlich fuer einen Ueberblick"


# ---------------------------------------------------------------------------
# Verlinkung aus den bestehenden Einstiegsdokumenten
# ---------------------------------------------------------------------------


def test_copilot_instructions_links_to_harness_overview():
    text = _read(COPILOT_INSTRUCTIONS)
    assert "HARNESS_UEBERBLICK.md" in text


def test_entwicklungsprozess_links_to_harness_overview():
    text = _read(ENTWICKLUNGSPROZESS)
    assert "HARNESS_UEBERBLICK.md" in text
