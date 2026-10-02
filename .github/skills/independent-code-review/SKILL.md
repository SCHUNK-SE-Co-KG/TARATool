# Skill: Independent-Code-Review

## Zweck

Dieser Skill beschreibt die konkrete Vorgehensweise, mit der der
**Review-Agent** (`.github/agents/reviewer.agent.md`) eine
Story-Implementierung unabhaengig vom Dev-Agent prueft - inklusive der
unabhaengigen Diff-Verifikation (TARA-0102), der Review-Rules R-01 bis
R-36 und der dokumentierten Review-Agent-Unabhaengigkeit (TARA-0114,
TARA-0115). Er ist das konkrete "Wie" zu **Schritt 5** des
Story-Workflows (`docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4).

Dieser Skill dupliziert nicht die vollstaendige R-01-bis-R-36-Liste; diese
bleibt Single Source of Truth in `docs/process_definition.yml` bzw. dem
generierten Abschnitt in `.github/agents/reviewer.agent.md`.

## Voraussetzungen

- Die Story-Implementierung ist abgeschlossen (TDD Green-Phase, siehe
  Skill `tdd-development`), Story-Tests sind PASSED.
- Der Review-Agent wird als **separater Sub-Agent-Kontext** aktiviert
  (TARA-0114/#185, TARA-0107/#177) - niemals als Moduswechsel im
  Dev-Agent-Kontext, da ein Agent, der die Implementierung selbst
  geschrieben hat, strukturell voreingenommen ist
  ("already-biased-toward-convenient-implementation").
- Ein PR auf `development` ist eroeffnet oder zumindest der Branch
  existiert remote.

## Schritte

1. **Uebergabe vom Dev-Agent entgegennehmen.** Erwartete Angaben:
   Story-ID, Branch, PR-Nummer, geaenderte Dateien (Selbstauskunft),
   Commit-SHA, TDD-Test-Status.

2. **Unabhaengige Diff-Verifikation (TARA-0102).** Die vom Dev-Agent
   genannte Dateiliste ist eine Selbstauskunft und kann unvollstaendig
   sein. Der Review-Agent verifiziert selbst:

   ```bash
   gh pr diff <PR-Nummer> --name-only
   # oder ohne PR:
   git diff --name-only development...feature/TARA-XXXX-...
   ```

   Weicht das Ergebnis ab, wird dies im Review-Bericht vermerkt und der
   Pruefumfang entsprechend erweitert.

3. **Pruefkatalog R-01 bis R-36 anwenden.** Kategorien: Korrektheit,
   Architektur, Sicherheit, Tests, Qualitaet, Runtime (siehe
   `docs/process_definition.yml`, Abschnitt `review_rules`, und die
   generierte Tabelle in `.github/agents/reviewer.agent.md`).
   Fuer Browser-Laufzeitpruefungen (Runtime-Kategorie) zusaetzlich den
   Runtime-Scanner aktivieren:

   ```bash
   python agents/review_agent/runtime_scanner.py \
     --url <APP_URL> --output security/reports/ --modules all
   ```

4. **Sicherheitsrelevante Findings gesondert behandeln.** Fuer
   Findings der Kategorie "Sicherheit" (R-07, R-08) oder bei Verdacht auf
   tiefergehende Schwachstellen: den Skill `security-review` (CLI-
   Subagent `security-review`) zusaetzlich aufrufen statt die Pruefung
   ausschliesslich manuell im Review-Agent-Kontext durchzufuehren.

5. **Findings als GitHub Issues anlegen** (Label `review-finding`, **nicht**
   `process-violation` - das ist dem Prozess-Guard vorbehalten, siehe
   Abgrenzung in `.github/agents/reviewer.agent.md`).
   Severity-Einstufung je Finding (Critical/High/Medium/Low) gemaess
   Review-Agent-Dokument.

6. **P-10-Review-Nachweis posten** (SHA-gebunden, TARA-0107-Format) als
   PR-Kommentar:

   ```json
   {
     "story": "TARA-XXXX",
     "pull_request": <NNN>,
     "reviewed_head_sha": "<aktueller PR-Head-SHA>",
     "review_profile_version": "1.0",
     "result": "passed",
     "critical": 0,
     "high": 0,
     "timestamp": "<ISO-8601>",
     "findings_issue": null
   }
   ```

   **Wichtig:** Wird nach dem Review erneut gepusht (z.B. Merge-Konflikt-
   Aufloesung), muss dieser Nachweis mit der NEUEN Head-SHA erneut gepostet
   werden - der Prozess-Guard (P-10) vergleicht exakt.

7. **Dev-Agent uebernimmt Findings-Behebung.** Critical/High: Pflicht vor
   Merge. Medium/Low: koennen als Backlog-Items dokumentiert werden (PO-
   Entscheidung).

## Verifikation

- Das unabhaengig ermittelte Diff (Schritt 2) stimmt mit dem vom
  Dev-Agent gemeldeten ueberein, oder Abweichungen sind dokumentiert.
- Jedes Finding ist als eigenes GitHub-Issue mit Label `review-finding`
  und Severity erfasst.
- Der P-10-JSON-Kommentar referenziert exakt den aktuellen PR-Head-SHA.
- Keine offenen Critical/High-Findings vor Uebergabe an den Prozess-Guard
  (Schritt 6 des Story-Workflows).

## Bezug zu Regeln/Stories

- Rolle: `.github/agents/reviewer.agent.md`
- Prozessschritt: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4 (Schritt 5)
- Review-Rules R-01 bis R-36: `docs/process_definition.yml`
  (Abschnitt `review_rules`)
- Unabhaengige Diff-Verifikation: TARA-0102
- Review-Agent-Unabhaengigkeit: TARA-0114 (#185), TARA-0115
- P-10-Review-Nachweis: TARA-0107, geprueft durch
  `scripts/process_guard/check_review_agent_invoked.sh`
- Sicherheitspruefung: Skill `security-review`
