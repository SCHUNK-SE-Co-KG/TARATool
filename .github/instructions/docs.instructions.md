---
applyTo: "docs/**"
---

# Instructions: Dokumentation (`docs/**`)

> Noch keine ueber die allgemeinen Regeln hinausgehenden pfadspezifischen
> Regeln fuer dieses Verzeichnis - bei Bedarf ergaenzen.

- `docs/process_definition.yml` ist die Single Source of Truth fuer
  Prozess-/Review-Regeln (TARA-0116); Aenderungen an Regeltiteln/-texten
  erfordern einen Lauf von `scripts/process_guard/generate_process_docs.py`
  (ohne `--check`), um Drift in den generierten Abschnitten zu vermeiden.
- `docs/ENTWICKLUNGSPROZESS.md` bleibt der vollstaendige, menschenlesbare
  Prozess-Leitfaden und wird bei Rollen-/Pfadaenderungen konsistent
  mitgepflegt.
