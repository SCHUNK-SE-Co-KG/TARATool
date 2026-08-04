# Contributing â€“ TARATool

## Branch-Strategie

```
main          â† Stable Release (nur via PR aus Development)
  â””â”€â”€ Development  â† Integration Branch
        â””â”€â”€ feature/TARA-XXXX-kurzbeschreibung  â† Story-Branch
```

| Branch                | Zweck                        | Merge-Ziel           |
| --------------------- | ---------------------------- | -------------------- |
| `main`                | Stable, tagged Releases      | â€“                    |
| `Development`         | Integration, immer lauffÃ¤hig | `main` per PR        |
| `feature/TARA-XXXX-*` | Eine Story = ein Branch      | `Development` per PR |

**Naming-Convention:** `feature/TARA-0003-review-agent-workflow`  
**Kein direktes Pushen auf `main` oder `Development`.**

---

## Story-Workflow (Test-Driven Development)

### Voraussetzung: Story muss vom Product Owner freigegeben sein (Status: Ready â†’ In Progress)

```
[Product Owner gibt Story frei]
        â†“
Schritt 1 â€“ Setup
  â€¢ Status â†’ "In Progress"
  â€¢ Branch anlegen: git checkout -b feature/TARA-XXXX-kurzbeschreibung

        â†“
Schritt 2 â€“ Tests ZUERST schreiben âš ï¸  (TDD Red-Phase)
  â€¢ Testdatei anlegen: tests/test_TARA_XXXX.py
  â€¢ Alle Akzeptanzkriterien als TestfÃ¤lle abbilden
  â€¢ Bei Bug-Issue: Test schreiben, der den Bug reproduziert
  â€¢ Tests ausfÃ¼hren â†’ mÃ¼ssen FEHLSCHLAGEN (beweist TestvaliditÃ¤t)
    pytest tests/test_TARA_XXXX.py -v   â†’ Expected: FAILED

        â†“
Schritt 3 â€“ Implementierung  (TDD Green-Phase)
  â€¢ Feature / Fix implementieren
  â€¢ Iterieren bis Story-Tests grÃ¼n

        â†“
Schritt 4 â€“ Vor dem Commit (Pflicht-Checks)
  â€¢ Schritt 4a â€“ Prettier: npm run format:check â†’ 0 Fehler âœ…
    (Bei Formatierungsfehlern: npm run format:write, Ã„nderungen commiten)
  â€¢ Schritt 4b â€“ ESLint: npm run lint â†’ Exit-Code 0 âœ…
  â€¢ Schritt 4c â€“ Story-Tests: pytest tests/test_TARA_XXXX.py -v  â†’ PASSED âœ…
  â€¢ Schritt 4d â€“ VollstÃ¤ndige Suite: pytest tests/test_TARA_XXXX.py --noconftest -q â†’ 0 Fehler âœ…
    (VollstÃ¤ndige Playwright-Suite: pytest -x -q â€“ nur wenn Playwright installiert)
  â€¢ Commit: "TARA-XXXX: Beschreibung"

        â†“
Schritt 5 â€“ Review
  â€¢ Status â†’ "inReview"
  â€¢ Review-Agent aktivieren (siehe agents/review_agent/REVIEW_AGENT_WORKFLOW.md)
  â€¢ Findings beheben oder als Backlog-Items anlegen

        â†“
Schritt 6 â€“ Prozess-Guard PrÃ¼fung
  â€¢ Prozess-Guard prÃ¼ft alle Regeln (siehe agents/process_guard/PROCESS_GUARD_AGENT.md)
  â€¢ âœ… PROCESS OK  â†’ PR auf Development Ã¶ffnen
  â€¢ âŒ PROCESS BLOCKED â†’ Findings beheben, zurÃ¼ck zu Schritt 4

        â†“
Schritt 7 â€“ Merge
  â€¢ PR gemergt â†’ Status â†’ "Freigabe"
  â€¢ Dev-Agent wartet auf explizites PO-OK (Chat-Nachricht oder Issue-Kommentar)

        â†“
Schritt 7b - Lokalen Dev-Stand aktualisieren (Pflicht)
  * Dev-Agent pullt nach jedem Merge aktuellen Development-Stand:
    git checkout Development
    git pull
  * Lokales Verzeichnis: <lokales-repo-verzeichnis>
  * PO kann anschliessend lokal testen bevor er die Freigabe erteilt

        u{2193}

Schritt 8 â€“ PO-Freigabe (Pflicht)
  â€¢ Product Owner prÃ¼ft das Ergebnis
  â€¢ PO gibt explizites OK â†’ Status â†’ "Done"
  â€¢ âŒ Ohne PO-Freigabe: Status bleibt auf "Freigabe" â€“ Dev-Agent setzt NICHT auf Done
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

AusfÃ¼hrung:

```bash
pytest tests/test_TARA_XXXX.py -v    # Story-Tests
pytest -m "TARA_XXXX" -v             # per Marker
pytest -x -q                          # vollstÃ¤ndige Suite (vor PR Pflicht)
```

---

## Commit-Message Format

```
TARA-XXXX: Kurzbeschreibung im Imperativ

Optionaler lÃ¤ngerer ErklÃ¤rungstext.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## Chat-Regeln fÃ¼r den Dev-Agent

- **Jede Chat-Antwort nennt die aktive TARA-ID** der bearbeiteten Items
- **Keine Arbeit ohne Freigabe** durch den Product Owner
- **Status-Updates** sofort nach Statuswechsel ins Board eintragen

---

## TARA-ID Nummernschema

IDs sind **atomar und unverÃ¤nderlich** (P-14). So ermittelst du die nÃ¤chste freie ID:

```bash
# HÃ¶chste vorhandene TARA-ID aus allen Issues ermitteln
gh issue list --state all --limit 200 --json title \
  | python3 -c "
import sys, json, re
issues = json.load(sys.stdin)
ids = [int(m.group(1)) for t in issues for m in [re.search(r'TARA-(\d+)', t['title'])] if m]
print(f'HÃ¶chste ID: TARA-{max(ids):04d}  â†’  NÃ¤chste: TARA-{max(ids)+1:04d}')
"
```

Oder manuell: hÃ¶chste Nummer in GitHub Issues suchen + 1.

---

## Ausnahmen vom Standard-Workflow

| Ausnahme      | Bedingung                                                                          | Was entfÃ¤llt                          |
| ------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| **Prototyp**  | Issue-Titel enthÃ¤lt â€žPrototyp" oder ist explizit als Machbarkeitsnachweis markiert | Review-Agent (kein Code-Review nÃ¶tig) |
| **Bootstrap** | Allererste Story eines neuen Feature-Branch-Schemas                                | P-07 (Branch-Naming)                  |

Ausnahmen mÃ¼ssen vom PO explizit genehmigt werden und im Issue dokumentiert sein.
