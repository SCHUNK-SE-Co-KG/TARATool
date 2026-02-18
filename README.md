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
- [Externe Abhängigkeiten](#externe-abhängigkeiten)
- [CVE-Monitoring (Due Diligence)](#cve-monitoring-due-diligence)
- [Datenhaltung](#datenhaltung)
- [Testsuite](#testsuite)
- [Architektur-Verbesserungen](#architektur-verbesserungen-p1p5)
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
├── docs/
│   └── SCHASAM_Methodenbeschreibung.docx   # Methodendokumentation
└── js/
    ├── core/                               # Kern (Globals, Utils, Init)
    │   ├── about.js                        # About-Modal, SBOM-Generierung, Versionsinformation
    │   ├── globals.js                      # Konstanten, KSTU-Skalen, Default-Datenstrukturen
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
| **Script-Reihenfolge** | `structure.js → calc.js → editor_v2.js → ui.js → dot_export.js` (in `index.html`). `tab_dispatcher.js` wird **nach allen Modulen** und **vor init.js** geladen. |
| **DOM-Zugriffe** | Immer `document.getElementById()` verwenden, niemals implizite DOM-Globals (`window.elementId`) – Voraussetzung für ES-Module `strict mode`. |

---

## Externe Abhängigkeiten

Alle Abhängigkeiten werden über CDN geladen – es gibt **keine lokalen node_modules** und keinen Build-Prozess.

| Bibliothek | Version | Zweck |
|---|---|---|
| [Font Awesome](https://fontawesome.com/) | 6.5.1 | Icons |
| [@hpcc-js/wasm (Graphviz)](https://github.com/nicedoc/hpcc-js-wasm) | latest | DOT-Rendering im Browser (Angriffsbäume) |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | PDF-Report-Generierung |

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

Das Projekt verfügt über eine umfassende E2E-Testsuite basierend auf **Python**, **pytest** und **Playwright** (178 Tests).

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
   Bei Änderungen an bestimmten Modulen können gezielt die relevanten Tests ausgeführt werden (z. B. `pytest -m assets`). Vor dem Pull Request müssen jedoch **alle 178 Tests** bestehen.
5. Pushe den Branch (`git push origin feature/mein-feature`)
6. Erstelle einen Pull Request

### Richtlinien

- Die UI-Sprache ist **Deutsch** (konsistent mit der Automotive-Cybersecurity-Domäne)
- Kein Build-System – alle JS-Dateien werden direkt als `<script>` eingebunden
- Globale Variablen/Funktionen über `window.*` exponieren
- Code-Kommentare bevorzugt auf Deutsch oder Englisch
- **Keine Änderungen ohne erfolgreichen Testdurchlauf pushen**

---

## Architektur-Verbesserungen (P1–P5)

Das Projekt nutzt eine **Script-Tag-Architektur** mit globaler Scope-Teilung (22 Dateien, ~7.900 LOC). Im Rahmen eines umfassenden Architektur-Reviews wurden folgende Verbesserungen umgesetzt:

| Maßnahme | Beschreibung |
|---|---|
| Zentrale Hilfsfunktionen | `getActiveAnalysis()` und `computeRiskScore()` als Single Source of Truth in `utils.js` |
| UI-/Logik-Trennung | Reine Berechnungslogik in `calc.js`, DOM-Zugriffe in `ui.js` |
| typeof-Guards | Absicherung aller cross-module Aufrufe gegen Ladeordnungs-Abhängigkeiten |
| IIFE-Kapselung | Stateful Module (`structure`, `editor_v2`, `residual_risk_*`, `report_*`) gekapselt |
| Tab-Dispatcher | `renderActiveTab()` aus `globals.js` extrahiert → eigenständige `tab_dispatcher.js` |
| DOM-Zugriffe | Implizite DOM-Globals durch explizite `document.getElementById()` ersetzt |

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
