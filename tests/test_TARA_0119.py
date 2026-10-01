"""
TARA-0119: Agent Skills einfuehren (.github/skills/)

Deckt ab (Akzeptanzkriterien aus Issue #190):
- Alle 6 Skill-Verzeichnisse mit SKILL.md existieren unter .github/skills/
  und sind vollstaendig ausformuliert (kein Geruest).
- Jede SKILL.md folgt dem einheitlichen Template (Zweck, Voraussetzungen,
  Schritte, Verifikation, Bezug zu Regeln/Stories).
- docs/ENTWICKLUNGSPROZESS.md und/oder .github/copilot-instructions.md
  erklaeren die vier Ebenen (Instructions/Skills/Agents/Actions).
- Keine inhaltliche Duplikation dauerhafter Regeln (P-01 bis P-27) in den
  Skill-Dateien.
- security-review/SKILL.md referenziert den bestehenden CLI-Subagenten
  (Agent-Typ security-review) statt eine eigene Checkliste zu definieren.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".github" / "skills"

EXPECTED_SKILLS = [
    "story-refinement",
    "tdd-development",
    "independent-code-review",
    "security-review",
    "acceptance-testing",
    "release-readiness",
]

REQUIRED_SECTIONS = ["Zweck", "Voraussetzungen", "Schritte", "Verifikation", "Bezug zu Regeln/Stories"]

# Diese Regel-IDs duerfen in Skills NUR referenziert (z.B. "P-04", "siehe P-04"),
# nicht aber mit ihrem vollen Regeltext dupliziert werden.
PROTECTED_RULE_TEXT_FRAGMENTS = [
    "Keine Arbeit ohne PO-Freigabe",  # voller Text der wichtigsten Regel (Instructions)
]

MIN_WORDS_FULLY_WRITTEN = 150


@pytest.mark.parametrize("skill_name", EXPECTED_SKILLS)
def test_skill_directory_and_file_exist(skill_name):
    skill_file = SKILLS_DIR / skill_name / "SKILL.md"
    assert skill_file.exists(), f".github/skills/{skill_name}/SKILL.md fehlt"


@pytest.mark.parametrize("skill_name", EXPECTED_SKILLS)
def test_skill_is_fully_written_out_not_a_stub(skill_name):
    """PO-Entscheidung Frage 1: Skills werden vollstaendig ausformuliert,
    nicht nur als Geruest angelegt."""
    skill_file = SKILLS_DIR / skill_name / "SKILL.md"
    text = skill_file.read_text(encoding="utf-8")
    word_count = len(text.split())
    assert word_count >= MIN_WORDS_FULLY_WRITTEN, (
        f"{skill_name}/SKILL.md wirkt wie ein Geruest ({word_count} Woerter, "
        f"erwartet >= {MIN_WORDS_FULLY_WRITTEN})"
    )


@pytest.mark.parametrize("skill_name", EXPECTED_SKILLS)
def test_skill_follows_unified_template(skill_name):
    """PO-Entscheidung Frage 3: einheitliches Template fuer alle SKILL.md."""
    skill_file = SKILLS_DIR / skill_name / "SKILL.md"
    text = skill_file.read_text(encoding="utf-8")
    for section in REQUIRED_SECTIONS:
        assert re.search(rf"^#+\s*{re.escape(section)}", text, re.MULTILINE), (
            f"{skill_name}/SKILL.md: Abschnitt '{section}' fehlt (einheitliches Template)"
        )


@pytest.mark.parametrize("skill_name", EXPECTED_SKILLS)
def test_skill_does_not_duplicate_protected_rule_text(skill_name):
    skill_file = SKILLS_DIR / skill_name / "SKILL.md"
    text = skill_file.read_text(encoding="utf-8")
    for fragment in PROTECTED_RULE_TEXT_FRAGMENTS:
        assert fragment not in text, (
            f"{skill_name}/SKILL.md dupliziert dauerhaften Regeltext ('{fragment}') statt "
            "auf die Instructions/Agents-Dokumente zu verweisen"
        )


def test_security_review_skill_references_cli_subagent():
    """PO-Entscheidung Frage 2: security-review/SKILL.md referenziert den
    bestehenden CLI-Subagenten (Agent-Typ security-review) statt einer
    eigenen Checkliste."""
    skill_file = SKILLS_DIR / "security-review" / "SKILL.md"
    text = skill_file.read_text(encoding="utf-8")
    assert "security-review" in text
    assert re.search(r"[Ss]ub-?[Aa]gent|agent_type", text), (
        "security-review/SKILL.md muss den CLI-Subagenten (agent_type security-review) "
        "als Mechanismus benennen"
    )


@pytest.mark.parametrize(
    "skill_name,expected_refs",
    [
        ("tdd-development", ["TARA-0111", "test_TARA_XXXX"]),
        ("independent-code-review", ["TARA-0114", "TARA-0115"]),
        ("release-readiness", ["P-16"]),
        ("story-refinement", ["Requirements-Agent"]),
        ("acceptance-testing", ["Acceptance-Agent"]),
    ],
)
def test_skill_references_related_rules_and_stories(skill_name, expected_refs):
    skill_file = SKILLS_DIR / skill_name / "SKILL.md"
    text = skill_file.read_text(encoding="utf-8")
    for ref in expected_refs:
        assert ref in text, f"{skill_name}/SKILL.md referenziert '{ref}' nicht"


def test_four_layer_model_documented():
    """Instructions/Skills/Agents/Actions muessen in ENTWICKLUNGSPROZESS.md
    oder copilot-instructions.md erklaert werden."""
    entwicklungsprozess = (REPO_ROOT / "docs" / "ENTWICKLUNGSPROZESS.md").read_text(encoding="utf-8")
    copilot_instructions = (REPO_ROOT / ".github" / "copilot-instructions.md").read_text(encoding="utf-8")
    combined = entwicklungsprozess + copilot_instructions

    for layer in ["Instructions", "Skills", "Agents", "Actions"]:
        assert layer in combined, f"Vier-Ebenen-Modell: Ebene '{layer}' wird nirgends erklaert"
    assert ".github/skills" in combined


def test_no_mojibake_in_skill_files():
    mojibake_patterns = ["â€", "â†", "Ã¤", "Ã¶", "Ã¼", "Ã„", "Ã–", "Ãœ", "Ã¸", "ÃŸ"]
    for skill_name in EXPECTED_SKILLS:
        text = (SKILLS_DIR / skill_name / "SKILL.md").read_text(encoding="utf-8")
        found = [p for p in mojibake_patterns if p in text]
        assert not found, f"{skill_name}/SKILL.md enthaelt Mojibake: {found}"
