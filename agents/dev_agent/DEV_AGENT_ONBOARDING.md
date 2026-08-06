# Dev Agent Onboarding â€“ TARATool

Diese Anleitung ermöglicht einem neuen Dev-Agenten (in einem frischen Agentenfenster,
auf einem beliebigen Rechner) den Entwicklungsprozess **exakt** so durchzuführen wie
definiert.

---

## Voraussetzungen

Folgende Tools müssen auf dem System installiert sein:

| Tool                | Mindestversion | Prüfen              |
| ------------------- | -------------- | ------------------- |
| **git**             | 2.x            | `git --version`     |
| **gh** (GitHub CLI) | 2.x            | `gh --version`      |
| **Node.js**         | 18+            | `node --version`    |
| **npm**             | 9+             | `npm --version`     |
| **Python**          | 3.10+          | `python3 --version` |

---

## Schritt 1 â€“ Repository klonen

```bash
git clone git@github.com:Bheowulf/TARATool.git
cd TARATool
git checkout development
git pull origin development
```

> **macOS/Linux:** SSH-Key muss in GitHub hinterlegt sein, oder alternativ HTTPS nutzen:
> `git clone https://github.com/Bheowulf/TARATool.git`

---

## Schritt 2 â€“ GitHub CLI authentifizieren

```bash
# Login (Browser-Flow)
gh auth login -h github.com

# Erweiterte Scopes für GitHub Projects (Pflicht für Board-Operationen)
gh auth refresh -h github.com -s project,read:project

# Verifizieren
gh auth status
```

Der aktive User muss **Schreibrechte im Repository** haben.

---

## Schritt 3 â€“ Node.js Abhängigkeiten installieren

```bash
npm install
```

Installiert: `prettier`, `eslint`, `@eslint/js`, `globals` (alle als devDependencies).

**Verifizieren:**

```bash
npm run format:check   # â†’ "All matched files use Prettier code style!"
npm run lint           # â†’ Exit-Code 0 (Warnings sind OK, Errors nicht)
```

---

## Schritt 4 â€“ Python Test-Umgebung einrichten

```bash
cd tests

# macOS/Linux
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Windows
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**Verifizieren (ohne Playwright):**

```bash
# Aus dem tests/-Verzeichnis:
.venv/bin/pytest test_TARA_0004.py --noconftest -v
# â†’ Alle Tests grün
```

> âš ï¸ **Wichtig:** `--noconftest` ist immer nötig, wenn Playwright **nicht** installiert ist.
> `conftest.py` initialisiert Playwright beim Start â€” ohne `--noconftest` bricht der Test-Lauf ab.
> Für Story-Tests (`test_TARA_XXXX.py`) reicht `--noconftest` vollständig aus.

---

## Schritt 5 â€“ Umgebung verifizieren (Smoke-Test)

```bash
cd tests
.venv/bin/pytest test_TARA_0004.py test_TARA_0020.py test_TARA_0021.py test_TARA_0022.py test_TARA_0024.py test_TARA_0034_0037.py --noconftest -q
```

Erwartetes Ergebnis: **Alle Tests grün**, 0 Fehler.

Wenn dieser Schritt erfolgreich ist, ist die Umgebung korrekt eingerichtet.

---

## Schritt 6 â€“ Workflow-Dokumente lesen (Pflicht)

Bevor mit einer Story begonnen wird, diese Dokumente kennen:

| Dokument                                       | Inhalt                                                      |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `CONTRIBUTING.md`                              | Vollständiger TDD-Workflow, Branch-Strategie, Commit-Format |
| `agents/process_guard/PROCESS_GUARD_AGENT.md`  | Regeln P-01â€“P-15, Compliance-Bericht-Format               |
| `agents/review_agent/REVIEW_AGENT_WORKFLOW.md` | Review-Agent-Checkliste R-01â€“R-12                         |
| `docs/GITHUB_BOARD.md`                         | Board-IDs, Status-IDs, GraphQL-Beispiele                    |
| `.github/pull_request_template.md`             | PR-Checkliste (TDD, Prettier, ESLint, Review, Freigabe)     |

---

## Schritt 7 â€“ Offene Stories finden

```bash
# Alle offenen Stories auf dem Board
gh issue list --label story --state open --limit 50

# Nächste Story im Status "Todo" auf dem Board (via API)
gh api graphql -f query='{
  node(id: "PVT_kwHOBLN4284BfLtb") {
    ... on ProjectV2 {
      items(first: 50) {
        nodes {
          content { ... on Issue { number title labels { nodes { name } } } }
          fieldValues(first: 5) {
            nodes { ... on ProjectV2ItemFieldSingleSelectValue { name } }
          }
        }
      }
    }
  }
}' --jq '.data.node.items.nodes[] | select(.fieldValues.nodes[].name? == "Todo") | "\(.content.number): \(.content.title)"'
```

---

## Schritt 8 â€“ Story bearbeiten (Kurzreferenz)

```
1. PO gibt Story frei (Chat-Nachricht)
2. Status â†’ "In Progress"  (Board-ID aus docs/GITHUB_BOARD.md)
3. git checkout -b feature/TARA-XXXX-kurzbeschreibung
4. tests/test_TARA_XXXX.py schreiben â†’ RED (müssen FEHLSCHLAGEN)
5. Implementierung â†’ GREEN
6. npm run format:check  (Prettier)
7. npm run lint          (ESLint)
8. pytest test_TARA_XXXX.py --noconftest -v
9. git add / git commit "TARA-XXXX: Beschreibung"
10. git push origin feature/TARA-XXXX-...
11. Status â†’ "inReview", PR öffnen
12. Review-Agent aufrufen, Findings beheben
13. Prozess-Guard aufrufen (P-01â€“P-15)
14. PR mergen â†’ Status â†’ "Freigabe"
15. Auf PO-OK warten â†’ Status â†’ "Done"
```

Vollständige Beschreibung: `CONTRIBUTING.md`

---

## Prozessregeln Kurzübersicht (P-01â€“P-15)

| Regel | Kurzform                                          |
| ----- | ------------------------------------------------- |
| P-01  | TARA-ID in jeder Chat-Antwort nennen              |
| P-02  | Status â†’ In Progress VOR Arbeitsbeginn          |
| P-03  | Tests VOR Implementierung schreiben               |
| P-04  | Tests müssen initial FEHLSCHLAGEN (Red bewiesen)  |
| P-05  | Story-Tests vor Commit grün                       |
| P-06  | Vollständige Suite vor PR grün                    |
| P-07  | Branch: `feature/TARA-XXXX-*`                     |
| P-08  | Commits referenzieren TARA-ID                     |
| P-09  | Status â†’ inReview vor PR                        |
| P-10  | Review-Agent aufgerufen, kein Critical/High offen |
| P-11  | Nach Merge â†’ Freigabe (nicht direkt Done)       |
| P-12  | Prettier grün vor Tests                           |
| P-13  | ESLint grün vor Tests                             |
| P-14  | TARA-IDs sind atomar und unveränderlich           |
| P-15  | Done nur nach explizitem PO-OK                    |
