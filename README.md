# TARA Tool

**Browser-basiertes Werkzeug für Bedrohungs- und Risikoanalysen (TARA) im Kontext des EU Cyber Resilience Act (CRA)**

![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)

Der **EU Cyber Resilience Act (CRA)** verpflichtet Hersteller von Produkten mit digitalen Elementen zu einer systematischen Cybersecurity-Risikobewertung über den gesamten Produktlebenszyklus. TARA Tool unterstützt diesen Prozess: Assets definieren, Schadensszenarien bewerten, Angriffsbäume modellieren, Risiken nach der **SCHASAM-Methode** berechnen, Security-Ziele ableiten und Restrisiken analysieren – inklusive vollständiger PDF-Report-Generierung.

---

## Inhaltsverzeichnis

- [CRA-Kontext](#cra-kontext)
- [Features](#features)
- [Schnellstart](#schnellstart)
- [SCHASAM-Methodik](#schasam-methodik)
- [Projektstruktur](#projektstruktur)
- [Konfiguration (Assessment-Parameter)](#konfiguration-assessment-parameter)
- [Externe Abhängigkeiten](#externe-abhängigkeiten)
- [CVE-Monitoring (Due Diligence)](#cve-monitoring-due-diligence)
- [Datenhaltung](#datenhaltung)
- [Testsuite](#testsuite)
- [Screenshots](#screenshots)
- [Mitwirken](#mitwirken)
- [Lizenz](#lizenz)

---

## CRA-Kontext

Der **Cyber Resilience Act (CRA)** – Verordnung (EU) 2024/2847 – ist seit Dezember 2024 in Kraft und stellt verbindliche Cybersecurity-Anforderungen an alle Produkte mit digitalen Elementen auf dem EU-Markt.

**Relevante CRA-Anforderungen, die TARA Tool adressiert:**

| CRA-Anforderung | Umsetzung im Tool |
|---|---|
| **Risikobewertung** (Anhang I, Teil 1) | Strukturierte TARA mit SCHASAM-Risikoberechnung |
| **Dokumentation der Risikoanalyse** (Art. 13) | PDF-Report mit vollständiger Analysedokumentation |
| **Identifikation von Schwachstellen & Bedrohungen** | Angriffsbäume mit mehrstufiger Bedrohungsmodellierung |
| **Schutzbedarfsfeststellung** | CIA-Bewertung (Vertraulichkeit, Integrität, Verfügbarkeit) pro Asset |
| **Bewertung der Auswirkungen** | Schadensauswirkungsmatrix (Safety, Financial, IP, Privacy, Legal) |
| **Maßnahmenableitung** | Security-Ziele und Restrisikoanalyse mit Behandlungsoptionen |
| **Versionierung & Nachvollziehbarkeit** | Snapshots, Rollback und Änderungshistorie |

> **Hinweis:** TARA Tool ist ein unterstützendes Werkzeug für die Risikoanalyse. Die vollständige CRA-Konformität erfordert weitere organisatorische und technische Maßnahmen (z. B. Vulnerability Handling, Incident Reporting, SBOM).

---

## Features

| Feature | Beschreibung |
|---|---|
| **Assets** | Verwaltung von Assets mit CIA-Schutzbedarf (Stufe I / II / III) |
| **Schadensszenarien** | 5 vordefinierte Szenarien (Safety, Financial, IP Loss, Privacy, Legal) + benutzerdefinierte |
| **Schadensauswirkungsmatrix** | Kreuzmatrix Assets × Schadensszenarien mit Schweregrad-Bewertung (1 / 2 / 3) |
| **Angriffsbäume** | Kartenbasierter Editor (variable Tiefe 1–3 Ebenen) mit DOT/Graphviz-Vorschau |
| **Risikoanalyse** | SCHASAM-basierte Risikoberechnung je Angriffsbaum mit automatischer Worst-Case-Vererbung |
| **Security Ziele** | Definition von Security-Zielen mit Referenz auf Angriffsbaumwurzeln |
| **Restrisikoanalyse** | Behandlung je Blatt (Akzeptiert / Delegiert / Mitigiert) mit optionaler KSTU-Neubewertung |
| **PDF-Report** | Vollständiger Analysebericht als PDF (Management-Summary, Detail, Visualisierungen) |
| **Versionierung** | Major-/Minor-Versionskontrolle mit Snapshots, Rollback und Änderungskommentaren |
| **Import / Export** | JSON-basierter Export/Import vollständiger Analysen mit automatischer Daten-Migration |
| **Multi-Analyse** | Gleichzeitige Verwaltung mehrerer Analysen per Dropdown |
| **Dashboard** | Übersicht mit Risikoverteilung (Original + Restrisiko) |

---

## Schnellstart

### Voraussetzungen

- Ein moderner Webbrowser (Chrome, Firefox, Edge, Safari)
- **Kein Server, kein Build-Schritt, keine Installation erforderlich**

### Starten

```
git clone https://github.com/SCHUNK-SE-Co-KG/TARATool.git
cd TARATool
```

Öffne `index.html` direkt im Browser – fertig.

> **Hinweis:** Für die Graphviz-Vorschau der Angriffsbäume wird eine Internetverbindung benötigt (CDN-Bibliotheken).

### Erster Workflow

1. **Neue Analyse** anlegen (Button „Neu")
2. **Assets** definieren und CIA-Schutzbedarf vergeben
3. **Schadensszenarien** ggf. ergänzen
4. **Schadensauswirkungsmatrix** ausfüllen (Schweregrad 1–3 je Asset × Szenario)
5. **Risikoanalyse** → Angriffsbäume erstellen, KSTU-Werte an Blättern bewerten
6. **Security Ziele** ableiten
7. **Restrisikoanalyse** → Maßnahmen zuordnen, mitigierte Risiken neu bewerten
8. **Report (PDF)** generieren

---

## SCHASAM-Methodik

Die Risikobewertung folgt der **SCHASAM-Methode**. Das Risiko $R$ ergibt sich aus dem normalisierten Impact $I_{norm}$ und vier Wahrscheinlichkeitsparametern:

$$R = I_{norm} \times (K + S + T + U)$$

- **K** – Komplexität des Angriffs
- **S** – Skalierung (Breite der Auswirkung)
- **T** – Zeitaufwand
- **U** – Nutzen für den Angreifer

Risiken werden in vier Klassen eingeteilt: **Kritisch**, **Hoch**, **Mittel** und **Niedrig**.

> Die vollständige Methodenbeschreibung mit allen Skalen, Gewichtungsfaktoren und Berechnungsbeispielen findet sich unter [`docs/SCHASAM_Methodenbeschreibung.docx`](docs/SCHASAM_Methodenbeschreibung.docx).

---

## Projektstruktur

```
TARATool/
├── index.html                              # Single-Page-Application (Einstiegspunkt)
├── css/
│   └── style.css                           # Alle Styles
├── config/
│   └── assessment_config.json              # Externalisierte Bewertungsparameter (jährlich reviewbar)
├── docs/
│   ├── SCHASAM_Methodenbeschreibung.docx   # Methodendokumentation
│   └── PENTEST_REPORT_2026-02-23.md        # Pentest-Bericht
├── security/
│   ├── cve_scanner.py                      # CVE-Scanner (OSV-API)
│   ├── requirements.txt                    # Python-Abhängigkeiten für Scanner
│   └── reports/                            # Generierte CVE-Reports (JSON + Markdown)
├── tests/                                  # E2E-Testsuite (pytest + Playwright)
│   ├── conftest.py                         # Fixtures und Playwright-Setup
│   ├── pytest.ini                          # Pytest-Konfiguration und Marker
│   ├── requirements.txt                    # Test-Abhängigkeiten
│   ├── run_tests.bat                       # One-Click-Testskript
│   ├── test_*.py                           # Testmodule (13 Dateien)
│   └── fixtures/                           # Testdaten (JSON-Fixtures)
├── .github/
│   └── workflows/                          # GitHub Actions (CVE-Scan, Monthly Report)
└── js/
    ├── core/                               # Kern (Config, Globals, Utils, Init)
    │   ├── about.js                        # About-Modal, SBOM-Generierung, Versionsinformation
    │   ├── config_loader.js                # Lädt assessment_config.json synchron vor allen anderen Modulen
    │   ├── globals.js                      # Konstanten, KSTU-Skalen, Default-Datenstrukturen (config-driven mit Fallbacks)
    │   ├── utils.js                        # localStorage, UID-Generierung, getActiveAnalysis(), computeRiskScore(), Hilfsfunktionen
    │   ├── analysis_core.js                # Analyse-CRUD, Import/Export, Dashboard
    │   ├── tab_dispatcher.js               # renderActiveTab() – zentraler Tab-Router (nach allen Modulen geladen)
    │   └── init.js                         # Bootstrap, Tab-Navigation, Event-Wiring
    ├── modules/                            # Fachmodule
    │   ├── assets.js                       # Asset-Verwaltung (CRUD, CIA-Bewertung)
    │   ├── damage_scenarios.js             # Schadensszenarien-Verwaltung
    │   ├── impact_matrix.js                # Schadensauswirkungsmatrix
    │   ├── risk_analysis.js                # Risikoeinträge, Angriffsbaum-Modal-Integration
    │   ├── security_goals.js               # Security-Ziele (Referenz auf Angriffsbäume)
    │   └── versioning.js                   # Versionskontrolle (Snapshots, Rollback)
    ├── attack_tree/                        # Angriffsbaum-Logik
    │   ├── attack_tree_calc.js             # SCHASAM-Berechnungsengine (KSTU + Impact), reine Logik ohne DOM
    │   ├── attack_tree_editor_v2.js        # Kartenbasierter Baum-Editor (v2, IIFE)
    │   ├── attack_tree_ui.js               # Angriffsbaum-UI (Rendering, Form-Events, Live-Summaries, Download/Export)
    │   ├── attack_tree_structure.js        # Baumstruktur-Tiefe, Impact-Rows (IIFE, 4 Fkt. exponiert)
    │   └── dot_export.js                   # Reine DOT/Graphviz-Stringgenerierung (kein DOM)
    ├── report/                             # PDF-Report
    │   ├── report_pdf_helpers.js           # Graphviz-Rendering, Hilfsfunktionen
    │   ├── report_pdf_builder.js           # PDF-Layout-Engine (Tabellen, Matrix, etc.)
    │   └── report_export.js                # Report-Orchestrator (Kapitelstruktur)
    └── residual_risk/                      # Restrisikoanalyse
        ├── residual_risk_data.js           # Datenmodell, Sync, Legacy-Dict-Migration (IIFE)
        └── residual_risk_ui.js             # UI – Behandlung, Neubewertung (IIFE)
```

### Architekturkonventionen

| Konvention | Beschreibung |
|---|---|
| **IIFE-Pattern** | Dateien mit internem State/Closures nutzen IIFE (`structure`, `editor_v2`, `residual_risk_*`, `report_*`). Reine Funktionsdateien ohne internen State (calc, ui, modules) bleiben ohne IIFE, da alle Funktionen cross-module public API sind. |
| **`_`-Prefix** | Markiert Funktionen als **intern konzipiert**, die aber aufgrund der globalen Script-Tag-Architektur dennoch cross-module genutzt werden. Alle Aufrufe sind mit `typeof`-Guards abgesichert. |
| **Script-Reihenfolge** | `config_loader.js → globals.js → utils.js → …` (in `index.html`). Im Attack-Tree-Bereich: `structure.js → calc.js → editor_v2.js → ui.js → dot_export.js`. `tab_dispatcher.js` wird **nach allen Modulen** und **vor init.js** geladen. |
| **DOM-Zugriffe** | Immer `document.getElementById()` verwenden, niemals implizite DOM-Globals (`window.elementId`) – Voraussetzung für ES-Module `strict mode`. |

---

## Konfiguration (Assessment-Parameter)

Alle bewertungsrelevanten Skalierungsfaktoren und Schwellenwerte sind in einer **zentralen Konfigurationsdatei** externalisiert, sodass sie bei jährlichen Reviews ohne Codeänderungen angepasst werden können:

📄 **[`config/assessment_config.json`](config/assessment_config.json)**

### Konfigurierte Parameter

| Abschnitt | Inhalt |
|---|---|
| `impactScale` | Gültige Impact-Werte (0–3), Labels und CSS-Klassen für die Schadensauswirkungsmatrix |
| `severityLevelFactors` | Schweregradfaktoren (0 → 0.0, 1 → 0.3, 2 → 0.6, 3 → 1.0) |
| `protectionLevels` | Schutzstufengewichte (I=0.6, II=0.8, III=1.0) und Ranking (−=0, I=1, II=2, III=3) |
| `probabilityCriteria` | KSTU-Parameter (Komplexität, Skalierung, Zeitaufwand, Nutzen) mit Min/Max und Labels |
| `riskThresholds` | Risikoschwellen (Kritisch ≥ 2.5, Hoch ≥ 1.5, Mittel ≥ 0.5, Niedrig ≥ 0) mit Farben |
| `defaultDamageScenarios` | Die fünf Standard-Schadensszenarien (Safety, Financial, IP Loss, Privacy, Legal) |

### Architektur

```
config/assessment_config.json     ← Einzige Datei, die bei Reviews angepasst wird
        ↓ (synchron geladen)
js/core/config_loader.js          ← Validiert und setzt globales ASSESSMENT_CONFIG
        ↓
js/core/globals.js                ← Alle Konstanten config-driven mit Fallbacks
        ↓
Alle Module (impact_matrix, attack_tree_calc, assets, …)
```

`config_loader.js` wird in `index.html` **vor** `globals.js` geladen und verwendet einen synchronen XMLHttpRequest, damit die Konfiguration garantiert verfügbar ist, bevor andere Module initialisiert werden. Bei Ladefehlern greifen hardcodierte Fallbacks in `globals.js`.

### Jährlicher Review-Prozess

1. `config/assessment_config.json` im Editor öffnen
2. Gewünschte Parameter anpassen (z. B. Schwellenwerte, Faktoren)
3. Config-Tests ausführen: `pytest -m config`
4. Vollständige Testsuite ausführen: `pytest`
5. Änderung committen und PR erstellen

---

## Externe Abhängigkeiten

Alle Abhängigkeiten werden über CDN geladen – es gibt **keine lokalen node_modules** und keinen Build-Prozess.

| Bibliothek | Version | Zweck |
|---|---|---|
| [Font Awesome](https://fontawesome.com/) | 6.5.1 | Icons |
| [@hpcc-js/wasm (Graphviz)](https://github.com/nicedoc/hpcc-js-wasm) | 2.33.2 | DOT-Rendering im Browser (Angriffsbäume) |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | ZIP-Export (Baumdaten) |
| [jsPDF](https://github.com/parallax/jsPDF) | 4.2.1 | PDF-Report-Generierung |

> **Subresource Integrity (SRI):** Die CDN-Skripte für JSZip und jsPDF werden mit `integrity`-Hashes und `crossorigin="anonymous"` geladen, um Manipulationen durch kompromittierte CDNs zu verhindern.

Für die PDF-Angriffsbaumvisualisierung werden externe Render-Dienste genutzt:
- [Kroki](https://kroki.io/) (primär)
- [QuickChart](https://quickchart.io/graphviz) (Fallback)

---

## CVE-Monitoring (Due Diligence)

Das Repository enthält einen **automatischen CVE-Scanner**, der alle Abhängigkeiten (JavaScript-CDN-Bibliotheken und Python-Testpakete) täglich gegen die [Google OSV-Datenbank](https://osv.dev) auf bekannte Sicherheitslücken prüft.

### Funktionsweise

| Komponente | Beschreibung |
|---|---|
| `security/cve_scanner.py` | Python-Scanner – extrahiert Abhängigkeiten aus `index.html` (CDN-URLs) und `tests/requirements.txt`, fragt die OSV-API ab |
| `.github/workflows/cve-scan.yml` | GitHub Actions Workflow – läuft **täglich um 06:00 UTC** und bei manuellem Auslösen |
| `.github/workflows/cve-monthly-report.yml` | Monatlicher Report – erstellt am **1. Montag um 09:00 MEZ** ein GitHub Issue mit vollständigem CVE-Report |
| `security/reports/cve_report.md` | Markdown-Report mit Schwachstellen-Details (CVE-ID, CVSS, Fix-Version) |
| `security/reports/cve_report.json` | Maschinenlesbarer JSON-Report |

### Alert bei kritischen Schwachstellen

Bei Schwachstellen mit **CVSS >= 7.0** wird automatisch ein **GitHub Issue** mit dem Label `cve-alert` erstellt und dem Maintainer zugewiesen. Benachrichtigungen erfolgen über GitHubs eigene Notification-Pipeline (E-Mail, Web, Mobile – je nach persönlicher Einstellung unter [github.com/settings/notifications](https://github.com/settings/notifications)).

### Monatlicher Sicherheitsbericht

Am **1. Montag jedes Monats um 09:00 Uhr (MEZ)** wird automatisch ein GitHub Issue mit dem Label `cve-monthly-report` erstellt, das den vollständigen CVE-Report enthält. Damit ist eine regelmäßige Übersicht über den Sicherheitsstatus aller Abhängigkeiten gewährleistet – auch wenn keine kritischen Schwachstellen vorliegen.

### Geprüfte Abhängigkeiten

- **JavaScript (npm):** Font Awesome, JSZip, jsPDF (aus CDN-URLs in `index.html`)
- **Python (PyPI):** pytest, playwright, pytest-html, pytest-xdist, pytest-timeout (aus `tests/requirements.txt`)

### Manueller Scan

```bash
pip install -r security/requirements.txt
python security/cve_scanner.py
```

Die Reports werden unter `security/reports/` abgelegt. Der GitHub Actions Workflow committet sie automatisch auf den `main`-Branch.

> **CRA-Relevanz:** Der CRA fordert in Art. 13 (6) die Identifikation und Dokumentation von Schwachstellen in Komponenten Dritter. Der automatisierte CVE-Scan unterstützt diese **Due-Diligence-Pflicht** als kontinuierliches Monitoring.

---

## Datenhaltung

Alle Analysedaten werden im **`localStorage`** des Browsers gespeichert (Schlüssel: `taraAnalyses`).

- **Export:** Analysen können als `.json`-Datei exportiert werden
- **Import:** `.json`-Dateien können importiert werden (mit automatischer Daten-Migration älterer Formate)
- **Versionierung:** Snapshots werden innerhalb der Analyse gespeichert und können per Rollback wiederhergestellt werden

> **Wichtig:** `localStorage` ist browserspezifisch. Für Datensicherung und Teamarbeit den JSON-Export verwenden.

---

## Testsuite

Das Projekt verfügt über eine umfassende E2E-Testsuite basierend auf **Python**, **pytest** und **Playwright** (266 Tests).

### Schnellstart

```cmd
cd tests
run_tests.bat
```

Das Skript erstellt automatisch ein Virtual Environment, installiert alle Abhängigkeiten und führt die Tests aus.

### Manuell

```cmd
cd tests
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium --with-deps
pytest
```

### Testkategorien

| Marker | Beschreibung | Befehl |
|---|---|---|
| `smoke` | Schnelle Basis-Checks | `pytest -m smoke` |
| `core` | App-Startup, Navigation, Persistenz | `pytest -m core` |
| `assets` | Asset-Verwaltung | `pytest -m assets` |
| `damage_scenarios` | Schadensszenarien & Impact-Matrix | `pytest -m damage_scenarios` |
| `risk_analysis` | Risikoanalyse & Angriffsbäume | `pytest -m risk_analysis` |
| `security_goals` | Schutzziele | `pytest -m security_goals` |
| `residual_risk` | Restrisikoanalyse | `pytest -m residual_risk` |
| `report` | PDF-Report-Generierung | `pytest -m report` |
| `config` | Konfigurationssystem & Parameter-Propagation | `pytest -m config` |
| `tree_export` | Baumdaten-ZIP-Export | `pytest -m tree_export` |
| `security_fixes` | Security- und Datenintegritäts-Fixes | `pytest -m security_fixes` |
| `e2e` | Vollständige Workflow-Tests | `pytest -m e2e` |

> Detaillierte Informationen zur Testsuite findest du in [tests/README.md](tests/README.md).

---

## Mitwirken

Beiträge sind willkommen! So kannst du mitmachen:

1. Forke das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/mein-feature`)
3. Committe deine Änderungen (`git commit -m 'Neues Feature: ...'`)
4. **Teste vor dem Push** – stelle sicher, dass alle Tests bestehen:
   ```cmd
   cd tests
   pytest -x -q
   ```
   Bei Änderungen an bestimmten Modulen können gezielt die relevanten Tests ausgeführt werden (z. B. `pytest -m assets`). Vor dem Pull Request müssen jedoch **alle Tests** bestehen.
5. Pushe den Branch (`git push origin feature/mein-feature`)
6. Erstelle einen Pull Request

### Richtlinien

- Die UI-Sprache ist **Deutsch** (konsistent mit der Automotive-Cybersecurity-Domäne)
- Kein Build-System – alle JS-Dateien werden direkt als `<script>` eingebunden
- Globale Variablen/Funktionen über `window.*` exponieren
- Code-Kommentare bevorzugt auf Deutsch oder Englisch
- **Keine Änderungen ohne erfolgreichen Testdurchlauf pushen**

---

## Lizenz

Dieses Projekt ist lizenziert unter der **GNU General Public License v3.0** – siehe [LICENSE](LICENSE) für Details.

```
TARA Tool – Browser-basierte Bedrohungs- und Risikoanalyse
Copyright (C) 2026 SCHUNK SE & Co. KG

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
