# Contributing – TARATool

## Branch-Strategie

```
main          ← Stable Release (nur via PR aus Development)
  └── Development  ← Integration Branch
        └── feature/TARA-XXXX-kurzbeschreibung  ← Story-Branch
```

| Branch                | Zweck                        | Merge-Ziel           |
| --------------------- | ---------------------------- | -------------------- |
| `main`                | Stable, tagged Releases      | –                    |
| `Development`         | Integration, immer lauffähig | `main` per PR        |
| `feature/TARA-XXXX-*` | Eine Story = ein Branch      | `Development` per PR |

**Naming-Convention:** `feature/TARA-0003-review-agent-workflow`  
**Kein direktes Pushen auf `main` oder `Development`.**

---

## Story-Workflow (Test-Driven Development)

### Voraussetzung: Story muss vom Product Owner freigegeben sein (Status: Ready → In Progress)

```
[Product Owner gibt Story frei]
        ↓
Schritt 1 – Setup
  • Status → "In Progress"
  • Branch anlegen: git checkout -b feature/TARA-XXXX-kurzbeschreibung

        ↓
Schritt 2 – Tests ZUERST schreiben ⚠️  (TDD Red-Phase)
  • Testdatei anlegen: tests/test_TARA_XXXX.py
  • Alle Akzeptanzkriterien als Testfälle abbilden
  • Bei Bug-Issue: Test schreiben, der den Bug reproduziert
  • Tests ausführen → müssen FEHLSCHLAGEN (beweist Testvalidität)
    pytest tests/test_TARA_XXXX.py -v   → Expected: FAILED

        ↓
Schritt 3 – Implementierung  (TDD Green-Phase)
  • Feature / Fix implementieren
  • Iterieren bis Story-Tests grün

        ↓
Schritt 4 – Vor dem Commit (Pflicht-Checks)
  • Schritt 4a – Prettier: npm run format:check → 0 Fehler ✅
    (Bei Formatierungsfehlern: npm run format:write, Änderungen commiten)
  • Schritt 4b – ESLint: npm run lint → Exit-Code 0 ✅
  • Schritt 4c – Story-Tests: pytest tests/test_TARA_XXXX.py -v  → PASSED ✅
  • Schritt 4d – Vollständige Suite: pytest -x -q  → 0 Fehler ✅
  • Commit: "TARA-XXXX: Beschreibung"

        ↓
Schritt 5 – Review
  • Status → "Review"
  • Review-Agent aktivieren (siehe docs/REVIEW_AGENT_WORKFLOW.md)
  • Findings beheben oder als Backlog-Items anlegen

        ↓
Schritt 6 – Prozess-Guard Freigabe
  • Prozess-Guard prüft alle Regeln (siehe .github/PROCESS_GUARD_AGENT.md)
  • ✅ PROCESS OK  → PR auf Development öffnen
  • ❌ PROCESS BLOCKED → Findings beheben, zurück zu Schritt 4

        ↓
Schritt 7 – Abschluss
  • PR gemergt → Status → "Done"
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
