# Review-Agent Workflow

**Version:** 1.0 | **Stand:** 2026-08-02 | **Branch:** Development

---

## Überblick

Der Review-Agent ist ein separater Copilot-Sub-Agent. Er prüft Änderungen **unabhängig vom Dev-Agent** und kommuniziert ausschließlich über GitHub Issues (Label: `review-finding`).

> **Abgrenzung zu `process-violation` (TARA-0116):** `review-finding` ist
> ausschliesslich fuer inhaltliche Review-Agent-Findings (R-01 bis R-36)
> reserviert. Deterministisch vom Process Guard festgestellte Regelverstoesse
> (P-01 bis P-27) erhalten stattdessen das eigene Label `process-violation`
> (siehe `agents/process_guard/PROCESS_GUARD_AGENT.md`).

```
Dev-Agent implementiert Story
        ↓
Dev-Agent setzt Item auf "inReview" und aktiviert Review-Agent
        ↓
Review-Agent analysiert Diff / geänderte Dateien
        ↓
Review-Agent öffnet GitHub Issues mit Label review-finding
        ↓
Dev-Agent sieht Findings als Issues im Board – kein direkter Dialog
```

---

## Aktivierung

Der Dev-Agent übergibt beim Aufruf:

```
Story-ID:          TARA-XXXX
Branch:            feature/TARA-XXXX-kurzbeschreibung
PR-Nummer:         <NNN>
Geänderte Dateien: [Liste]
Commit:            <SHA>
TDD-Tests:         tests/test_TARA_XXXX.py (PASSED)
```

### Unabhaengige Diff-Verifikation (TARA-0102)

Die vom Dev-Agent übergebene Dateiliste ist eine Selbstauskunft und kann
unvollständig oder fehlerhaft sein. Der Review-Agent verifiziert die
tatsächlich geänderten Dateien daher **unabhängig** selbst, bevor er den
Prüfkatalog anwendet:

```bash
gh pr diff <PR-Nummer> --name-only
# oder, falls kein PR vorhanden:
git diff --name-only <Base-Branch>...<Branch>
```

Weicht das Ergebnis von der übergebenen Liste ab, wird dies im Review-Bericht
vermerkt und die zusätzlich gefundenen Dateien werden in den Prüfumfang
aufgenommen.

### Runtime-Scanner-Aktivierung (TARA-0038 Browser Runtime Introspection)

Für Stories mit Browser-Laufzeitprüfung wird zusätzlich übergeben:

```
App-URL:           file:///path/to/index.html  (oder http://localhost:PORT)
Base-Branch:       Development
Scanner-Module:    [console, network, dom, storage, performance, accessibility,
                    csp, service_worker, permissions, dom_xss, html_injection,
                    eval, cors, clickjacking, storage_deep]
```

Der Scanner wird aufgerufen mit:

```bash
python agents/review_agent/runtime_scanner.py \
  --url <APP_URL> \
  --output security/reports/ \
  --modules all
```

---

## Prüfkatalog

<!-- GENERATED:review-rules-table:START (docs/process_definition.yml, scripts/process_guard/generate_process_docs.py) -->

| Regel | Kategorie      | Beschreibung                                                                                                                                                                           |
| ----- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01  | Korrektheit    | Alle Akzeptanzkriterien der Story erfüllt                                                                                                                                              |
| R-02  | Korrektheit    | Keine offensichtlichen Logikfehler, Edge Cases behandelt                                                                                                                               |
| R-03  | Architektur    | IIFE-Pattern korrekt (nur Dateien mit internem State)                                                                                                                                  |
| R-04  | Architektur    | `_`-Prefix für intern konzipierte Funktionen                                                                                                                                           |
| R-05  | Architektur    | Nur `document.getElementById()`, kein `window.elementId`                                                                                                                               |
| R-06  | Architektur    | Script-Ladereihenfolge in `index.html` eingehalten                                                                                                                                     |
| R-07  | Sicherheit     | Keine neuen CDN-Abhängigkeiten ohne SRI-Hash                                                                                                                                           |
| R-08  | Sicherheit     | Kein `eval()`, keine unsichere DOM-Manipulation                                                                                                                                        |
| R-09  | Tests          | Alle bestehenden Tests weiterhin grün                                                                                                                                                  |
| R-10  | Tests          | Neue Funktionalität durch Story-Tests abgedeckt (TDD)                                                                                                                                  |
| R-11  | Qualität       | Kein duplizierter Code (DRY)                                                                                                                                                           |
| R-12  | Qualität       | Keine auskommentierten Code-Blöcke                                                                                                                                                     |
| R-13  | Runtime        | Konsolen-Fehler und -Warnungen erfasst (TARA-0040)                                                                                                                                     |
| R-14  | Runtime        | Fehlgeschlagene Netzwerkaufrufe erkannt (TARA-0041)                                                                                                                                    |
| R-15  | Runtime        | DOM-Zustand und Event-Listener-Leaks geprüft (TARA-0042)                                                                                                                               |
| R-16  | Runtime        | localStorage, sessionStorage, Cookies analysiert (TARA-0043)                                                                                                                           |
| R-17  | Runtime        | Performance-Timing und Speicherentwicklung gemessen (TARA-0044)                                                                                                                        |
| R-18  | Runtime        | Accessibility-Tree auf ARIA-Verletzungen geprüft (TARA-0045)                                                                                                                           |
| R-19  | Runtime        | CSP-Verletzungen und unbehandelte Promise-Rejections erfasst (TARA-0046)                                                                                                               |
| R-20  | Runtime        | Service-Worker-Verhalten und Cross-Origin-Kommunikation überwacht (TARA-0047)                                                                                                          |
| R-21  | Runtime        | Browser-Berechtigungen inventarisiert (TARA-0048)                                                                                                                                      |
| R-22  | Sicherheit     | DOM-XSS-Sinks erkannt – innerHTML, document.write etc. (TARA-0050)                                                                                                                     |
| R-23  | Sicherheit     | HTML-Injection in dynamisch gerenderte Inhalte geprüft (TARA-0051)                                                                                                                     |
| R-24  | Sicherheit     | Ressourcen-Manipulation via script/link src geprüft (TARA-0051)                                                                                                                        |
| R-25  | Sicherheit     | eval()/Function()-Aufrufe zur Laufzeit erkannt (TARA-0052)                                                                                                                             |
| R-26  | Sicherheit     | CORS-Header auf Wildcard + Credentials geprüft (TARA-0053)                                                                                                                             |
| R-27  | Sicherheit     | Clickjacking-Schutz (X-Frame-Options / CSP frame-ancestors) geprüft (TARA-0054)                                                                                                        |
| R-28  | Sicherheit     | Reverse-Tabnabbing – target=_blank ohne noopener erkannt (TARA-0054)                                                                                                                   |
| R-29  | Sicherheit     | Storage-Deep-Scan: sensible Schlüssel in localStorage/sessionStorage (TARA-0055)                                                                                                       |
| R-30  | Sicherheit     | XSSI-Risiko: SRI-Hash auf externen Skripten geprüft (TARA-0055)                                                                                                                        |
| R-31  | Sicherheit     | GitHub-Actions Script-Injection: keine `${{ github.event.*.body/title }}`-Interpolation direkt in `run:`-Blöcken, stattdessen `env:`                                                   |
| R-32  | Qualität       | Fehlendes Error-Handling um externe API-/GraphQL-Aufrufe in Workflows/Skripten (kein unkontrollierter Crash/Abbruch)                                                                   |
| R-33  | Qualität       | Regex-/Parsing-Robustheit (Wortgrenzen, Gross-/Kleinschreibung, Vergangenheitsformen, Negation) bei Text-Verarbeitung in Automatisierung                                               |
| R-34  | Architektur    | Stille Bypässe: fehlende Felder/Werte dürfen nicht automatisch als "OK"/bestanden gewertet werden (sicherheitshalber FAIL statt stillem PASS)                                          |
| R-35  | Kompatibilität | Datenmigration und Rückwärtskompatibilität: `localStorage`-Schemaänderungen dürfen bestehende gespeicherte Analysen nicht unlesbar machen (Migrationspfad oder Versionsfeld vorhanden) |
| R-36  | Abhängigkeiten | Neue/geänderte npm- oder pip-Abhängigkeiten: Lizenzkompatibilität geprüft, keine unerwarteten transitiven Abhängigkeiten mit inkompatibler Lizenz                                      |

<!-- GENERATED:review-rules-table:END -->

### Erweiterter Prüfkatalog für Nicht-Browser-Code (TARA-0102)

Der Katalog R-01–R-30 ist auf Browser-/JS-Code fokussiert. Aenderungen an
GitHub-Actions-Workflows, Bash- und Python-Automatisierungsskripten
(`agents/`, `scripts/`, `.github/workflows/`) werden zusaetzlich gegen die
folgenden Regeln geprueft — genau diese Kategorie war die Quelle der Findings
TARA-0090 bis TARA-0099, die vom bisherigen Katalog nicht erfasst wurden:

### Priorisierte neue Reviewdimensionen (TARA-0114)

Story TARA-0114 hat vorgeschlagen, den Prüfkatalog um 14 zusätzliche
Dimensionen zu erweitern (u.a. Recovery, Race Conditions,
Performance-Budget, Barrierefreiheit-Semantik). Die PO-Rückmeldung war,
**priorisiert/gestuft** vorzugehen statt alle 14 auf einmal aufzunehmen:
zunächst nur die beiden für TARATool als reines Browser-Tool relevantesten
Dimensionen. Weitere Dimensionen aus der Story können in Folge-Stories
schrittweise als weitere R-Regeln ergänzt werden.

---

## Finding-Format

**Titel:** `[TARA-XXXX] REVIEW-FINDING: <Kurzbeschreibung>`  
**Labels:** `review-finding` + `sp:1` (Aufwand zur Behebung)

> ⚠️ **Wichtig:** `TARA-XXXX` im Titel ist eine **neue, eindeutige ID** für das Finding selbst —
> **nicht** die Source-Story-ID. Jedes Finding erhält eine eigene ID via `get_next_tara_id()`.
> Die Source-Story wird im Body als `**Source-Story:**` referenziert.

```markdown
## Review Finding

**Finding-ID:** TARA-XXXX  
**Source-Story:** TARA-YYYY  
**Typ:** Bug | Architektur | Sicherheit | Test | Code-Qualität  
**Schwere:** Kritisch | Hoch | Mittel | Niedrig  
**Konfidenz:** 1-10  
**Regel:** R-XX  
**Datei:** `path/to/file.js` (Zeile X)

### Problem

<Beschreibung>

### Erwartung

<Was sollte stattdessen sein?>

### Vorschlag

<Konkreter Lösungsvorschlag>
```

### Schwere-Rubrik (TARA-0102)

Damit die Schwere-Einstufung nicht rein selbstattestiert und uneinheitlich bleibt,
gelten folgende verbindliche Kriterien pro Stufe (jeweils zusätzlich mit einem
**Konfidenz**-Wert 1-10 zu versehen, analog zum Security-Review-Skill):

| Schwere      | Kriterium                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Kritisch** | Ausnutzbare Sicherheitsluecke oder Datenverlust/-korruption im Produktivbetrieb wahrscheinlich          |
| **Hoch**     | Funktionaler Fehler mit direkter Nutzerauswirkung ODER Sicherheitsrisiko mit erschwerten Vorbedingungen |
| **Mittel**   | Strukturelles/architektonisches Problem ohne unmittelbare Nutzerauswirkung                              |
| **Niedrig**  | Stil-/Wartbarkeitsfrage ohne funktionale Auswirkung                                                     |

Nur Findings mit **Konfidenz ≥ 6** duerfen die Schwere "Kritisch"/"Hoch" erhalten;
bei geringerer Konfidenz wird die Schwere um eine Stufe reduziert und die
Unsicherheit im Finding-Body explizit vermerkt.

### Finding-Ablage-Differenzierung (TARA-0114)

Bisher erzeugte der Review-Agent für **jedes** Finding ≥ Mittel automatisch ein
eigenes GitHub-Issue mit neuer, globaler TARA-ID (`get_next_tara_id()`). Das
verwaltungsaufwendige Anlegen einer eigenen Issue-ID auch für triviale,
direkt behebbare Findings verwässert das Backlog. Der Review-Agent
differenziert die Ablage stattdessen nach **Finding-Art**:

| Finding-Art                              | Ablage                           |
| ---------------------------------------- | -------------------------------- |
| Direkt behebbares PR-Problem             | PR-Review-Kommentar (kein Issue) |
| Blockierendes Security-/Funktionsproblem | Finding-Issue (wie bisher)       |
| Akzeptierte technische Schuld            | Backlog-Story (statt Finding)    |
| Wiederkehrendes systemisches Problem     | Epic- oder Improvement-Issue     |

Technisch trägt jedes Finding-Dict optional ein Feld `disposition` mit einem
der Werte `pr_comment`, `finding_issue`, `backlog_story` oder
`systemic_issue`. `report_builder.create_github_issues_for_findings()`
respektiert dieses Feld:

- `pr_comment`: Es wird **kein** GitHub-Issue angelegt. Das Finding wird
  stattdessen als formatierter PR-Review-Kommentar zurückgegeben
  (`result["pr_comments"]`), den der Dev-/Review-Agent direkt im PR postet.
- `finding_issue`: Wie bisher – Issue mit Label `review-finding` + `sp:1`.
- `backlog_story`: Issue mit Label `story` (kein `review-finding`-Label,
  Titelformat `[TARA-XXXX] STORY: ...`), referenziert die Source-Story als
  Ursprung, aber **nicht** als blockierendes Finding.
- `systemic_issue`: Issue im Titelformat `[TARA-XXXX] EPIC: ...` (nicht
  `REVIEW-FINDING:`, da der Process-Guard-Issue-Checker diesen Praefix
  zwingend an das Label `review-finding` koppelt) mit Label `epic` (bei
  mehreren betroffenen Komponenten) bzw. zusaetzlich `enhancement` (bei
  einem einzelnen wiederkehrenden Muster).

**Interim-Regelung (PO-Entscheidung, TARA-0114):** Für die erste Umsetzung
setzte der Review-Agent `disposition` per **Selbsteinschaetzung** (analog zur
Schwere-Rubrik oben). Fehlt das Feld, gilt aus Rückwärtskompatibilität die
bisherige Regel (Mittel/Hoch/Kritisch → `finding_issue`, Niedrig → kein
Eintrag). Die dauerhafte, **deterministische Heuristik**, die diese
Selbsteinschätzung ersetzt, wurde in Folge-Story **#185 (TARA-0115)**
entwickelt - siehe Abschnitt "Ablage-Heuristik (TARA-0115)" unten (Antwort
auf die in #185 offen gelassene Frage 3, wer im Zweifel entscheidet).

---

### Ablage-Heuristik (TARA-0115)

Ersetzt die reine Review-Agent-Selbsteinschaetzung aus TARA-0114 durch eine
nachvollziehbare, auf **objektiven Finding-Merkmalen** basierende Regel
(`report_builder.resolve_disposition_heuristic()`), konsistent mit dem
Rollenmodell aus #178 (TARA-0108: keine LLM-Selbstattestierung fuer
prozessrelevante Entscheidungen).

**PO-Entscheidung zu Frage 1 (Issue #185):** Die Heuristik ist eine
**Leitplanke mit begründeter Abweichungsmöglichkeit** - kein striktes,
unumstoessliches Regelwerk. Der Review-Agent kann bewusst abweichen, muss
dies aber ueber das Feld `override_reason` explizit begruenden; ohne
Begruendung setzt die Heuristik ihr eigenes Ergebnis durch. Jede Abweichung
wird in `session.report["disposition_deviations"]` protokolliert (Process
Guard-Sichtbarkeit). **Ausnahme:** Das Sicherheitsnetz (Punkt 1 im
Entscheidungsbaum unten) wird IMMER VOR der Abweichungspruefung ausgewertet
und ist dadurch selbst mit `override_reason` nicht umgehbar.

**PO-Entscheidung zu Frage 2 (Issue #185):** Wiederholung wird
**automatisiert** erkannt (`count_similar_prior_findings()`, Suche unter
bestehenden `review-finding`-Issues nach Regel + Typ). Tritt ein Finding
wiederholt auf, wird **keine** neue Epic-Instanz angelegt, sondern eine
**Story**, die den Harness gezielt auf Prozessluecken bzgl. wiederholter
Findings untersucht (Titelformat `[TARA-XXXX] STORY: Prozessluecken-
Ueberpruefung - ...`, Label `story`).

**Entscheidungsbaum (objektive Merkmale, in Prüfreihenfolge):**

1. **Sicherheitsnetz (nicht abweichbar):** Kategorie `Sicherheit` **und**
   Schwere ≥ Hoch → immer `finding_issue`, nie `pr_comment`.
2. **Wiederholung** (`repeat_count` ≥ 1, automatisiert ermittelt) →
   `systemic_issue`, umgesetzt als Prozessluecken-Story (s.o.).
3. **Akzeptierte technische Schuld** (`accepted_debt: true`) →
   `backlog_story`.
4. **Direkt behebbar** (`fix_scope: "in_diff"` und Schwere ≤ Mittel) →
   `pr_comment`.
5. **Fallback:** bestehende Schwere-basierte Regel aus TARA-0114
   (Mittel/Hoch/Kritisch → `finding_issue`, Niedrig → kein Eintrag).

Neue optionale Finding-Felder: `category` (`Sicherheit`/`Architektur`/
`Test`/`Code-Qualitaet`), `repeat_count` (int, sonst automatisch ermittelt),
`accepted_debt` (bool), `fix_scope` (`in_diff`/`outside_diff`),
`override_reason` (str, erzwingt Protokollierung bei bewusster Abweichung).

---

## Unabhängigkeit des Review-Agent (TARA-0114)

Der Review-Agent ist laut Überblick oben "ein separater Copilot-Sub-Agent".
Diese Story präzisiert verbindlich, was "unabhängig" konkret bedeutet.
**Alle sieben Punkte sind Voraussetzung**, nicht optionale Empfehlungen:

1. **Separater Kontext:** Der Review-Agent läuft in einem eigenen Kontext
   ohne gemeinsamen Chat-/Gedächtnis-Verlauf mit dem Dev-Agent (technisch:
   eigener Sub-Agent-Aufruf, z.B. über das `task`-Tool mit
   `agent_type: code-review`, nicht als Fortsetzung derselben Konversation).
2. **Keine Übernahme der Dev-Agent-Begründung:** Der Review-Agent bewertet
   eigenständig, ob eine Änderung korrekt ist. Die vom Dev-Agent gelieferte
   Zusammenfassung/Begründung dient höchstens als Kontext-Hinweis, niemals
   als Ersatz für die eigene Prüfung.
3. **Eigene Diff-Verifikation:** Siehe "Unabhaengige Diff-Verifikation"
   oben (TARA-0102) — verbindliche Voraussetzung, nicht nur
   Abweichungs-Detektor: `gh pr diff --name-only` bzw. `git diff --name-only`
   wird in **jedem** Review ausgeführt, unabhängig von der Dateiliste des
   Dev-Agenten.
4. **Story und Akzeptanzkriterien selbst lesen:** Der Review-Agent liest die
   Story/Akzeptanzkriterien direkt aus dem referenzierten GitHub-Issue,
   nicht aus einer Zusammenfassung des Dev-Agenten.
5. **Prüfung gegen unveränderlichen Commit-SHA:** Direkte Kopplung an Story
   #177/TARA-0107 — der SHA-gebundene JSON-Review-Nachweis
   (`reviewed_head_sha`) stellt sicher, dass ein Review-Ergebnis nach einem
   weiteren Push automatisch ungültig wird.
6. **Modell-Unabhängigkeit:** Es wird **kein separates Pflicht-Modell**
   vorgeschrieben (PO-Entscheidung, TARA-0114: "immer den Development
   Agenten anziehen" — gemeint ist, dass der Review-Agent als eigener
   Sub-Agent-**Typ** (`code-review`) aufgerufen wird, unabhängig davon,
   welches konkrete Modell der Dev-Agent für die Story-Implementierung
   selbst nutzt). Ein expliziter `model`-Parameter kann bei Bedarf gesetzt
   werden, ist aber nicht verbindlich vorgeschrieben.
7. **Least-Privilege-Zugriff:** Der Review-Agent hat **keine Schreibrechte**
   auf den Feature-Code — nur Leserechte auf den Diff plus das Recht,
   Checks/PR-Kommentare zu erzeugen. Direkte Kopplung an Story #178/
   TARA-0108 (Rollentrennung Dev-/Review-Agent/Process Guard): der
   Review-Agent darf Findings melden und Board-Labels setzen
   (`_set_story_blocked`), aber keine Datei-Änderungen am geprüften Code
   vornehmen.

---

## Merge-Freigabe (Statusmodell B, seit TARA-0110: PO-Akzeptanz VOR Merge)

| Ergebnis           | Vorgehen                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Keine Findings     | Gebundene PO-Akzeptanz auf PR abwarten (P-25) → Item automatisch **Accepted**, danach Merge → Done |
| Nur Niedrig/Mittel | PR möglich, Findings als neue Backlog-Items anlegen, dann wie oben → **Accepted**                  |
| Hoch/Kritisch      | Item zurück auf „In Progress", Findings zuerst beheben                                             |

### Technischer P-10-Nachweis (TARA-0089, SHA-gebunden seit TARA-0107)

Der urspruengliche Nachweis aus TARA-0089 (Freitext-Marker
`Review-Agent: OK - keine Findings` / `Review-Agent: Findings siehe #<NNN>`) war
faelschbar: er bewies nicht, welcher Agent geprueft hat, welchen Commit er
geprueft hat, welcher Pruefkatalog verwendet wurde, und ob danach weitere
Aenderungen gepusht wurden. Jeder – auch der Dev-Agent oder ein Mensch – konnte
diesen Text schreiben. Seit TARA-0107 ist dieser Freitext-Marker **kein
gueltiger Nachweis mehr**.

Stattdessen veroeffentlicht der Review-Agent nach jeder Pruefung einen
maschinenlesbaren JSON-Block als PR-Kommentar:

```json
{
  "story": "TARA-0107",
  "pull_request": 123,
  "reviewed_head_sha": "abc123...",
  "review_profile_version": "2.1",
  "result": "passed",
  "critical": 0,
  "high": 0,
  "timestamp": "2026-09-28T08:00:00Z",
  "findings_issue": null
}
```

Pflichtfelder: `story`, `pull_request`, `reviewed_head_sha`,
`review_profile_version`, `result`, `critical`, `high`, `timestamp`.
`findings_issue` (optional) referenziert ein `review-finding`-Issue, falls
`critical`/`high` > 0 sind – ohne diese Referenz gilt ein Ergebnis mit offenen
Critical/High-Findings als blockierend.

`process-guard.yml` (Schritt "P-10 – Review-Agent-Nachweis vorhanden") laedt
bei jedem PR gegen `development`/`main` alle PR-Kommentare inkl. Zeitstempel
und den aktuellen `head.sha` und ruft
`scripts/process_guard/check_review_agent_invoked.sh <COMMENTS_JSON_FILE> <PR_HEAD_SHA>`
auf. Dieses Skript delegiert an
`scripts/process_guard/review_result_parser.py`, das:

1. den zuletzt veroeffentlichten vollstaendigen JSON-Block extrahiert,
2. prueft, dass `reviewed_head_sha` exakt dem aktuellen PR-Head-SHA entspricht
   (ein Push NACH dem Review invalidiert den Nachweis automatisch – der Check
   schlaegt dann fehl, bis ein neues Review-Ergebnis fuer den neuen Head-SHA
   vorliegt),
3. prueft, dass keine offenen Critical/High-Findings ohne `findings_issue`
   vorliegen.

Fehlt ein gueltiger, SHA-aktueller JSON-Block, schlaegt der Check fehl und der
PR ist nicht mergefaehig.

---

## Finding-Abschluss

Ein Review-Finding-Issue (Label `review-finding`) wird **unabhaengig vom Board-Status
der Source-Story** abgeschlossen. Es gibt genau zwei zulaessige Wege, ein Finding zu
schliessen:

### Fall A – Direkter Fix

Das Finding wird durch einen Fix-Commit auf dem Branch der Source-Story behoben.

1. Fix implementieren, Tests ergaenzen/anpassen, Commit erstellen. Der Commit/PR referenziert
   das Finding-Issue ausschliesslich mit `Bezug: #<Finding-Issue>` – **niemals** mit einem
   GitHub-Auto-Close-Keyword (`Closes`/`Fixes`/`Resolves` etc.), da Finding-Issues laut P-19
   nicht automatisch beim Merge geschlossen werden duerfen.
2. Sobald der Fix-Commit **gepusht** ist, darf das Finding-Issue **sofort** geschlossen werden
   (Kommentar mit Verweis auf Commit-SHA/PR). Das ist **entkoppelt** vom aktuellen Board-Status
   der Source-Story: Die Source-Story durchlaeuft weiterhin eigenstaendig den vollen Workflow
   (Todo → In Progress → inReview → Accepted → Done); das Finding muss nicht auf deren
   Accepted/Done warten.

### Fall B – Folge-Story (keine direkte Fix)

Das Finding schlaegt keine direkte Code-Aenderung vor, sondern eine groessere/strukturelle
Verbesserung (typischerweise am Vorschlag "Folge-Story" im Finding-Body erkennbar, z.B.
Architektur-Findings mit Schwere Mittel/Niedrig ohne konkreten Patch).

1. Der Dev-Agent legt **zuerst** ein neues Story-Issue an (naechste freie TARA-ID via
   `get_next_tara_id()`, Label `story`), das die Verbesserung beschreibt und das
   Finding-Issue referenziert (`Bezug: #<Finding-Issue>`).
2. **Erst danach** darf das Finding-Issue geschlossen werden. Der Schliess-Kommentar
   referenziert die neue Story (z.B. "Ueberfuehrt in Story #<Nr>").
3. Auch hier gilt: kein GitHub-Auto-Close-Keyword im Story-Issue oder im PR, der das Finding
   referenziert (P-19).

> Siehe auch Regel **P-22** in `agents/process_guard/PROCESS_GUARD_AGENT.md` und
> `docs/ENTWICKLUNGSPROZESS.md`.

### Priorisierung akzeptierter Findings (P-22)

Setzt der PO ein Review-Finding-Issue durch einen Kommentar mit einem an die
TARA-ID des Finding-Issues GEBUNDENEN Freigabe-Kommando (TARA-0109, z.B.
`akzeptiert TARA-XXXX`; lose Keywords ohne ID-Bindung reichen seit TARA-0109
nicht mehr aus) auf **akzeptiert**, gilt:

1. Der Dev-Agent setzt den Board-Status des Finding-Issues **unmittelbar** auf
   **"In Progress"** (Audit-Trail-Kommentar mit Verweis auf den PO-Freigabe-Kommentar,
   P-02/P-20).
2. Akzeptierte Findings werden **vor** allen anderen bereits "In Progress" befindlichen
   Stories bearbeitet – sie haben Prioritaet gegenueber laufender Story-Arbeit, die noch
   keinen entsprechenden Freigabe-Kommentar hat. Der Dev-Agent unterbricht dazu keine
   angefangene Story mitten in einem Commit, sondern arbeitet begonnene Einheiten
   (Red/Green-Zyklus) zu Ende, bevor er zu den priorisierten Findings wechselt, plant aber
   die naechste Arbeitseinheit anhand dieser Prioritaet.
3. Diese Prioritaets-Regel gilt zusaetzlich zu und unabhaengig von Fall A/Fall B oben:
   Sie bestimmt **wann** ein akzeptiertes Finding bearbeitet wird, Fall A/B bestimmen
   **wie** es anschliessend geschlossen wird.

## Scope-Entscheidung: Welche R-Checks laufen wann?

| Änderungen betreffen                                                                                     | Pflicht-Checks                                                                        | Optionale Checks                           |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------ |
| `js/`, `index.html`                                                                                      | R-01–R-12 + R-22–R-30                                                                 | R-13–R-21 (Runtime, nur wenn App startbar) |
| `agents/`, `scripts/`, `.github/workflows/`                                                              | R-01–R-12 + R-31–R-34                                                                 | R-22–R-30 entfallen (kein Browser-Code)    |
| `tests/`                                                                                                 | R-09, R-10                                                                            | –                                          |
| `docs/`, `*.md`                                                                                          | R-01                                                                                  | –                                          |
| `package.json`, `requirements.txt`, `tests/requirements.txt`, `localStorage`-Schemaänderungen (in `js/`) | R-35, R-36 (zusätzlich zu den oben genannten Pflicht-Checks des jeweiligen Dateityps) | –                                          |

**Runtime-Checks (R-13–R-30) sind Pflicht** für alle Commits, die `index.html`, `js/` oder
`agents/review_agent/` verändern. Sie erfordern eine lauffähige App-Instanz.

### Skip-Eskalation (TARA-0102)

Wird keine App-URL übergeben, **entfallen R-13–R-30 nicht mehr stillschweigend**:
Der Review-Agent vermerkt dies weiterhin als `[SKIP Runtime: kein App-URL übergeben]`
im Finding-Bericht, erzeugt zusätzlich aber eine **Eskalation** — einen expliziten
Pflicht-Hinweis im PR-Kommentar (`⚠️ Eskalation: Runtime-/Security-Checks R-13–R-30
uebersprungen, da keine App-URL uebergeben wurde. Dev-Agent muss dies begruenden
oder eine App-URL nachreichen.`), der vom Dev-Agent im PR aktiv bestaetigt oder
durch Nachreichen einer App-URL aufgeloest werden muss, bevor der PR gemergt wird.
