# TARATool – Entwicklungsprozess

**Dieses Dokument** beschreibt den vollständigen Entwicklungsprozess für das TARATool-Projekt.
Es richtet sich an den **Product Owner (PO)** und an **neue Dev-Agenten**, die mit der
Entwicklung starten möchten.

> **Für einen neuen Dev-Agenten:** Lies zuerst dieses Dokument komplett, dann
> `docs/DEV_AGENT_ONBOARDING.md` für die technische Einrichtung.

---

## Inhaltsverzeichnis

1. [Rollen und Verantwortlichkeiten](#1-rollen-und-verantwortlichkeiten)
2. [Projekt-Infrastruktur](#2-projekt-infrastruktur)
3. [Planungsebenen: Epic → Story](#3-planungsebenen-epic--story)
4. [Der vollständige Story-Workflow](#4-der-vollständige-story-workflow)
5. [Board-Statusübergänge](#5-board-statusübergänge)
6. [Technische Qualitätssicherung](#6-technische-qualitätssicherung)
7. [Prozessregeln (P-01 bis P-15)](#7-prozessregeln-p-01-bis-p-15)
8. [Ausnahmen und Sonderfälle](#8-ausnahmen-und-sonderfälle)
9. [Dokumente auf einen Blick](#9-dokumente-auf-einen-blick)

---

## 1. Rollen und Verantwortlichkeiten

| Rolle                  | Wer                | Aufgaben                                                   |
| ---------------------- | ------------------ | ---------------------------------------------------------- |
| **Product Owner (PO)** | @Bheowulf          | Epics/Stories genehmigen, Freigabe nach Merge, Done setzen |
| **Dev-Agent**          | GitHub Copilot CLI | Implementierung, TDD, Commits, PRs                         |
| **Review-Agent**       | Copilot Sub-Agent  | Code-Review, Finding-Issues erstellen                      |
| **Prozess-Guard**      | Copilot Sub-Agent  | Workflow-Compliance prüfen (P-01–P-15)                     |

### Kommunikationsregeln

- Dev-Agent **nennt in jeder Antwort** die aktive TARA-ID (z. B. `[TARA-0026]`)
- Dev-Agent **beginnt keine Arbeit** ohne explizite PO-Freigabe
- Review-Agent und Prozess-Guard kommunizieren **ausschließlich über GitHub Issues**
  (Label: `review-finding`) — kein direkter Dialog mit dem Dev-Agent
- PO-Freigabe erfolgt per **Chat-Nachricht** (z. B. „OK" oder „freigegeben")

---

## 2. Projekt-Infrastruktur

### Repository

```
https://github.com/Bheowulf/TARATool
Branch: Development  ← aktiver Entwicklungszweig
Branch: main         ← Stable Releases
```

### Branch-Struktur

```
main
  └── Development          ← Integration, immer lauffähig
        └── feature/TARA-XXXX-kurzbeschreibung
```

**Regel:** Kein direktes Pushen auf `main` oder `Development`.
Jede Story bekommt einen eigenen Feature-Branch.

### GitHub Project Board

Board: **TARATool Überarbeitung**
→ https://github.com/users/Bheowulf/projects/3

Technische IDs für API-Zugriff: siehe `docs/GITHUB_BOARD.md`

---

## 3. Planungsebenen: Epic → Story

### Epic

Ein Epic gruppiert mehrere zusammengehörige Stories. Epics haben keine eigene
Implementierung — sie dienen der Übersicht und Priorisierung.

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
| 5   | Groß (1 Tag)               |
| 8   | Sehr groß (2 Tage)         |
| 13  | XL (> 2 Tage → aufteilen!) |

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

---

## 4. Der vollständige Story-Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 0 – PO genehmigt Story                                 │
│  • Epic muss genehmigt und In Progress sein                     │
│  • PO gibt Story per Chat frei: "TARA-XXXX freigegeben"        │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 1 – Setup (Dev-Agent)                                  │
│  • Status → "In Progress" im Board                              │
│  • Branch anlegen:                                              │
│    git checkout Development && git pull origin Development      │
│    git checkout -b feature/TARA-XXXX-kurzbeschreibung           │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 2 – Tests schreiben ⚠️ TDD RED-PHASE                   │
│  • Datei anlegen: tests/test_TARA_XXXX.py                       │
│  • Alle Akzeptanzkriterien als pytest-Tests abbilden            │
│  • Tests ausführen → müssen FEHLSCHLAGEN                        │
│    pytest tests/test_TARA_XXXX.py --noconftest -v               │
│    → Expected: FAILED (beweist Testvalidität!)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 3 – Implementierung (TDD GREEN-PHASE)                  │
│  • Feature implementieren                                       │
│  • Iterieren bis alle Story-Tests grün sind                     │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 4 – Qualitätssicherung vor Commit (Pflicht)            │
│  4a  npm run format:check   → Prettier: 0 Fehler               │
│      (Fehler? → npm run format:write, dann erneut prüfen)       │
│  4b  npm run lint           → ESLint: Exit-Code 0              │
│  4c  pytest test_TARA_XXXX.py --noconftest -v  → PASSED         │
│  4d  Commit: "TARA-XXXX: Beschreibung"                          │
│      git push origin feature/TARA-XXXX-...                      │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 5 – Code Review (Review-Agent)                         │
│  • Status → "inReview" im Board                                 │
│  • Dev-Agent aktiviert Review-Agent als Sub-Agent               │
│  • Review-Agent erstellt Findings als GitHub Issues             │
│  • Dev-Agent behebt Findings (Critical/High: Pflicht)           │
│  ⚠️ Prototypen: Review-Agent kann entfallen (PO-Genehmigung)    │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 6 – Prozess-Guard                                      │
│  • Dev-Agent aktiviert Prozess-Guard als Sub-Agent              │
│  • Guard prüft P-01 bis P-15                                    │
│  • ✅ PROCESS OK  → PR auf Development öffnen                   │
│  • ❌ PROCESS BLOCKED → Findings beheben, zurück zu Schritt 4   │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 7 – Merge                                              │
│  • PR auf Development öffnen und mergen                         │
│  • Feature-Branch wird gelöscht                                 │
│  • Status → "Freigabe" im Board                                 │
│  • Dev-Agent wartet — setzt NICHT selbst auf Done!              │
└───────────────────────────┬─────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SCHRITT 8 – PO-Freigabe (Pflicht)                              │
│  • PO prüft das Ergebnis im Browser / Repository                │
│  • PO gibt per Chat frei: "OK", "freigegeben", o.ä.             │
│  • Dev-Agent setzt Status → "Done"                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Board-Statusübergänge

```
Todo ──→ In Progress ──→ inReview ──→ Freigabe ──→ Done
          (Dev-Agent)    (Dev-Agent)   (Dev-Agent)   (PO)
```

| Status          | Bedeutung                    | Wer setzt                     |
| --------------- | ---------------------------- | ----------------------------- |
| **Todo**        | Geplant, noch nicht begonnen | Dev-Agent nach PO-Freigabe    |
| **In Progress** | Aktiv in Bearbeitung         | Dev-Agent (vor Arbeitsbeginn) |
| **inReview**    | Review läuft, PR offen       | Dev-Agent                     |
| **Freigabe**    | Gemergt, wartet auf PO-OK    | Dev-Agent                     |
| **Done**        | Abgeschlossen ✅             | **Product Owner**             |

---

## 6. Technische Qualitätssicherung

### Prettier (Formatierung)

```bash
npm run format:check   # Prüfen
npm run format:write   # Automatisch formatieren
```

Prettier läuft auf: JS, CSS, MD, HTML (außer `index.html` und `tests/*.py`)

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

> ⚠️ `conftest.py` initialisiert Playwright beim Import.
> Ohne `--noconftest` bricht der Test-Lauf ab, wenn Playwright nicht installiert ist.

---

## 7. Prozessregeln (P-01 bis P-15)

Der **Prozess-Guard** prüft am Ende jeder Story die Einhaltung aller Regeln.
Verletzungen werden als GitHub Issues mit Label `review-finding` gemeldet.

| Regel    | Beschreibung                                      | Wann geprüft  |
| -------- | ------------------------------------------------- | ------------- |
| **P-01** | TARA-ID in jeder Chat-Antwort                     | Laufend       |
| **P-02** | Status → In Progress VOR Arbeitsbeginn            | Story-Start   |
| **P-03** | Tests VOR Implementierung geschrieben             | Red-Phase     |
| **P-04** | Tests haben initial FEHLGESCHLAGEN                | Red-Phase     |
| **P-05** | Story-Tests vor Commit grün                       | Vor Commit    |
| **P-06** | Alle Story-Tests grün vor PR                      | Vor PR        |
| **P-07** | Branch: `feature/TARA-XXXX-*`                     | Branch-Anlage |
| **P-08** | Commits referenzieren TARA-ID                     | Jeder Commit  |
| **P-09** | Status → inReview vor PR-Öffnung                  | Vor PR        |
| **P-10** | Review-Agent aufgerufen, kein Critical/High offen | Vor PR        |
| **P-11** | Nach Merge → Freigabe (nicht direkt Done)         | Nach Merge    |
| **P-12** | Prettier grün vor Tests                           | Vor Commit    |
| **P-13** | ESLint grün vor Tests                             | Vor Commit    |
| **P-14** | TARA-IDs unveränderlich (atomar)                  | Jederzeit     |
| **P-15** | Done nur nach explizitem PO-OK                    | Nach Merge    |

Vollständige Regeln: `.github/PROCESS_GUARD_AGENT.md`

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

---

## 9. Dokumente auf einen Blick

| Dokument                  | Pfad                               | Für wen            | Inhalt                                         |
| ------------------------- | ---------------------------------- | ------------------ | ---------------------------------------------- |
| **Dieser Prozess**        | `docs/ENTWICKLUNGSPROZESS.md`      | PO + Agent         | Gesamtüberblick                                |
| **Dev-Agent Einrichtung** | `docs/DEV_AGENT_ONBOARDING.md`     | Neuer Agent        | Setup, Smoke-Test, Kurzreferenz                |
| **TDD-Workflow (Detail)** | `CONTRIBUTING.md`                  | Dev-Agent          | Branch-Strategie, alle Schritte, Commit-Format |
| **Prozess-Guard Regeln**  | `.github/PROCESS_GUARD_AGENT.md`   | Dev-Agent + Guard  | P-01–P-15, Finding-Format                      |
| **Review-Agent**          | `docs/REVIEW_AGENT_WORKFLOW.md`    | Dev-Agent + Review | R-01–R-12, Finding-Format                      |
| **Board-IDs**             | `docs/GITHUB_BOARD.md`             | Dev-Agent          | GraphQL-IDs, Statusübergänge, Beispiele        |
| **Test-Framework**        | `tests/README.md`                  | Dev-Agent          | --noconftest, Marker, venv-Setup               |
| **PR-Checkliste**         | `.github/pull_request_template.md` | Dev-Agent          | TDD, Prettier, ESLint, Review, Freigabe        |
