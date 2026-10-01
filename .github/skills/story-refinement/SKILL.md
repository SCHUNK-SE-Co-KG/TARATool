# Skill: Story-Refinement

## Zweck

Dieser Skill beschreibt das Vorgehen, mit dem eine informelle, noch
unstrukturierte Chat-Anforderung des PO in eine strukturierte, pruefbare
Story (GitHub-Issue) uebersetzt wird - mit klar formulierten
Akzeptanzkriterien, benanntem Scope/Nicht-Scope und benannten
Abhaengigkeiten. Er ist das konkrete, wiederholbare "Wie" zur Rolle des
**Requirements-Agent** (`agents/requirements_agent/REQUIREMENTS_AGENT.md`).

Der Skill selbst trifft **keine fachliche Entscheidung** und setzt
**keinen Board-Status** - er ist eine Schritt-fuer-Schritt-Anleitung, keine
Regel und keine Rollenbeschreibung. Dauerhafte Regeln (z.B. wer freigeben
darf) stehen ausschliesslich in `.github/copilot-instructions.md` und
`agents/requirements_agent/REQUIREMENTS_AGENT.md`; dieser Skill verweist
nur darauf.

## Voraussetzungen

- Eine Chat-Nachricht des PO mit einer neuen, noch nicht als Issue
  erfassten Anforderung liegt vor.
- Der Requirements-Agent wird als **separater Sub-Agent-Kontext**
  aktiviert (siehe Abschnitt "Unabhaengigkeit" in
  `agents/requirements_agent/REQUIREMENTS_AGENT.md`) - nicht als
  Moduswechsel im laufenden Dev-Agent-Kontext.
- Das uebergeordnete Epic ist bereits angelegt und "In Progress"
  (siehe `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 3 "Epic-Completion-Regel").
- Die naechste freie TARA-ID wurde noch nicht final vergeben (wird in
  Schritt 1 ermittelt).

## Schritte

1. **TARA-ID ermitteln.** Hoechste existierende TARA-ID per `gh issue list`
   plus Regex ermitteln (siehe `CONTRIBUTING.md`, Abschnitt "TARA-ID
   Nummernschema") und die naechste freie Nummer reservieren.

   ```bash
   gh issue list --state all --limit 200 --json title \
     | python3 -c "
   import sys, json, re
   issues = json.load(sys.stdin)
   ids = [int(m.group(1)) for t in issues for m in [re.search(r'TARA-(\d+)', t['title'])] if m]
   print(f'Naechste freie ID: TARA-{max(ids)+1:04d}')
   "
   ```

2. **Anforderung strukturieren.** Aus der Chat-Nachricht werden extrahiert:
   - **Problem/Ist-Zustand**: Was funktioniert heute nicht/noch nicht?
   - **Scope**: Was genau soll diese Story leisten?
   - **Nicht-Scope**: Was wird bewusst ausgeklammert (ggf. als Folge-Story)?
   - **Akzeptanzkriterien**: Mindestens 2, als pruefbare Checkbox-Liste
     formuliert (siehe Beispiel-Issues #190, #191 fuer das uebliche Format).
   - **Abhaengigkeiten**: Verweise auf andere Stories/Epics (`Bezug: #NNN`).

3. **Definition-of-Ready-Checkliste pruefen** (identisch zur Tabelle in
   `agents/requirements_agent/REQUIREMENTS_AGENT.md`):

   | Kriterium | Pruefung |
   |---|---|
   | TARA-ID vergeben | TARA-XXXX im Titel |
   | Akzeptanzkriterien vorhanden | Mindestens 2 Kriterien im Issue-Body |
   | Scope/Nicht-Scope benannt | Abgrenzung im Issue-Body dokumentiert |
   | Abhaengigkeiten benannt | Verweis auf abhaengige Stories/Epics |
   | Keine offenen Fragen ohne Antwort | Rueckfragen an PO geklaert oder dokumentiert |
   | Story Points geschaetzt | Label sp:N gesetzt |
   | Kein offenes Blocking-Finding | Kein Issue mit Label blocked + dieser TARA-ID |
   | Epic aktiv (In Progress) | Uebergeordnetes Epic nicht Done/geschlossen |

4. **Offene Rueckfragen sammeln.** Luecken/Widersprueche, die der
   Requirements-Agent nicht selbst entscheiden darf, werden als
   nummerierte Liste offener Fragen im Issue-Body dokumentiert (Abschnitt
   "Offene Fragen").

5. **Issue anlegen.**

   ```bash
   gh issue create --repo SCHUNK-SE-Co-KG/TARATool \
     --title "[TARA-XXXX] STORY: <Kurzbeschreibung>" \
     --body-file <issue_body.md> \
     --label story
   ```

6. **An den PO uebergeben.** Der Requirements-Agent markiert die Story im
   Chat explizit als "bereit zur PO-Freigabe" oder benennt die noch
   fehlenden DoR-Punkte. Die eigentliche Freigabe (gebundenes Kommando,
   z.B. `akzeptiert TARA-XXXX`) erfolgt ausschliesslich durch den PO -
   siehe `.github/copilot-instructions.md`, Abschnitt "WICHTIGSTE REGEL".

## Verifikation

- Alle 8 DoR-Kriterien aus Schritt 3 sind im Issue-Body nachvollziehbar
  erfuellt oder als offene Frage markiert.
- Das Issue enthaelt mindestens 2 als Checkbox formulierte
  Akzeptanzkriterien.
- Der Requirements-Agent hat **keinen** Board-Status gesetzt und **keine**
  Freigabeformulierung ("freigegeben"/"akzeptiert") selbst in das Issue
  geschrieben (das waere eine Rollenverletzung, siehe Nicht-Scope in
  `agents/requirements_agent/REQUIREMENTS_AGENT.md`).
- Bestehende, bereits vollstaendige Stories koennen diesen Skill
  ueberspringen (siehe `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4,
  "Optionaler Schritt -1").

## Bezug zu Regeln/Stories

- Rolle: `agents/requirements_agent/REQUIREMENTS_AGENT.md`
- Prozessschritt: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4
  ("Optionaler Schritt -1")
- Definition of Ready: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 3
- Freigabe-Regeln: `.github/copilot-instructions.md`
  (Abschnitt zur PO-Freigabe)
- TARA-ID-Vergabe: `CONTRIBUTING.md`, Abschnitt "TARA-ID Nummernschema"
