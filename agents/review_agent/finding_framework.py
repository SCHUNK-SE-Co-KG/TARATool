"""TARA-0062: Finding-Qualitaets-Framework fuer den Review-Agenten.

Dieses Modul implementiert das zentrale Qualitaets-Framework fuer alle
Review-Agent-Findings. Es definiert:

- ``Severity``: Schwere-Stufen (Kritisch/Hoch/Mittel/Niedrig/Hinweis)
- ``Confidence``: Konfidenz-Stufen (High/Medium/Low)
- ``Finding``: Datenklasse fuer ein einzelnes Review-Finding
- ``validate_finding()``: Prueft Finding auf Qualitaetskriterien
- ``create_finding()``: Factory mit automatischer ID-Vergabe

Ablehnungskriterien (Finding wird NICHT als Issue angelegt):
    1. Kein ``evidence.code_snippet`` -> zu vage
    2. ``reasoning`` enthaelt Spekulations-Woerter ohne konkreten Beweis
       (koennte, moeglicherweise, eventuell, vielleicht, ggf., wahrscheinlich)
    3. ``type == "Stilhinweis"`` -> eigene Kategorie, kein Issue
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

# ── Enums ─────────────────────────────────────────────────────────────────────

class Severity(str, Enum):
    """Schwere-Stufe eines Findings."""
    Kritisch = "Kritisch"
    Hoch     = "Hoch"
    Mittel   = "Mittel"
    Niedrig  = "Niedrig"
    Hinweis  = "Hinweis"


class Confidence(str, Enum):
    """Konfidenz-Stufe eines Findings."""
    High   = "High"
    Medium = "Medium"
    Low    = "Low"


# ── Finding Datenklasse ───────────────────────────────────────────────────────

@dataclass
class Finding:
    """Ein einzelnes Review-Finding nach TARA-0062 Schema.

    Alle Felder entsprechen dem Finding-Schema aus dem Epic TARA-0056.
    Pflichtfelder werden per ``validate_finding()`` geprueft.
    """
    id:           str
    rule:         str
    file:         str
    line:         int
    severity:     Severity
    confidence:   Confidence
    type:         str
    evidence:     dict[str, Any]
    reasoning:    str
    missing_info: Optional[str] = None

    # Optionale Felder fuer Duplikat-Detektor (TARA-0061)
    rule_reference:    str = field(default="")
    codezeile_or_spur: str = field(default="")
    affected_locations: list[str] = field(default_factory=list)
    description:       str = field(default="")

    def to_dict(self) -> dict[str, Any]:
        """Serialisiert das Finding in das kanonische Schema-Dict."""
        return {
            "id":           self.id,
            "rule":         self.rule,
            "file":         self.file,
            "line":         self.line,
            "severity":     self.severity.value,
            "confidence":   self.confidence.value,
            "type":         self.type,
            "evidence":     self.evidence,
            "reasoning":    self.reasoning,
            "missing_info": self.missing_info,
        }


# ── Validierung ───────────────────────────────────────────────────────────────

_SPECULATIVE_WORDS = (
    "könnte", "koennnte", "koennte",
    "möglicherweise", "moeglicherweise",
    "eventuell", "vielleicht", "ggf.",
    "wahrscheinlich", "vermutlich",
    "könnte problematisch", "could be",
)


def validate_finding(f: Finding) -> tuple[bool, str]:
    """Prueft ein Finding auf Qualitaetskriterien.

    Returns:
        (True, "") wenn Finding akzeptiert wird.
        (False, reason) wenn Finding abgelehnt wird.
    """
    # 1. Kein code_snippet -> zu vage
    code_snippet = f.evidence.get("code_snippet", "").strip()
    if not code_snippet:
        return False, "Abgelehnt: evidence.code_snippet fehlt (zu vage)"

    # 2. Stilhinweis -> eigene Kategorie, kein Issue
    if f.type.lower() in ("stilhinweis", "stil", "hinweis"):
        return False, "Abgelehnt: Stilhinweis wird nicht als Issue angelegt"

    # 3. Spekulations-Woerter ohne konkreten Beweis
    reasoning_lower = f.reasoning.lower()
    for word in _SPECULATIVE_WORDS:
        if word.lower() in reasoning_lower:
            return False, f"Abgelehnt: Spekulation ('{word}') ohne konkreten Beweis"

    return True, ""


# ── Factory ───────────────────────────────────────────────────────────────────

_counters: dict[str, int] = {}


def create_finding(
    *,
    tara_id:      str,
    rule:         str,
    file:         str,
    line:         int,
    severity:     Severity,
    confidence:   Confidence,
    finding_type: str,
    evidence:     dict[str, Any],
    reasoning:    str,
    missing_info: Optional[str] = None,
) -> Finding:
    """Erzeugt ein Finding mit automatischer, eindeutiger ID.

    IDs haben das Format ``REVIEW-<TARA_ID>-<NNN>`` (dreistellig, aufsteigend
    pro TARA-ID).

    Args:
        tara_id: Z.B. ``"TARA-0062"``.
        rule:    Z.B. ``"R-33"``.
        ...      Restliche Felder wie in ``Finding``.

    Returns:
        Neues ``Finding``-Objekt mit gesetzter ID.
    """
    _counters[tara_id] = _counters.get(tara_id, 0) + 1
    finding_id = f"REVIEW-{tara_id}-{_counters[tara_id]:03d}"
    return Finding(
        id=finding_id,
        rule=rule,
        file=file,
        line=line,
        severity=severity,
        confidence=confidence,
        type=finding_type,
        evidence=evidence,
        reasoning=reasoning,
        missing_info=missing_info,
    )
