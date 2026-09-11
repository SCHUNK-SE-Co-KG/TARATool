# Review-Agent Workflow

**Version:** 1.0 | **Stand:** 2026-08-02 | **Branch:** Development

---

## Ãœberblick

Der Review-Agent ist ein separater Copilot-Sub-Agent. Er prüft Ã„nderungen **unabhängig vom Dev-Agent** und kommuniziert ausschlieÃŸlich über GitHub Issues (Label: `review-finding`).

```
Dev-Agent implementiert Story
        â†“
Dev-Agent setzt Item auf "Review" und aktiviert Review-Agent
        â†“
Review-Agent analysiert Diff / geänderte Dateien
        â†“
Review-Agent öffnet GitHub Issues mit Label review-finding
        â†“
Dev-Agent sieht Findings als Issues im Board â€“ kein direkter Dialog
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

| #    | Bereich     | Prüfung                                                                          |
| ---- | ----------- | -------------------------------------------------------------------------------- |
| R-01 | Korrektheit | Alle Akzeptanzkriterien der Story erfüllt                                        |
| R-02 | Korrektheit | Keine offensichtlichen Logikfehler, Edge Cases behandelt                         |
| R-03 | Architektur | IIFE-Pattern korrekt (nur Dateien mit internem State)                            |
| R-04 | Architektur | `_`-Prefix für intern konzipierte Funktionen                                     |
| R-05 | Architektur | Nur `document.getElementById()`, kein `window.elementId`                         |
| R-06 | Architektur | Script-Ladereihenfolge in `index.html` eingehalten                               |
| R-07 | Sicherheit  | Keine neuen CDN-Abhängigkeiten ohne SRI-Hash                                     |
| R-08 | Sicherheit  | Kein `eval()`, keine unsichere DOM-Manipulation                                  |
| R-09 | Tests       | Alle bestehenden Tests weiterhin grün                                            |
| R-10 | Tests       | Neue Funktionalität durch Story-Tests abgedeckt (TDD)                            |
| R-11 | Qualität    | Kein duplizierter Code (DRY)                                                     |
| R-12 | Qualität    | Keine auskommentierten Code-Blöcke                                               |
| R-13 | Runtime     | Konsolen-Fehler und -Warnungen erfasst (TARA-0040)                               |
| R-14 | Runtime     | Fehlgeschlagene Netzwerkaufrufe erkannt (TARA-0041)                              |
| R-15 | Runtime     | DOM-Zustand und Event-Listener-Leaks geprüft (TARA-0042)                         |
| R-16 | Runtime     | localStorage, sessionStorage, Cookies analysiert (TARA-0043)                     |
| R-17 | Runtime     | Performance-Timing und Speicherentwicklung gemessen (TARA-0044)                  |
| R-18 | Runtime     | Accessibility-Tree auf ARIA-Verletzungen geprüft (TARA-0045)                     |
| R-19 | Runtime     | CSP-Verletzungen und unbehandelte Promise-Rejections erfasst (TARA-0046)         |
| R-20 | Runtime     | Service-Worker-Verhalten und Cross-Origin-Kommunikation überwacht (TARA-0047)    |
| R-21 | Runtime     | Browser-Berechtigungen inventarisiert (TARA-0048)                                |
| R-22 | Sicherheit  | DOM-XSS-Sinks erkannt â€“ innerHTML, document.write etc. (TARA-0050)             |
| R-23 | Sicherheit  | HTML-Injection in dynamisch gerenderte Inhalte geprüft (TARA-0051)               |
| R-24 | Sicherheit  | Ressourcen-Manipulation via script/link src geprüft (TARA-0051)                  |
| R-25 | Sicherheit  | eval()/Function()-Aufrufe zur Laufzeit erkannt (TARA-0052)                       |
| R-26 | Sicherheit  | CORS-Header auf Wildcard + Credentials geprüft (TARA-0053)                       |
| R-27 | Sicherheit  | Clickjacking-Schutz (X-Frame-Options / CSP frame-ancestors) geprüft (TARA-0054)  |
| R-28 | Sicherheit  | Reverse-Tabnabbing â€“ target=_blank ohne noopener erkannt (TARA-0054)           |
| R-29 | Sicherheit  | Storage-Deep-Scan: sensible Schlüssel in localStorage/sessionStorage (TARA-0055) |
| R-30 | Sicherheit  | XSSI-Risiko: SRI-Hash auf externen Skripten geprüft (TARA-0055)                  |

### Erweiterter Prüfkatalog für Nicht-Browser-Code (TARA-0102)

Der Katalog R-01–R-30 ist auf Browser-/JS-Code fokussiert. Aenderungen an
GitHub-Actions-Workflows, Bash- und Python-Automatisierungsskripten
(`agents/`, `scripts/`, `.github/workflows/`) werden zusaetzlich gegen die
folgenden Regeln geprueft — genau diese Kategorie war die Quelle der Findings
TARA-0090 bis TARA-0099, die vom bisherigen Katalog nicht erfasst wurden:

| #    | Bereich     | Prüfung                                                                                                                                       |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R-31 | Sicherheit  | GitHub-Actions Script-Injection: keine `${{ github.event.*.body/title }}`-Interpolation direkt in `run:`-Blöcken, stattdessen `env:`          |
| R-32 | Qualität    | Fehlendes Error-Handling um externe API-/GraphQL-Aufrufe in Workflows/Skripten (kein unkontrollierter Crash/Abbruch)                          |
| R-33 | Qualität    | Regex-/Parsing-Robustheit (Wortgrenzen, Gross-/Kleinschreibung, Vergangenheitsformen, Negation) bei Text-Verarbeitung in Automatisierung      |
| R-34 | Architektur | Stille Bypässe: fehlende Felder/Werte dürfen nicht automatisch als "OK"/bestanden gewertet werden (sicherheitshalber FAIL statt stillem PASS) |

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

---

## Merge-Freigabe

| Ergebnis           | Vorgehen                                                             |
| ------------------ | -------------------------------------------------------------------- |
| Keine Findings     | PR auf Development, Item â†’ **Freigabe** (PO-OK abwarten â†’ Done)  |
| Nur Niedrig/Mittel | PR möglich, Findings als neue Backlog-Items anlegen â†’ **Freigabe** |
| Hoch/Kritisch      | Item zurück auf â€žIn Progress", Findings zuerst beheben             |

### Technischer P-10-Nachweis (TARA-0089)

Damit die Aktivierung des Review-Agenten nicht rein dokumentarisch bleibt, prueft
`process-guard.yml` (Schritt "P-10 – Review-Agent-Nachweis vorhanden") bei jedem PR
gegen `development`/`main`, ob mindestens ein PR-Kommentar eines der beiden
maschinenlesbaren Marker enthaelt:

```
Review-Agent: OK - keine Findings
```

oder

```
Review-Agent: Findings siehe #<NNN>
```

(`<NNN>` = Nummer eines angelegten `review-finding`-Issues). Fehlt der Marker,
schlaegt der Check fehl (`scripts/process_guard/check_review_agent_invoked.sh`).
Der Dev-Agent muss also nach jeder Review-Agent-Aktivierung einen dieser
Kommentare im PR hinterlassen, bevor der PR gemergt werden kann.

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
   (Todo → In Progress → inReview → Freigabe → Done); das Finding muss nicht auf deren
   Freigabe/Done warten.

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

Setzt der PO ein Review-Finding-Issue durch einen Kommentar mit einem der
Freigabe-Schluesselwoerter (`PO-OK`, `Freigabe erteilt`, `freigegeben`, `akzeptiert`)
auf **akzeptiert**, gilt:

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

| Änderungen betreffen                        | Pflicht-Checks        | Optionale Checks                           |
| ------------------------------------------- | --------------------- | ------------------------------------------ |
| `js/`, `index.html`                         | R-01–R-12 + R-22–R-30 | R-13–R-21 (Runtime, nur wenn App startbar) |
| `agents/`, `scripts/`, `.github/workflows/` | R-01–R-12 + R-31–R-34 | R-22–R-30 entfallen (kein Browser-Code)    |
| `tests/`                                    | R-09, R-10            | –                                          |
| `docs/`, `*.md`                             | R-01                  | –                                          |

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
