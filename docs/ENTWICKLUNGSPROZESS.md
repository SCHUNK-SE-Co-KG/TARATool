# TARATool â€“ Entwicklungsprozess

| **PR-Checkliste** | `.github/pull_request_template.md` | Dev-Agent | TDD, Prettier, ESLint, Review, Freigabe |
| **Test-Framework** | `tests/README.md` | Dev-Agent | --noconftest, Marker, venv-Setup |

| Regel    | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Wann geprüft                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **P-01** | TARA-ID in jeder Chat-Antwort                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Laufend                                            |
| **P-02** | Status → In Progress VOR Arbeitsbeginn                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Story-Start                                        |
| **P-03** | Tests VOR Implementierung geschrieben                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Red-Phase                                          |
| **P-04** | Tests haben initial FEHLGESCHLAGEN                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Red-Phase                                          |
| **P-05** | Story-Tests vor Commit grün                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Vor Commit                                         |
| **P-06** | Alle Story-Tests grün vor PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Vor PR                                             |
| **P-07** | Branch: `feature/TARA-XXXX-*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Branch-Anlage                                      |
| **P-08** | Commits referenzieren TARA-ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Jeder Commit                                       |
| **P-09** | Status → inReview vor PR-Öffnung                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Vor PR                                             |
| **P-10** | Review-Agent aufgerufen, kein Critical/High offen                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Vor PR                                             |
| **P-11** | Nach Merge → Status bleibt "Accepted" (Sicherheitscheck), Audit-Kommentar gepostet; Done NUR noch via P-27 (`PO Release`, seit TARA-0121)                                                                                                                                                                                                                                                                                                                                                              | Nach Merge                                         |
| **P-12** | Prettier grün vor Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Vor Commit                                         |
| **P-13** | ESLint grün vor Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Vor Commit                                         |
| **P-14** | TARA-IDs unveränderlich (atomar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Jederzeit                                          |
| **P-15** | Done nur nach PO-OK als Issue-Kommentar (automatisch via po-approve.yml)                                                                                                                                                                                                                                                                                                                                                                                                                               | Nach Merge                                         |
| **P-16** | Feature-Branch nach Merge löschen                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Nach Merge                                         |
| **P-17** | Alle Epic-Stories Freigabe → development lokal pullen + PO per Issue informieren                                                                                                                                                                                                                                                                                                                                                                                                                       | Nach letztem Merge                                 |
| **P-18** | **Pre-Transition Check**: Prozess-Guard prüft Vorbedingungen **vor jedem** Status-Wechsel. Bei Verletzung: Issue-Label `blocked` setzen, Finding-Issue anlegen (Board-Status bleibt unveraendert, TARA-0121).                                                                                                                                                                                                                                                                                          | Vor jedem Status-Wechsel                           |
| **P-19** | Kein `Closes/Fixes/Resolves #NNN` im PR-Body (unterläuft P-11/P-15 durch Auto-Close). Stattdessen `Bezug: #NNN` verwenden.                                                                                                                                                                                                                                                                                                                                                                             | Vor PR / bei PR-Update                             |
| **P-20** | Audit-Trail-Kommentar bei jedem Board-Status-Wechsel (wann/warum/durch wen). PO-Freigabe-Keywords: `PO-OK`, `Freigabe erteilt`, `freigegeben`, `akzeptiert`, `Accepted`, `Ok`/`OK` (Story oder Epic).                                                                                                                                                                                                                                                                                                  | Bei jedem Status-Wechsel                           |
| **P-22** | **Review-Finding-Abschluss & Priorisierung**: Ein Finding-Issue wird nach direktem Fix-Commit sofort geschlossen (entkoppelt vom Status der Source-Story); erfordert das Finding eine strukturelle Verbesserung, wird zuerst eine Folge-Story angelegt, bevor das Finding schliesst. Vom PO akzeptierte Findings (Freigabe-Schluesselwort im Kommentar) werden sofort auf "In Progress" gesetzt und vor anderen laufenden Stories priorisiert bearbeitet. Details: `.github/agents/reviewer.agent.md`. | Beim Finding-Abschluss / bei PO-Freigabe-Kommentar |

# TARATool â€“ Entwicklungsprozess

**Dieses Dokument** beschreibt den vollständigen Entwicklungsprozess für das TARATool-Projekt.
Es richtet sich an den **Product Owner (PO)** und an **neue Dev-Agenten**, die mit der
Entwicklung starten möchten.

> **Für einen neuen Dev-Agenten:** Lies zuerst dieses Dokument komplett, dann
> `.github/agents/developer.agent.md` für die technische Einrichtung.

---

## Inhaltsverzeichnis

1. [Rollen und Verantwortlichkeiten](#1-rollen-und-verantwortlichkeiten)
2. [Projekt-Infrastruktur](#2-projekt-infrastruktur)
3. [Planungsebenen: Epic â†’ Story](#3-planungsebenen-epic--story)
4. [Der vollständige Story-Workflow](#4-der-vollständige-story-workflow)
5. [Board-Statusübergänge](#5-board-statusübergänge)
6. [Technische Qualitätssicherung](#6-technische-qualitätssicherung)
7. [Prozessregeln (P-01 bis P-27)](#7-prozessregeln-p-01-bis-p-27)
8. [Ausnahmen und Sonderfälle](#8-ausnahmen-und-sonderfälle)
9. [Dokumente auf einen Blick](#9-dokumente-auf-einen-blick)

---

## 1. Rollen und Verantwortlichkeiten

| Rolle                                                   | Wer                                   | Aufgaben                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product Owner (PO)**                                  | @NicoPeperSchunk                      | Epics/Stories genehmigen, Freigabe nach Merge, Done setzen                                                                                               |
| **Requirements-Agent** (seit TARA-0118)                 | Copilot Sub-Agent (separater Kontext) | Chat-Anforderung -> Story mit AC/Scope/Abhaengigkeiten, DoR-Pruefung; **keine fachliche Freigabe** - siehe `.github/agents/requirements.agent.md`        |
| **Dev-Agent**                                           | GitHub Copilot CLI                    | Implementierung, TDD, Commits, PRs                                                                                                                       |
| **Review-Agent**                                        | Copilot Sub-Agent                     | Code-Review, Finding-Issues erstellen                                                                                                                    |
| **Prozess-Guard**                                       | Copilot Sub-Agent                     | Workflow-Compliance prüfen (P-01â€“P-15)                                                                                                                 |
| **Acceptance-Agent** (seit TARA-0118, nur dokumentiert) | - (kein Code/Prototyp)                | Konzeptionelle Rolle: Entscheidungsgrundlage fuer PO-Abnahme aufbereiten; **keine eigene Freigabebefugnis** - siehe `.github/agents/acceptance.agent.md` |

### Kommunikationsregeln

- Dev-Agent **nennt in jeder Antwort** die aktive TARA-ID (z. B. `[TARA-0026]`)
- Dev-Agent **beginnt keine Arbeit** ohne explizite PO-Freigabe
- Review-Agent und Prozess-Guard kommunizieren **ausschlieÃŸlich über GitHub Issues**
  (Label: `review-finding`) â€” kein direkter Dialog mit dem Dev-Agent
- **PO-Freigabe fuer Story-/Epic-Start (Todo → PO Accepted, P-26, seit TARA-0121)** erfolgt
  ausschliesslich per **Issue-Kommentar** mit dem an die TARA-ID GEBUNDENEN Kommando
  `PO Accepted TARA-XXXX` (Story- oder Epic-Issue). Die alte lose Keyword-Liste (`PO-OK`,
  `freigegeben`, `akzeptiert`, `Accepted`, `Ok`/`OK` usw.) autorisiert diesen Uebergang
  **nicht mehr allein** - sie bleibt fuer andere, nicht-kritische Hinweise als
  Audit-Kommentar erhalten.
- **PO-Freigabe fuer den finalen Release (Accepted → PO Release → Done, P-27, seit
  TARA-0121)** erfolgt ausschliesslich per gebundenem Kommando `PO Release TARA-XXXX`,
  nachdem der Status bereits **Accepted** ist (PR gemergt).
- Die GitHub-Automation (`po-approve.yml`, `scripts/process_guard/check_po_accepted_keyword.sh`,
  `check_po_release_keyword.sh`) erkennt diese gebundenen Kommandos und setzt den Status
  automatisch (Wortgrenzen-Erkennung verhindert False-Positives).
- **Audit-Trail (P-20, TARA-0086)**: Bei jedem Statuswechsel hinterlaesst der Dev-Agent einen
  kurzen Kommentar im betroffenen Issue, z. B.:
  `P-02: Status Todo -> In Progress (PO-Freigabe: "akzeptiert", Kommentar von @po-user)`.
  Damit ist im Nachhinein nachvollziehbar, wann/warum/durch wen ein Wechsel erfolgte.

### Merge-Berechtigung des Dev-Agents

Der Dev-Agent darf **eigenstaendig mergen** wenn:

1. Review abgeschlossen (keine offenen Critical/High Findings)
2. Prozess-Guard: PROCESS OK
3. Alle Story-Tests gruen
4. **Statusmodell B (seit TARA-0110, P-25):** PO-Akzeptanz-Gate erfuellt (Status
   bereits auf **Accepted**) - Merge nach `development` ist technisch ueber einen
   required Status-Check blockiert, solange dieses Gate nicht erfuellt ist.

Nach dem Merge: Status bleibt **Accepted** (Sicherheitscheck, P-11), Done wird
NUR noch ueber P-27 gesetzt (gebundenes `PO Release TARA-XXXX`-Kommando,
seit TARA-0121).

### Epic-Batch-Testing (Regel P-17)

Wenn **alle Stories eines Epics** auf **Accepted** (bzw. bereits **Done**) stehen:

1. Dev-Agent zieht `development` lokal (git pull)
2. Dev-Agent informiert PO im Epic-Issue: "Alle Stories des Epic TARA-XXXX sind auf Accepted/Done - bitte testen"
3. PO testet den aktuellen Stand auf dem development-Branch
4. PO kommentiert im Epic-Issue mit einem der Freigabe-Schluesselwoerter (siehe **P-20**:
   `PO-OK`, `Freigabe erteilt`, `freigegeben`, `akzeptiert`, `Accepted`, `Ok`/`OK`)
5. GitHub-Automation (po-approve.yml) setzt alle betroffenen Stories automatisch auf **Done**

---

## 2. Projekt-Infrastruktur

### Repository

```
https://github.com/SCHUNK-SE-Co-KG/TARATool
Branch: development  ← aktiver Entwicklungszweig
Branch: main         ← Stable Releases
```

### Branch-Struktur

```
main
  └── development          ← Integration, immer lauffähig
        └── feature/TARA-XXXX-kurzbeschreibung
```

**Regel:** Kein direktes Pushen auf `main` oder `development`.
Jede Story bekommt einen eigenen Feature-Branch.

### GitHub Project Board

Board: **TARATool**
→ https://github.com/orgs/SCHUNK-SE-Co-KG/projects/4

Technische IDs für API-Zugriff: siehe `docs/GITHUB_BOARD.md`

---

## 3. Planungsebenen: Epic â†’ Story

### Epic

Ein Epic gruppiert mehrere zusammengehörige Stories. Epics haben keine eigene
Implementierung â€” sie dienen der Ãœbersicht und Priorisierung.

**Format:** `[TARA-XXXX] EPIC: Titel`
**Label:** `epic`

### Story

Eine Story ist eine einzelne, abgeschlossene Entwicklungsaufgabe mit klaren
Akzeptanzkriterien.

**Format:** `[TARA-XXXX] STORY: Titel`
**Labels:** `story`, `sp:N` (Story Points)

### Story Points (Fibonacci)

| SP  | Bedeutung                    |
| --- | ---------------------------- |
| 1   | Trivial (< 30 min)           |
| 2   | Klein (< 2h)                 |
| 3   | Mittel (halber Tag)          |
| 5   | GroÃŸ (1 Tag)                |
| 8   | Sehr groÃŸ (2 Tage)          |
| 13  | XL (> 2 Tage â†’ aufteilen!) |

### TARA-ID vergeben

IDs sind **fortlaufend, atomar und unveränderlich**. Nächste freie ID ermitteln:

```bash
gh issue list --state all --limit 200 --json title \
  | python3 -c "
import sys, json, re
issues = json.load(sys.stdin)
ids = [int(m.group(1)) for t in issues for m in [re.search(r'TARA-(\d+)', t['title'])] if m]
print(f'Nächste ID: TARA-{max(ids)+1:04d}')
"
```

### Definition of Ready (DoR)

Eine Story darf erst bearbeitet werden, wenn alle folgenden Punkte erfüllt sind:

| Kriterium                     | Prüfung                                       |
| ----------------------------- | --------------------------------------------- |
| TARA-ID vergeben              | TARA-XXXX im Titel                            |
| Akzeptanzkriterien vorhanden  | Mindestens 2 Kriterien im Issue-Body          |
| Story Points geschätzt        | Label sp:N gesetzt                            |
| Kein offenes Blocking-Finding | Kein Issue mit Label blocked + dieser TARA-ID |
| Epic aktiv (In Progress)      | Übergeordnetes Epic nicht Done/geschlossen    |
| PO-Freigabe                   | Explizites OK per Chat                        |

### Epic-Completion-Regel

Ein Epic wechselt auf **Done**, wenn alle zugehörigen Stories Done sind.

1. Dev-Agent prüft nach jeder Story-Fertigstellung, ob alle Child-Stories Done sind.
2. Wenn ja: Epic-Status auf **Accepted** setzen, PO bestätigt -> **Done**.
3. Ein Epic geht **nicht** direkt auf Done (P-25 gilt auch für Epics).

---

## 4. Der vollständige Story-Workflow

> **Optionaler Schritt -1 (seit TARA-0118): Requirements-Agent.** Bei
> einer neuen, noch unstrukturierten Chat-Anforderung kann der PO vor
> Schritt 0 den **Requirements-Agent** (separater Sub-Agent-Kontext,
> siehe `.github/agents/requirements.agent.md`) aktivieren.
> Dieser erstellt/ergaenzt das Story-Issue (Akzeptanzkriterien, Scope/
> Nicht-Scope, Abhaengigkeiten) und prueft die Definition-of-Ready-
> Checkliste (Abschnitt 3). Der Requirements-Agent hat **keine
> fachliche Freigabe-Befugnis** - die Freigabe (Schritt 0) bleibt
> ausschliesslich beim PO. Bereits vollstaendige Stories koennen diesen
> Schritt ueberspringen.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 0 â€“ PO genehmigt Story                                 â”‚
â”‚  â€¢ Epic muss genehmigt und In Progress sein                     â”‚
â”‚  â€¢ PO gibt Story per Chat frei: "TARA-XXXX freigegeben"        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 1 â€“ Setup (Dev-Agent)                                  â”‚
â”‚  â€¢ Status â†’ "In Progress" im Board                              â”‚
â”‚  â€¢ Branch anlegen:                                              â”‚
â”‚    git checkout Development && git pull origin Development      â”‚
â”‚    git checkout -b feature/TARA-XXXX-kurzbeschreibung           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 2 â€“ Tests schreiben âš ï¸ TDD RED-PHASE                   â”‚
â”‚  â€¢ Datei anlegen: tests/test_TARA_XXXX.py                       â”‚
â”‚  â€¢ Alle Akzeptanzkriterien als pytest-Tests abbilden            â”‚
â”‚  â€¢ Tests ausführen â†’ müssen FEHLSCHLAGEN                        â”‚
â”‚    pytest tests/test_TARA_XXXX.py --noconftest -v               â”‚
â”‚    â†’ Expected: FAILED (beweist Testvalidität!)                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 3 â€“ Implementierung (TDD GREEN-PHASE)                  â”‚
â”‚  â€¢ Feature implementieren                                       â”‚
â”‚  â€¢ Iterieren bis alle Story-Tests grün sind                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 4 â€“ Qualitätssicherung vor Commit (Pflicht)            â”‚
â”‚  4a  npm run format:check   â†’ Prettier: 0 Fehler               â”‚
â”‚      (Fehler? â†’ npm run format:write, dann erneut prüfen)       â”‚
â”‚  4b  npm run lint           â†’ ESLint: Exit-Code 0              â”‚
â”‚  4c  pytest test_TARA_XXXX.py --noconftest -v  â†’ PASSED         â”‚
â”‚  4d  Commit: "TARA-XXXX: Beschreibung"                          â”‚
â”‚      git push origin feature/TARA-XXXX-...                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 5 â€“ Code Review (Review-Agent)                         â”‚
â”‚  â€¢ Status â†’ "inReview" im Board                                 â”‚
â”‚  â€¢ Dev-Agent aktiviert Review-Agent als Sub-Agent               â”‚
â”‚  â€¢ Review-Agent erstellt Findings als GitHub Issues             â”‚
â”‚  â€¢ Dev-Agent behebt Findings (Critical/High: Pflicht)           â”‚
â”‚  âš ï¸ Prototypen: Review-Agent kann entfallen (PO-Genehmigung)    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
+------------------------------------------------------------------+
|  SCHRITT 6 - Prozess-Guard                                        |
|  * Dev-Agent aktiviert Prozess-Guard als Sub-Agent                |
|  * Guard prueft P-01 bis P-13 sowie P-25 (PO-Akzeptanz-Gate) und  |
|    P-26 (Status "PO Accepted" vor Story-Start nachgewiesen)       |
|  * OK: PROCESS OK -> PR auf development oeffnen (Dev-Agent)       |
|  * FEHLER: PROCESS BLOCKED -> Findings beheben, zurueck zu Schritt 4 |
+------------------------------------------------------------------+
                            |
                            v
+------------------------------------------------------------------+
|  SCHRITT 7 - PO-Akzeptanz VOR Merge (Statusmodell B, P-25)        |
|  * PO prueft PR/Story im Browser bzw. auf dem Feature-Branch      |
|  * PO postet ein an die TARA-ID GEBUNDENES Akzeptanz-Kommando     |
|    auf dem PR selbst (z.B. "TARA-XXXX akzeptiert")                |
|  * Automation setzt Status -> "Accepted" (inReview -> Accepted)   |
|  * Merge nach development ist erst jetzt technisch zulaessig      |
+------------------------------------------------------------------+
                            |
                            v
+------------------------------------------------------------------+
|  SCHRITT 8 - Merge (automatisch -> Done)                          |
|  * PR auf Development mergen (Dev-Agent, nach P-25-OK)            |
|  * Feature-Branch wird geloescht (P-16)                          |
|  * Status -> "PO Release" NUR nach gebundenem "PO Release         |
|    TARA-XXXX"-Kommando eines Nutzers mit Schreibrechten (P-27,    |
|    TARA-0121) - danach automatisch -> "Done"                      |
+------------------------------------------------------------------+
```

---

## 5. Board-Statusübergänge

```
Todo --> PO Accepted --> In Progress --> inReview --> Accepted --> (Merge) --> PO Release --> Done
          (Automation)   (Dev-Agent)     (Dev-Agent)   (Automation)              (Automation)   (Automation)
```

| Status          | Bedeutung                                                                        | Wer setzt                     |
| --------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| **Todo**        | Geplant, noch nicht begonnen                                                     | -                             |
| **PO Accepted** | PO hat die Bearbeitung erlaubt (P-26, TARA-0121)                                 | GitHub Automation             |
| **In Progress** | Aktiv in Bearbeitung                                                             | Dev-Agent (vor Arbeitsbeginn) |
| **inReview**    | Review laeuft, PR offen                                                          | Dev-Agent                     |
| **Accepted**    | PO-Akzeptanz auf PR erteilt (P-25), wartet auf Merge                             | GitHub Automation             |
| **PO Release**  | PO hat den gemergten Stand fachlich/releasebezogen freigegeben (P-27, TARA-0121) | GitHub Automation             |
| **Done**        | Nach PO Release automatisch gesetzt (P-27)                                       | GitHub Automation             |

Der fruehere Status "Blocking" entfaellt (PO-Entscheidung, TARA-0121);
blockierte Items werden ueber das Issue-Label `blocked` markiert
(Board-Status bleibt unveraendert).

---

## 6. Technische Qualitätssicherung

### Prettier (Formatierung)

```bash
npm run format:check   # Prüfen
npm run format:write   # Automatisch formatieren
```

Prettier läuft auf: JS, CSS, MD, HTML (auÃŸer `index.html` und `tests/*.py`)

### ESLint (Codequalität)

```bash
npm run lint           # Prüfen (js/-Verzeichnis)
```

- 0 Errors = Pflicht
- Warnings sind akzeptiert (pre-existing issues)

### Tests

```bash
# Story-Tests (immer --noconftest ohne Playwright)
cd tests
.venv/bin/pytest test_TARA_XXXX.py --noconftest -v

# Alle Story-Tests auf einmal
.venv/bin/pytest test_TARA_*.py --noconftest -q

# Vollständige E2E-Suite (nur mit Playwright)
.venv/bin/pytest -x -q
```

> âš ï¸ `conftest.py` initialisiert Playwright beim Import.
> Ohne `--noconftest` bricht der Test-Lauf ab, wenn Playwright nicht installiert ist.

---

## 7. Prozessregeln (P-01 bis P-27)

Der **Prozess-Guard** prueft **vor jedem Statuswechsel** (P-18) und am Ende jeder Story
die Einhaltung aller Regeln. Verletzungen werden als GitHub Issues mit Label `review-finding`
gemeldet und das Item zusaetzlich mit dem Issue-Label `blocked` markiert (Board-Status
bleibt unveraendert - der frühere Status "Blocking" entfaellt seit TARA-0121).

| Regel     | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Wann geprüft                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **P-01**  | TARA-ID in jeder Chat-Antwort                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Laufend                                            |
| **P-06b** | **Regressionsschutz bei gemeinsam genutztem Code (redefiniert TARA-0125)**: Aenderung an gemeinsam genutztem Code OHNE Risikopfad (P-06c) erzwingt KEINE sofortige volle Regression mehr je Story - sie wird auf das Epic-Batch-Gate (P-17) bzw. den Monatslauf (P-17b) verschoben.                                                                                                                                                                                                                    | Vor PR                                             |
| **P-06c** | **Risikobasierte Sofort-Regression (TARA-0125)**: Aenderung an einem Risikopfad (Datenmodell, Import/Export, Risikoberechnung, Report-Generierung, zentrale State-Verwaltung, Auth/Security, gemeinsame Basiskomponenten, Build-/Deployment-Konfig, Testinfrastruktur - siehe `scripts/process_guard/regression_risk_paths.txt`) erzwingt die volle Regressionssuite SOFORT, unabhaengig von P-17/P-17b.                                                                                               | Vor PR                                             |
| **P-06d** | **Risikobasierte Playwright-UI-Tests (TARA-0134)**: der Playwright-Job (`test:integration`/`test:e2e`, ci-tests.yml) laeuft bei PRs nur, wenn UI-/Browser-relevante Pfade veraendert wurden (siehe `scripts/process_guard/regression_risk_paths_ui.txt`) - sonst wird er uebersprungen (spart ~9,7 Min./PR). Sicherheitsnetz: Playwright-Tests laufen weiterhin IMMER bei push auf development/main sowie im Epic-Batch-Gate (P-17) und Monatslauf (P-17b).                                            | Vor PR                                             |
| **P-02**  | Status → In Progress VOR Arbeitsbeginn                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Story-Start                                        |
| **P-03**  | Tests VOR Implementierung geschrieben                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Red-Phase                                          |
| **P-04**  | Tests haben initial FEHLGESCHLAGEN                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Red-Phase                                          |
| **P-05**  | Story-Tests vor Commit grün                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Vor Commit                                         |
| **P-06**  | Alle Story-Tests grün vor PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Vor PR                                             |
| **P-07**  | Branch: `feature/TARA-XXXX-*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Branch-Anlage                                      |
| **P-08**  | Commits referenzieren TARA-ID                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Jeder Commit                                       |
| **P-09**  | Status → inReview vor PR-Öffnung                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Vor PR                                             |
| **P-10**  | Review-Agent aufgerufen, kein Critical/High offen                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Vor PR                                             |
| **P-11**  | Nach Merge → Status bleibt "Accepted" (Sicherheitscheck), Audit-Kommentar gepostet; Done NUR noch via P-27 (`PO Release`, seit TARA-0121)                                                                                                                                                                                                                                                                                                                                                              | Nach Merge                                         |
| **P-12**  | Prettier grün vor Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Vor Commit                                         |
| **P-13**  | ESLint grün vor Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Vor Commit                                         |
| **P-14**  | TARA-IDs unveränderlich (atomar)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Jederzeit                                          |
| **P-15**  | Done automatisch, sofern Status vorher „Accepted" war (Sicherheitscheck); seit TARA-0110 abgeloest durch P-25 als primaeren Merge-Gate (po-approve.yml bleibt manueller Fallback)                                                                                                                                                                                                                                                                                                                      | Nach Merge                                         |
| **P-16**  | Feature-Branch nach Merge löschen                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Nach Merge                                         |
| **P-17**  | **Epic-Batch-Testing (automatisiert TARA-0125)**: sobald alle Sub-Issues eines Epics Accepted/PO Release/Done sind, laeuft automatisch EINMAL die volle Regressionssuite fuer das Epic; bei Gruen wird automatisch ein Release-PR `development` → `main` erstellt (`epic-batch-gate.yml`).                                                                                                                                                                                                             | Nach letztem Merge eines Epics                     |
| **P-17b** | **Monatliche Vollregression (TARA-0125)**: am 1. Montag jedes Monats laeuft die volle Regressionssuite auf `main`; Ergebnis wird als GitHub-Issue dokumentiert (`monthly-regression.yml`).                                                                                                                                                                                                                                                                                                             | Monatlich (main)                                   |
| **P-18**  | **Pre-Transition Check**: Prozess-Guard prüft Vorbedingungen **vor jedem** Status-Wechsel. Bei Verletzung: Issue-Label `blocked` setzen, Finding-Issue anlegen (Board-Status bleibt unveraendert, TARA-0121).                                                                                                                                                                                                                                                                                          | Vor jedem Status-Wechsel                           |
| **P-19**  | Kein `Closes/Fixes/Resolves #NNN` im PR-Body (unterläuft P-11/P-25 durch Auto-Close). Stattdessen `Bezug: #NNN` verwenden.                                                                                                                                                                                                                                                                                                                                                                             | Vor PR / bei PR-Update                             |
| **P-20**  | Audit-Trail-Kommentar bei jedem Board-Status-Wechsel (wann/warum/durch wen). PO-Freigabe-Keywords: `PO-OK`, `Freigabe erteilt`, `freigegeben`, `akzeptiert`, `Accepted`, `Ok`/`OK` (Story oder Epic).                                                                                                                                                                                                                                                                                                  | Bei jedem Status-Wechsel                           |
| **P-22**  | **Review-Finding-Abschluss & Priorisierung**: Ein Finding-Issue wird nach direktem Fix-Commit sofort geschlossen (entkoppelt vom Status der Source-Story); erfordert das Finding eine strukturelle Verbesserung, wird zuerst eine Folge-Story angelegt, bevor das Finding schliesst. Vom PO akzeptierte Findings (Freigabe-Schluesselwort im Kommentar) werden sofort auf "In Progress" gesetzt und vor anderen laufenden Stories priorisiert bearbeitet. Details: `.github/agents/reviewer.agent.md`. | Beim Finding-Abschluss / bei PO-Freigabe-Kommentar |
| **P-23**  | **Kein eigenstaendiger Arbeitsbeginn bei `/init`/Session-Start**: Onboarding besteht ausschliesslich aus Lesen (Prozessdoku + Agenten-Doku), Board sichten und Vorschlagen; erst nach expliziter PO-/User-Freigabe darf Arbeit (Branch/Commit/Status-Wechsel) beginnen. Details: `.github/copilot-instructions.md`.                                                                                                                                                                                    | Bei jedem Session-/Init-Start                      |
| **P-24**  | **Epic-Sync-Pflicht (ab TARA-0113: native Sub-Issues)**: Eine NEUE Story mit `Bezug: #<Epic-Nr>` wird per `scripts/workflow/link_epic_subissue.sh` als native GitHub-Sub-Issue mit ihrem Epic verknuepft (REST-Endpunkt `POST /repos/{owner}/{repo}/issues/{epic}/sub_issues`) - keine manuelle Text-Checkliste im Epic-Body mehr. Bestandsschutz: bestehende Epics (z.B. #176) behalten ihre Text-Checkliste unveraendert, keine rueckwirkende Migration.                                             | Bei Story-Anlage unter einem (neuen) Epic          |
| **P-25**  | **PO-Akzeptanz-Gate vor Merge (Statusmodell B, TARA-0110)**: Merge nach `development` erst zulaessig, wenn (1) SHA-aktueller Review-Nachweis (P-10) UND (2) an die TARA-ID gebundene, nach dem letzten Push auf dem PR gepostete PO-Akzeptanz vorliegen. Status wechselt dabei automatisch inReview → Accepted (`po-approve.yml`); Merge wird ueber einen required Status-Check in `process-guard.yml` blockiert, solange das Gate nicht erfuellt ist.                                                 | Vor jedem Merge nach `development`                 |
| **P-26**  | **PO-Accepted-Gate (TARA-0121)**: Arbeitsbeginn (Todo → In Progress) erst zulaessig, nachdem der Status ueber ein an die TARA-ID gebundenes `PO Accepted TARA-XXXX`-Kommando (Story- oder Epic-Issue) automatisch auf **PO Accepted** gesetzt wurde. Die alte lose Keyword-Liste (P-20) autorisiert diesen Wechsel nicht mehr allein.                                                                                                                                                                  | Vor Story-Start (Todo → PO Accepted → In Progress) |
| **P-27**  | **PO-Release-Gate (TARA-0121)**: Der finale Wechsel Accepted → **PO Release** → **Done** ist erst zulaessig, nachdem ein an die TARA-ID gebundenes `PO Release TARA-XXXX`-Kommando gepostet wurde (Status muss zu diesem Zeitpunkt bereits **Accepted** sein). Ersetzt die bisherige Done-Freigabe ueber lose Keywords (P-15) fuer diesen Uebergang.                                                                                                                                                   | Nach Merge, vor Done                               |

**Hinweis (TARA-0121):** Der fruehere Board-Status "Blocking" entfaellt (PO-Entscheidung).
Blockierte Items werden stattdessen ueber das Issue-Label `blocked` markiert; der
Board-Status bleibt dabei unveraendert.

Vollständige Regeln: `.github/agents/process-guard.policy.md`

---

## 8. Ausnahmen und Sonderfälle

### Prototyp-Ausnahme

Wenn eine Story explizit als **Prototyp** oder **Machbarkeitsnachweis** angelegt ist:

- Review-Agent kann entfallen (kein Code-Review erforderlich)
- Muss vom PO explizit im Issue oder per Chat genehmigt werden

### Bootstrap-Ausnahme

Wenn ein neues Feature-Branch-Schema eingeführt wird (erste Story):

- P-07 (Branch-Naming) kann einmalig abweichen
- Muss als Prozess-Finding dokumentiert werden

### Mehrere Stories in einem Branch

Wenn Stories technisch voneinander abhängen (z. B. TARA-0034 bis TARA-0037):

- Ein gemeinsamer Branch ist erlaubt
- Branch-Name enthält erste und letzte ID: `feature/TARA-0034-0037-beschreibung`
- Alle Stories werden in einem PR zusammengefasst

### Hotfix-Prozess

Wenn nach einem Merge auf `development` ein **kritischer Bug** gefunden wird:

```
1. PO gibt Hotfix per Chat frei: "Hotfix für TARA-XXXX"
2. Branch anlegen von development:
   git checkout development && git pull
   git checkout -b hotfix/TARA-XXXX-kurzbeschreibung
3. Fix implementieren (TDD Green-Phase – Red-Phase entfällt bei Kritisch)
4. pytest + Prettier + ESLint grün
5. Review-Agent: entfällt (PO-Entscheid)
6. Prozess-Guard: Nur P-05, P-06, P-07, P-08, P-12, P-13
7. PR direkt auf development – kein separater Review-Zyklus
8. PO merged und setzt Status → Done
```

> ⚠️ Hotfixes sind Ausnahmen. Wenn möglich, den normalen Prozess verwenden.
> Ein Hotfix-Finding (mit Begründung) wird vom Prozess-Guard im Issue dokumentiert.

---

## 8a. Skills (seit TARA-0119)

Prozesswissen ist auf vier Ebenen verteilt, damit wiederkehrende
Vorgehensweisen unabhängig von den dauerhaften Regeln gepflegt werden
können:

| Ebene        | Pfad                                                    | Inhalt                                               |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| Instructions | `.github/copilot-instructions.md`                       | Dauerhafte, universelle Regeln (P-01–P-27), Freigabe |
| **Skills**   | `.github/skills/*/SKILL.md`                             | Wiederholbare Schritt-für-Schritt-Vorgehensweisen    |
| Agents       | `.github/agents/*.agent.md (+ process-guard.policy.md)` | Rolle, Rechte, Verantwortungsgrenzen                 |
| Actions      | `.github/workflows/*`, `scripts/*`                      | Erzwingen Fakten/Zustandsübergänge (deterministisch) |

Verfügbare Skills: `story-refinement`, `tdd-development`,
`independent-code-review`, `security-review`, `acceptance-testing`,
`release-readiness`. Skills sind eigenständige Markdown-Dateien und
**kein** Teil der aus `docs/process_definition.yml` generierten Doku
(TARA-0116) – sie beschreiben Vorgehen statt Regeln und dürfen keine
dauerhaften Regeltexte duplizieren, sondern verweisen darauf.

---

## 9. Dokumente auf einen Blick

| Dokument                          | Pfad                                     | Für wen             | Inhalt                                                                                                    |
| --------------------------------- | ---------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Dieser Prozess**                | `docs/ENTWICKLUNGSPROZESS.md`            | PO + Agent          | Gesamtüberblick                                                                                           |
| **Dev-Agent Einrichtung**         | `.github/agents/developer.agent.md`      | Neuer Agent         | Setup, Smoke-Test, Kurzreferenz                                                                           |
| **TDD-Workflow (Detail)**         | `CONTRIBUTING.md`                        | Dev-Agent           | Branch-Strategie, alle Schritte, Commit-Format                                                            |
| **Prozess-Guard Regeln**          | `.github/agents/process-guard.policy.md` | Dev-Agent + Guard   | P-01–P-27, Finding-Format                                                                                 |
| **Review-Agent**                  | `.github/agents/reviewer.agent.md`       | Dev-Agent + Review  | R-01–R-30, Finding-Format                                                                                 |
| **Requirements-Agent**            | `.github/agents/requirements.agent.md`   | Requirements-Agent  | DoR-Prüfung, Story-Erstellung                                                                             |
| **Acceptance-Agent**              | `.github/agents/acceptance.agent.md`     | Acceptance-Agent    | Entscheidungsgrundlage fuer PO-Abnahme                                                                    |
| **Board-IDs**                     | `docs/GITHUB_BOARD.md`                   | Dev-Agent           | GraphQL-IDs, Statusübergänge, Beispiele                                                                   |
| **Harness-Überblick (TARA-0124)** | `docs/HARNESS_UEBERBLICK.md`             | PO + neuer Agent    | Kompakter Gesamtüberblick: Agent-Rollen, Board-Status-Diagramm, Story-Lebenszyklus, P-01–P-27-Kurztabelle |
| **Test-Framework**                | `tests/README.md`                        | Dev-Agent           | --noconftest, Marker, venv-Setup                                                                          |
| **PR-Checkliste**                 | `.github/pull_request_template.md`       | Dev-Agent           | TDD, Prettier, ESLint, Review, Freigabe                                                                   |
| **Path-spezifische Regeln**       | `.github/instructions/*.instructions.md` | Agent (automatisch) | Operative Ablaeufe (Session-Start, Gates), applyTo-gescoped                                               |
