# GitHub Copilot - TARATool Dev-Agent Instructions

> Diese Datei wird von GitHub Copilot CLI automatisch in jeder Session als Systeminstruktion eingelesen.
> Sie beschreibt den Session-Start-Ablauf und verweist auf die massgeblichen Prozessdokumente.
> Inhalte werden **nicht** hier dupliziert - stets die referenzierten Dateien lesen.

---

## Projekt-Kontext

| | |
|-|-|
| **Lokales Verzeichnis** | Clone des `development`-Branches |
| **Repo** | https://github.com/SCHUNK-SE-Co-KG/TARATool |
| **Projektboard** | https://github.com/orgs/SCHUNK-SE-Co-KG/projects/4 |
| **Aktiver Branch** | `development` |

Alle Commits, PRs und Board-Operationen erfolgen ausschliesslich auf `SCHUNK-SE-Co-KG/TARATool`.

---

## Massgebliche Dokumentation

| Dokument | Pfad | Inhalt |
|----------|------|--------|
| **Entwicklungsprozess** | `docs/ENTWICKLUNGSPROZESS.md` | Vollstaendiger Prozess, Rollen, Workflow, Regeln P-01-P-18 |
| **Board-IDs & GraphQL** | `docs/GITHUB_BOARD.md` | API-IDs, Status-Optionen, gh-Befehle |
| **Dev-Agent Einrichtung** | `agents/dev_agent/DEV_AGENT_ONBOARDING.md` | Setup, Smoke-Test, Kurzreferenz |
| **Prozess-Guard-Regeln** | `agents/process_guard/PROCESS_GUARD_AGENT.md` | P-01-P-18 vollstaendig, Pre-Transition-Checks |
| **Review-Agent** | `agents/review_agent/REVIEW_AGENT_WORKFLOW.md` | R-01-R-30, Severity, Finding-Framework |

> **Beim Session-Start diese Dateien lesen**, bevor mit der Arbeit begonnen wird.

---

## Wer ist der Product Owner?

Der PO ist der GitHub-User mit **Schreibrechten auf** `SCHUNK-SE-Co-KG/TARATool`.
Der aktive Chat-Gespraechspartner ist der PO.

---

## WICHTIGSTE REGEL: Keine Arbeit ohne PO-Freigabe

**Keine Implementierung, kein Branch, keine Tests - ohne nachgewiesene Freigabe.**

Freigabe ist gegeben wenn eine der folgenden Bedingungen erfuellt ist:
1. Chat-Nachricht in der aktuellen Session enthaelt: `freigegeben`, `Freigabe fuer TARA-XXXX`, `PO-OK`, `akzeptiert`, `Accepted`, `Ok`
2. GitHub Issue-Kommentar am Epic oder Story enthaelt: `PO-OK`, `Freigabe erteilt`, `freigegeben`, `akzeptiert`, `Accepted`, `Ok`

---

## Schluesselwoerter in Issue-Kommentaren

Diese Liste ist deckungsgleich mit der tatsaechlichen Erkennung in
`scripts/process_guard/check_po_approval_keyword.sh` (aufgerufen von
`.github/workflows/po-approve.yml`, TARA-0086). Freigabe gilt sowohl bei
Kommentar im **Story-Issue** als auch im **Epic-Issue** (z.B. Sammelfreigabe
fuer alle Stories eines Epics).

| Schluesselwort | Bedeutung | Wirkung |
|----------------|-----------|---------|
| `PO-OK` | PO-Freigabe | Story/Epic freigegeben ODER Done-Setzen erlaubt |
| `Freigabe erteilt` | PO-Freigabe | Story/Epic freigegeben |
| `freigegeben` | PO-Freigabe | Story/Epic freigegeben |
| `akzeptiert` | PO-Freigabe | Story/Epic freigegeben |
| `Accepted` | PO-Freigabe | Story/Epic freigegeben |
| `Ok` / `OK` | PO-Freigabe | Story/Epic freigegeben |
| `Pause` | Arbeit pausiert | Issue wird im aktuellen Status belassen, nicht weiterbearbeitet |

> **Pause**: Ein Issue mit Kommentar `Pause` wird vom Dev-Agent in dieser Session **uebersprungen**.
> Es bleibt im aktuellen Status. Weiterarbeit nur nach erneutem expliziten PO-OK.

---

## Audit-Trail bei Board-Status-Wechseln (TARA-0086)

Bei **jedem** Statuswechsel (Todo -> In Progress -> inReview -> Freigabe -> Done)
hinterlaesst der Dev-Agent einen kurzen Kommentar im betroffenen Issue, z.B.:

> `P-02: Status Todo -> In Progress (PO-Freigabe: "akzeptiert", Kommentar von @po-user)`

Dies macht jeden Wechsel im Nachhinein nachvollziehbar (wann/warum/durch wen).


---

## Session-Start: Pflichtablauf (vor jeder Implementierung)

### 1 - Board laden: Blocking
- Alle **Blocking**-Items aus Board #1 pruefen
- Blocking = offene Critical/High Findings oder Prozessverletzung
- PO ueber blockierte Items informieren; **nicht** selbst aufloesen ohne Anweisung

### 2 - Board laden: In Progress
- Alle **In-Progress**-Items laden
- Hat ein Item einen `Pause`-Kommentar? -> ueberspringen
- Offene `review-finding`- oder `blocked`-Issues pruefen
- Zusammenfassung ausgeben

### 3 - Board laden: Todo - Epics
- Alle **Epic**-Issues (Label `epic`) mit Status **Todo** laden
- Issue-Kommentare auf Freigabe-Muster pruefen (`PO-OK`, `freigegeben`, `akzeptiert`)
- Freigegebene Epics identifizieren

### 4 - Stories des freigegebenen Epics pruefen
- Alle zugehoerigen Stories laden und Freigabe pruefen
- `Pause`-Kommentar vorhanden? -> ueberspringen, PO informieren
- **Alle Stories freigegeben** -> autonom beginnen (Abhaengigkeitsreihenfolge)
- **Teilweise freigegeben** -> freigegebene bearbeiten, PO auf fehlende Freigaben hinweisen
- **Keine Story freigegeben** -> PO informieren und warten

### 5 - Zusammenfassung ausgeben
- Blocking-Items (mit Hinweis), In-Progress-Items, was wird bearbeitet, was fehlt

---

## Pre-Transition Check (Regel P-18)

**Vor jedem Status-Wechsel** muss der Prozess-Guard die Vorbedingungen pruefen.
Vollstaendige Tabelle: `agents/process_guard/PROCESS_GUARD_AGENT.md`

| Uebergang | Minimale Vorbedingung |
|-----------|-----------------------|
| Todo -> In Progress | PO-Freigabe nachgewiesen |
| In Progress -> inReview | Prettier + ESLint + Tests gruen |
| inReview -> Freigabe | Kein offenes Critical/High Finding, PR gemergt |
| Freigabe -> Done | PO-OK im Issue-Kommentar |
| any -> Blocking | Offenes Critical/High Finding ODER Prozessverletzung |

---

## Regel P-01 (immer aktiv)

Waehrend der Arbeit an einer Story: TARA-ID in **jeder** Chat-Antwort nennen.
Beispiel: `[TARA-0026]`

---

> Vollstaendige Prozessregeln (P-01-P-18): `agents/process_guard/PROCESS_GUARD_AGENT.md`
> Vollstaendiger Story-Workflow: `docs/ENTWICKLUNGSPROZESS.md` (Abschnitt 4)
