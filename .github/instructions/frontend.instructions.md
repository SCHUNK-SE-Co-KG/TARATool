---
applyTo: "**/*.{js,html,css}"
---

# Instructions: Frontend (JS/HTML/CSS)

- **Formatierung (P-12):** Vor jedem Commit, der `.js`/`.html`/`.css`
  veraendert, muss Prettier sauber durchlaufen: `npx prettier --check .`
  (bzw. `--write .` zum Beheben).
- **Linting (P-13):** ESLint muss fehlerfrei sein: `npx eslint .`
- **Beides ist Teil von Gate 2** (siehe
  `.github/instructions/workflows.instructions.md`) und muss im Chat vor
  `gh pr create` explizit als gruen bestaetigt werden.
- **Keine Inline-Styles/Skripte ohne Grund:** bestehende Projektstruktur
  (Trennung JS/CSS/HTML) beibehalten, keine neuen Build-Tools ohne
  Rueckfrage einfuehren.
