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
| **Requirements-Agent** (seit TARA-0118) | `agents/requirements_agent/REQUIREMENTS_AGENT.md` | Chat-Anforderung -> Story (AC/Scope/Abhaengigkeiten), DoR-Pruefung, separater Kontext, keine fachliche Freigabe |
| **Acceptance-Agent** (seit TARA-0118, nur dokumentiert) | `agents/acceptance_agent/ACCEPTANCE_AGENT.md` | Konzeptionelle Rolle, kein Code/Prototyp, keine eigene Freigabebefugnis |

> **Beim Session-Start diese Dateien lesen**, bevor mit der Arbeit begonnen wird.

---

## Wer ist der Product Owner?

Der PO ist der GitHub-User mit **Schreibrechten auf** `SCHUNK-SE-Co-KG/TARATool`.
Der aktive Chat-Gespraechspartner ist der PO.

---

## WICHTIGSTE REGEL: Keine Arbeit ohne PO-Freigabe

**Keine Implementierung, kein Branch, keine Tests - ohne nachgewiesene Freigabe.**

Freigabe ist gegeben wenn eine der folgenden Bedingungen erfuellt ist (TARA-0109:
gebundenes Kommando `<Keyword> TARA-XXXX` bzw. `TARA-XXXX <Keyword>` - einheitlich
fuer beide Pfade, damit keine zwei unterschiedlichen Freigabe-Grammatiken existieren):
1. Chat-Nachricht in der aktuellen Session enthaelt: `freigegeben TARA-XXXX`,
   `Freigabe fuer TARA-XXXX`, `PO-OK TARA-XXXX`, `akzeptiert TARA-XXXX`,
   `Accepted TARA-XXXX`, `TARA-XXXX Ok`
2. GitHub Issue-Kommentar am Epic oder Story enthaelt dasselbe gebundene Kommando-Format
   (siehe Abschnitt "Schluesselwoerter in Issue-Kommentaren" unten); bei Kommentar im
   **Epic-Issue** mit der Epic-ID gilt dies als Sammelfreigabe fuer alle im Epic-Body
   gelisteten Stories.

---

## `/init` und Session-Start: Kein eigenstaendiger Arbeitsbeginn (Regel P-23)

> ⛔ **Diese Regel gilt VOR allen anderen Schritten** - auch und gerade wenn die
> Session mit dem eingebauten CLI-Befehl `/init` beginnt.

`/init` darf in diesem Repository **niemals** dazu fuehren, dass der Agent
eigenstaendig Dateien anlegt, ueberschreibt oder aendert (das schliesst
insbesondere ein automatisches Neuschreiben dieser Datei
`.github/copilot-instructions.md` durch die eingebaute `/init`-Routine der
CLI ein) - unabhaengig davon, was der Standard-`/init`-Ablauf der CLI sonst
vorsieht. `/init` in diesem Repo ist **ausschliesslich** ein Lese-/Analyse-
und Vorschlags-Vorgang:

1. **Lesen:** `docs/ENTWICKLUNGSPROZESS.md` vollstaendig parsen.
2. **Lesen:** alle `agents/*/*.md`-Dateien (Dev-Agent, Process-Guard,
   Review-Agent) vollstaendig parsen.
3. **Board sichten:** Projektboard laden (Blocking, In Progress, Todo-Epics/
   Stories, akzeptierte Review-Findings) gemaess Ablauf unten.
4. **Vorschlagen:** dem PO/User eine Zusammenfassung praesentieren, inkl.
   eines konkreten Vorschlags, mit welchen Issues/Epics als naechstes
   begonnen werden koennte - **ohne** diese Arbeit bereits zu beginnen.
5. **Warten:** Erst nach expliziter PO-/User-Freigabe (siehe "WICHTIGSTE
   REGEL" oben) duerfen Branch, Commit, Datei-Aenderungen oder
   Board-Status-Wechsel erfolgen.

Werden durch das Ausfuehren von `/init` (oder eine andere eingebaute
CLI-Routine) dennoch automatisch Datei-Aenderungen vorgenommen, **muessen**
diese sofort mit `git checkout --` bzw. `git restore` zurueckgesetzt werden,
bevor irgendeine weitere Aktion erfolgt.

---


## Schluesselwoerter in Issue-Kommentaren

Diese Liste ist deckungsgleich mit der tatsaechlichen Erkennung in
`scripts/process_guard/po_approval_parser.py` (aufgerufen ueber
`scripts/process_guard/check_po_approval_keyword.sh` aus
`.github/workflows/po-approve.yml`, TARA-0086/TARA-0109). Freigabe gilt sowohl bei
Kommentar im **Story-Issue** als auch im **Epic-Issue** (z.B. Sammelfreigabe
fuer alle Stories eines Epics).

> **TARA-0109 (gebundenes Kommando statt loser Keywords):** Ein Keyword allein
> (z.B. das eigenstaendige Wort `OK`) genuegt **nicht mehr**. Das Keyword muss
> in enger Nachbarschaft **an eine konkrete TARA-ID gebunden** sein, z.B.
> `akzeptiert TARA-0109` oder `TARA-0109 ist nun akzeptiert`. Damit entfaellt der
> bisherige Fehlalarm bei Saetzen wie "Der Test ist OK, aber die Story ist noch
> nicht freigegeben." (kein TARA-Bezug in der Naehe -> keine Freigabe). Zitierte
> Passagen (Markdown-Blockquote `>`) und Code-Fences werden nicht als aktives
> Kommando gewertet. Die TARA-ID wird aus dem Freigabe-**Kommentar selbst**
> entnommen, nicht mehr pauschal aus Issue-Titel/-Body.

| Schluesselwort | Bedeutung | Wirkung (gebunden an TARA-XXXX) |
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

Bei **jedem** Statuswechsel (Todo -> In Progress -> inReview -> Accepted -> Done)
hinterlaesst der Dev-Agent bzw. die Automation einen kurzen Kommentar im betroffenen Issue, z.B.:

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
| inReview -> Accepted | P-25: SHA-aktueller Review-Nachweis + gebundene PO-Akzeptanz auf dem PR (nach letztem Push) - automatisch gesetzt |
| Accepted -> Done | Automatisch nach Merge, nur wenn Status vorher "Accepted" war |
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
- [ ] Board-Status auf **"inReview"** gesetzt? (Issue-Kommentar mit Audit-Trail, P-09/P-20)
- [ ] Story-Tests lokal gruen (P-06)?
- [ ] Prettier/ESLint gruen, falls JS/HTML/CSS geaendert (P-12/P-13)?
- [ ] PR-Body enthaelt `Bezug: #NNN`, **kein** `Closes/Fixes #NNN` (P-19)?

Erst wenn **alle** Punkte eines Gates im Chat bestaetigt sind, darf der naechste
Schritt (Commit bzw. PR-Oeffnung) ausgefuehrt werden. Fehlt eine Bestaetigung,
gilt der Schritt als **nicht freigegeben** und muss zuerst nachgeholt werden.

---

## Regel P-01 (immer aktiv)

Waehrend der Arbeit an einer Story: TARA-ID in **jeder** Chat-Antwort nennen.
Beispiel: `[TARA-0026]`

---

> Vollstaendige Prozessregeln (P-01-P-23): `agents/process_guard/PROCESS_GUARD_AGENT.md`
> Vollstaendiger Story-Workflow: `docs/ENTWICKLUNGSPROZESS.md` (Abschnitt 4)
