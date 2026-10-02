---
applyTo: "tests/**"
---

# Instructions: Tests (`tests/**`)

- **TDD ist verbindlich (P-03/P-04/P-04b):** Vor jeder Implementierung wird
  zuerst die Testdatei `tests/test_TARA_XXXX.py` angelegt/erweitert und muss
  initial **fehlschlagen** (Red-Phase), bevor der Code dazu geschrieben wird
  (Green-Phase).
- **Story-Tests laufen isoliert:** `pytest tests/test_TARA_XXXX.py --noconftest -v`
  bzw. `python -m pytest test_TARA_XXXX.py --noconftest -q` aus dem
  `tests/`-Verzeichnis heraus.
- **Regressionsschutz (P-06b):** Wurde zusaetzlich zur Story-Testdatei auch
  gemeinsam genutzter Code veraendert (`scripts/`, andere Testdateien,
  Anwendungscode, Workflow-YAML), muss die volle Suite gruen sein:
  ```
  cd tests; $files = Get-ChildItem -Name "test_TARA_*.py"; python -m pytest $files --noconftest -q
  ```
- **Keine Doppelausfuehrung von Setup-Fixtures:** `--noconftest` verhindert,
  dass die globale `conftest.py` (App-Startup, Browser-Fixtures) fuer reine
  Unit-Tests unnoetig mitlaeuft - siehe `tests/README.md`.
- **Pfad-Konstanten bei Doku-Assertions:** Tests, die den Inhalt von
  Prozessdokumenten pruefen (z.B. `.github/agents/*.agent.md`,
  `.github/copilot-instructions.md`), muessen bei einer Umbenennung/
  Verschiebung dieser Dateien (wie in TARA-0120 geschehen) mit aktualisiert
  werden - das ist Teil der jeweiligen Story, kein separates Ticket.
- **Keine Mojibake-Regression:** Encoding-Checks (`â€“`, `Ã¤` usw.) in
  generierten Prozessdokumenten sind Pflichttests (siehe `test_TARA_0116.py`).
