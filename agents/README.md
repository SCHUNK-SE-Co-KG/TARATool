# Agenten-Übersicht

Dieses Verzeichnis enthält (seit TARA-0120) nur noch den **Python-Implementierungscode**
des Review-Agenten sowie kurze Verweis-Stubs. Die massgeblichen
**Rollenbeschreibungen** aller Agenten liegen unter
[`.github/agents/`](../.github/agents/).

## Agenten

| Agent                                               | Rolle                                                                                                 | Rollenbeschreibung (massgeblich)                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Requirements-Agent (seit TARA-0118)                 | Chat-Anforderung -> Story (AC/Scope/Abhaengigkeiten), DoR-Pruefung; keine fachliche Freigabe          | [.github/agents/requirements.agent.md](../.github/agents/requirements.agent.md)     |
| Dev Agent                                           | TDD-Implementierung, Branch-Management, Story-Umsetzung                                               | [.github/agents/developer.agent.md](../.github/agents/developer.agent.md)           |
| Review Agent                                        | Diff-Review (R-01–R-30), Browser-Runtime-Scan, Qualitätsprüfung                                       | [.github/agents/reviewer.agent.md](../.github/agents/reviewer.agent.md)             |
| Prozess-Guard                                       | Compliance-Check (P-01–P-27) vor PR, Branch-Schutz (Policy, keine eigene Rolle, siehe TARA-0108)      | [.github/agents/process-guard.policy.md](../.github/agents/process-guard.policy.md) |
| Acceptance-Agent (seit TARA-0118, nur dokumentiert) | Entscheidungsgrundlage fuer PO-Abnahme aufbereiten; keine eigene Freigabebefugnis; kein Code/Prototyp | [.github/agents/acceptance.agent.md](../.github/agents/acceptance.agent.md)         |

> `agents/review_agent/*.py` enthaelt weiterhin den Python-Implementierungscode des
> Review-Agenten (Duplication-Detector, Report-Builder etc.), der ueber
> `from agents.review_agent import ...` importiert wird und **nicht** migriert wurde.

## Zusammenspiel der Agenten

```
Dev Agent
  │  schreibt Tests (TDD Red) → implementiert (TDD Green) → committet
  │
  ▼
Review Agent
  │  analysiert Diff (R-01..R-30) → Browser Runtime Scan
  │
  ▼
Prozess-Guard
  │  prüft P-01..P-15 Compliance
  │
  ▼
PR → Development (nach Freigabe)
```

Der **Dev Agent** übernimmt die Implementierung neuer Features nach dem TDD-Prinzip.
Der **Review Agent** prüft den fertigen Diff auf Code-Qualität und Sicherheit.
Der **Prozess-Guard** stellt sicher, dass alle Prozessregeln eingehalten wurden, bevor ein PR gemergt wird.
