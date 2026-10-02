# Skill: Security-Review

## Zweck

Dieser Skill beschreibt, wann und wie der bestehende **CLI-Subagent vom
Agent-Typ `security-review`** im Kontext einer TARATool-Story aufgerufen
wird, und wie mit dessen Ergebnissen im Review-Prozess weiter zu verfahren
ist. **PO-Entscheidung (TARA-0119):** Dieser Skill definiert bewusst
**keine eigene, TARATool-spezifische Sicherheits-Checkliste** - er
referenziert ausschliesslich den bereits vorhandenen, allgemeinen
CLI-Subagenten und bettet dessen Nutzung in den bestehenden
Review-Workflow ein.

## Voraussetzungen

- Eine Story hat Aenderungen, die sicherheitsrelevant sein koennen:
  Authentifizierung, Eingabeverarbeitung/Parsing, DOM-Manipulation mit
  Nutzereingaben, neue externe Abhaengigkeiten (CDN/Pakete), Export-/
  Import-Funktionen oder Aenderungen an Datenhaltung/Storage.
- Der Review-Agent hat die Pruefkatalog-Kategorie "Sicherheit" (R-07,
  R-08, siehe `docs/process_definition.yml`) bereits angewendet (Skill
  `independent-code-review`) und haelt eine vertiefte Pruefung fuer
  sinnvoll, ODER der PO fordert explizit `/security-review` an.

## Schritte

1. **Trigger erkennen.** Mindestens einer der folgenden Faelle liegt vor:
   - Explizite PO-Anfrage ("/security-review" oder "Sicherheitsluecken
     pruefen").
   - R-07/R-08-Verdacht im Review-Agent-Durchlauf (z.B. neue CDN-
     Abhaengigkeit ohne SRI-Hash, `eval()`-Nutzung, unsichere
     DOM-Manipulation mit Nutzereingaben).
   - Risikobasierte Vollregressions-Trigger-Kategorie "Authentifizierung
     oder Security" (siehe TARA-0125, `docs/ENTWICKLUNGSPROZESS.md`).

2. **Subagenten aufrufen.** Der Review-Agent (bzw. Dev-Agent, falls kein
   separater Review-Agent-Kontext noetig ist) delegiert an den
   CLI-Subagenten mit `agent_type: security-review`:

   ```
   task(
     agent_type="security-review",
     name="TARA-XXXX-security-review",
     description="Sicherheitsreview fuer TARA-XXXX",
     prompt="<Kontext: betroffene Dateien, Diff, Story-Beschreibung>"
   )
   ```

   Der Subagent arbeitet **read-only** auf dem Diff/den betroffenen
   Dateien und liefert eine strukturierte Befundliste mit Severity
   (Critical/High/Medium/Low) und Confidence-Score zurueck.

3. **Ergebnisse als Tabelle praesentieren.** Format (siehe
   Security-Review-Caller-Contract): Spalten Severity-Icon (🔴/🟠/🟡/⚪),
   Datei, Zeilen, Beschreibung, Confidence.

4. **Findings in den Review-Prozess einordnen.** Jedes gemeldete Finding
   wird wie ein normales Review-Finding behandelt: GitHub-Issue mit Label
   `review-finding` anlegen (siehe Skill `independent-code-review`,
   Schritt 5), Severity aus dem Subagenten-Ergebnis uebernehmen.
   Critical/High-Findings sind vor Merge verpflichtend zu beheben
   (gleiche Regel wie fuer alle anderen Review-Findings).

5. **Dem PO Optionen anbieten.** Nach Praesentation der Tabelle:
   "Fix highest severity issues" / "Fix all issues" / "Commit a summary
   of findings" (`SECURITY-REVIEW.md`) - PO entscheidet, welche Option
   gewaehlt wird.

6. **Nachbearbeitung.** Gewaehlte Fixes werden als normale TDD-Iteration
   (Skill `tdd-development`) umgesetzt: Test ergaenzen/anpassen,
   Implementierung fixen, Regression erneut gruen.

## Verifikation

- Kein eigener Sicherheits-Pruefkatalog wurde in diesem Skill oder in
  einer anderen TARATool-spezifischen Datei neu definiert - die
  inhaltliche Pruefung erfolgt ausschliesslich durch den bestehenden
  `security-review`-Subagenten.
- Jedes vom Subagenten gemeldete Finding ist als GitHub-Issue mit Label
  `review-finding` nachvollziehbar.
- Kritische/hohe Findings sind vor dem Merge der Story behoben oder vom
  PO explizit als akzeptiertes Restrisiko dokumentiert.

## Bezug zu Regeln/Stories

- CLI-Subagent: Agent-Typ `security-review` (read-only Tool-Zugriff)
- Uebergeordneter Review-Prozess: Skill `independent-code-review`,
  `.github/agents/reviewer.agent.md`
- Review-Rules Sicherheit (R-07, R-08): `docs/process_definition.yml`
- Risikobasierte Vollregression bei Security-Aenderungen: TARA-0125
