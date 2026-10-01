# Dev Agent Onboarding – TARATool

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

## Schritt 1 – Repository klonen

```bash
git clone git@github.com:SCHUNK-SE-Co-KG/TARATool.git
cd TARATool
git checkout development
git pull origin development
```

> **macOS/Linux:** SSH-Key muss in GitHub hinterlegt sein, oder alternativ HTTPS nutzen:
> `git clone https://github.com/SCHUNK-SE-Co-KG/TARATool.git`

---

## Schritt 2 – GitHub CLI authentifizieren

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

## Schritt 3 – Node.js Abhängigkeiten installieren

```bash
npm install
```

Installiert: `prettier`, `eslint`, `@eslint/js`, `globals` (alle als devDependencies).

**Verifizieren:**

```bash
npm run format:check   # → "All matched files use Prettier code style!"
npm run lint           # → Exit-Code 0 (Warnings sind OK, Errors nicht)
```

---

## Schritt 4 – Python Test-Umgebung einrichten

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
# → Alle Tests grün
```

> ⚠️ **Wichtig:** `--noconftest` ist immer nötig, wenn Playwright **nicht** installiert ist.
> `conftest.py` initialisiert Playwright beim Start — ohne `--noconftest` bricht der Test-Lauf ab.
> Für Story-Tests (`test_TARA_XXXX.py`) reicht `--noconftest` vollständig aus.

---

## Schritt 5 – Umgebung verifizieren (Smoke-Test)

```bash
cd tests
.venv/bin/pytest test_TARA_0004.py test_TARA_0020.py test_TARA_0021.py test_TARA_0022.py test_TARA_0024.py test_TARA_0034_0037.py --noconftest -q
```

Erwartetes Ergebnis: **Alle Tests grün**, 0 Fehler.

Wenn dieser Schritt erfolgreich ist, ist die Umgebung korrekt eingerichtet.

---

## Schritt 6 – Workflow-Dokumente lesen (Pflicht)

> ⚠️ **Regel P-23:** Auch bei automatischem Session-Start (z.B. `/init` im
> GitHub Copilot CLI) duerfen bis zu diesem Schritt **keine** Datei-Aenderungen,
> Commits, Branches oder Board-Status-Wechsel vorgenommen werden. Dieser
> Schritt ist ausschliesslich Lesen/Parsen - siehe
> `.github/copilot-instructions.md` Abschnitt "`/init` und Session-Start".

Bevor mit einer Story begonnen wird, diese Dokumente kennen:

| Dokument                                       | Inhalt                                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTRIBUTING.md`                              | Vollständiger TDD-Workflow, Branch-Strategie, Commit-Format                                                                                                                                                                   |
| `agents/process_guard/PROCESS_GUARD_AGENT.md`  | <!-- GENERATED:rule-range:START (docs/process_definition.yml, scripts/process_guard/generate_process_docs.py) -->Prozessregeln P-01-P-27, Review-Regeln R-01-R-36<!-- GENERATED:rule-range:END -->, Compliance-Bericht-Format |
| `agents/review_agent/REVIEW_AGENT_WORKFLOW.md` | Review-Agent-Prüfkatalog (siehe `docs/process_definition.yml`)                                                                                                                                                                |
| `docs/GITHUB_BOARD.md`                         | Board-IDs, Status-IDs, GraphQL-Beispiele                                                                                                                                                                                      |
| `.github/pull_request_template.md`             | PR-Checkliste (TDD, Prettier, ESLint, Review, Freigabe)                                                                                                                                                                       |

---

## Schritt 7 – Offene Stories finden

```bash
# Alle offenen Stories auf dem Board
gh issue list --label story --state open --limit 50

# Nächste Story im Status "Todo" auf dem Board (via API)
gh api graphql -f query='{
  node(id: "PVT_kwDOBu4dv84BfbaR") {
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

## Schritt 8 – Story bearbeiten (Kurzreferenz)

```
1. PO gibt Story frei (Chat-Nachricht)
2. Status â†’ "In Progress" (TARA-0117, P-18: NICHT mehr per direkter
   GraphQL-Mutation/set_story_status.py, sondern per
   `gh workflow run transition.yml -f story=TARA-XXXX -f to="In Progress"` -
   `.github/workflows/transition.yml` prueft die Vorbedingung (Status muss
   "PO Accepted" sein) und setzt Status + Audit-Kommentar atomar)
   â›” GATE 1 (P-21): Vor Schritt 3 aktiv im Chat bestaetigen, siehe
   .github/copilot-instructions.md ("VERBINDLICHES GATE vor Commit/PR")
3. git checkout -b feature/TARA-XXXX-kurzbeschreibung
   ⚠️ **P-24 (Epic-Sync-Pflicht):** Wird diese Story ueber `Bezug: #<Epic-Nr>`
   einem Epic zugeordnet, MUSS im gleichen Arbeitsschritt das Epic-Issue-Body
   (Checkliste "Enthaltene Stories") um die neue Story ergaenzt werden - nicht
   erst nachtraeglich.
4. tests/test_TARA_XXXX.py schreiben → RED (müssen FEHLSCHLAGEN)
5. Implementierung → GREEN
6. npm run format:check  (Prettier)
7. npm run lint          (ESLint)
8. pytest test_TARA_XXXX.py --noconftest -v
9. git add / git commit "TARA-XXXX: Beschreibung"
10. git push origin feature/TARA-XXXX-...
11. Status â†’ "inReview" (TARA-0117, P-18: per
    `gh workflow run transition.yml -f story=TARA-XXXX -f to=inReview -f head_sha=<SHA>`),
    PR öffnen (PR-Body: `Bezug: #NNN`, NIE `Closes/Fixes #NNN`, siehe P-19)
    â›” GATE 2 (P-21): Vor `gh pr create` aktiv im Chat bestaetigen
12. Review-Agent aufrufen, Findings beheben. Danach zwingend einen PR-Kommentar
    hinterlassen: `Review-Agent: OK - keine Findings` ODER `Review-Agent: Findings
    siehe #<NNN>` - process-guard.yml erzwingt diesen Nachweis technisch (P-10,
    siehe TARA-0089, `scripts/process_guard/check_review_agent_invoked.sh`).
13. Prozess-Guard aufrufen (<!-- GENERATED:rule-range:START (docs/process_definition.yml, scripts/process_guard/generate_process_docs.py) -->Prozessregeln P-01-P-27, Review-Regeln R-01-R-36<!-- GENERATED:rule-range:END -->)
14. PO-Akzeptanz auf dem PR (P-25) → Status automatisch inReview → Accepted → PR mergen
15. Nach Merge: Status automatisch "Done" (P-11, nur wenn vorher "Accepted"); auf gebundenes
    PO-Release-Kommando (P-27) fuer die fachliche Freigabe warten → Status "PO Release" → "Done"
```

Vollständige Beschreibung: `CONTRIBUTING.md`

---

## Prozessregeln Kurzübersicht

Vollstaendige, generierte Regel-Tabelle (Single Source of Truth: `docs/process_definition.yml`):

<!-- GENERATED:process-rules-table:START (docs/process_definition.yml, scripts/process_guard/generate_process_docs.py) -->

| Regel | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Automatisiert                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-01  | Dev-Agent nennt TARA-ID in jeder Chat-Antwort                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Manuell                                                                                                                                                              |
| P-02  | Item auf „In Progress" gesetzt **bevor** Arbeit begann                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **GitHub Actions (PR)** – deterministischer Zeitstempel-Vergleich (Audit-Trail-Kommentar vs. erster Commit, TARA-0108)                                               |
| P-03  | **Tests vor Implementierung** geschrieben – Testdatei existiert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | **GitHub Actions (PR)**                                                                                                                                              |
| P-04  | Tests haben initial **fehlgeschlagen** – Red-Commit vor Green-Commit, Tests rot am Red-Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **GitHub Actions (PR)**                                                                                                                                              |
| P-04b | **Finaler Red-Green-Nachweis (TARA-0111)**: der FINALE Testinhalt (PR-Head-Stand) schlaegt beim Code des Basis-Branches nachweislich fehl und besteht beim PR-Head-Code – ergaenzt P-04, das nur den ERSTEN Commit-Snapshot prueft und einen spaeter durch inhaltsleere Tests ersetzten Teststand nicht erkennen wuerde                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **GitHub Actions (PR)** – `check_final_red_green.sh`                                                                                                                 |
| P-05  | Story-spezifische Tests **vor Commit** ausgefuehrt → alle gruen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Manuell (Dev-Agent-Pflicht)                                                                                                                                          |
| P-06  | Story-Testdatei gruen vor PR (Teilmenge von `test:unit`, TARA-0112): `npm run test:unit -- tests/test_TARA_XXXX.py` bzw. `pytest tests/test_TARA_XXXX.py --noconftest -v` – **keine** vollstaendige Suite, siehe P-06b/`test:integration`/`test:e2e` fuer den vollstaendigen Nachweis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **GitHub Actions (PR)**                                                                                                                                              |
| P-06b | **Regressionsschutz bei gemeinsam genutztem Code (TARA-0111)**: wurde ausser der Story-Testdatei/Doku auch gemeinsam genutzter Code veraendert (z.B. `scripts/`, andere Testdateien, Anwendungscode, Workflow-YAML), muss zusaetzlich `test:unit` (volle Suite ohne `tests/e2e/`/`tests/integration/`) gruen sein; `test:integration`/`test:e2e` laufen als eigene CI-Gates in `ci-tests.yml` vor Merge/Release (TARA-0112)                                                                                                                                                                                                                                                                                                                                                                               | **GitHub Actions (PR)** – `check_regression_scope.sh`                                                                                                                |
| P-07  | Branch-Name folgt `feature/TARA-XXXX-*` Schema                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **GitHub Actions (PR)**                                                                                                                                              |
| P-08  | Commit-Messages referenzieren TARA-ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **GitHub Actions (PR)**                                                                                                                                              |
| P-09  | Item auf „inReview" gesetzt **vor** PR-Erstellung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Manuell                                                                                                                                                              |
| P-10  | Review-Agent aufgerufen, Nachweis als SHA-gebundener JSON-Block (`reviewed_head_sha` == PR-Head-SHA), kein offenes Critical/High Finding ohne `findings_issue` (TARA-0107)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **GitHub Actions (PR)**                                                                                                                                              |
| P-11  | Nach Merge: Item auf „Done“ setzen (seit TARA-0110/Statusmodell B nur zulaessig, wenn Status vorher „Accepted“ war – sonst P-25-Umgehung)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **GitHub Actions (Post-Merge)** – `post-merge-status.yml` setzt Status automatisch beim Merge-Event (TARA-0108/TARA-0110), kein manueller Dev-Agent-Schritt mehr     |
| P-12  | **Prettier** (`npm run format:check`) bei JS/HTML-Aenderungen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **GitHub Actions (PR)**                                                                                                                                              |
| P-13  | **ESLint** (`npm run lint`) bei JS-Aenderungen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **GitHub Actions (PR)**                                                                                                                                              |
| P-14  | **TARA-IDs sind atomar und unveraenderlich** – keine ID mehrfach vergeben                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **GitHub Actions (Issue-Erstellung)**                                                                                                                                |
| P-15  | **Done NUR nach vorherigem "Accepted"** – seit TARA-0110 (Statusmodell B) ersetzt durch P-25 (PO-Akzeptanz VOR Merge, nicht mehr danach); `po-approve.yml` bleibt als manueller Fallback fuer Issue-Kommentare                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Manuell (Fallback)                                                                                                                                                   |
| P-16  | **Feature-Branch nach Merge loeschen**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Manuell                                                                                                                                                              |
| P-17  | **Epic-Batch-Testing**: PO informieren wenn alle Stories auf Freigabe                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Manuell                                                                                                                                                              |
| P-18  | **Pre-Transition Check**: Vorbedingungen vor jedem Status-Wechsel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Manuell (Dev-Agent-Pflicht)                                                                                                                                          |
| P-19  | Kein `Closes/Fixes/Resolves #NNN` im PR-Body (unterlaeuft P-11/P-15 durch Auto-Close) - stattdessen `Bezug: #NNN`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **GitHub Actions (PR)**                                                                                                                                              |
| P-20  | Audit-Trail-Kommentar bei jedem Board-Status-Wechsel; PO-Freigabe erfordert seit TARA-0109 ein an die TARA-ID GEBUNDENES Kommando (`akzeptiert TARA-XXXX`, nicht mehr lose Keywords)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **GitHub Actions (Issue-Kommentar)**                                                                                                                                 |
| P-21  | **Verbindliches Gate vor Commit/PR**: Checkliste in `.github/copilot-instructions.md` aktiv im Chat bestaetigen (Board-Status In Progress vor 1. Commit, Board-Status inReview vor `gh pr create`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Manuell (Dev-Agent-Pflicht, nicht ueberspringbar)                                                                                                                    |
| P-22  | **Review-Finding-Abschluss & Priorisierung**: Finding-Issue nach direktem Fix sofort schliessbar (entkoppelt vom Source-Story-Status), bei struktureller Verbesserung erst nach Anlage einer Folge-Story; vom PO akzeptierte Findings (Kommentar mit Freigabe-Schluesselwort) werden sofort auf "In Progress" gesetzt und **vor** anderen laufenden Stories priorisiert bearbeitet – siehe `agents/review_agent/REVIEW_AGENT_WORKFLOW.md` Abschnitt "Finding-Abschluss"                                                                                                                                                                                                                                                                                                                                   | Manuell (Dev-Agent-Pflicht)                                                                                                                                          |
| P-23  | **Kein eigenstaendiger Arbeitsbeginn bei `/init`/Session-Start**: Onboarding besteht ausschliesslich aus Lesen (Prozessdoku + Agenten-Doku), Board sichten, Vorschlagen; erst nach expliziter PO-/User-Freigabe darf Arbeit (Branch/Commit/Status-Wechsel) beginnen – siehe `.github/copilot-instructions.md` Abschnitt "`/init` und Session-Start"                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Manuell (Dev-Agent-Pflicht)                                                                                                                                          |
| P-24  | **Epic-Sync-Pflicht (ab TARA-0113: native Sub-Issues)**: Wird eine NEUE Story mit `Bezug: #<Epic-Nr>` angelegt, verknuepft der Dev-Agent sie ueber `scripts/workflow/link_epic_subissue.sh --owner <owner> --repo <repo> --epic <Epic-Nr> --story <Story-Nr>` als native GitHub-Sub-Issue mit ihrem Epic (REST-Endpunkt `POST /repos/{owner}/{repo}/issues/{epic}/sub_issues`). Diese Sub-Issue-Beziehung ist die Source of Truth fuer "Epic enthaelt Story X" - keine manuelle Text-Checkliste im Epic-Body mehr fuer neue Epics/Stories. **Bestandsschutz (PO-Entscheidung, Issue #183):** Bestehende Epics (z.B. #176 mit den Stories #177-#182) behalten ihre bereits gepflegte Text-Checkliste unveraendert als historisches Artefakt - es findet KEINE rueckwirkende Migration auf Sub-Issues statt | Automatisiert per Skript, Aufruf durch Dev-Agent (TARA-0113)                                                                                                         |
| P-25  | **PO-Akzeptanz-Gate vor Merge (Statusmodell B, TARA-0110)**: Merge nach `development` erst zulaessig, wenn (1) SHA-aktueller Review-Nachweis (P-10) UND (2) an die TARA-ID gebundene, nach dem letzten Push gepostete PO-Akzeptanz auf dem PR selbst vorliegen; Status wechselt dabei automatisch inReview → Accepted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **GitHub Actions (PR-Kommentar + required Status-Check)**                                                                                                            |
| P-26  | **PO-Accepted-Gate (Bearbeitungserlaubnis, TARA-0121)**: Der Uebergang Todo → PO Accepted darf NUR durch ein an die TARA-ID gebundenes `PO Accepted TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten ausgeloest werden (`po_approval_parser.extract_po_accepted_ids`); die alten losen Freigabe-Keywords (`akzeptiert`, `OK`, ...) autorisieren diesen Uebergang NICHT mehr. Der Dev-Agent darf erst nach nachgewiesenem Status „PO Accepted“ von Todo nach In Progress wechseln                                                                                                                                                                                                                                                                                                                      | **GitHub Actions (Issue-Kommentar)** – `check-po-accepted`-Job in `po-approve.yml`, Vorbedingung fuer Todo → In Progress zusaetzlich in `process-guard.yml` geprueft |
| P-27  | **PO-Release-Gate (fachliche/releasebezogene Abnahme, TARA-0121)**: Der Uebergang Accepted → PO Release → Done darf NUR erfolgen, wenn (1) der Status bereits „Accepted“ ist (technische Abnahme + Merge abgeschlossen) UND (2) ein an die TARA-ID gebundenes `PO Release TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten NACH Erreichen von „Accepted“ vorliegt (`po_release_gate.validate_release_gate`). Der Dev-Agent darf einen PO Release nur anfordern/vorbereiten, niemals selbst setzen (`set_story_status.py` weist `PO Accepted`/`PO Release` als Argumente explizit zurueck)                                                                                                                                                                                                             | **GitHub Actions (Issue-/PR-Kommentar)** – `check-po-release`-Job in `po-approve.yml`, setzt danach automatisch Done                                                 |

<!-- GENERATED:process-rules-table:END -->
