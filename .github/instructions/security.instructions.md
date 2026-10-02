---
applyTo: "**"
---

# Instructions: Security & Authentifizierung

- **Keine Secrets im Code/Commit:** Tokens, Passwoerter, API-Keys niemals
  hart codieren oder in Issue-/PR-Kommentare schreiben.
- **Security-relevante Aenderungen** (Authentifizierung, Autorisierung,
  Session-/State-Verwaltung, Datenvalidierung an Trust-Boundaries) durchlaufen
  verpflichtend den Skill `security-review` (`.github/skills/security-review/SKILL.md`)
  zusaetzlich zum normalen Review.
- **Risikobasierte Vollregression (TARA-0125):** Stories, die Authentifizierung/
  Security, das Datenmodell, Import/Export, Risikoberechnung,
  Report-Generierung, zentrale State-Verwaltung, gemeinsame Basiskomponenten,
  Build-/Deployment-Konfiguration oder die Testinfrastruktur selbst betreffen,
  loesen unmittelbar eine volle Regressionssuite aus (nicht erst beim
  Epic-Batch oder Monats-Lauf) - siehe `.github/agents/process-guard.policy.md`.
- **Keine Umgehung von Freigabe-Gates** durch Security-Fixes "im Vorbeigehen" -
  auch Hotfixes durchlaufen P-01 bis P-21.
