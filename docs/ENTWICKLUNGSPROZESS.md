# TARATool â€“ Entwicklungsprozess

**Dieses Dokument** beschreibt den vollstÃ¤ndigen Entwicklungsprozess fÃ¼r das TARATool-Projekt.
Es richtet sich an den **Product Owner (PO)** und an **neue Dev-Agenten**, die mit der
Entwicklung starten mÃ¶chten.

> **FÃ¼r einen neuen Dev-Agenten:** Lies zuerst dieses Dokument komplett, dann
> `agents/dev_agent/DEV_AGENT_ONBOARDING.md` fÃ¼r die technische Einrichtung.

---

## Inhaltsverzeichnis

1. [Rollen und Verantwortlichkeiten](#1-rollen-und-verantwortlichkeiten)
2. [Projekt-Infrastruktur](#2-projekt-infrastruktur)
3. [Planungsebenen: Epic â†’ Story](#3-planungsebenen-epic--story)
4. [Der vollstÃ¤ndige Story-Workflow](#4-der-vollstÃ¤ndige-story-workflow)
5. [Board-StatusÃ¼bergÃ¤nge](#5-board-statusÃ¼bergÃ¤nge)
6. [Technische QualitÃ¤tssicherung](#6-technische-qualitÃ¤tssicherung)
7. [Prozessregeln (P-01 bis P-15)](#7-prozessregeln-p-01-bis-p-15)
8. [Ausnahmen und SonderfÃ¤lle](#8-ausnahmen-und-sonderfÃ¤lle)
9. [Dokumente auf einen Blick](#9-dokumente-auf-einen-blick)

---

## 1. Rollen und Verantwortlichkeiten

| Rolle                  | Wer                | Aufgaben                                                   |
| ---------------------- | ------------------ | ---------------------------------------------------------- |
| **Product Owner (PO)** | @Bheowulf          | Epics/Stories genehmigen, Freigabe nach Merge, Done setzen |
| **Dev-Agent**          | GitHub Copilot CLI | Implementierung, TDD, Commits, PRs                         |
| **Review-Agent**       | Copilot Sub-Agent  | Code-Review, Finding-Issues erstellen                      |
| **Prozess-Guard**      | Copilot Sub-Agent  | Workflow-Compliance prÃ¼fen (P-01â€“P-15)                     |

### Kommunikationsregeln

- Dev-Agent **nennt in jeder Antwort** die aktive TARA-ID (z. B. `[TARA-0026]`)
- Dev-Agent **beginnt keine Arbeit** ohne explizite PO-Freigabe
- Review-Agent und Prozess-Guard kommunizieren **ausschlieÃŸlich Ã¼ber GitHub Issues**
  (Label: `review-finding`) â€” kein direkter Dialog mit dem Dev-Agent
- PO-Freigabe erfolgt per **Chat-Nachricht** (z. B. â€žOK" oder â€žfreigegeben")

---

## 2. Projekt-Infrastruktur

### Repository

```
https://github.com/Bheowulf/TARATool
Branch: Development  â† aktiver Entwicklungszweig
Branch: main         â† Stable Releases
```

### Branch-Struktur

```
main
  â””â”€â”€ Development          â† Integration, immer lauffÃ¤hig
        â””â”€â”€ feature/TARA-XXXX-kurzbeschreibung
```

**Regel:** Kein direktes Pushen auf `main` oder `Development`.
Jede Story bekommt einen eigenen Feature-Branch.

### GitHub Project Board

Board: **TARATool Ãœberarbeitung**
â†’ https://github.com/users/Bheowulf/projects/3

Technische IDs fÃ¼r API-Zugriff: siehe `docs/GITHUB_BOARD.md`

---

## 3. Planungsebenen: Epic â†’ Story

### Epic

Ein Epic gruppiert mehrere zusammengehÃ¶rige Stories. Epics haben keine eigene
Implementierung â€” sie dienen der Ãœbersicht und Priorisierung.

**Format:** `[TARA-XXXX] EPIC: Titel`
**Label:** `epic`

### Story

Eine Story ist eine einzelne, abgeschlossene Entwicklungsaufgabe mit klaren
Akzeptanzkriterien.

**Format:** `[TARA-XXXX] STORY: Titel`
**Labels:** `story`, `sp:N` (Story Points)

### Story Points (Fibonacci)

| SP  | Bedeutung                  |
| --- | -------------------------- |
| 1   | Trivial (< 30 min)         |
| 2   | Klein (< 2h)               |
| 3   | Mittel (halber Tag)        |
| 5   | GroÃŸ (1 Tag)               |
| 8   | Sehr groÃŸ (2 Tage)         |
| 13  | XL (> 2 Tage â†’ aufteilen!) |

### TARA-ID vergeben

IDs sind **fortlaufend, atomar und unverÃ¤nderlich**. NÃ¤chste freie ID ermitteln:

```bash
gh issue list --state all --limit 200 --json title \
  | python3 -c "
import sys, json, re
issues = json.load(sys.stdin)
ids = [int(m.group(1)) for t in issues for m in [re.search(r'TARA-(\d+)', t['title'])] if m]
print(f'NÃ¤chste ID: TARA-{max(ids)+1:04d}')
"
```

---

## 4. Der vollstÃ¤ndige Story-Workflow

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
â”‚  â€¢ Tests ausfÃ¼hren â†’ mÃ¼ssen FEHLSCHLAGEN                        â”‚
â”‚    pytest tests/test_TARA_XXXX.py --noconftest -v               â”‚
â”‚    â†’ Expected: FAILED (beweist TestvaliditÃ¤t!)                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 3 â€“ Implementierung (TDD GREEN-PHASE)                  â”‚
â”‚  â€¢ Feature implementieren                                       â”‚
â”‚  â€¢ Iterieren bis alle Story-Tests grÃ¼n sind                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 4 â€“ QualitÃ¤tssicherung vor Commit (Pflicht)            â”‚
â”‚  4a  npm run format:check   â†’ Prettier: 0 Fehler               â”‚
â”‚      (Fehler? â†’ npm run format:write, dann erneut prÃ¼fen)       â”‚
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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 6 â€“ Prozess-Guard                                      â”‚
â”‚  â€¢ Dev-Agent aktiviert Prozess-Guard als Sub-Agent              â”‚
â”‚  â€¢ Guard prÃ¼ft P-01 bis P-15                                    â”‚
â”‚  â€¢ âœ… PROCESS OK  â†’ PR auf Development Ã¶ffnen                   â”‚
â”‚  â€¢ âŒ PROCESS BLOCKED â†’ Findings beheben, zurÃ¼ck zu Schritt 4   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 7 â€“ Merge                                              â”‚
â”‚  â€¢ PR auf Development Ã¶ffnen und mergen                         â”‚
â”‚  â€¢ Feature-Branch wird gelÃ¶scht                                 â”‚
â”‚  â€¢ Status â†’ "Freigabe" im Board                                 â”‚
â”‚  â€¢ Dev-Agent wartet â€” setzt NICHT selbst auf Done!              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                            â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  SCHRITT 8 â€“ PO-Freigabe (Pflicht)                              â”‚
â”‚  â€¢ PO prÃ¼ft das Ergebnis im Browser / Repository                â”‚
â”‚  â€¢ PO gibt per Chat frei: "OK", "freigegeben", o.Ã¤.             â”‚
â”‚  â€¢ Dev-Agent setzt Status â†’ "Done"                              â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 5. Board-StatusÃ¼bergÃ¤nge

```
Todo â”€â”€â†’ In Progress â”€â”€â†’ inReview â”€â”€â†’ Freigabe â”€â”€â†’ Done
          (Dev-Agent)    (Dev-Agent)   (Dev-Agent)   (PO)
```

| Status          | Bedeutung                    | Wer setzt                     |
| --------------- | ---------------------------- | ----------------------------- |
| **Todo**        | Geplant, noch nicht begonnen | Dev-Agent nach PO-Freigabe    |
| **In Progress** | Aktiv in Bearbeitung         | Dev-Agent (vor Arbeitsbeginn) |
| **inReview**    | Review lÃ¤uft, PR offen       | Dev-Agent                     |
| **Freigabe**    | Gemergt, wartet auf PO-OK    | Dev-Agent                     |
| **Done**        | Abgeschlossen âœ…             | **Product Owner**             |

---

## 6. Technische QualitÃ¤tssicherung

### Prettier (Formatierung)

```bash
npm run format:check   # PrÃ¼fen
npm run format:write   # Automatisch formatieren
```

Prettier lÃ¤uft auf: JS, CSS, MD, HTML (auÃŸer `index.html` und `tests/*.py`)

### ESLint (CodequalitÃ¤t)

```bash
npm run lint           # PrÃ¼fen (js/-Verzeichnis)
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

# VollstÃ¤ndige E2E-Suite (nur mit Playwright)
.venv/bin/pytest -x -q
```

> âš ï¸ `conftest.py` initialisiert Playwright beim Import.
> Ohne `--noconftest` bricht der Test-Lauf ab, wenn Playwright nicht installiert ist.

---

## 7. Prozessregeln (P-01 bis P-15)

Der **Prozess-Guard** prÃ¼ft am Ende jeder Story die Einhaltung aller Regeln.
Verletzungen werden als GitHub Issues mit Label `review-finding` gemeldet.

| Regel    | Beschreibung                                      | Wann geprÃ¼ft  |
| -------- | ------------------------------------------------- | ------------- |
| **P-01** | TARA-ID in jeder Chat-Antwort                     | Laufend       |
| **P-02** | Status â†’ In Progress VOR Arbeitsbeginn            | Story-Start   |
| **P-03** | Tests VOR Implementierung geschrieben             | Red-Phase     |
| **P-04** | Tests haben initial FEHLGESCHLAGEN                | Red-Phase     |
| **P-05** | Story-Tests vor Commit grÃ¼n                       | Vor Commit    |
| **P-06** | Alle Story-Tests grÃ¼n vor PR                      | Vor PR        |
| **P-07** | Branch: `feature/TARA-XXXX-*`                     | Branch-Anlage |
| **P-08** | Commits referenzieren TARA-ID                     | Jeder Commit  |
| **P-09** | Status â†’ inReview vor PR-Ã–ffnung                  | Vor PR        |
| **P-10** | Review-Agent aufgerufen, kein Critical/High offen | Vor PR        |
| **P-11** | Nach Merge â†’ Freigabe (nicht direkt Done)         | Nach Merge    |
| **P-12** | Prettier grÃ¼n vor Tests                           | Vor Commit    |
| **P-13** | ESLint grÃ¼n vor Tests                             | Vor Commit    |
| **P-14** | TARA-IDs unverÃ¤nderlich (atomar)                  | Jederzeit     |
| **P-15** | Done nur nach explizitem PO-OK                    | Nach Merge    |

VollstÃ¤ndige Regeln: `agents/process_guard/PROCESS_GUARD_AGENT.md`

---

## 8. Ausnahmen und SonderfÃ¤lle

### Prototyp-Ausnahme

Wenn eine Story explizit als **Prototyp** oder **Machbarkeitsnachweis** angelegt ist:

- Review-Agent kann entfallen (kein Code-Review erforderlich)
- Muss vom PO explizit im Issue oder per Chat genehmigt werden

### Bootstrap-Ausnahme

Wenn ein neues Feature-Branch-Schema eingefÃ¼hrt wird (erste Story):

- P-07 (Branch-Naming) kann einmalig abweichen
- Muss als Prozess-Finding dokumentiert werden

### Mehrere Stories in einem Branch

Wenn Stories technisch voneinander abhÃ¤ngen (z. B. TARA-0034 bis TARA-0037):

- Ein gemeinsamer Branch ist erlaubt
- Branch-Name enthÃ¤lt erste und letzte ID: `feature/TARA-0034-0037-beschreibung`
- Alle Stories werden in einem PR zusammengefasst

---

## 9. Dokumente auf einen Blick

| Dokument                  | Pfad                               | FÃ¼r wen            | Inhalt                                         |
| ------------------------- | ---------------------------------- | ------------------ | ---------------------------------------------- |
| **Dieser Prozess**        | `docs/ENTWICKLUNGSPROZESS.md`      | PO + Agent         | GesamtÃ¼berblick                                |
| **Dev-Agent Einrichtung** | `agents/dev_agent/DEV_AGENT_ONBOARDING.md`     | Neuer Agent        | Setup, Smoke-Test, Kurzreferenz                |
| **TDD-Workflow (Detail)** | `CONTRIBUTING.md`                  | Dev-Agent          | Branch-Strategie, alle Schritte, Commit-Format |
| **Prozess-Guard Regeln**  | `agents/process_guard/PROCESS_GUARD_AGENT.md`   | Dev-Agent + Guard  | P-01â€“P-15, Finding-Format                      |
| **Review-Agent**          | `agents/review_agent/REVIEW_AGENT_WORKFLOW.md`    | Dev-Agent + Review | R-01â€“R-12, Finding-Format                      |
| **Board-IDs**             | `docs/GITHUB_BOARD.md`             | Dev-Agent          | GraphQL-IDs, StatusÃ¼bergÃ¤nge, Beispiele        |
| **Test-Framework**        | `tests/README.md`                  | Dev-Agent          | --noconftest, Marker, venv-Setup               |
| **PR-Checkliste**         | `.github/pull_request_template.md` | Dev-Agent          | TDD, Prettier, ESLint, Review, Freigabe        |
