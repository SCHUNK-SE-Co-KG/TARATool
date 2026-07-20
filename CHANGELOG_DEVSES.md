# Changelog – TaraTool Branch `DevSES`

**Stand:** 20.07.2026  
**Basis:** `Development` → Branch `DevSES`  
**Remote:** https://github.com/SCHUNK-SE-Co-KG/TARATool/tree/DevSES

Vollständige Übersicht aller Änderungen in diesem Branch (SES-Entwicklung).

---

## 1. Angriffsbaum-Editor (v2)

### 1.1 Auswirkungen-Limit erhöht
- Maximal **10 Auswirkungen** pro Pfad/Zwischenpfad (vorher 5).
- Zähler `(x/10 Auswirkungen)`, Tooltips und Prüflogik in `attack_tree_editor_v2.js`.

### 1.2 Kopieren, Ausschneiden, Einfügen, Verschieben
Neue Baum-Bedienung innerhalb und zwischen Ebenen:

| Element | Aktionen |
|---------|----------|
| **Auswirkung (Blatt)** | Kopieren, Ausschneiden, ▲ nach oben, ▼ nach unten |
| **Pfad / Zwischenpfad** | Einfügen, Kopieren, Ausschneiden, ▲, ▼ |
| **Root (Angriffsziel)** | Button **„Pfad einfügen“** für kopierten/ausgeschnittenen Angriffspfad |

**Verhalten:**
- **Kopieren:** Deep-Clone mit **neuen UIDs** (mehrfach einfügbar, keine Kollision mit Restrisiko-Schlüsseln).
- **Ausschneiden + Einfügen:** Verschieben über Ebenen (Quelle wird entfernt).
- **▲ / ▼:** Reihenfolge innerhalb desselben Eltern-Knotens ändern.
- **Zyklus-Schutz:** Knoten kann nicht in eigenen Teilbaum verschoben werden.
- Modulweite Zwischenablage `_clip` in `attack_tree_editor_v2.js`.

**Geänderte Dateien:** `attack_tree_editor_v2.js`, `index.html` (Button `btnPasteAttackPath`).

---

## 2. PDF-Report (Angriffsbaum & Restrisiko)

### Schärfere Baum-Grafiken
- SVG→Raster in **Zielauflösung (~300 DPI)** statt fest 1600 px Breite.
- Einbettung bevorzugt **verlustfreies PNG** (JPEG nur Fallback bei >12 MB).
- Deutlich schärfere Linien/Text bei großen Bäumen auf A3.

**Geänderte Dateien:** `report_pdf_helpers.js`, `report_export.js`.

---

## 3. DOT-/Graphviz-Export (PDF & Baumdaten)

### 3.1 Stammbaum-Optik für Auswirkungen
- Alle Blätter auf **einer gemeinsamen untersten Ebene** (`rank=sink`).
- Kein versetztes Ranking (z. B. SATA höher als DisplayPort) bei unterschiedlicher Pfadtiefe.

### 3.2 Gerade Verbindungslinien (Stamm- und Bus-Optik)
- `splines=polyline` statt `splines=spline`.
- Bei mehreren Kindern: **unsichtbarer Junction-Knoten** unter dem Parent.
  - Senkrechter Stamm (ohne Pfeilspitze) → Junction.
  - Gerade Äste zu jeder Ziel-Box (mit Pfeilspitze).
- `concentrate=false`; Hilfsfunktion `_dotConnectFanout`.
- Gilt für Angriffsbaum- und Restrisiko-Export (treeV2).

**Geänderte Datei:** `dot_export.js`.

---

## 4. UI / Tooltips (Angriffsbaum)

### 4.1 STRIDE-Tooltips nicht abgeschnitten
- Floating Tooltips (`position: fixed` am `body`), entkommen Modal-Overflow.

### 4.2 Impact-Checkboxen mit vollem Label
- Statt `DS1` → **`DS1 (Safety)`** usw.
- Hover: Titel, Kategorie, ausführliche Beschreibung aus Schadensszenarien.
- `getDisplayDamageScenarios()` in `utils.js` (Default + Custom-Szenarien).

**Geänderte Dateien:** `attack_tree_editor_v2.js`, `utils.js`, `style.css`.

---

## 5. Bewertungsconfig (assessment_config) – portable Nutzung

### Problem (vorher)
- `assessment_config.json` per XHR unter `file://` oft blockiert → Fallback mit alten K/S/T/U-Texten in `globals.js`.
- Hard-Reload half nicht; `.bat`-Sync war nötig.

### Lösung
1. **`config/assessment_config.js`** – wird per `<script>` geladen (funktioniert mit Doppelklick/`file://`).
2. **Button „Bewertungsconfig laden“** (Tab Übersicht) – Datei-Dialog für `assessment_config.json`, **ohne Webserver und ohne .bat**.
3. **Laufzeit-Reload:** `syncGlobalsFromAssessmentConfig()` aktualisiert KSTU-Dropdowns, Schwellen, Impact-Skalen sofort.
4. **Optional:** `tools/sync_assessment_config.bat` regeneriert `.js` aus `.json` (für automatischen Start ohne Button-Klick).
5. **Diagnose:** F12-Konsole → `taraConfigStatus()`.

### Config-Inhalt (SES): S (Skalierung) angepasst
Neue Texte in `assessment_config.json` (Beispiel):
- `0,5` – IT-Netzwerk beim Kunden
- `0,3` – OT-Netzwerk beim Kunden
- `0,1` – Einzelprodukt / lokale Maschine

**Geänderte/neue Dateien:**
- `config/assessment_config.json`
- `config/assessment_config.js` (generiert)
- `js/core/config_loader.js`
- `js/core/globals.js` (reload-fähige Globals)
- `js/core/init.js` (Button + File-Input)
- `js/attack_tree/attack_tree_calc.js` (`rebuildTreeRiskLevelsFromConfig`)
- `index.html`
- `tools/sync_assessment_config.py`
- `tools/sync_assessment_config.bat`

---

## 6. Geänderte Dateien (Gesamtübersicht)

| Datei | Änderung |
|-------|----------|
| `js/attack_tree/attack_tree_editor_v2.js` | Limit 10, Copy/Cut/Paste/Move, DS-Labels, Tooltips |
| `js/attack_tree/dot_export.js` | Blatt-Ranking, Junction-Bus-Routing |
| `js/attack_tree/attack_tree_calc.js` | Config-Reload für Risiko-Schwellen |
| `js/report/report_pdf_helpers.js` | Hochauflösende SVG→PNG-Konvertierung |
| `js/report/report_export.js` | DPI-basierte Bildbreite im PDF |
| `js/core/utils.js` | `getDisplayDamageScenarios()` |
| `js/core/config_loader.js` | Portable Load + Runtime-Reload |
| `js/core/globals.js` | Reload-fähige Config-Globals |
| `js/core/init.js` | Config-Button, File-Picker |
| `css/style.css` | `.at-floating-tooltip`, `.ds-tag` |
| `index.html` | Pfad einfügen, Bewertungsconfig laden, assessment_config.js |
| `config/assessment_config.json` | S-Skalierung SES |
| `config/assessment_config.js` | Portable Config (auto aus JSON) |
| `tools/sync_assessment_config.*` | JSON→JS Sync (optional) |
| `docs/SCHASAM_Methodenbeschreibung.docx` | Dokument aktualisiert |
| `CHANGELOG_DEVSES.md` | Diese Datei |

---

## 7. Bewusst nicht geändert

- **Datenhaltung:** weiterhin `localStorage` (kein Dateisystem-Server).
- **Legacy-Angriffsbaum** ohne `treeV2`: 5er-Index-System unverändert.
- **`sync.ffs_db`:** FreeFileSync-Artefakt, nicht versioniert.

---

## 8. Testhinweise (lokal)

1. `index.html` öffnen (Hard-Reload bei JS-Änderungen).
2. **Angriffsbaum:** 10 Auswirkungen; Copy/Cut/Paste/Move; Pfad einfügen am Root.
3. **PDF:** großen Baum exportieren → Schärfe + gerade Bus-Pfeile prüfen.
4. **Tooltips:** STRIDE + Impact-DS am Rand und bei Checkboxen.
5. **Config:** JSON ändern → Übersicht → **Bewertungsconfig laden** → `assessment_config.json` wählen → S-Dropdown prüfen.
6. **Konsole:** `taraConfigStatus()` → `sScalingOptions` mit neuen Texten.

---

## 9. Commit-Historie (DevSES, Auszug)

| Commit | Beschreibung |
|--------|--------------|
| `51bd877` | feat: SES dev improvements (Editor, PDF, DOT, Tooltips) |
| `fd5fd18` | docs: CHANGELOG_DEVSES |
| `9bdc8d8` | feat(dot): junction bus routing |
| `db086c4` | feat: portable config reload + assessment_config.js |

**Vollständige Dokumentation (inkl. Copy/Paste/Move-Details):**  
`AENDERUNGEN_DEVSES.md` (im Repo-Root) bzw. `Aufgaben/2026-07-20_devses-aenderungsuebersicht/AENDERUNGEN_DEVSES.md`
