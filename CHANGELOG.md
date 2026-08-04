# Changelog

<!-- AENDERUNGEN_DEVSES.md (neuester Inhalt) -->

# TaraTool â€“ VollstÃ¤ndige Ã„nderungsÃ¼bersicht Branch `DevSES`

**Stand:** 20.07.2026  
**Basis:** `Development`  
**Branch:** `DevSES`  
**Remote:** https://github.com/SCHUNK-SE-Co-KG/TARATool/tree/DevSES  
**Autor SES-Entwicklung:** Daniel Merkler / Cursor-Session

Diese Datei dokumentiert **alle** Ã„nderungen im Branch `DevSES` â€“ inklusive Copy/Cut/Paste/Move im Angriffsbaum, PDF/DOT-Export, Tooltips und portable Bewertungsconfig.

---

## Commit-Historie

| Commit    | Beschreibung                                            |
| --------- | ------------------------------------------------------- |
| `51bd877` | feat: SES dev improvements (Editor, PDF, DOT, Tooltips) |
| `fd5fd18` | docs: CHANGELOG_DEVSES                                  |
| `9bdc8d8` | feat(dot): junction bus routing for straight tree edges |
| `db086c4` | feat: portable config reload and assessment_config.js   |

---

## 1. Angriffsbaum-Editor (v2)

### 1.1 Auswirkungen-Limit: 5 â†’ 10

| Vorher                                    | Nachher                      |
| ----------------------------------------- | ---------------------------- |
| Max. 5 Auswirkungen pro Pfad/Zwischenpfad | Max. **10** Auswirkungen     |
| ZÃ¤hler `(x/5 Auswirkungen)`               | ZÃ¤hler `(x/10 Auswirkungen)` |

**Datei:** `js/attack_tree/attack_tree_editor_v2.js`  
**BegrÃ¼ndung:** v2 nutzt UID-basierte SchlÃ¼ssel (`B..|N..|L..`); mehr als 5 BlÃ¤tter kollidieren nicht mit Restrisiko/Export.

**Nicht geÃ¤ndert:** Legacy-Baum ohne `treeV2` (`attack_tree_structure.js`, festes 5er-Index-System).

---

### 1.2 Kopieren, Ausschneiden, EinfÃ¼gen, Verschieben (Copy / Cut / Paste / Move)

Neue Baum-Bedienung innerhalb und **zwischen** Ebenen.

#### UI â€“ neue Buttons

| Element                 | Buttons                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **Auswirkung (Blatt)**  | Kopieren, Ausschneiden, â–² nach oben, â–¼ nach unten                       |
| **Pfad / Zwischenpfad** | **EinfÃ¼gen**, Kopieren, Ausschneiden, â–², â–¼                              |
| **Root (Angriffsziel)** | Neuer Button **â€žPfad einfÃ¼genâ€œ** (`btnPasteAttackPath` in `index.html`) |

#### Zwischenablage `_clip`

Modulweite Variable in `attack_tree_editor_v2.js`:

```javascript
_clip = {
  mode: 'copy' | 'cut',
  kind: 'node' | 'impact',
  payload, // geklontes oder Original-Objekt
  sourceArr, // nur bei cut: Array zum Entfernen aus Quelle
};
```

#### Helferfunktionen

| Funktion                        | Zweck                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| `_regenNodeUids(node)`          | Frische UIDs fÃ¼r ganzen Teilbaum beim **Kopieren**                  |
| `_regenImpactUid(imp)`          | Frische UID fÃ¼r Auswirkung beim **Kopieren**                        |
| `_containsNode(root, target)`   | Zyklus-Schutz: Ziel darf nicht im zu verschiebenden Teilbaum liegen |
| `_moveInArray(arr, uid, dir)`   | â–²/â–¼ â€“ Reihenfolge im gleichen Eltern-Array                          |
| `_mkIconBtn(...)`               | Einheitliche Icon-Buttons mit Tooltip                               |
| `pasteInto(editor, targetNode)` | Zentrale EinfÃ¼ge-Logik                                              |

#### Verhalten im Detail

**Kopieren (`mode: copy`)**

- Deep-Clone via `structuredClone`
- Knoten: alle UIDs im Teilbaum neu â†’ **beliebig oft einfÃ¼gbar**, keine Kollision mit Restrisiko-SchlÃ¼sseln
- Auswirkung: neue Impact-UID

**Ausschneiden + EinfÃ¼gen (`mode: cut`)**

- Objekt wird aus `sourceArr` entfernt und am Ziel eingehÃ¤ngt = **Verschieben**
- Einmalig (nach EinfÃ¼gen ist `_clip` leer)
- Funktioniert **Ã¼ber Ebenen hinweg** (z. B. Auswirkung von Pfad A nach Pfad B; Zwischenpfad von Pfad A unter Pfad B)

**EinfÃ¼gen-Regeln (`pasteInto`)**

| Inhalt Zwischenablage          | Ziel                       | Ergebnis                                     |
| ------------------------------ | -------------------------- | -------------------------------------------- |
| **Knoten** (Pfad/Zwischenpfad) | Anderer Knoten             | Als **Kind** (`targetNode.children`)         |
| **Knoten**                     | Root (`targetNode = null`) | Als neuer **Angriffspfad** (`root.children`) |
| **Auswirkung**                 | Knoten (Pfad/Zwischenpfad) | In `targetNode.impacts` (Limit 10)           |
| **Auswirkung**                 | Root                       | **Nicht erlaubt** (Toast-Warnung)            |

**Zyklus-Schutz:** Knoten kann nicht in sich selbst oder eigenen Teilbaum verschoben werden.

**â–² / â–¼:** Nur Reihenfolge innerhalb desselben Eltern-Knotens (`parent.children` bzw. `node.impacts`).

#### GeÃ¤nderte Dateien

| Datei                                     | Ã„nderung                                                       |
| ----------------------------------------- | -------------------------------------------------------------- |
| `js/attack_tree/attack_tree_editor_v2.js` | Zwischenablage, Helfer, Buttons, `pasteInto`, Root-Verdrahtung |
| `index.html`                              | Button `btnPasteAttackPath` neben â€žAngriffspfad anlegen"       |

#### Test (Copy/Paste/Move)

1. `index.html` Ã¶ffnen (Hard-Reload), Angriffsbaum Ã¶ffnen
2. Auswirkung **kopieren** â†’ in anderen Pfad **EinfÃ¼gen**
3. Zwischenpfad **ausschneiden** â†’ in anderem Pfad **EinfÃ¼gen** (Quelle verschwindet)
4. **â–²/â–¼** â€“ Reihenfolge prÃ¼fen
5. Pfad kopieren â†’ oben **â€žPfad einfÃ¼gen"** â†’ neuer Angriffspfad
6. Speichern & SchlieÃŸen â†’ erneut Ã¶ffnen â†’ Struktur bleibt

---

## 2. PDF-Report â€“ schÃ¤rfere Baum-Grafiken

**Problem:** SVG (Graphviz) wurde auf max. 1600 px Breite gerastert und als JPEG komprimiert â†’ auf A3 nur ~100 DPI, unscharf bei groÃŸen BÃ¤umen.

**Fix:**

- SVGâ†’Raster in **ZielauflÃ¶sung ~300 DPI** (skaliert auch hoch)
- Einbettung bevorzugt **verlustfreies PNG** (JPEG nur Fallback bei >12 MB)
- `imageSmoothingQuality = 'high'`

| Datei                             | Ã„nderung                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| `js/report/report_pdf_helpers.js` | `svgTextToPng` â€“ DPI-Skalierung, PNG/JPEG-Fallback           |
| `js/report/report_export.js`      | Zielbreite = `availW/25.4*300` fÃ¼r Angriffsbaum + Restrisiko |

---

## 3. DOT-/Graphviz-Export

### 3.1 Stammbaum-Optik â€“ alle BlÃ¤tter unten

- Alle Auswirkungen auf **einer gemeinsamen untersten Ebene** (`rank=sink`)
- Kein versetztes Ranking nach Baumtiefe (z. B. SATA und DisplayPort auf gleicher Linie)

### 3.2 Gerade Verbindungslinien (Junction-Bus)

- `splines=polyline` statt `splines=spline`
- `concentrate=false`
- Bei mehreren Kindern: **unsichtbarer Junction-Knoten** unter dem Parent
  - Senkrechter Stamm ohne Pfeilspitze â†’ Junction
  - Gerade Ã„ste zu jeder Ziel-Box mit Pfeilspitze
- Hilfsfunktionen: `_dotGraphHeader`, `_dotConnectFanout`
- Gilt fÃ¼r Angriffsbaum **und** Restrisiko (treeV2)

**Datei:** `js/attack_tree/dot_export.js`

---

## 4. UI / Tooltips (Angriffsbaum)

### 4.1 STRIDE-Tooltips

- Floating Tooltips (`position: fixed`, am `body`) â€“ entkommen Modal-Overflow, nicht abgeschnitten

### 4.2 Impact-Checkboxen mit vollem Label

| Vorher    | Nachher                                                     |
| --------- | ----------------------------------------------------------- |
| `DS1`     | `DS1 (Safety)`                                              |
| Kurzlabel | Hover: Titel, Kategorie, Beschreibung aus Schadensszenarien |

- Neue Funktion `getDisplayDamageScenarios()` in `utils.js` (Default + Custom-Szenarien)

| Datei                                     | Ã„nderung                          |
| ----------------------------------------- | --------------------------------- |
| `js/attack_tree/attack_tree_editor_v2.js` | Tooltip-Binding, DS-Labels        |
| `js/core/utils.js`                        | `getDisplayDamageScenarios()`     |
| `css/style.css`                           | `.at-floating-tooltip`, `.ds-tag` |

---

## 5. Bewertungsconfig â€“ portable Nutzung (ohne Webserver)

### Problem (vorher)

- `assessment_config.json` per XHR unter `file://` blockiert â†’ Fallback mit alten K/S/T/U-Texten in `globals.js` (â€žProduktportfolio" â€¦)
- Hard-Reload half nicht; nur `.bat`-Sync als Workaround

### LÃ¶sung (drei Wege)

| Weg                                                 | Beschreibung                                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **1. Button â€žBewertungsconfig laden"**              | Tab Ãœbersicht â†’ Datei-Dialog â†’ `assessment_config.json` wÃ¤hlen â†’ sofortige Aktualisierung **ohne** Seiten-Reload |
| **2. `config/assessment_config.js`**                | Per `<script>` beim Start geladen (funktioniert mit Doppelklick/`file://`)                                       |
| **3. Optional: `tools/sync_assessment_config.bat`** | Regeneriert `.js` aus `.json`                                                                                    |

### Technik

- `reloadAssessmentConfigFromJsonText()` â€“ Laufzeit-Reload aus Datei-Inhalt
- `syncGlobalsFromAssessmentConfig()` â€“ aktualisiert KSTU-Dropdowns, Schwellen, Impact-Skalen
- `rebuildTreeRiskLevelsFromConfig()` â€“ Risiko-Schwellen im Baum
- `onAssessmentConfigReloaded()` â€“ UI-Refresh nach Laden
- Diagnose: F12 â†’ `taraConfigStatus()`

### SES-Anpassung S (Skalierung)

Neue Texte in `config/assessment_config.json`:

| Wert  | Text                            |
| ----- | ------------------------------- |
| `0.5` | IT-Netzwerk beim Kunden         |
| `0.3` | OT-Netzwerk beim Kunden         |
| `0.1` | Einzelprodukt / lokale Maschine |

_(Hinweis: Zeile 61 enthÃ¤lt optional Tippfehler extra `)` bei IT-Netzwerk-Text.)_

### GeÃ¤nderte/neue Dateien

| Datei                                | Ã„nderung                              |
| ------------------------------------ | ------------------------------------- |
| `config/assessment_config.json`      | S-Skalierung SES                      |
| `config/assessment_config.js`        | Auto-generiert aus JSON               |
| `js/core/config_loader.js`           | Preload + Runtime-Reload              |
| `js/core/globals.js`                 | Reload-fÃ¤hige Globals                 |
| `js/core/init.js`                    | Button + File-Input                   |
| `js/attack_tree/attack_tree_calc.js` | `rebuildTreeRiskLevelsFromConfig`     |
| `index.html`                         | Script-Tag, Button, hidden file input |
| `tools/sync_assessment_config.py`    | JSONâ†’JS Sync                          |
| `tools/sync_assessment_config.bat`   | Windows-Starter                       |

---

## 6. GesamtÃ¼bersicht geÃ¤nderte Dateien

| Datei                                     | Bereich                                                     |
| ----------------------------------------- | ----------------------------------------------------------- |
| `js/attack_tree/attack_tree_editor_v2.js` | Limit 10, Copy/Cut/Paste/Move, DS-Labels, Tooltips          |
| `js/attack_tree/dot_export.js`            | Blatt-Ranking, Junction-Bus                                 |
| `js/attack_tree/attack_tree_calc.js`      | Config-Reload Risiko-Schwellen                              |
| `js/report/report_pdf_helpers.js`         | HochauflÃ¶sende SVGâ†’PNG                                      |
| `js/report/report_export.js`              | DPI-Bildbreite PDF                                          |
| `js/core/utils.js`                        | `getDisplayDamageScenarios()`                               |
| `js/core/config_loader.js`                | Portable Load + Runtime-Reload                              |
| `js/core/globals.js`                      | Reload-fÃ¤hige Config-Globals                                |
| `js/core/init.js`                         | Config-Button, File-Picker                                  |
| `css/style.css`                           | Floating Tooltips, DS-Tags                                  |
| `index.html`                              | Pfad einfÃ¼gen, Bewertungsconfig laden, assessment_config.js |
| `config/assessment_config.json`           | S-Skalierung SES                                            |
| `config/assessment_config.js`             | Portable Config                                             |
| `tools/sync_assessment_config.*`          | JSONâ†’JS Sync                                                |
| `CHANGELOG_DEVSES.md`                     | Kurz-Changelog im Repo                                      |

---

## 7. Bewusst nicht geÃ¤ndert

- **Datenhaltung:** weiterhin `localStorage` (`taraAnalyses`) â€“ kein Dateisystem-Server
- **Legacy-Angriffsbaum** ohne `treeV2`: 5er-Index-System unverÃ¤ndert
- **`sync.ffs_db`:** FreeFileSync-Artefakt, nicht versioniert

---

## 8. Test-Checkliste (lokal)

- [ ] **Limit:** 10 Auswirkungen pro Pfad
- [ ] **Copy/Paste/Move:** Auswirkung kopieren, Pfad ausschneiden, â–²/â–¼, â€žPfad einfÃ¼gen" am Root
- [ ] **PDF:** groÃŸer Baum â†’ SchÃ¤rfe + gerade Bus-Pfeile
- [ ] **DOT-Export:** BlÃ¤tter auf einer Linie unten
- [ ] **Tooltips:** STRIDE + DS-Labels am Rand sichtbar
- [ ] **Config:** JSON Ã¤ndern â†’ â€žBewertungsconfig laden" â†’ S-Dropdown prÃ¼fen
- [ ] **Konsole:** `taraConfigStatus()` â†’ neue S-Texte

---

## 9. Workflow fÃ¼r Kollegen

```text
git fetch origin
git checkout DevSES
# index.html per Doppelklick Ã¶ffnen (portable)
# Nach Config-Ã„nderung: Ãœbersicht â†’ â€žBewertungsconfig laden"
```


---

<!-- CHANGELOG_DEVSES.md -->

# Changelog â€“ TaraTool Branch `DevSES`

**Stand:** 20.07.2026  
**Basis:** `Development` â†’ Branch `DevSES`  
**Remote:** https://github.com/SCHUNK-SE-Co-KG/TARATool/tree/DevSES

VollstÃ¤ndige Ãœbersicht aller Ã„nderungen in diesem Branch (SES-Entwicklung).

---

## 1. Angriffsbaum-Editor (v2)

### 1.1 Auswirkungen-Limit erhÃ¶ht

- Maximal **10 Auswirkungen** pro Pfad/Zwischenpfad (vorher 5).
- ZÃ¤hler `(x/10 Auswirkungen)`, Tooltips und PrÃ¼flogik in `attack_tree_editor_v2.js`.

### 1.2 Kopieren, Ausschneiden, EinfÃ¼gen, Verschieben

Neue Baum-Bedienung innerhalb und zwischen Ebenen:

| Element                 | Aktionen                                                               |
| ----------------------- | ---------------------------------------------------------------------- |
| **Auswirkung (Blatt)**  | Kopieren, Ausschneiden, â–² nach oben, â–¼ nach unten                      |
| **Pfad / Zwischenpfad** | EinfÃ¼gen, Kopieren, Ausschneiden, â–², â–¼                                 |
| **Root (Angriffsziel)** | Button **â€žPfad einfÃ¼genâ€œ** fÃ¼r kopierten/ausgeschnittenen Angriffspfad |

**Verhalten:**

- **Kopieren:** Deep-Clone mit **neuen UIDs** (mehrfach einfÃ¼gbar, keine Kollision mit Restrisiko-SchlÃ¼sseln).
- **Ausschneiden + EinfÃ¼gen:** Verschieben Ã¼ber Ebenen (Quelle wird entfernt).
- **â–² / â–¼:** Reihenfolge innerhalb desselben Eltern-Knotens Ã¤ndern.
- **Zyklus-Schutz:** Knoten kann nicht in eigenen Teilbaum verschoben werden.
- Modulweite Zwischenablage `_clip` in `attack_tree_editor_v2.js`.

**GeÃ¤nderte Dateien:** `attack_tree_editor_v2.js`, `index.html` (Button `btnPasteAttackPath`).

---

## 2. PDF-Report (Angriffsbaum & Restrisiko)

### SchÃ¤rfere Baum-Grafiken

- SVGâ†’Raster in **ZielauflÃ¶sung (~300 DPI)** statt fest 1600 px Breite.
- Einbettung bevorzugt **verlustfreies PNG** (JPEG nur Fallback bei >12 MB).
- Deutlich schÃ¤rfere Linien/Text bei groÃŸen BÃ¤umen auf A3.

**GeÃ¤nderte Dateien:** `report_pdf_helpers.js`, `report_export.js`.

---

## 3. DOT-/Graphviz-Export (PDF & Baumdaten)

### 3.1 Stammbaum-Optik fÃ¼r Auswirkungen

- Alle BlÃ¤tter auf **einer gemeinsamen untersten Ebene** (`rank=sink`).
- Kein versetztes Ranking (z. B. SATA hÃ¶her als DisplayPort) bei unterschiedlicher Pfadtiefe.

### 3.2 Gerade Verbindungslinien (Stamm- und Bus-Optik)

- `splines=polyline` statt `splines=spline`.
- Bei mehreren Kindern: **unsichtbarer Junction-Knoten** unter dem Parent.
  - Senkrechter Stamm (ohne Pfeilspitze) â†’ Junction.
  - Gerade Ã„ste zu jeder Ziel-Box (mit Pfeilspitze).
- `concentrate=false`; Hilfsfunktion `_dotConnectFanout`.
- Gilt fÃ¼r Angriffsbaum- und Restrisiko-Export (treeV2).

**GeÃ¤nderte Datei:** `dot_export.js`.

---

## 4. UI / Tooltips (Angriffsbaum)

### 4.1 STRIDE-Tooltips nicht abgeschnitten

- Floating Tooltips (`position: fixed` am `body`), entkommen Modal-Overflow.

### 4.2 Impact-Checkboxen mit vollem Label

- Statt `DS1` â†’ **`DS1 (Safety)`** usw.
- Hover: Titel, Kategorie, ausfÃ¼hrliche Beschreibung aus Schadensszenarien.
- `getDisplayDamageScenarios()` in `utils.js` (Default + Custom-Szenarien).

**GeÃ¤nderte Dateien:** `attack_tree_editor_v2.js`, `utils.js`, `style.css`.

---

## 5. Bewertungsconfig (assessment_config) â€“ portable Nutzung

### Problem (vorher)

- `assessment_config.json` per XHR unter `file://` oft blockiert â†’ Fallback mit alten K/S/T/U-Texten in `globals.js`.
- Hard-Reload half nicht; `.bat`-Sync war nÃ¶tig.

### LÃ¶sung

1. **`config/assessment_config.js`** â€“ wird per `<script>` geladen (funktioniert mit Doppelklick/`file://`).
2. **Button â€žBewertungsconfig ladenâ€œ** (Tab Ãœbersicht) â€“ Datei-Dialog fÃ¼r `assessment_config.json`, **ohne Webserver und ohne .bat**.
3. **Laufzeit-Reload:** `syncGlobalsFromAssessmentConfig()` aktualisiert KSTU-Dropdowns, Schwellen, Impact-Skalen sofort.
4. **Optional:** `tools/sync_assessment_config.bat` regeneriert `.js` aus `.json` (fÃ¼r automatischen Start ohne Button-Klick).
5. **Diagnose:** F12-Konsole â†’ `taraConfigStatus()`.

### Config-Inhalt (SES): S (Skalierung) angepasst

Neue Texte in `assessment_config.json` (Beispiel):

- `0,5` â€“ IT-Netzwerk beim Kunden
- `0,3` â€“ OT-Netzwerk beim Kunden
- `0,1` â€“ Einzelprodukt / lokale Maschine

**GeÃ¤nderte/neue Dateien:**

- `config/assessment_config.json`
- `config/assessment_config.js` (generiert)
- `js/core/config_loader.js`
- `js/core/globals.js` (reload-fÃ¤hige Globals)
- `js/core/init.js` (Button + File-Input)
- `js/attack_tree/attack_tree_calc.js` (`rebuildTreeRiskLevelsFromConfig`)
- `index.html`
- `tools/sync_assessment_config.py`
- `tools/sync_assessment_config.bat`

---

## 6. GeÃ¤nderte Dateien (GesamtÃ¼bersicht)

| Datei                                     | Ã„nderung                                                    |
| ----------------------------------------- | ----------------------------------------------------------- |
| `js/attack_tree/attack_tree_editor_v2.js` | Limit 10, Copy/Cut/Paste/Move, DS-Labels, Tooltips          |
| `js/attack_tree/dot_export.js`            | Blatt-Ranking, Junction-Bus-Routing                         |
| `js/attack_tree/attack_tree_calc.js`      | Config-Reload fÃ¼r Risiko-Schwellen                          |
| `js/report/report_pdf_helpers.js`         | HochauflÃ¶sende SVGâ†’PNG-Konvertierung                        |
| `js/report/report_export.js`              | DPI-basierte Bildbreite im PDF                              |
| `js/core/utils.js`                        | `getDisplayDamageScenarios()`                               |
| `js/core/config_loader.js`                | Portable Load + Runtime-Reload                              |
| `js/core/globals.js`                      | Reload-fÃ¤hige Config-Globals                                |
| `js/core/init.js`                         | Config-Button, File-Picker                                  |
| `css/style.css`                           | `.at-floating-tooltip`, `.ds-tag`                           |
| `index.html`                              | Pfad einfÃ¼gen, Bewertungsconfig laden, assessment_config.js |
| `config/assessment_config.json`           | S-Skalierung SES                                            |
| `config/assessment_config.js`             | Portable Config (auto aus JSON)                             |
| `tools/sync_assessment_config.*`          | JSONâ†’JS Sync (optional)                                     |
| `docs/SCHASAM_Methodenbeschreibung.docx`  | Dokument aktualisiert                                       |
| `CHANGELOG_DEVSES.md`                     | Diese Datei                                                 |

---

## 7. Bewusst nicht geÃ¤ndert

- **Datenhaltung:** weiterhin `localStorage` (kein Dateisystem-Server).
- **Legacy-Angriffsbaum** ohne `treeV2`: 5er-Index-System unverÃ¤ndert.
- **`sync.ffs_db`:** FreeFileSync-Artefakt, nicht versioniert.

---

## 8. Testhinweise (lokal)

1. `index.html` Ã¶ffnen (Hard-Reload bei JS-Ã„nderungen).
2. **Angriffsbaum:** 10 Auswirkungen; Copy/Cut/Paste/Move; Pfad einfÃ¼gen am Root.
3. **PDF:** groÃŸen Baum exportieren â†’ SchÃ¤rfe + gerade Bus-Pfeile prÃ¼fen.
4. **Tooltips:** STRIDE + Impact-DS am Rand und bei Checkboxen.
5. **Config:** JSON Ã¤ndern â†’ Ãœbersicht â†’ **Bewertungsconfig laden** â†’ `assessment_config.json` wÃ¤hlen â†’ S-Dropdown prÃ¼fen.
6. **Konsole:** `taraConfigStatus()` â†’ `sScalingOptions` mit neuen Texten.

---

## 9. Commit-Historie (DevSES, Auszug)

| Commit    | Beschreibung                                            |
| --------- | ------------------------------------------------------- |
| `51bd877` | feat: SES dev improvements (Editor, PDF, DOT, Tooltips) |
| `fd5fd18` | docs: CHANGELOG_DEVSES                                  |
| `9bdc8d8` | feat(dot): junction bus routing                         |
| `db086c4` | feat: portable config reload + assessment_config.js     |

**VollstÃ¤ndige Dokumentation (inkl. Copy/Paste/Move-Details):**  
`AENDERUNGEN_DEVSES.md` (im Repo-Root) bzw. `Aufgaben/2026-07-20_devses-aenderungsuebersicht/AENDERUNGEN_DEVSES.md`

