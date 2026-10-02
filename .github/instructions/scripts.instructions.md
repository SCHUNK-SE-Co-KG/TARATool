---
applyTo: "scripts/**"
---

# Instructions: Scripts (`scripts/**`, `agents/*/*.py`)

> Noch keine ueber die allgemeinen Regeln hinausgehenden pfadspezifischen
> Regeln fuer dieses Verzeichnis - bei Bedarf ergaenzen.

- Automationsskripte (Process-Guard, Report-Builder, Workflow-Helfer) sind
  deterministisch und LLM-frei zu halten (siehe `.github/agents/process-guard.policy.md`).
- Aenderungen hier zaehlen als "gemeinsam genutzter Code" im Sinne von
  P-06b (siehe `.github/instructions/tests.instructions.md`) und erfordern
  die volle Regressionssuite.
