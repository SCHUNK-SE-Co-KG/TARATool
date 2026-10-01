# Skill: Acceptance-Testing

## Zweck

Dieser Skill beschreibt, wie vor der finalen PO-Akzeptanz einer Story
(Schritt 7 des Story-Workflows, P-25) eine strukturierte
Entscheidungsgrundlage fuer den PO aufbereitet wird: Abgleich der
Testergebnisse gegen die im Issue formulierten Akzeptanzkriterien, Stand
des Reviews (offene Critical/High-Findings?) und Status des
Prozess-Guards. Er ist das konkrete, **heute manuell vom Dev-Agent
durchgefuehrte** "Wie" zu dem konzeptionell beschriebenen
**Acceptance-Agent** (`agents/acceptance_agent/ACCEPTANCE_AGENT.md`).

**Wichtig (PO-Entscheidung TARA-0118):** Der Acceptance-Agent selbst ist
in diesem Epic **nicht implementiert** - dieser Skill beschreibt daher die
Vorgehensweise, die der **Dev-Agent** bis zu einer moeglichen spaeteren
Implementierung manuell durchfuehrt, nicht die Aktivierung eines
eigenstaendigen Agenten.

## Voraussetzungen

- Die Story-Implementierung ist fertig, Review-Agent-Durchlauf
  abgeschlossen (Skill `independent-code-review`), Prozess-Guard ist
  gruen (Schritt 6 des Story-Workflows).
- Ein PR auf `development` ist eroeffnet.
- Die Akzeptanzkriterien-Liste aus dem Story-Issue liegt vor.

## Schritte

1. **Akzeptanzkriterien-Abgleich erstellen.** Fuer jedes im Issue
   formulierte Akzeptanzkriterium wird im PR-Kommentar oder Chat
   dokumentiert, durch welchen Test es abgedeckt ist (Testname/Testfall).
   Nicht abgedeckte Kriterien muessen vor der Uebergabe an den PO
   nachgezogen werden (zurueck zu Skill `tdd-development`).

2. **Review-Status zusammenfassen.** Aus dem P-10-Review-Nachweis
   (Skill `independent-code-review`, Schritt 6) werden `critical` und
   `high` extrahiert. Beide muessen `0` sein, sonst ist die Story noch
   nicht bereit fuer die PO-Akzeptanz.

3. **Prozess-Guard-Status pruefen.** Alle CI-Checks (`gh pr checks <NNN>`)
   muessen gruen sein: Unit Tests, Playwright (falls zutreffend),
   Prozess-Guard Compliance Check.

4. **Zusammenfassung dem PO vorlegen**, z.B.:

   ```
   [TARA-XXXX] Bereit zur Akzeptanz:
   - Akzeptanzkriterien: 4/4 durch Tests abgedeckt
   - Review: 0 Critical, 0 High (P-10-Nachweis SHA <sha>)
   - Prozess-Guard: alle Checks gruen
   -> Bitte "akzeptiert TARA-XXXX" auf PR #<NNN> posten
   ```

5. **Auf das gebundene PO-Kommando warten.** Die **finale fachliche
   Entscheidung** trifft ausschliesslich der PO ueber ein an die TARA-ID
   gebundenes Kommando auf dem PR (`akzeptiert TARA-XXXX`, siehe
   `.github/copilot-instructions.md`). Dieser Skill (und ein zukuenftiger
   Acceptance-Agent) darf diese Entscheidung **nicht** vorwegnehmen oder
   automatisch simulieren.

6. **Automatisierte Status-Transition abwarten/pruefen.** Nach dem
   PO-Kommando sollte `po-approve.yml` (`check-po-acceptance-pr`) den
   Status automatisch auf "Accepted" setzen. Falls nicht (siehe bekannte
   Automatisierungsluecken, Issue #211), Board-Status manuell pruefen und
   ggf. als dokumentierte Bootstrap-Ausnahme nachziehen.

## Verifikation

- Jedes Akzeptanzkriterium aus dem Issue ist einem konkreten Testfall
  zugeordnet.
- Der dem PO vorgelegte Status (Review 0/0 Critical/High, CI gruen) ist
  zum Zeitpunkt der Vorlage aktuell (SHA-Uebereinstimmung mit PR-Head).
- Es wurde **keine** eigene Freigabeformulierung durch den Dev-Agent oder
  diesen Skill erzeugt - nur die Entscheidungsgrundlage.

## Bezug zu Regeln/Stories

- Konzeptionelle Rolle: `agents/acceptance_agent/ACCEPTANCE_AGENT.md`
  (nicht implementiert, nur Dokumentation)
- Prozessschritt: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4 (Schritt 7)
- PO-Akzeptanz-Gate: P-25,
  `scripts/process_guard/po_acceptance_gate.py`
- Review-Nachweis-Format: Skill `independent-code-review`
