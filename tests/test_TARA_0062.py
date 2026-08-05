"""Tests for TARA-0062: Finding-Qualitaets-Framework.

TDD Red Phase: Diese Tests MÜSSEN initial fehlschlagen.
finding_framework.py existiert noch nicht.
"""
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


# ── Severity / Confidence Enums ──────────────────────────────────────────────

@pytest.mark.TARA_0062
def test_severity_enum_values():
    """Severity muss Kritisch/Hoch/Mittel/Niedrig/Hinweis haben."""
    from agents.review_agent.finding_framework import Severity
    assert hasattr(Severity, "Kritisch")
    assert hasattr(Severity, "Hoch")
    assert hasattr(Severity, "Mittel")
    assert hasattr(Severity, "Niedrig")
    assert hasattr(Severity, "Hinweis")


@pytest.mark.TARA_0062
def test_confidence_enum_values():
    """Confidence muss High/Medium/Low haben."""
    from agents.review_agent.finding_framework import Confidence
    assert hasattr(Confidence, "High")
    assert hasattr(Confidence, "Medium")
    assert hasattr(Confidence, "Low")


# ── Finding Dataclass ────────────────────────────────────────────────────────

@pytest.mark.TARA_0062
def test_finding_has_required_fields():
    """Finding muss alle Pflichtfelder aus dem Schema haben."""
    from agents.review_agent.finding_framework import Finding, Severity, Confidence
    f = Finding(
        id="REVIEW-TARA-0001-001",
        rule="R-33",
        file="js/core.js",
        line=42,
        severity=Severity.Hoch,
        confidence=Confidence.High,
        type="Defekt",
        evidence={"code_snippet": "catch(e) {}", "execution_trace": "foo->bar", "violated_rule": "R-33"},
        reasoning="Leerer catch-Block verwirft Fehler kommentarlos.",
        missing_info=None,
    )
    assert f.id == "REVIEW-TARA-0001-001"
    assert f.rule == "R-33"
    assert f.severity == Severity.Hoch
    assert f.confidence == Confidence.High


@pytest.mark.TARA_0062
def test_finding_to_dict_contains_all_fields():
    """Finding.to_dict() muss vollständiges Schema-JSON liefern."""
    from agents.review_agent.finding_framework import Finding, Severity, Confidence
    f = Finding(
        id="REVIEW-TARA-0001-002",
        rule="R-33",
        file="js/core.js",
        line=10,
        severity=Severity.Mittel,
        confidence=Confidence.Medium,
        type="Defekt",
        evidence={"code_snippet": "if (x)", "execution_trace": "a->b", "violated_rule": "R-33"},
        reasoning="Begründung.",
        missing_info=None,
    )
    d = f.to_dict()
    for key in ["id","rule","file","line","severity","confidence","type","evidence","reasoning","missing_info"]:
        assert key in d, f"Missing key: {key}"
    assert d["severity"] == "Mittel"
    assert d["confidence"] == "Medium"


# ── Validierung ──────────────────────────────────────────────────────────────

@pytest.mark.TARA_0062
def test_validate_rejects_finding_without_code_snippet():
    """Finding ohne evidence.code_snippet wird als ungültig abgelehnt."""
    from agents.review_agent.finding_framework import Finding, Severity, Confidence, validate_finding
    f = Finding(
        id="REVIEW-TARA-0001-003",
        rule="R-33",
        file="js/core.js",
        line=5,
        severity=Severity.Hoch,
        confidence=Confidence.High,
        type="Defekt",
        evidence={"execution_trace": "foo", "violated_rule": "R-33"},  # kein code_snippet
        reasoning="Etwas stimmt nicht.",
        missing_info=None,
    )
    valid, reason = validate_finding(f)
    assert not valid
    assert "code_snippet" in reason.lower()


@pytest.mark.TARA_0062
def test_validate_rejects_speculative_reasoning():
    """Finding mit Spekulations-Wörtern ohne Beweis wird abgelehnt."""
    from agents.review_agent.finding_framework import Finding, Severity, Confidence, validate_finding
    f = Finding(
        id="REVIEW-TARA-0001-004",
        rule="R-33",
        file="js/core.js",
        line=5,
        severity=Severity.Hoch,
        confidence=Confidence.High,
        type="Defekt",
        evidence={"code_snippet": "catch(e) {}", "execution_trace": "a->b", "violated_rule": "R-33"},
        reasoning="Das könnte problematisch sein.",
        missing_info=None,
    )
    valid, reason = validate_finding(f)
    assert not valid
    assert "spekulation" in reason.lower() or "k\u00f6nnte" in reason.lower()


@pytest.mark.TARA_0062
def test_validate_rejects_stil_findings():
    """Finding mit type=Stilhinweis wird als Hinweis-Kategorie abgelehnt (kein Issue)."""
    from agents.review_agent.finding_framework import Finding, Severity, Confidence, validate_finding
    f = Finding(
        id="REVIEW-TARA-0001-005",
        rule="R-01",
        file="js/core.js",
        line=5,
        severity=Severity.Niedrig,
        confidence=Confidence.Low,
        type="Stilhinweis",
        evidence={"code_snippet": "var x = 1", "execution_trace": "", "violated_rule": "R-01"},
        reasoning="Variablenname nicht aussagekräftig.",
        missing_info=None,
    )
    valid, reason = validate_finding(f)
    assert not valid
    assert "stil" in reason.lower() or "hinweis" in reason.lower()


@pytest.mark.TARA_0062
def test_validate_accepts_valid_finding():
    """Vollständiges, evidenzbasiertes Finding wird akzeptiert."""
    from agents.review_agent.finding_framework import Finding, Severity, Confidence, validate_finding
    f = Finding(
        id="REVIEW-TARA-0001-006",
        rule="R-33",
        file="js/core.js",
        line=42,
        severity=Severity.Hoch,
        confidence=Confidence.High,
        type="Defekt",
        evidence={"code_snippet": "catch(e) {}", "execution_trace": "importAnalysis()->JSON.parse()->catch(e){}", "violated_rule": "R-33"},
        reasoning="JSON.parse wirft bei ungültigen Daten SyntaxError. Der leere catch-Block verwirft diesen Fehler kommentarlos.",
        missing_info=None,
    )
    valid, reason = validate_finding(f)
    assert valid, f"Sollte gültig sein, aber: {reason}"


# ── create_finding factory ───────────────────────────────────────────────────

@pytest.mark.TARA_0062
def test_create_finding_generates_id():
    """create_finding() erzeugt automatisch eine eindeutige ID."""
    from agents.review_agent.finding_framework import create_finding, Severity, Confidence
    f = create_finding(
        tara_id="TARA-0062",
        rule="R-33",
        file="js/x.js",
        line=1,
        severity=Severity.Hoch,
        confidence=Confidence.High,
        finding_type="Defekt",
        evidence={"code_snippet": "catch(e) {}", "execution_trace": "a->b", "violated_rule": "R-33"},
        reasoning="Konkreter Beweis.",
    )
    assert f.id.startswith("REVIEW-TARA-0062-")
    assert len(f.id) > len("REVIEW-TARA-0062-")


@pytest.mark.TARA_0062
def test_create_finding_increments_counter():
    """create_finding() zählt Findings pro TARA-ID hoch."""
    from agents.review_agent.finding_framework import create_finding, Severity, Confidence
    f1 = create_finding(
        tara_id="TARA-0099",
        rule="R-31",
        file="js/a.js",
        line=1,
        severity=Severity.Mittel,
        confidence=Confidence.Medium,
        finding_type="Defekt",
        evidence={"code_snippet": "dead code", "execution_trace": "x->y", "violated_rule": "R-31"},
        reasoning="Toter Code nach return.",
    )
    f2 = create_finding(
        tara_id="TARA-0099",
        rule="R-31",
        file="js/b.js",
        line=2,
        severity=Severity.Mittel,
        confidence=Confidence.Medium,
        finding_type="Defekt",
        evidence={"code_snippet": "dead code", "execution_trace": "x->z", "violated_rule": "R-31"},
        reasoning="Weiterer toter Code.",
    )
    # IDs sollen verschieden sein
    assert f1.id != f2.id
