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
| **Entwicklungsprozess** | `docs/ENTWICKLUNGSPROZESS.md` | Vollstaendiger Prozess, Rollen, Workflow, Regeln P-01-P-18, P-21 (P-19/P-20 folgen nach Merge von PR #149/#150) |
| **Board-IDs & GraphQL** | `docs/GITHUB_BOARD.md` | API-IDs, Status-Optionen, gh-Befehle |
| **Dev-Agent Einrichtung** | `agents/dev_agent/DEV_AGENT_ONBOARDING.md` | Setup, Smoke-Test, Kurzreferenz |
| **Prozess-Guard-Regeln** | `agents/process_guard/PROCESS_GUARD_AGENT.md` | P-01-P-18, P-21 (P-19/P-20 folgen nach Merge), Pre-Transition-Checks |
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
1. Chat-Nachricht in der aktuellen Session enthaelt: `freigegeben`, `Freigabe fuer TARA-XXXX`, `PO-OK`, `akzeptiert`
2. GitHub Issue-Kommentar am Epic oder Story enthaelt: `PO-OK`, `Freigabe erteilt`, `freigegeben`, `akzeptiert`

---

## Schluesselwoerter in Issue-Kommentaren

| Schluesselwort | Bedeutung | Wirkung |
|----------------|-----------|---------|
| `PO-OK` | PO-Freigabe | Story/Epic freigegeben ODER Done-Setzen erlaubt |
| `Freigabe erteilt` | PO-Freigabe | Story/Epic freigegeben |
| `freigegeben` | PO-Freigabe | Story/Epic freigegeben |
| `akzeptiert` | PO-Freigabe | Story/Epic freigegeben |
| `Pause` | Arbeit pausiert | Issue wird im aktuellen Status belassen, nicht weiterbearbeitet |

> **Pause**: Ein Issue mit Kommentar `Pause` wird vom Dev-Agent in dieser Session **uebersprungen**.
> Es bleibt im aktuellen Status. Weiterarbeit nur nach erneutem expliziten PO-OK.

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

## VERBINDLICHES GATE vor Commit/PR (TARA-0087, P-21)

> ⛔ **Nicht ueberspringbar.** Diese Checkliste MUSS aktiv im Chat bestaetigt werden,
> bevor der jeweilige naechste Schritt ausgefuehrt wird. Reines "gedanklich abgehakt"
> reicht nicht - der Dev-Agent gibt jeden Punkt explizit im Chat aus.

**Gate 1 - VOR dem ersten Commit einer Story:**
- [ ] Board-Status auf **"In Progress"** gesetzt? (Issue-Kommentar mit Audit-Trail, P-02)
- [ ] Testdatei `tests/test_TARA_XXXX.py` existiert bereits (P-03)?

**Gate 2 - VOR `gh pr create`:**
- [ ] Board-Status auf **"inReview"** gesetzt? (Issue-Kommentar mit Audit-Trail, P-09)
- [ ] Story-Tests lokal gruen (P-06)?
- [ ] Prettier/ESLint gruen, falls JS/HTML/CSS geaendert (P-12/P-13)?
- [ ] PR-Body enthaelt `Bezug: #NNN`, **kein** `Closes/Fixes #NNN`?

> Hinweis (TARA-0098): Die Regeln P-19 (kein Auto-Close-Keyword im PR-Body) und
> P-20 (Audit-Trail-Kommentar-Pflicht, vollstaendige Freigabe-Keyword-Liste)
> werden auf separaten Branches (TARA-0085/PR #149, TARA-0086/PR #150)
> eingefuehrt und sind hier bewusst noch nicht referenziert, solange diese
> PRs nicht in `development` gemergt sind. Nach dem Merge sind die obigen
> Referenzen um `(P-19)` bzw. `(P-20)` zu ergaenzen.

Erst wenn **alle** Punkte eines Gates im Chat bestaetigt sind, darf der naechste
Schritt (Commit bzw. PR-Oeffnung) ausgefuehrt werden. Fehlt eine Bestaetigung,
gilt der Schritt als **nicht freigegeben** und muss zuerst nachgeholt werden.

---

## Regel P-01 (immer aktiv)

Waehrend der Arbeit an einer Story: TARA-ID in **jeder** Chat-Antwort nennen.
Beispiel: `[TARA-0026]`

---

> Vollstaendige Prozessregeln (P-01-P-18, P-21; P-19/P-20 nach Merge von PR #149/#150): `agents/process_guard/PROCESS_GUARD_AGENT.md`
> Vollstaendiger Story-Workflow: `docs/ENTWICKLUNGSPROZESS.md` (Abschnitt 4)
