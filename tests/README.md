# TARATool – Test Framework

## Übersicht

Zwei Test-Kategorien:

1. **TARA-Story-Tests** (`test_TARA_XXXX.py`) — schlanke Pytest-Tests für den TDD-Workflow, kein Browser nötig
2. **E2E-Tests** (alle anderen `test_*.py`) — Playwright-basierte Browser-Tests für die vollständige App

---

## TARA-Story-Tests (kein Playwright)

Diese Tests laufen **ohne Playwright** und prüfen Dateistruktur, Konfiguration und Workflow-Regeln.

### Voraussetzungen

```bash
cd tests
python3 -m venv .venv          # macOS/Linux
source .venv/bin/activate
pip install pytest pytest-timeout
```

```cmd
cd tests
python -m venv .venv           # Windows
.venv\Scripts\activate
pip install pytest pytest-timeout
```

### ⚠️ Wichtig: `--noconftest` immer angeben

`conftest.py` initialisiert Playwright beim Import. Ohne `--noconftest` bricht der Test-Lauf
sofort ab, wenn Playwright nicht installiert ist.

```bash
# Story-Tests ausführen (aus dem tests/-Verzeichnis):
.venv/bin/pytest test_TARA_0004.py --noconftest -v
.venv/bin/pytest test_TARA_XXXX.py --noconftest -v

# Mehrere auf einmal:
.venv/bin/pytest test_TARA_0004.py test_TARA_0020.py test_TARA_0021.py --noconftest -q

# Per Marker (alle Tests einer Story):
.venv/bin/pytest -m TARA_0022 --noconftest -v
```

### Registrierte TARA-Marker

| Marker      | Story                | Beschreibung                            |
| ----------- | -------------------- | --------------------------------------- |
| `TARA_0004` | Branch-Strategie     | Workflow-Dokumente, Prozessregeln       |
| `TARA_0006` | parse_trivy cleanup  | Entfernte Dateien                       |
| `TARA_0020` | Prettier             | Konfiguration, Scripts, .prettierignore |
| `TARA_0021` | ESLint               | Flat Config, globals, lint-Script       |
| `TARA_0022` | Workflow-Integration | Prettier+ESLint als Pflichtschritte     |
| `TARA_0024` | Canvas-Prototyp      | canvas_prototype.html                   |
| `TARA_0034` | Freigabe-Workflow    | P-15, Freigabe-Schritt                  |
| `TARA_0035` | Board-Dokumentation  | GITHUB_BOARD.md                         |
| `TARA_0036` | Dev Agent Onboarding | DEV_AGENT_ONBOARDING.md                 |
| `TARA_0037` | Tests README         | Diese Datei                             |

Neue Marker müssen in `pytest.ini` registriert werden:

```ini
[pytest]
markers =
    TARA_XXXX: Beschreibung
```

---

## E2E-Tests (Playwright erforderlich)

### Voraussetzungen

- **Python 3.10+**
- **pip**
- Playwright-Browser (Chromium)

### Option 1: Automatisch (Windows)

```cmd
cd tests
run_tests.bat
```

### Option 2: Manuell (macOS/Linux)

```bash
cd tests
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium --with-deps
pytest
```

### Option 3: Manuell (Windows)

```cmd
cd tests
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium --with-deps
pytest
```

### Tests ausführen

```bash
pytest                          # alle Tests
pytest -m smoke                 # nur Smoke-Tests
pytest -m core                  # Kernfunktionen
pytest --headed                 # Browser sichtbar (Debugging)
pytest --headed --slowmo=500    # mit Verzögerung
pytest --html=report.html --self-contained-html  # HTML-Report
pytest -n auto                  # parallel
```

### E2E-Marker

| Marker             | Beschreibung                                   |
| ------------------ | ---------------------------------------------- |
| `smoke`            | Schnelle Basis-Checks                          |
| `core`             | Kernfunktionen (Analyse-Lifecycle, Persistenz) |
| `assets`           | Asset-Management                               |
| `damage_scenarios` | Schadensszenarien & Impact-Matrix              |
| `risk_analysis`    | Risikoanalyse & Angriffsbäume                  |
| `security_goals`   | Schutzziele                                    |
| `residual_risk`    | Restrisikoanalyse                              |
| `report`           | PDF-Report-Generierung                         |
| `config`           | Konfigurationssystem                           |
| `e2e`              | Vollständige End-to-End-Workflows              |

---

## Projektstruktur

```
tests/
├── conftest.py               # Playwright-Fixtures (Achtung: --noconftest für Story-Tests!)
├── pytest.ini                # Marker, Timeout, Konfiguration
├── requirements.txt          # Python-Abhängigkeiten (inkl. Playwright)
├── run_tests.bat             # Windows Start-Skript (E2E)
├── README.md                 # Diese Datei
│
├── test_TARA_0004.py         # Story-Tests: Workflow-Dokumentation
├── test_TARA_0006.py         # Story-Tests: parse_trivy cleanup
├── test_TARA_0020.py         # Story-Tests: Prettier
├── test_TARA_0021.py         # Story-Tests: ESLint
├── test_TARA_0022.py         # Story-Tests: Workflow-Integration
├── test_TARA_0024.py         # Story-Tests: Canvas-Prototyp
├── test_TARA_0034_0037.py    # Story-Tests: Workflow-Doku & Onboarding
│
├── test_core.py              # E2E: App-Start, Tabs, Analyse-CRUD
├── test_assets.py            # E2E: Asset-Management
├── test_calculations.py      # E2E: SCHASAM-Berechnungen
├── test_config.py            # E2E: Konfiguration
├── test_damage_scenarios.py  # E2E: Schadensszenarien
├── test_risk_analysis.py     # E2E: Risikoanalyse
├── test_security_goals.py    # E2E: Schutzziele
├── test_residual_risk.py     # E2E: Restrisikoanalyse
├── test_report_versioning.py # E2E: PDF-Report
├── test_tree_export.py       # E2E: DOT-Export
└── test_e2e_workflow.py      # E2E: Vollständiger Workflow
```

## Konfiguration

Standard-Timeout pro Test: **30 Sekunden** (`pytest.ini`).
Die Test-URL wird aus dem Projektpfad berechnet (`file:///...index.html`) — kein Webserver nötig.
