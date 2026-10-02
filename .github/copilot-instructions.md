# GitHub Copilot - TARATool Dev-Agent Instructions

> Diese Datei wird von GitHub Copilot CLI automatisch in jeder Session als Systeminstruktion eingelesen.
> Sie enthaelt nur die ~8 unveraenderlichen Kernregeln. Operativer/pfadspezifischer
> Prozessinhalt (Session-Start-Ablauf, Gates, Freigabe-Keywords, Rollen) ist seit
> TARA-0120 ausgelagert - siehe Vier-Ebenen-Modell und Verweistabelle unten.

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

## Vier-Ebenen-Modell (seit TARA-0119/TARA-0120)

Prozesswissen ist bewusst auf vier Ebenen verteilt, um Wiederverwendbarkeit,
Testbarkeit und Wartung einzeln voneinander zu ermoeglichen. Keine Ebene
dupliziert den Inhalt einer anderen Ebene:

| Ebene | Pfad | Inhalt |
|-------|------|--------|
| **Instructions (Kern)** | `.github/copilot-instructions.md` (diese Datei) | ~8 dauerhafte Kernregeln, Freigabe-Grundsatz |
| **Instructions (operativ)** | `.github/instructions/*.instructions.md` (`applyTo`-Frontmatter) | Session-Start-Ablauf, Gate 1/Gate 2, Freigabe-Keywords, Test-/Frontend-/Security-Regeln |
| **Skills** | `.github/skills/*/SKILL.md` | Wiederholbare Vorgehensweisen (TDD, Code-Review, Release, ...) |
| **Agents** | `.github/agents/*.agent.md` + `.github/agents/process-guard.policy.md` | Rolle, Rechte, Verantwortungsgrenzen je Agent (Dev, Review, Requirements, Acceptance, Process-Guard) |
| **Actions/Skripte** | `.github/workflows/*`, `scripts/*` | Erzwingen Fakten und Zustandsuebergaenge (deterministisch, nicht LLM-basiert) |

Massgebliche Einstiegsdokumente: `docs/HARNESS_UEBERBLICK.md` (TARA-0124,
kompakter Gesamtueberblick: Agent-Rollen, Board-Statusautomat,
Story-Lebenszyklus, P-01-P-27-Kurztabelle), `docs/ENTWICKLUNGSPROZESS.md`
(vollstaendiger Prozess, Regeln P-01-P-27/R-01-R-36), `docs/GITHUB_BOARD.md`
(Board-IDs/GraphQL),
`.github/agents/developer.agent.md` (Setup/Kurzreferenz),
`.github/agents/process-guard.policy.md` (volle Regeltabelle, Pre-Transition-Checks),
`.github/agents/reviewer.agent.md` (Pruefkatalog), `.github/agents/requirements.agent.md`
(Chat-Anforderung -> Story, DoR), `.github/agents/acceptance.agent.md` (konzeptionell,
keine eigene Freigabebefugnis).

> **Beim Session-Start diese Dateien lesen**, bevor mit der Arbeit begonnen wird.

---

## Wer ist der Product Owner?

Der PO ist der GitHub-User mit **Schreibrechten auf** `SCHUNK-SE-Co-KG/TARATool`.
Der aktive Chat-Gespraechspartner ist der PO.

---

## WICHTIGSTE REGEL: Keine Arbeit ohne PO-Freigabe

**Keine Implementierung, kein Branch, keine Tests - ohne nachgewiesene Freigabe.**

Freigabe ist gegeben wenn eine der folgenden Bedingungen erfuellt ist (TARA-0109:
gebundenes Kommando `<Keyword> TARA-XXXX` bzw. `TARA-XXXX <Keyword>`):
1. Chat-Nachricht in der aktuellen Session enthaelt z.B. `freigegeben TARA-XXXX`,
   `PO-OK TARA-XXXX`, `akzeptiert TARA-XXXX`, `Accepted TARA-XXXX`.
2. GitHub Issue-Kommentar am Epic oder Story enthaelt dasselbe gebundene Kommando-Format;
   bei Kommentar im **Epic-Issue** gilt dies als Sammelfreigabe fuer alle im Epic-Body
   gelisteten Stories.

Vollstaendige Keyword-Tabelle, `Pause`-Handling und Bindungsregeln (Negation,
Blockquotes, Code-Fences): `.github/instructions/workflows.instructions.md`.

---

## `/init` und Session-Start: Kein eigenstaendiger Arbeitsbeginn (Regel P-23)

> ⛔ **Diese Regel gilt VOR allen anderen Schritten** - auch und gerade wenn die
> Session mit dem eingebauten CLI-Befehl `/init` beginnt.

`/init` darf in diesem Repository **niemals** dazu fuehren, dass der Agent
eigenstaendig Dateien anlegt, ueberschreibt oder aendert (das schliesst ein
automatisches Neuschreiben dieser Datei durch die eingebaute `/init`-Routine
der CLI ein). `/init` ist in diesem Repo **ausschliesslich** ein Lese-/
Analyse- und Vorschlags-Vorgang:

1. **Lesen:** `docs/ENTWICKLUNGSPROZESS.md` und alle `.github/agents/*.agent.md` parsen.
2. **Lesen:** `.github/agents/process-guard.policy.md` parsen.
3. **Board sichten:** Projektboard laden (Blocking, In Progress, Todo-Epics/
   Stories, akzeptierte Review-Findings) - Details: `.github/instructions/workflows.instructions.md`.
4. **Vorschlagen:** dem PO/User eine Zusammenfassung praesentieren, inkl.
   eines konkreten Vorschlags, mit welchen Issues/Epics als naechstes
   begonnen werden koennte - **ohne** diese Arbeit bereits zu beginnen.
5. **Warten:** Erst nach expliziter PO-/User-Freigabe (siehe "WICHTIGSTE
   REGEL" oben) duerfen Branch, Commit, Datei-Aenderungen oder
   Board-Status-Wechsel erfolgen.

Werden durch `/init` (oder eine andere eingebaute CLI-Routine) dennoch
automatisch Datei-Aenderungen vorgenommen, **muessen** diese sofort mit
`git checkout --` bzw. `git restore` zurueckgesetzt werden, bevor irgendeine
weitere Aktion erfolgt.

---

## Audit-Trail bei Board-Status-Wechseln (TARA-0086, Beispiel)

Bei jedem Statuswechsel hinterlaesst der Dev-Agent einen Audit-Kommentar, z.B.:

> `P-02: Status Todo -> In Progress (PO-Freigabe: "akzeptiert TARA-0026", Kommentar von @po-user)`

Vollstaendige Session-Start-Checkliste (Blocking/In-Progress/Todo-Epics) und
das VERBINDLICHE GATE vor Commit/PR (Gate 1/Gate 2, P-21): siehe
`.github/instructions/workflows.instructions.md`.

---

## Regel P-01 (immer aktiv)

Waehrend der Arbeit an einer Story: TARA-ID in **jeder** Chat-Antwort nennen.
Beispiel: `[TARA-0026]`

---

> Vollstaendige Prozessregeln (<!-- GENERATED:rule-range:START (docs/process_definition.yml, scripts/process_guard/generate_process_docs.py) -->Prozessregeln P-01-P-27, Review-Regeln R-01-R-36<!-- GENERATED:rule-range:END -->): `.github/agents/process-guard.policy.md`
> Vollstaendiger Story-Workflow: `docs/ENTWICKLUNGSPROZESS.md` (Abschnitt 4)
> Operative Ablaeufe/Gates: `.github/instructions/workflows.instructions.md`, `.github/instructions/tests.instructions.md`, `.github/instructions/frontend.instructions.md`, `.github/instructions/security.instructions.md`
