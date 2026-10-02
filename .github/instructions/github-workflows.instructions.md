---
applyTo: ".github/workflows/**"
---

# Instructions: GitHub Actions Workflows (`.github/workflows/**`)

> Noch keine ueber die allgemeinen Regeln hinausgehenden pfadspezifischen
> Regeln fuer dieses Verzeichnis - bei Bedarf ergaenzen.

- Workflows setzen Prozessregeln deterministisch durch (siehe
  `.github/agents/process-guard.policy.md`) - keine LLM-basierte Logik hier.
- Freigabe-Erkennung laeuft ausschliesslich ueber
  `scripts/process_guard/po_approval_parser.py` /
  `check_po_approval_keyword.sh` (TARA-0109), nicht ueber eigene
  Titel/Body-Textsuche im Workflow selbst.
