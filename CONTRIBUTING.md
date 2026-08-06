# Contributing â€“ TARATool

## Branch-Strategie

```
main          â† Stable Release (nur via PR aus Development)
  â””â”€â”€ Development  â† Integration Branch
        â””â”€â”€ feature/TARA-XXXX-kurzbeschreibung  â† Story-Branch
```

| Branch                | Zweck                        | Merge-Ziel           |
| --------------------- | ---------------------------- | -------------------- |
| `main`                | Stable, tagged Releases      | â€“                  |
| `Development`         | Integration, immer lauffähig | `main` per PR        |
| `feature/TARA-XXXX-*` | Eine Story = ein Branch      | `Development` per PR |

**Naming-Convention:** `feature/TARA-0003-review-agent-workflow`  
**Kein direktes Pushen auf `main` oder `Development`.**

---

## Story-Workflow (Test-Driven Development)

### Voraussetzung: Story muss vom Product Owner freigegeben sein (PO-OK im Chat oder Issue)

> **TDD-Pflicht: 2-Commit-Sequenz** — Schritt 2 (Test) und Schritt 3 (Implementierung)
> **muessen als separate Commits** eingecheckt werden. Nur so kann der Prozess-Guard (P-04)
> die Red-Phase automatisch verifizieren. Ein einzelner Commit mit Test + Implementierung
> gilt als **P-04-Verletzung** und blockiert den PR.

```
[Product Owner gibt Story frei]
        |
Schritt 1 - Setup
  * Status -> "In Progress"  (Board-Status via scripts/set_story_status.py)
  * Branch anlegen: git checkout -b feature/TARA-XXXX-kurzbeschreibung

        |
Schritt 2 - Tests ZUERST schreiben  (TDD Red-Phase)
  * Testdatei anlegen: tests/test_TARA_XXXX.py
  * Alle Akzeptanzkriterien als Testfaelle abbilden
  * Tests ausfuehren -> muessen FEHLSCHLAGEN (beweist Testvaliditaet)
    pytest tests/test_TARA_XXXX.py --noconftest -v  -> Expected: FAILED

  *** RED-COMMIT (Pflicht fuer P-04) ***
    git add tests/test_TARA_XXXX.py
    git commit -m "TARA-XXXX: TDD Red - Tests schreiben (noch fehlgeschlagen)"
    git push origin feature/TARA-XXXX-...
    -> Dieser Commit beweist die Red-Phase. P-04 prueft ihn automatisch im PR.

        |
Schritt 3 - Implementierung  (TDD Green-Phase)
  * Feature / Fix implementieren
  * Iterieren bis Story-Tests gruen:
    pytest tests/test_TARA_XXXX.py --noconftest -v  -> Expected: PASSED

        |
Schritt 4 - Vor dem Green-Commit (Pflicht-Checks)
  * Schritt 4a - Prettier: npm run format:check -> 0 Fehler
    (N/A fuer reine Python-Stories ohne JS/HTML-Aenderungen)
  * Schritt 4b - ESLint:   npm run lint -> Exit-Code 0
    (N/A fuer reine Python-Stories ohne JS-Aenderungen)
  * Schritt 4c - Story-Tests: pytest tests/test_TARA_XXXX.py --noconftest -v -> PASSED
  * Schritt 4d - Gesamtsuite: pytest tests/ --noconftest -q -> 0 neue Fehler

  *** GREEN-COMMIT (Pflicht) ***
    git add <geaenderte Dateien>
    git commit -m "TARA-XXXX: Implementierung - Tests gruen"
    git push origin feature/TARA-XXXX-...

        |
Schritt 5 - Review
  * Status -> "inReview"
  * PR auf Development oeffnen
  * Review-Agent aktivieren (siehe agents/review_agent/REVIEW_AGENT_WORKFLOW.md)
  * Findings beheben oder als Backlog-Items anlegen

        |
Schritt 6 - Prozess-Guard Pruefung (automatisch via GitHub Actions bei PR)
  * GitHub Actions prueft P-04, P-06, P-07, P-08, P-12, P-13 automatisch
  * PROCESS OK  -> PR mergen
  * PROCESS BLOCKED -> Findings beheben, zurueck zu Schritt 4

        |
Schritt 7 - Merge
  * PR gemergt -> Status -> "Freigabe"
  * Dev-Agent wartet auf explizites PO-OK

        |
Schritt 8 - PO-Freigabe (Pflicht)
  * Product Owner prueft das Ergebnis lokal
  * PO gibt explizites OK -> Status -> "Done"
  * Ohne PO-Freigabe: Status bleibt auf "Freigabe"
```

---

## Test-Benennung

```bash
tests/test_TARA_XXXX.py          # dedizierte Story-Testdatei (bevorzugt)
# oder in bestehendem Modul mit Marker:
@pytest.mark.TARA_XXXX
def test_feature_name():
    ...
```

Ausführung:

```bash
pytest tests/test_TARA_XXXX.py -v    # Story-Tests
pytest -m "TARA_XXXX" -v             # per Marker
pytest -x -q                          # vollständige Suite (vor PR Pflicht)
```

---

## Commit-Message Format

```
TARA-XXXX: Kurzbeschreibung im Imperativ

Optionaler längerer Erklärungstext.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Chat-Regeln für den Dev-Agent

- **Jede Chat-Antwort nennt die aktive TARA-ID** der bearbeiteten Items
- **Keine Arbeit ohne Freigabe** durch den Product Owner
- **Status-Updates** sofort nach Statuswechsel ins Board eintragen

---

## TARA-ID Nummernschema

IDs sind **atomar und unveränderlich** (P-14). So ermittelst du die nächste freie ID:

```bash
# Höchste vorhandene TARA-ID aus allen Issues ermitteln
gh issue list --state all --limit 200 --json title \
  | python3 -c "
import sys, json, re
issues = json.load(sys.stdin)
ids = [int(m.group(1)) for t in issues for m in [re.search(r'TARA-(\d+)', t['title'])] if m]
print(f'Höchste ID: TARA-{max(ids):04d}  â†’  Nächste: TARA-{max(ids)+1:04d}')
"
```

Oder manuell: höchste Nummer in GitHub Issues suchen + 1.

---

## Ausnahmen vom Standard-Workflow

| Ausnahme      | Bedingung                                                                            | Was entfällt                          |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| **Prototyp**  | Issue-Titel enthält â€žPrototyp" oder ist explizit als Machbarkeitsnachweis markiert | Review-Agent (kein Code-Review nötig) |
| **Bootstrap** | Allererste Story eines neuen Feature-Branch-Schemas                                  | P-07 (Branch-Naming)                  |

Ausnahmen müssen vom PO explizit genehmigt werden und im Issue dokumentiert sein.
