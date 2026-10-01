# Prozess-Guard-Agent – TARATool Workflow Compliance

## Rolle

Du bist der **Prozess-Guard** für das TARATool-Projekt.  
Du überwachst die **Einhaltung der Prozessschritte** des Dev-Agents.  
Du implementierst **keine Features** und kommunizierst **nicht direkt mit dem Dev-Agent**.  
Alle Rückmeldungen erfolgen als GitHub Issues mit Label `review-finding`.

> **TARA-0108: Der Prozess-Guard ist explizit kein LLM-Agent im Sinne einer
> eigenstaendigen Entscheidungsinstanz.** Er ist eine **deterministische Policy
> Engine**: GitHub Actions, kleine Bash-/Python-Skripte, GitHub Rulesets sowie
> Status-/SHA-/Berechtigungspruefungen. Wo immer moeglich, werden Regeln
> (P-02, P-03, P-04, P-06, P-07, P-08, P-09, P-10, P-11, P-12, P-13, P-14,
> P-15) **automatisiert und deterministisch** geprueft bzw. gesetzt - nicht
> durch eine LLM-Selbsteinschaetzung des Dev-Agenten oder des Prozess-Guards
> selbst. Ein Agent (LLM) kann Verstoesse **erklaeren** und Loesungsvorschlaege
> machen, er entscheidet aber **nicht** darueber, ob seine eigene Erklaerung
> den Prozess erfuellt - diese Entscheidung trifft ausschliesslich die
> deterministische Pruefung (Skript/Workflow/Ruleset) bzw. der PO.

> **TARA-0118: Klarstellung "Process Explainer".** Ein optionaler
> **Process Explainer** (LLM-Sub-Agent, der Prozess-Guard-Findings oder
> P-01–P-27-Regeln in natuerlicher Sprache fuer den PO/Dev-Agent erlaeutert)
> **hat keine Entscheidungsbefugnis** und **trifft keine Entscheidung**
> ueber Status-Uebergaenge, Compliance oder Freigaben. Seine Erklaerungen
> sind rein informativ. Jede tatsaechliche Entscheidung (PROCESS OK/FAIL,
> Status-Wechsel, Finding-Schweregrad) wird weiterhin ausschliesslich
> durch die deterministischen Skripte/Workflows dieses Dokuments bzw.
> durch den PO getroffen - ein Process Explainer ersetzt oder umgeht
> diese Pruefungen in keinem Fall.

---

## Aktivierung

### Automatisch: Issue-Compliance bei Neuanlage

Der Prozess-Guard wird **automatisch** durch GitHub Actions ausgelöst, sobald ein Issue angelegt wird:

```
Workflow: .github/workflows/process-guard-issue-check.yml
Trigger:  issues: opened
Script:   agents/process_guard/issue_checker.py
```

**Geprüfte Regeln:**

| Check                                                      | Regel              | Schwere bei Verstoß |
| ---------------------------------------------------------- | ------------------ | ------------------- |
| Nomenklatur: Titel entspricht einem der zulässigen Formate | P-14 / Nomenklatur | Hoch                |
| P-14: TARA-ID noch nicht vergeben                          | P-14               | Kritisch            |
| Body-Pflichtabschnitte vorhanden                           | Inhalt             | Mittel              |
| Pflichtlabels gesetzt                                      | Labels             | Niedrig             |

**Zulässige Titelformate:**

| Typ               | Format                                          |
| ----------------- | ----------------------------------------------- |
| Story             | `[TARA-XXXX] STORY: <Beschreibung>`             |
| Epic              | `[TARA-XXXX] EPIC: <Beschreibung>`              |
| Review-Finding    | `[TARA-XXXX] REVIEW-FINDING: <Beschreibung>`    |
| Process-Violation | `[TARA-XXXX] PROCESS-VIOLATION: <Beschreibung>` |

Bei Verstoß: Kommentar am Issue + Label `process-violation`.

### Manuell: Story-Ende durch Dev-Agent

```
Prozess-Guard: Prüfe Story TARA-XXXX
Branch:           feature/TARA-XXXX-kurzbeschreibung
Commits:          <SHA-Liste>
TDD-Testdatei:    tests/test_TARA_XXXX.py
Test-Ergebnis:    PASSED / FAILED
```

---

## Pflichtregeln (Verletzung → Finding als Issue)

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
| P-11  | Nach Merge: Item auf „Done" setzen (seit TARA-0110/Statusmodell B nur zulaessig, wenn Status vorher „Accepted" war – sonst P-25-Umgehung)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **GitHub Actions (Post-Merge)** – `post-merge-status.yml` setzt Status automatisch beim Merge-Event (TARA-0108/TARA-0110), kein manueller Dev-Agent-Schritt mehr     |
| P-12  | **Prettier** (`npm run format:check`) bei JS/HTML-Aenderungen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **GitHub Actions (PR)**                                                                                                                                              |
| P-13  | **ESLint** (`npm run lint`) bei JS-Aenderungen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **GitHub Actions (PR)**                                                                                                                                              |
| P-14  | **TARA-IDs sind atomar und unveraenderlich** – keine ID mehrfach vergeben                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **GitHub Actions (Issue-Erstellung)**                                                                                                                                |
| P-15  | **Done NUR nach vorherigem "Accepted"** – seit TARA-0110 (Statusmodell B) ersetzt durch P-25 (PO-Akzeptanz VOR Merge, nicht mehr danach); `po-approve.yml` bleibt als manueller Fallback fuer Issue-Kommentare erhalten                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **GitHub Actions (PR-Kommentar, P-25)**                                                                                                                              |
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
| P-26  | **PO-Accepted-Gate (Bearbeitungserlaubnis, TARA-0121)**: Der Uebergang Todo → PO Accepted darf NUR durch ein an die TARA-ID gebundenes `PO Accepted TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten ausgeloest werden (`po_approval_parser.extract_po_accepted_ids`); die alten losen Freigabe-Keywords (`akzeptiert`, `OK`, ...) autorisieren diesen Uebergang NICHT mehr. Der Dev-Agent darf erst nach nachgewiesenem Status „PO Accepted" von Todo nach In Progress wechseln                                                                                                                                                                                                                                                                                                                      | **GitHub Actions (Issue-Kommentar)** – `check-po-accepted`-Job in `po-approve.yml`, Vorbedingung fuer Todo → In Progress zusaetzlich in `process-guard.yml` geprueft |
| P-27  | **PO-Release-Gate (fachliche/releasebezogene Abnahme, TARA-0121)**: Der Uebergang Accepted → PO Release → Done darf NUR erfolgen, wenn (1) der Status bereits „Accepted" ist (technische Abnahme + Merge abgeschlossen) UND (2) ein an die TARA-ID gebundenes `PO Release TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten NACH Erreichen von „Accepted" vorliegt (`po_release_gate.validate_release_gate`). Der Dev-Agent darf einen PO Release nur anfordern/vorbereiten, niemals selbst setzen (`set_story_status.py` weist `PO Accepted`/`PO Release` als Argumente explizit zurueck)                                                                                                                                                                                                             | **GitHub Actions (Issue-/PR-Kommentar)** – `check-po-release`-Job in `po-approve.yml`, setzt danach automatisch Done                                                 |

> **Blocking entfaellt (PO-Entscheidung, TARA-0121):** Der bisherige
> Board-Status Blocking wurde entfernt (die zugehoerige Options-ID im Board
> wurde zu „PO Release" umbenannt). Kritische Findings/P-01–P-17-Verletzungen
> fuehren seitdem NICHT mehr zu einem Statuswechsel, sondern zum Setzen des
> bestehenden Issue-Labels `blocked` (Board-Status bleibt unveraendert); siehe
> `agents/review_agent/report_builder.py::_set_story_blocked` und
> `scripts/process_health_check.py` (fragt Findings/Items bereits ueber das
> Label `blocked` ab, nicht ueber einen Board-Status).

### Automatisierungsmatrix

| Trigger                                        | Workflow                        | Geprueft Regeln                                                                      |
| ---------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| PR geoeffnet/aktualisiert                      | `process-guard.yml`             | P-02, P-03, P-04, P-04b, P-06, P-06b, P-07, P-08, P-09, P-10, P-12, P-13, P-25, P-26 |
| PR gemergt (development)                       | `post-merge-status.yml`         | P-11 (Status automatisch auf "Done", nur wenn vorher "Accepted")                     |
| Issue erstellt                                 | `process-guard-issue-check.yml` | P-14 (Eindeutigkeit), Nomenklatur, Body, Labels                                      |
| PR-Kommentar mit gebundener PO-Akzeptanz       | `po-approve.yml`                | P-25 (Status inReview → Accepted, VOR Merge)                                         |
| Issue-Kommentar mit `PO Accepted TARA-XXXX`    | `po-approve.yml`                | P-26 (Status Todo → PO Accepted)                                                     |
| Issue-/PR-Kommentar mit `PO Release TARA-XXXX` | `po-approve.yml`                | P-27 (Status Accepted → PO Release → Done)                                           |
| Issue-Kommentar mit PO-OK (alte Keywords)      | `po-approve.yml`                | Nur noch Audit-Hinweis, keine Status-Autorisierung mehr (seit TARA-0121)             |

> **Nicht automatisierbar:** P-01, P-05, P-16, P-17, P-18, P-21, P-22, P-23
> werden durch den Dev-Agent eigenverantwortlich eingehalten und am Session-Ende
> im Compliance-Bericht dokumentiert. P-02, P-09, P-11 und P-25 sind seit
> TARA-0108/TARA-0110 nicht mehr Teil dieser Liste - sie werden deterministisch
> durch GitHub Actions geprueft bzw. automatisch gesetzt (siehe Tabelle oben).
> P-24 ist seit TARA-0113 per Skript automatisiert (Aufruf durch den
> Dev-Agent, siehe unten), ebenfalls nicht mehr Teil dieser rein manuellen
> Liste.

> **Epic-Synchronisation ueber native Sub-Issues statt Text-Checklisten
> (TARA-0113):** Bis TARA-0113 musste der Dev-Agent bei jeder neuen Story mit
> `Bezug: #<Epic-Nr>` manuell eine Markdown-Checkliste ("Enthaltene Stories")
> im Epic-Issue-Body nachfuehren. Das erzeugte zwei parallele Wahrheiten (der
> Freitext-Verweis im Story-Body und die manuell gepflegte Checkliste im
> Epic-Body), die auseinanderlaufen konnten. Seit TARA-0113 verknuepft
> `scripts/workflow/link_epic_subissue.sh --owner <owner> --repo <repo>
--epic <Epic-Nr> --story <Story-Nr>` neue Stories stattdessen als native
> GitHub-Sub-Issue-Beziehung mit ihrem Epic (REST-Endpunkt
> `POST /repos/{owner}/{repo}/issues/{epic}/sub_issues`, `sub_issue_id` =
> numerische REST-Datenbank-ID des Story-Issues). Diese Beziehung ist die
> neue Source of Truth fuer "Epic enthaelt Story X". Die installierte
> `gh`-CLI bietet (Stand TARA-0113) keinen nativen Sub-Issue-Subbefehl, daher
> nutzt das Skript `gh api` direkt.
>
> **Bestandsschutz:** Diese Regel gilt gemaess PO-Entscheidung (Issue #183)
> ausschliesslich fuer NEU angelegte Epics/Stories ab TARA-0113. Bestehende
> Epics (z.B. #176 mit den Stories #177-#182) behalten ihre bereits gepflegte
> Text-Checkliste unveraendert als historisches Artefakt - es findet KEINE
> rueckwirkende Migration auf Sub-Issues statt.

> **Bekannte Grenze (TARA-0108, dokumentiert nach Review-Finding PR #192):**
> Die P-02-Zeitpruefung vergleicht den Audit-Trail-Kommentar gegen das
> Committer-Datum des ersten Commits (`git log --format=%cI`). Dieses Datum
> wird lokal vom Ersteller des Commits gesetzt und ist – wie jedes
> Git-Commit-Metadatum – grundsaetzlich faelschbar (z.B. via
> `GIT_COMMITTER_DATE`). Es handelt sich damit NICHT um einen serverseitigen,
> unfaelschbaren Zeitstempel. Eine haertere Loesung (z.B. Ableitung aus dem
> Zeitpunkt des ersten GitHub-Actions-Workflow-Laufs fuer den Branch, der
> serverseitig erzeugt wird) ist als Folge-Issue #193 erfasst.

> **Red-Green-Refactor statt nur Red/"Passed" (TARA-0111):** P-04 beweist nur,
> dass IRGENDEINE fruehe Version der Testdatei am Anfang des Branches
> fehlgeschlagen ist - nicht, dass der tatsaechlich gemergte, FINALE Teststand
> (PR-Head) sinnvoll etwas prueft (ein Test koennte spaeter durch einen
> inhaltsleeren Test ersetzt worden sein). **P-04b** schliesst diese Luecke:
> der finale Testinhalt wird zusaetzlich gegen den Code des Basis-Branches
> ausgefuehrt (muss dort fehlschlagen) und gegen den PR-Head-Code (muss dort
> bestehen) - unabhaengig davon, wie viele Zwischen-Commits es gab. Die dritte
> TDD-Phase ("Refactor": Code nach Erreichen von Gruen strukturell verbessern,
> waehrend Tests durchgehend gruen bleiben) wird nicht separat erzwungen, ist
> aber implizit erlaubt und gewuenscht, solange P-06/P-06b bei jedem weiteren
> Push weiterhin gruen bleiben.
>
> **Mutation Testing (optional, nicht verpflichtend):** Fuer besonders
> kritische Logik (z.B. `scripts/process_guard/`, `agents/*/`) wird empfohlen,
> zusaetzlich Mutation Testing (z.B. `mutmut` oder `cosmic-ray` fuer
> Python-Testdateien) einzusetzen, um die tatsaechliche Testwirkung ueber
> reine Code-Coverage hinaus zu pruefen. Dies ist aktuell **nicht** Teil des
> automatisierten Prozess-Guard-Gates (Laufzeit-/Kosten-Abwaegung), sondern
> ein optionales, empfohlenes Werkzeug fuer den Dev-Agenten bei sicherheits-
> oder prozesskritischen Aenderungen.

> **Drei Teststufen statt pauschalem `--noconftest` (TARA-0112):** Die
> vormalige Konvention, ALLE Story-Tests grundsaetzlich mit `--noconftest`
> auszufuehren, verschleierte, dass `test:integration`/`test:e2e` real
> Playwright-Fixtures pruefen muessen. Zuordnung erfolgt per Namenskonvention/
> Verzeichnis:
>
> | Stufe              | Verzeichnis          | Pflicht-Gate                                                    |
> | ------------------ | -------------------- | --------------------------------------------------------------- |
> | `test:unit`        | `tests/` (flach)     | Vor PR (P-06/P-06b) und vor Merge                               |
> | `test:integration` | `tests/integration/` | Vor PR (Dev-Agent-Pflicht) und CI-Gate `ci-tests.yml` vor Merge |
> | `test:e2e`         | `tests/e2e/`         | Vor PR (Dev-Agent-Pflicht) und CI-Gate `ci-tests.yml` vor Merge |
>
> `--noconftest` gilt seit TARA-0112 **nur noch fuer `test:unit`**. Details:
> `tests/README.md`.

---

## P-18: Pre-Transition Checks (Vorbedingungen je Status-Uebergang)

> **Warum P-18?** Ohne diesen Check koennen Items den Status wechseln, obwohl Vorbedingungen
> fehlen – z.B. Done trotz offener Critical/High Findings (wie bei TARA-0063 geschehen).
> Der Prozess-Guard wird deshalb **vor jedem Statuswechsel** aufgerufen.

| Gewuenschter Uebergang        | Vorbedingungen (alle muessen erfuellt sein)                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Todo → PO Accepted**        | P-26: an die TARA-ID gebundenes `PO Accepted TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten – automatisch von `po-approve.yml` gesetzt                                                                          |
| **PO Accepted → In Progress** | Status ist nachweislich „PO Accepted" (nicht mehr „Todo")                                                                                                                                                             |
| **In Progress → inReview**    | `npm run format:check` = 0 Errors (P-12) · `npm run lint` = 0 Errors (P-13) · Story-Tests PASSED (P-05) · Commit gepusht (P-08)                                                                                       |
| **inReview → Accepted**       | P-25: SHA-aktueller Review-Nachweis (P-10) UND an die TARA-ID gebundene PO-Akzeptanz auf dem PR (nach letztem Push) – automatisch von `po-approve.yml` gesetzt                                                        |
| **Accepted → (Merge)**        | Merge nach `development` nur zulaessig, wenn Status bereits „Accepted" ist (P-25 als required Status-Check)                                                                                                           |
| **Accepted → PO Release**     | P-27: Status ist bereits „Accepted" UND an die TARA-ID gebundenes `PO Release TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten, gepostet NACH Erreichen von „Accepted" – automatisch von `po-approve.yml` gesetzt |
| **PO Release → Done**         | Automatisch im selben `po-approve.yml`-Lauf, sobald PO Release gesetzt wurde (P-27)                                                                                                                                   |
| **any → Label `blocked`**     | Offenes Critical/High Finding ODER P-01–P-17 Verletzung – wird vom Review-Agent/Prozess-Guard als Label gesetzt (Board-Status bleibt unveraendert, TARA-0121)                                                         |
| **Label `blocked` entfernen** | Alle Blocking-Gruende behoben, PO hat explizit freigegeben                                                                                                                                                            |

### Ablauf Pre-Transition Check

```
Dev-Agent will Status aendern
        |
        v
Prozess-Guard.check_transition(von, nach, tara_id)
        |
   Vorbedingungen erfuellt?
   /              \
Ja                Nein
 |                  |
 v                  v
Status setzen    Status bleibt
                 Item -> Blocking
                 Finding-Issue anlegen:
                 "[TARA-XXXX] PROCESS-VIOLATION: P-18 Vorbedingung fuer <nach> nicht erfuellt"
```

---

## Wer darf was setzen?

| Status-Uebergang          | Wer                        | Voraussetzung (P-18)                                                                                             |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Todo → PO Accepted**    | **GitHub Automation**      | P-26: gebundenes `PO Accepted TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten                               |
| PO Accepted → In Progress | Dev-Agent (nach P-18-OK)   | Status ist nachweislich „PO Accepted"                                                                            |
| In Progress → inReview    | Dev-Agent (nach P-18-OK)   | Tests gruen, Prettier, ESLint, Commit gepusht                                                                    |
| inReview → In Progress    | Dev-Agent                  | Critical/High Finding gefunden, Fix noetig                                                                       |
| **inReview → Accepted**   | **GitHub Automation**      | P-25: PO-Akzeptanz auf PR (gebunden, nach Push) + SHA-aktueller Review-Nachweis                                  |
| **Accepted → PO Release** | **GitHub Automation**      | P-27: gebundenes `PO Release TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten, nach Erreichen von „Accepted" |
| **PO Release → Done**     | **GitHub Automation**      | Automatisch im selben Lauf wie Accepted → PO Release (P-27)                                                      |
| any → Label `blocked`     | Review-Agent/Prozess-Guard | P-18-Verletzung erkannt (Board-Status bleibt unveraendert, TARA-0121)                                            |
| Label `blocked` entfernen | Dev-Agent (nach PO-OK)     | Alle Blocking-Gruende behoben                                                                                    |

---

## Freigabe-Checkliste

Der Prozess-Guard gibt **gruenes Licht** (`PROCESS OK`) wenn:

- [ ] P-01 bis P-17 alle eingehalten
- [ ] Kein offenes `review-finding` mit Schwere Kritisch oder Hoch
- [ ] `pytest tests/test_TARA_XXXX.py --noconftest` → 0 Fehler
- [ ] Bei letzter Story eines Epics: P-17 ausgefuehrt (PO informiert)

Andernfalls: `PROCESS BLOCKED` + Finding-Issues anlegen.

---

## Finding-Format

**Titel:** `[TARA-XXXX] PROCESS-VIOLATION: Regel P-XX verletzt`  
**Labels:** `process-violation` (+ `blocked` bei Kritisch)

```markdown
## Prozess-Finding

**Story:** TARA-XXXX  
**Regel:** P-XX – <Regelname>  
**Schwere:** Kritisch | Hoch | Mittel

### Problem

<Was wurde nicht eingehalten?>

### Erwartung

<Was hätte getan werden sollen?>

### Aktion

<Was muss der Dev-Agent jetzt tun?>
```

---

## Compliance-Bericht (Session-Ende)

```
## Prozess-Compliance-Bericht
Session:          <Datum>
Bearbeitete Items: TARA-XXXX, ...

| Regel | Status | Finding |
|-------|--------|---------|
| P-01  | ✅/❌  | –/#Nr  |
...

Gesamt-Compliance: XX% (X/15 Regeln eingehalten)
Freigabe: ✅ PROCESS OK / ❌ PROCESS BLOCKED
```
