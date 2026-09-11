"""
[TARA-0101] Tests: Kein eigenstaendiger Arbeitsbeginn bei `/init`/Session-Start.

TDD Red-Phase: Alle Tests muessen FEHLSCHLAGEN, bevor
.github/copilot-instructions.md, agents/dev_agent/DEV_AGENT_ONBOARDING.md,
agents/process_guard/PROCESS_GUARD_AGENT.md und docs/ENTWICKLUNGSPROZESS.md
um die neue Regel P-23 (kein eigenstaendiger Arbeitsbeginn bei /init) ergaenzt
wurden.
"""
import os

import pytest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

INSTRUCTIONS_PATH = os.path.join(REPO_ROOT, ".github", "copilot-instructions.md")
ONBOARDING_PATH = os.path.join(REPO_ROOT, "agents", "dev_agent", "DEV_AGENT_ONBOARDING.md")
PROCESS_GUARD_PATH = os.path.join(REPO_ROOT, "agents", "process_guard", "PROCESS_GUARD_AGENT.md")
ENTWICKLUNGSPROZESS_PATH = os.path.join(REPO_ROOT, "docs", "ENTWICKLUNGSPROZESS.md")


def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


@pytest.mark.TARA_0101
def test_copilot_instructions_forbids_autonomous_work_on_init():
    """copilot-instructions.md muss explizit regeln, dass '/init' keine
    eigenstaendigen Aenderungen ausloesen darf."""
    content = _read(INSTRUCTIONS_PATH)
    assert "/init" in content, "Der Befehl '/init' muss explizit erwaehnt werden"
    assert "P-23" in content, "Regel P-23 muss referenziert werden"


@pytest.mark.TARA_0101
def test_copilot_instructions_describes_onboarding_steps_in_order():
    """Der Onboarding-Ablauf (Lesen -> Board sichten -> Vorschlagen -> Freigabe
    abwarten) muss in dieser Reihenfolge als nummerierte Schritte beschrieben sein."""
    content = _read(INSTRUCTIONS_PATH)
    lower = content.lower()
    idx_lesen = lower.index("1. **lesen")
    idx_board = lower.index("3. **board sichten")
    idx_proposal = lower.index("4. **vorschlagen")
    idx_wait = lower.index("5. **warten")
    assert idx_lesen < idx_board < idx_proposal < idx_wait, (
        "Reihenfolge Lesen -> Board sichten -> Vorschlagen -> Warten muss eingehalten werden"
    )


@pytest.mark.TARA_0101
def test_copilot_instructions_requires_revert_of_autonomous_init_changes():
    """Falls '/init' dennoch automatisch Aenderungen vornimmt, muss ein
    sofortiges Zuruecksetzen (git checkout/restore) gefordert werden."""
    content = _read(INSTRUCTIONS_PATH)
    assert "git checkout" in content or "git restore" in content


@pytest.mark.TARA_0101
def test_process_guard_agent_defines_p23():
    content = _read(PROCESS_GUARD_PATH)
    assert "P-23" in content, "Regel P-23 fehlt in PROCESS_GUARD_AGENT.md"
    p23_line = next(line for line in content.splitlines() if line.strip().startswith("| P-23"))
    assert "init" in p23_line.lower()


@pytest.mark.TARA_0101
def test_entwicklungsprozess_references_p23():
    content = _read(ENTWICKLUNGSPROZESS_PATH)
    assert "P-23" in content, "Regel P-23 fehlt in ENTWICKLUNGSPROZESS.md"
    p23_line = next(line for line in content.splitlines() if line.strip().startswith("| **P-23**"))
    assert "init" in p23_line.lower()


@pytest.mark.TARA_0101
def test_dev_agent_onboarding_references_p23_before_reading_step():
    """DEV_AGENT_ONBOARDING.md muss vor/bei Schritt 6 (Workflow-Dokumente
    lesen) auf P-23 verweisen."""
    content = _read(ONBOARDING_PATH)
    assert "P-23" in content, "Regel P-23 fehlt in DEV_AGENT_ONBOARDING.md"
