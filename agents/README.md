# Agenten-Übersicht

Dieses Verzeichnis enthält die Prozessdokumentationen und Implementierungen aller Agenten, die im TARATool-Entwicklungsprozess zusammenarbeiten.

## Agenten

| Agent         | Rolle                                                           | Prozessdatei                                                                   |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Dev Agent     | TDD-Implementierung, Branch-Management, Story-Umsetzung         | [dev_agent/DEV_AGENT_ONBOARDING.md](dev_agent/DEV_AGENT_ONBOARDING.md)         |
| Review Agent  | Diff-Review (R-01–R-30), Browser-Runtime-Scan, Qualitätsprüfung | [review_agent/REVIEW_AGENT_WORKFLOW.md](review_agent/REVIEW_AGENT_WORKFLOW.md) |
| Prozess-Guard | Compliance-Check (P-01–P-15) vor PR, Branch-Schutz              | [process_guard/PROCESS_GUARD_AGENT.md](process_guard/PROCESS_GUARD_AGENT.md)   |

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
