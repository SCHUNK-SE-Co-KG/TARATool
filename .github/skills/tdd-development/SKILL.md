# Skill: TDD-Development

## Zweck

Dieser Skill beschreibt die konkrete, wiederholbare Vorgehensweise fuer
Test-Driven Development innerhalb einer TARATool-Story: Red-Phase (Tests
zuerst, muessen fehlschlagen), Green-Phase (Implementierung, bis Tests
gruen sind) und den robusten TDD-Nachweis aus TARA-0111 (Tests sowohl
gegen den Basis-Branch als auch gegen den PR-Head ausfuehren). Er ist das
konkrete "Wie" zu **Schritt 1-4** des Story-Workflows
(`docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4) fuer den **Dev-Agent**.

Dieser Skill dupliziert keine dauerhaften Regeln (P-01 bis P-27) - er
verweist darauf. Die verbindlichen Gate-Checklisten (Gate 1/Gate 2 vor
Commit/PR) stehen ausschliesslich in `.github/copilot-instructions.md`.

## Voraussetzungen

- Die Story ist vom PO freigegeben (siehe Skill `story-refinement` bzw.
  direkte PO-Freigabe im Chat/Issue-Kommentar).
- Board-Status wurde bereits auf "In Progress" gesetzt (P-02,
  `gh workflow run transition.yml -f story=TARA-XXXX -f to="In Progress"`).
- Ein Feature-Branch `feature/TARA-XXXX-kurzbeschreibung` existiert
  (von `development` abgezweigt).

## Schritte

1. **Testdatei anlegen (Red-Phase).** `tests/test_TARA_XXXX.py` erstellen
   und **alle** Akzeptanzkriterien der Story als pytest-Testfaelle
   abbilden (siehe `tests/test_TARA_0116.py` als Referenzbeispiel fuer
   Struktur und Benennung).

2. **Tests gegen den aktuellen Stand ausfuehren - muessen fehlschlagen.**
   Dies beweist die Testvaliditaet (ein Test, der schon vor der
   Implementierung "gruen" ist, testet nichts):

   ```bash
   cd tests
   python -m pytest test_TARA_XXXX.py --noconftest -v
   # Erwartung: FAILED (mindestens ein Test schlaegt fehl)
   ```

3. **Red-Commit (Pflicht fuer P-04).** Test-Datei und Implementierung
   MUESSEN als **separate Commits** eingecheckt werden - nur so kann der
   Prozess-Guard die Red-Phase automatisch verifizieren (`check_red_phase.sh`).

   ```bash
   git add tests/test_TARA_XXXX.py
   git commit -m "TARA-XXXX: TDD Red - Tests schreiben (noch fehlgeschlagen)"
   git push origin feature/TARA-XXXX-...
   ```

4. **Implementierung (Green-Phase).** Feature/Fix implementieren,
   iterieren bis alle Story-Tests gruen sind:

   ```bash
   python -m pytest test_TARA_XXXX.py --noconftest -v
   # Erwartung: PASSED (alle Tests)
   ```

5. **Robuster TDD-Nachweis (TARA-0111).** Vor dem Review-Nachweis werden
   die Story-Tests **zweimal** ausgefuehrt, um einen "False Green" (Test
   besteht nur zufaellig, nicht weil die Implementierung korrekt ist)
   auszuschliessen:
   - einmal gegen den **PR-Head** (muss PASSED sein),
   - einmal gegen den **Basis-Branch** (`development`, vor dem
     Feature-Commit) - hier muss der Test wieder FAILED sein (sonst war
     der Test nie wirklich rot, z.B. weil er versehentlich immer "true"
     zurueckgibt).

6. **Qualitaetssicherung vor dem Green-Commit (Pflicht-Checks).**
   - Prettier (nur bei JS/HTML/CSS-Aenderungen): `npm run format:check`
   - ESLint (nur bei JS-Aenderungen): `npm run lint`
   - Story-Tests: `python -m pytest test_TARA_XXXX.py --noconftest -v` -> PASSED
   - Gesamtsuite (Regression): `python -m pytest test_TARA_*.py --noconftest -q`
     aus dem `tests/`-Verzeichnis (siehe `docs/ENTWICKLUNGSPROZESS.md`,
     Abschnitt 6 "Tests") - 0 neue Fehler.

7. **Green-Commit.**

   ```bash
   git add <geaenderte Dateien>
   git commit -m "TARA-XXXX: Implementierung - Tests gruen"
   git push origin feature/TARA-XXXX-...
   ```

## Verifikation

- Red-Commit und Green-Commit sind zwei separate Commits im PR-Diff
  sichtbar (nicht zu einem Commit zusammengefasst).
- `python -m pytest test_TARA_XXXX.py --noconftest -v` ist PASSED gegen
  den finalen Stand.
- Die volle Regressionssuite (`test_TARA_*.py`) ist PASSED (keine
  bestehende Story durch die Aenderung gebrochen).
- Bei JS/HTML/CSS-Aenderungen: Prettier und ESLint fehlerfrei.
- Gate 1 der Checkliste in `.github/copilot-instructions.md` ist im Chat
  explizit bestaetigt, bevor der naechste Schritt (Review) beginnt.

## Bezug zu Regeln/Stories

- Prozessschritt: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4
  (Schritt 1-4), Abschnitt 6 ("Technische Qualitaetssicherung")
- TDD-Detailworkflow: `CONTRIBUTING.md`, Abschnitt "Story-Workflow
  (Test-Driven Development)"
- Red-Phase-Pruefung: `scripts/process_guard/check_red_phase.sh`,
  `scripts/process_guard/check_final_red_green.sh` (P-04/P-06)
- Robuster TDD-Nachweis: TARA-0111 (Tests gegen Basis-Branch UND PR-Head)
- Gate-Checkliste vor Commit/PR: `.github/copilot-instructions.md`
  ("VERBINDLICHES GATE vor Commit/PR")
