# TARATool – Test Framework

## Übersicht

Vollständiges E2E-Testframework für das TARATool basierend auf **Python**, **pytest** und **Playwright**.

## Voraussetzungen

- **Python 3.10+** (empfohlen: 3.12)
- **pip** (wird mit Python mitgeliefert)

## Schnellstart

### Option 1: Automatisch (Windows)

```cmd
cd tests
run_tests.bat
```

Das Skript erstellt automatisch ein Virtual Environment, installiert alle Abhängigkeiten und führt die Tests aus.

### Option 2: Manuell

```cmd
cd tests

# Virtual Environment erstellen & aktivieren
python -m venv .venv
.venv\Scripts\activate

# Abhängigkeiten installieren
pip install -r requirements.txt

# Playwright Browser installieren
playwright install chromium --with-deps

# Alle Tests ausführen
pytest
```

## Tests ausführen

### Alle Tests

```cmd
pytest
```

### Nur Smoke-Tests (schnelle Prüfung)

```cmd
pytest -m smoke
```

### Nur eine Kategorie

```cmd
pytest -m core           # App-Startup, Navigation, Analyse-Lifecycle
pytest -m assets         # Asset-Verwaltung
pytest -m damage_scenarios  # Schadensszenarien & Impact-Matrix
pytest -m risk_analysis  # Risikoanalyse & Angriffsbäume
pytest -m security_goals # Schutzziele
pytest -m residual_risk  # Restrisikoanalyse
pytest -m report         # PDF-Report
pytest -m e2e            # Vollständige Workflow-Tests
```

### Mit HTML-Report

```cmd
pytest --html=report.html --self-contained-html
```

### Headed Mode (Browser sichtbar)

```cmd
pytest --headed
```

### Einzelne Testdatei

```cmd
pytest test_core.py
pytest test_assets.py -v
```

### Einzelnen Test

```cmd
pytest test_core.py::TestAppStartup::test_page_title
```

### Parallel (schneller)

```cmd
pytest -n auto
```

## Projektstruktur

```
tests/
├── conftest.py               # Fixtures, Hilfsfunktionen, Konfiguration
├── pytest.ini                # pytest-Konfiguration & Marker
├── requirements.txt          # Python-Abhängigkeiten
├── run_tests.bat             # Windows Start-Skript
├── README.md                 # Diese Datei
│
├── test_core.py              # App-Start, Tabs, Analyse-CRUD, Persistenz
├── test_assets.py            # Asset CRUD, CIA-Werte, Cards
├── test_damage_scenarios.py  # Schadensszenarien CRUD, Impact-Matrix
├── test_risk_analysis.py     # Risikoanalyse, Angriffsbäume, KSTU, DOT
├── test_security_goals.py    # Schutzziele CRUD
├── test_residual_risk.py     # Restrisikoanalyse Sync & UI
├── test_report_versioning.py # PDF-Report, Versionsverwaltung
└── test_e2e_workflow.py      # Vollständiger Workflow-Durchlauf
```

## Testabdeckung

| Modul                | Testdatei                  | Tests |
|----------------------|----------------------------|-------|
| Startup & Navigation | `test_core.py`             | 27    |
| Assets               | `test_assets.py`           | 9     |
| Schadensszenarien     | `test_damage_scenarios.py` | 10    |
| Risikoanalyse        | `test_risk_analysis.py`    | 15    |
| Schutzziele          | `test_security_goals.py`   | 4     |
| Restrisikoanalyse    | `test_residual_risk.py`    | 4     |
| Report & Versioning  | `test_report_versioning.py`| 6     |
| E2E Workflow         | `test_e2e_workflow.py`     | 3     |
| **Gesamt**           |                            | **78** |

## Marker-Übersicht

| Marker             | Beschreibung                                    |
|--------------------|-------------------------------------------------|
| `smoke`            | Schnelle Basis-Checks (App lädt, Elemente da)   |
| `core`             | Kernfunktionen (Analyse-Lifecycle, Persistenz)   |
| `assets`           | Asset-Management                                |
| `damage_scenarios` | Schadensszenarien & Impact-Matrix               |
| `risk_analysis`    | Risikoanalyse & Angriffsbäume                   |
| `security_goals`   | Schutzziele                                     |
| `residual_risk`    | Restrisikoanalyse                               |
| `report`           | PDF-Report-Generierung                          |
| `e2e`              | Vollständige End-to-End-Workflows               |

## Konfiguration

Die Test-URL wird automatisch aus dem Projektpfad berechnet (`file:///...index.html`).
Es wird kein Webserver benötigt – Playwright öffnet die HTML-Datei direkt.

### Headless vs. Headed

Standardmäßig laufen Tests **headless** (kein sichtbarer Browser).
Zum Debuggen `--headed` verwenden:

```cmd
pytest --headed --slowmo=500
```

### Timeout

Standard-Timeout pro Test: **30 Sekunden** (konfiguriert in `pytest.ini`).
