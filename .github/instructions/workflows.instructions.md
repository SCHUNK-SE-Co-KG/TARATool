---
applyTo: "**"
---

# Workflow-Instructions: Session-Start, Freigabe-Gates, Audit-Trail

> Ausgelagert aus `.github/copilot-instructions.md` (TARA-0120). Diese Datei
> wird dank `applyTo: "**"` bei jeder Datei-Interaktion automatisch geladen
> und ist damit funktional weiterhin immer aktiv - nur strukturell getrennt
> von den unveraenderlichen Kernregeln.

## `/init` und Session-Start: Kein eigenstaendiger Arbeitsbeginn (Regel P-23)

> ⛔ **Diese Regel gilt VOR allen anderen Schritten** - auch und gerade wenn die
> Session mit dem eingebauten CLI-Befehl `/init` beginnt.

`/init` darf in diesem Repository **niemals** dazu fuehren, dass der Agent
eigenstaendig Dateien anlegt, ueberschreibt oder aendert (das schliesst
insbesondere ein automatisches Neuschreiben von `.github/copilot-instructions.md`
durch die eingebaute `/init`-Routine der CLI ein) - unabhaengig davon, was der
Standard-`/init`-Ablauf der CLI sonst vorsieht. `/init` in diesem Repo ist
**ausschliesslich** ein Lese-/Analyse- und Vorschlags-Vorgang:

1. **Lesen:** `docs/ENTWICKLUNGSPROZESS.md` vollstaendig parsen.
2. **Lesen:** alle `.github/agents/*.agent.md`-Dateien vollstaendig parsen.
3. **Board sichten:** Projektboard laden (Blocking, In Progress, Todo-Epics/
   Stories, akzeptierte Review-Findings) gemaess Ablauf unten.
4. **Vorschlagen:** dem PO/User eine Zusammenfassung praesentieren, inkl.
   eines konkreten Vorschlags, mit welchen Issues/Epics als naechstes
   begonnen werden koennte - **ohne** diese Arbeit bereits zu beginnen.
5. **Warten:** Erst nach expliziter PO-/User-Freigabe duerfen Branch, Commit,
   Datei-Aenderungen oder Board-Status-Wechsel erfolgen.

Werden durch das Ausfuehren von `/init` (oder eine andere eingebaute
CLI-Routine) dennoch automatisch Datei-Aenderungen vorgenommen, **muessen**
diese sofort mit `git checkout --` bzw. `git restore` zurueckgesetzt werden,
bevor irgendeine weitere Aktion erfolgt.

## Schluesselwoerter in Issue-Kommentaren

Deckungsgleich mit `scripts/process_guard/po_approval_parser.py`
(TARA-0086/TARA-0109). Freigabe gilt sowohl bei Kommentar im **Story-Issue**
als auch im **Epic-Issue** (Sammelfreigabe).

> **TARA-0109 (gebundenes Kommando):** Ein Keyword allein genuegt **nicht**.
> Es muss an eine konkrete TARA-ID gebunden sein, z.B. `akzeptiert TARA-0109`
> oder `TARA-0109 ist nun akzeptiert`. Zitate (Blockquote `>`) und
> Code-Fences zaehlen nicht als aktives Kommando.

| Schluesselwort       | Bedeutung       | Wirkung (gebunden an TARA-XXXX)           |
| -------------------- | --------------- | ------------------------------------------ |
| `PO-OK`               | PO-Freigabe      | Story/Epic freigegeben ODER Done-Setzen erlaubt |
| `Freigabe erteilt`    | PO-Freigabe      | Story/Epic freigegeben                     |
| `freigegeben`         | PO-Freigabe      | Story/Epic freigegeben                     |
| `akzeptiert`          | PO-Freigabe      | Story/Epic freigegeben                     |
| `Accepted`            | PO-Freigabe      | Story/Epic freigegeben                     |
| `Ok` / `OK`           | PO-Freigabe      | Story/Epic freigegeben                     |
| `Pause`               | Arbeit pausiert  | Issue bleibt im aktuellen Status, wird uebersprungen |

> **Pause**: Ein Issue mit Kommentar `Pause` wird in dieser Session
> uebersprungen. Weiterarbeit nur nach erneutem expliziten PO-OK.

## Audit-Trail bei Board-Status-Wechseln (TARA-0086)

Bei **jedem** Statuswechsel (Todo -> In Progress -> inReview -> Accepted -> Done)
hinterlaesst der Dev-Agent bzw. die Automation einen kurzen Kommentar im
betroffenen Issue, z.B.:

> `P-02: Status Todo -> In Progress (PO-Freigabe: "akzeptiert", Kommentar von @po-user)`

## Session-Start: Pflichtablauf (vor jeder Implementierung)

### 1 - Board laden: Blocking

- Alle **Blocking**-Items aus Board #1 pruefen (offene Critical/High Findings
  oder Prozessverletzung); PO informieren, **nicht** selbst aufloesen ohne
  Anweisung.

### 2 - Board laden: In Progress

- Alle **In-Progress**-Items laden; `Pause`-Kommentar -> ueberspringen; offene
  `review-finding`/`blocked`-Issues pruefen; Zusammenfassung ausgeben.

### 3 - Board laden: Todo - Epics

- Alle **Epic**-Issues (Label `epic`) mit Status **Todo** laden; Kommentare auf
  Freigabe-Muster pruefen; freigegebene Epics identifizieren.

### 4 - Stories des freigegebenen Epics pruefen

- Alle zugehoerigen Stories laden und Freigabe pruefen. `Pause` -> ueberspringen
  + PO informieren. Alle freigegeben -> autonom beginnen (Abhaengigkeitsreihenfolge).
  Teilweise freigegeben -> freigegebene bearbeiten, PO auf Luecken hinweisen.
  Keine Freigabe -> PO informieren und warten.

### 5 - Zusammenfassung ausgeben

- Blocking-Items (mit Hinweis), In-Progress-Items, was wird bearbeitet, was fehlt.

## Pre-Transition Check (Regel P-18)

**Vor jedem Status-Wechsel** muss der Prozess-Guard die Vorbedingungen pruefen.
Vollstaendige Tabelle: `.github/agents/process-guard.policy.md`.

| Uebergang            | Minimale Vorbedingung                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Todo -> In Progress   | PO-Freigabe nachgewiesen                                                                                           |
| In Progress -> inReview | Prettier + ESLint + Tests gruen                                                                                 |
| inReview -> Accepted  | P-25: SHA-aktueller Review-Nachweis + gebundene PO-Akzeptanz auf dem PR (nach letztem Push) - automatisch gesetzt |
| Accepted -> Done      | Automatisch nach Merge, nur wenn Status vorher "Accepted" war                                                      |
| any -> Blocking       | Offenes Critical/High Finding ODER Prozessverletzung                                                              |

## VERBINDLICHES GATE vor Commit/PR (TARA-0087, P-21)

> ⛔ **Nicht ueberspringbar.** Diese Checkliste MUSS aktiv im Chat bestaetigt
> werden, bevor der jeweilige naechste Schritt ausgefuehrt wird. Reines
> "gedanklich abgehakt" reicht nicht - der Dev-Agent gibt jeden Punkt explizit
> im Chat aus.

**Gate 1 - VOR dem ersten Commit einer Story:**

- [ ] Board-Status auf **"In Progress"** gesetzt? (Issue-Kommentar mit Audit-Trail, P-02)
- [ ] Testdatei `tests/test_TARA_XXXX.py` existiert bereits (P-03)?

**Gate 2 - VOR `gh pr create`:**

- [ ] Board-Status auf **"inReview"** gesetzt? (Issue-Kommentar mit Audit-Trail, P-09/P-20)
- [ ] Story-Tests lokal gruen (P-06)?
- [ ] Prettier/ESLint gruen, falls JS/HTML/CSS geaendert (P-12/P-13)?
- [ ] PR-Body enthaelt `Bezug: #NNN`, **kein** `Closes/Fixes #NNN` (P-19)?

Erst wenn **alle** Punkte eines Gates im Chat bestaetigt sind, darf der
naechste Schritt (Commit bzw. PR-Oeffnung) ausgefuehrt werden. Fehlt eine
Bestaetigung, gilt der Schritt als **nicht freigegeben** und muss zuerst
nachgeholt werden. Referenz: `.github/agents/process-guard.policy.md` (P-19, P-20, P-21).
