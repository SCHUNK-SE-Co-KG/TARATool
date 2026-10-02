"""
TARA-0120: Instructions/Agents strukturieren

Deckt ab (Akzeptanzkriterien aus Issue #191):
- `.github/copilot-instructions.md` ist auf die ~8 unveraenderlichen Kernregeln
  + Verweistabelle gekuerzt (keine ausfuehrlichen P-01-P-27-Ablaeufe mehr
  direkt enthalten).
- `.github/instructions/*.instructions.md` existieren mit `applyTo`-Frontmatter
  und enthalten den ausgelagerten, pfadspezifischen/operativen Prozessinhalt
  (u.a. Session-Start-Ablauf, Gate 1/Gate 2, Freigabe-Keywords).
- `.github/agents/*.agent.md` existieren fuer Dev-, Review-, Requirements- und
  Acceptance-Agent; Prozess-Guard liegt als Policy-Dokument (kein *.agent.md)
  unter `.github/agents/` (TARA-0108: keine eigene Rolle).
- Die alten `agents/*/*.md`-Dateien sind Verweis-Stubs auf die neuen Dateien
  (gleiches Muster wie `docs/DEV_AGENT_ONBOARDING.md`), Python-Code unter
  `agents/review_agent/*.py` bleibt unveraendert am alten Ort.
- `scripts/process_guard/generate_process_docs.py` zeigt auf die neuen
  `.github/agents/*`-Pfade (GENERATED-Marker bleiben funktionsfaehig).
- `scripts/process_health_check.py` prueft die neuen Pfade.
- Keine inhaltliche Regel geht verloren: jede migrierte Datei behaelt ihre
  bisherigen Kerninhalte (Stichproben-Textfragmente).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent

COPILOT_INSTRUCTIONS = REPO_ROOT / ".github" / "copilot-instructions.md"
INSTRUCTIONS_DIR = REPO_ROOT / ".github" / "instructions"
AGENTS_DIR = REPO_ROOT / ".github" / "agents"

NEW_AGENT_FILES = {
    "developer.agent.md": "TDD",
    "reviewer.agent.md": "R-01",
    "requirements.agent.md": "Definition of Ready",
    "acceptance.agent.md": "Freigabebefugnis",
}
PROCESS_GUARD_POLICY = AGENTS_DIR / "process-guard.policy.md"

OLD_STUB_FILES = {
    REPO_ROOT / "agents" / "dev_agent" / "DEV_AGENT_ONBOARDING.md": "developer.agent.md",
    REPO_ROOT / "agents" / "review_agent" / "REVIEW_AGENT_WORKFLOW.md": "reviewer.agent.md",
    REPO_ROOT / "agents" / "process_guard" / "PROCESS_GUARD_AGENT.md": "process-guard.policy.md",
    REPO_ROOT / "agents" / "requirements_agent" / "REQUIREMENTS_AGENT.md": "requirements.agent.md",
    REPO_ROOT / "agents" / "acceptance_agent" / "ACCEPTANCE_AGENT.md": "acceptance.agent.md",
}

REQUIRED_INSTRUCTION_STEMS = {
    "workflows",
    "tests",
    "frontend",
    "security",
}

MAX_CORE_RULE_WORDS = 1200


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# copilot-instructions.md: gekuerzt auf Kernregeln + Verweise
# ---------------------------------------------------------------------------


def test_copilot_instructions_exists_and_is_short():
    assert COPILOT_INSTRUCTIONS.exists()
    text = _read(COPILOT_INSTRUCTIONS)
    word_count = len(text.split())
    assert word_count <= MAX_CORE_RULE_WORDS, (
        f"copilot-instructions.md hat {word_count} Woerter - sollte auf Kernregeln "
        f"+ Verweistabelle gekuerzt sein (<= {MAX_CORE_RULE_WORDS})"
    )


def test_copilot_instructions_no_longer_contains_detailed_gate_checklist():
    """Der ausfuehrliche Gate-1/Gate-2-Ablauf gehoert jetzt in
    .github/instructions/workflows.instructions.md, nicht mehr inline."""
    text = _read(COPILOT_INSTRUCTIONS)
    assert "Gate 2 - VOR `gh pr create`" not in text


def test_copilot_instructions_references_four_layer_model():
    text = _read(COPILOT_INSTRUCTIONS)
    assert ".github/instructions" in text
    assert ".github/agents" in text
    assert ".github/skills" in text


def test_copilot_instructions_keeps_p23_init_safety_rule():
    """Sicherheitskritische Meta-Regel ueber diese Datei selbst bleibt
    direkt (nicht nur per Verweis) erhalten."""
    text = _read(COPILOT_INSTRUCTIONS)
    assert "/init" in text
    assert "P-23" in text


# ---------------------------------------------------------------------------
# .github/instructions/*.instructions.md
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("stem", sorted(REQUIRED_INSTRUCTION_STEMS))
def test_instructions_file_exists(stem):
    path = INSTRUCTIONS_DIR / f"{stem}.instructions.md"
    assert path.exists(), f".github/instructions/{stem}.instructions.md fehlt"


@pytest.mark.parametrize("stem", sorted(REQUIRED_INSTRUCTION_STEMS))
def test_instructions_file_has_apply_to_frontmatter(stem):
    path = INSTRUCTIONS_DIR / f"{stem}.instructions.md"
    text = _read(path)
    assert text.startswith("---\n"), f"{path.name}: fehlendes YAML-Frontmatter"
    frontmatter_end = text.index("\n---", 4)
    frontmatter = text[:frontmatter_end]
    assert re.search(r"^applyTo:", frontmatter, re.MULTILINE), f"{path.name}: 'applyTo' fehlt im Frontmatter"


def test_workflows_instructions_contains_session_start_and_gates():
    text = _read(INSTRUCTIONS_DIR / "workflows.instructions.md")
    assert "Gate 2" in text
    assert "Session-Start" in text
    assert "PO-OK" in text or "PO-Freigabe" in text


# ---------------------------------------------------------------------------
# .github/agents/*.agent.md + Policy-Dokument
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("filename,marker_text", sorted(NEW_AGENT_FILES.items()))
def test_new_agent_file_exists_and_has_content(filename, marker_text):
    path = AGENTS_DIR / filename
    assert path.exists(), f".github/agents/{filename} fehlt"
    text = _read(path)
    assert marker_text in text, f"{filename}: erwarteter Inhalt '{marker_text}' nicht gefunden"


def test_process_guard_policy_file_exists_and_is_not_agent_md():
    assert PROCESS_GUARD_POLICY.exists(), ".github/agents/process-guard.policy.md fehlt"
    assert not PROCESS_GUARD_POLICY.name.endswith(".agent.md")
    text = _read(PROCESS_GUARD_POLICY)
    assert "P-01" in text


# ---------------------------------------------------------------------------
# Alte agents/*/*.md Dateien: Verweis-Stubs (kein Datenverlust, Python-Code
# bleibt unangetastet)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("old_path,new_filename", sorted(OLD_STUB_FILES.items(), key=lambda kv: str(kv[0])))
def test_old_agent_md_is_stub_pointing_to_new_location(old_path, new_filename):
    assert old_path.exists(), f"{old_path} wurde entfernt statt zum Verweis-Stub zu werden"
    text = _read(old_path)
    word_count = len(text.split())
    assert word_count <= 60, f"{old_path.name} ist kein kurzer Verweis-Stub mehr ({word_count} Woerter)"
    assert new_filename in text, f"{old_path.name} verweist nicht auf {new_filename}"


def test_review_agent_python_package_untouched_at_old_location():
    """Nur Markdown migriert - der Python-Code bleibt unter agents/review_agent/*.py,
    da ca. 30 Testdateien ueber `from agents.review_agent import ...` importieren."""
    run_review = REPO_ROOT / "agents" / "review_agent" / "run_review.py"
    assert run_review.exists()
    sys.path.insert(0, str(REPO_ROOT))
    try:
        import agents.review_agent.run_review  # noqa: F401
    finally:
        sys.path.pop(0)


# ---------------------------------------------------------------------------
# generate_process_docs.py zeigt auf neue Pfade
# ---------------------------------------------------------------------------


def test_generate_process_docs_points_to_new_agent_paths():
    sys.path.insert(0, str(REPO_ROOT))
    try:
        import importlib

        import scripts.process_guard.generate_process_docs as gpd

        importlib.reload(gpd)
        assert gpd.DEV_AGENT_ONBOARDING == AGENTS_DIR / "developer.agent.md"
        assert gpd.REVIEW_AGENT_WORKFLOW == AGENTS_DIR / "reviewer.agent.md"
        assert gpd.PROCESS_GUARD_AGENT == PROCESS_GUARD_POLICY
        assert gpd.COPILOT_INSTRUCTIONS == COPILOT_INSTRUCTIONS
    finally:
        sys.path.pop(0)


def test_generate_process_docs_check_mode_passes():
    """--check darf nach der Migration keinen Drift melden (Marker wurden
    mitverschoben, nicht neu erzeugt)."""
    import subprocess

    result = subprocess.run(
        [sys.executable, "scripts/process_guard/generate_process_docs.py", "--check"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"generate_process_docs.py --check meldet Drift/Fehler nach der Migration:\n"
        f"stdout={result.stdout}\nstderr={result.stderr}"
    )


# ---------------------------------------------------------------------------
# process_health_check.py prueft neue Pfade
# ---------------------------------------------------------------------------


def test_process_health_check_required_docs_use_new_agent_paths():
    text = _read(REPO_ROOT / "scripts" / "process_health_check.py")
    assert "agents/process_guard/PROCESS_GUARD_AGENT.md" not in text
    assert "agents/review_agent/REVIEW_AGENT_WORKFLOW.md" not in text
    assert "agents/dev_agent/DEV_AGENT_ONBOARDING.md" not in text
    assert ".github/agents/process-guard.policy.md" in text
    assert ".github/agents/reviewer.agent.md" in text
    assert ".github/agents/developer.agent.md" in text


# ---------------------------------------------------------------------------
# agents/README.md und docs/ENTWICKLUNGSPROZESS.md verweisen auf neue Pfade
# ---------------------------------------------------------------------------


def test_agents_readme_references_new_locations():
    text = _read(REPO_ROOT / "agents" / "README.md")
    assert ".github/agents" in text


def test_entwicklungsprozess_references_new_locations():
    text = _read(REPO_ROOT / "docs" / "ENTWICKLUNGSPROZESS.md")
    assert ".github/agents" in text
    assert ".github/instructions" in text
