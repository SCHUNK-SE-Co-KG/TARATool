# TARATool – Test Framework

## Übersicht

Drei Teststufen (TARA-0112 - ersetzt die vorherige pauschale
`--noconftest`-Konvention), zugeordnet über **Namenskonvention/Verzeichnis**:

| Stufe              | Verzeichnis          | Zweck                                                                                         | npm-Skript                 |
| ------------------ | -------------------- | --------------------------------------------------------------------------------------------- | -------------------------- |
| `test:unit`        | `tests/` (flach)     | Schnell, kein Playwright-Paket noetig (Story-/Prozess-Tests)                                  | `npm run test:unit`        |
| `test:integration` | `tests/integration/` | Playwright-Paket noetig, aber eigene Session (Review-Agent Runtime-Scanner, TARA-0039-0055)   | `npm run test:integration` |
| `test:e2e`         | `tests/e2e/`         | Playwright + `tests/e2e/conftest.py`-Fixtures, volle Browser-Interaktion mit der TARATool-App | `npm run test:e2e`         |

### Ausführungs-Policy je Gate

| Gate                                                               | Pflicht-Stufen                                |
| ------------------------------------------------------------------ | --------------------------------------------- |
| **Vor PR** (Push auf Feature-Branch, lokal/Dev-Agent-Pflicht)      | `test:unit` + `test:integration`              |
| **Vor Merge bzw. Release** (PR nach `development`/`main`, CI-Gate) | `test:unit` + `test:integration` + `test:e2e` |

`--noconftest` gilt **nur noch für `test:unit`** - `tests/conftest.py` (Root) enthält
seit TARA-0112 keinen Playwright-Import mehr und ist damit auch ohne installiertes
Playwright-Paket sicher ladbar. Die eigentlichen App-Fixtures (`app`, `page`,
`browser_context_args` etc.) liegen ausschließlich in `tests/e2e/conftest.py` und
werden von pytest automatisch nur für Tests unterhalb von `tests/e2e/` geladen.

---

## test:unit – Story-/Prozess-Tests (kein Playwright)

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

### Ausführen

```bash
npm run test:unit                                    # alle Unit-Tests

# Einzeln (aus dem Projekt-Root):
pytest tests/test_TARA_0004.py --noconftest -v
pytest tests/test_TARA_XXXX.py --noconftest -v

# Per Marker (alle Tests einer Story):
pytest -m TARA_0022 --noconftest -v
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

## test:integration – Review-Agent Runtime-Scanner (Playwright, eigene Session)

`tests/integration/test_TARA_0039.py` bis `test_TARA_0055.py`: prüfen die
Runtime-Checks des Review-Agents (R-13–R-30, `agents/review_agent/`). Diese
Tests verwalten ihre eigene Playwright-Browser-Session direkt (kein
`tests/e2e/conftest.py` nötig), benötigen aber das Playwright-Paket + Chromium.

```bash
npm run test:integration
```

---

## test:e2e – Browser-Tests der TARATool-App (Playwright + Fixtures)

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
npm run test:e2e
```

### Option 3: Manuell (Windows)

```cmd
cd tests
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium --with-deps
npm run test:e2e
```

### Tests ausführen

```bash
npm run test:e2e                            # alle E2E-Tests
pytest tests/e2e -m smoke                   # nur Smoke-Tests
pytest tests/e2e -m core                    # Kernfunktionen
pytest tests/e2e --headed                   # Browser sichtbar (Debugging)
pytest tests/e2e --headed --slowmo=500      # mit Verzögerung
pytest tests/e2e --html=report.html --self-contained-html  # HTML-Report
pytest tests/e2e -n auto                    # parallel
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
├── conftest.py                 # Nur collect_ignore_glob, KEIN Playwright-Import (TARA-0112)
├── pytest.ini                  # Marker, Timeout, Konfiguration
├── requirements.txt            # Python-Abhängigkeiten (inkl. Playwright)
├── run_tests.bat               # Windows Start-Skript (E2E)
├── README.md                   # Diese Datei
│
├── test_TARA_0004.py           # test:unit: Workflow-Dokumentation
├── test_TARA_0006.py           # test:unit: parse_trivy cleanup
├── test_TARA_0020.py           # test:unit: Prettier
├── test_TARA_0021.py           # test:unit: ESLint
├── test_TARA_0022.py           # test:unit: Workflow-Integration
├── test_TARA_0024.py           # test:unit: Canvas-Prototyp
├── test_TARA_0034_0037.py      # test:unit: Workflow-Doku & Onboarding
├── ...                         # weitere test_TARA_XXXX.py (test:unit, Standardort für neue Stories)
│
├── integration/                 # test:integration (Playwright, eigene Session)
│   └── test_TARA_0039.py … test_TARA_0055.py  # Review-Agent Runtime-Scanner (R-13-R-30)
│
└── e2e/                          # test:e2e (Playwright + conftest.py-Fixtures)
    ├── conftest.py               # Playwright-Fixtures (app, page, browser_context_args, ...)
    ├── test_core.py              # App-Start, Tabs, Analyse-CRUD
    ├── test_assets.py            # Asset-Management
    ├── test_calculations.py      # SCHASAM-Berechnungen
    ├── test_config.py            # Konfiguration
    ├── test_damage_scenarios.py  # Schadensszenarien
    ├── test_risk_analysis.py     # Risikoanalyse
    ├── test_security_goals.py    # Schutzziele
    ├── test_residual_risk.py     # Restrisikoanalyse
    ├── test_residual_debug.py    # Restrisiko-Debug
    ├── test_report_versioning.py # PDF-Report
    ├── test_tree_export.py       # DOT-Export
    ├── test_devses_features.py   # DevSes-Features
    ├── test_devses_security.py   # DevSes-Security
    ├── test_backward_compat.py   # Rückwärtskompatibilität
    ├── test_security_fixes.py    # Security-/Integritäts-Fixes
    └── test_e2e_workflow.py      # Vollständiger Workflow
```

## Konfiguration

Standard-Timeout pro Test: **30 Sekunden** (`pytest.ini`).
Die Test-URL wird aus dem Projektpfad berechnet (`file:///...index.html`) — kein Webserver nötig.
