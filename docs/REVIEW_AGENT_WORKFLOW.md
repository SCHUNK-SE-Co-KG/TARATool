# Review Agent Workflow

Dieser Workflow beschreibt den vollständigen Review-Prozess für JavaScript/TypeScript-Code im TARATool-Projekt.

## Überblick

Der Review-Agent prüft Code automatisch auf bekannte Muster, die zu Fehlern, Sicherheitslücken oder schlechter Wartbarkeit führen können.

## Prüfregeln

| Regel | Beschreibung |
|-------|-------------|
| R-01 | Keine `eval()`-Aufrufe oder dynamische Codeausführung |
| R-02 | Keine direkten `innerHTML`-Zuweisungen ohne Sanitierung |
| R-03 | Kein `document.write()` |
| R-04 | `localStorage`/`sessionStorage` nur über definierte Wrapper |
| R-05 | Keine unkontrollierten `postMessage`-Empfänger ohne Origin-Check |
| R-06 | Kein globales Überschreiben von `window`-Properties |
| R-07 | Alle `fetch()`-Aufrufe müssen `.catch()` oder `try/catch` haben |
| R-08 | Keine Hardcoded Credentials oder API-Keys im Source-Code |
| R-09 | `JSON.parse()` immer in `try/catch` eingebettet |
| R-10 | Keine Endlos-Rekursion ohne Abbruchbedingung |
| R-11 | Event-Listener werden bei Component-Destroy entfernt |
| R-12 | Kein toter Code nach `return`/`throw`-Statements |

## Workflow

1. **Automatisch bei PR** – GitHub Action `process-guard.yml` läuft auf jedem PR gegen `development`
2. **Manuell** – `python agents/review_agent/run_review.py <datei>`
3. **Findings** – werden als GitHub-Issues mit Label `review-finding` angelegt

## Severity-Stufen

| Stufe | Aktion |
|-------|--------|
| Kritisch | PR wird blockiert, sofortiger Fix erforderlich |
| Hoch | PR wird blockiert, Fix vor Merge |
| Mittel | Kommentar im PR, Fix im nächsten Sprint |
| Niedrig/Hinweis | Dokumentiert, kein Blocker |

## Integration mit Finding Framework (TARA-0062)

Alle Findings werden über `agents/review_agent/finding_framework.py` erstellt:

```python
from agents.review_agent.finding_framework import create_finding, Severity, Confidence
finding = create_finding(
    tara_id="0058",
    rule="R-12",
    severity=Severity.Mittel,
    confidence=Confidence.High,
    file="js/app.js",
    line=42,
    finding_type="Kontrollfluss",
    evidence={"code_snippet": "console.log('dead');"},
    reasoning="Toter Code nach return-Statement."
)
```
