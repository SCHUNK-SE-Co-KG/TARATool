# TaraTool – Vollständige Änderungsübersicht Branch `DevSES`

**Stand:** 20.07.2026  
**Basis:** `Development`  
**Branch:** `DevSES`  
**Remote:** https://github.com/SCHUNK-SE-Co-KG/TARATool/tree/DevSES  
**Autor SES-Entwicklung:** Daniel Merkler / Cursor-Session

Diese Datei dokumentiert **alle** Änderungen im Branch `DevSES` – inklusive Copy/Cut/Paste/Move im Angriffsbaum, PDF/DOT-Export, Tooltips und portable Bewertungsconfig.

---

## Commit-Historie

| Commit   | Beschreibung |
|----------|--------------|
| `51bd877` | feat: SES dev improvements (Editor, PDF, DOT, Tooltips) |
| `fd5fd18` | docs: CHANGELOG_DEVSES |
| `9bdc8d8` | feat(dot): junction bus routing for straight tree edges |
| `db086c4` | feat: portable config reload and assessment_config.js |

---

## 1. Angriffsbaum-Editor (v2)

### 1.1 Auswirkungen-Limit: 5 → 10

| Vorher | Nachher |
|--------|---------|
| Max. 5 Auswirkungen pro Pfad/Zwischenpfad | Max. **10** Auswirkungen |
| Zähler `(x/5 Auswirkungen)` | Zähler `(x/10 Auswirkungen)` |

**Datei:** `js/attack_tree/attack_tree_editor_v2.js`  
**Begründung:** v2 nutzt UID-basierte Schlüssel (`B..|N..|L..`); mehr als 5 Blätter kollidieren nicht mit Restrisiko/Export.

**Nicht geändert:** Legacy-Baum ohne `treeV2` (`attack_tree_structure.js`, festes 5er-Index-System).

---

### 1.2 Kopieren, Ausschneiden, Einfügen, Verschieben (Copy / Cut / Paste / Move)

Neue Baum-Bedienung innerhalb und **zwischen** Ebenen.

#### UI – neue Buttons

| Element | Buttons |
|---------|---------|
| **Auswirkung (Blatt)** | Kopieren, Ausschneiden, ▲ nach oben, ▼ nach unten |
| **Pfad / Zwischenpfad** | **Einfügen**, Kopieren, Ausschneiden, ▲, ▼ |
| **Root (Angriffsziel)** | Neuer Button **„Pfad einfügen“** (`btnPasteAttackPath` in `index.html`) |

#### Zwischenablage `_clip`

Modulweite Variable in `attack_tree_editor_v2.js`:

```javascript
_clip = {
  mode: 'copy' | 'cut',
  kind: 'node' | 'impact',
  payload,      // geklontes oder Original-Objekt
  sourceArr     // nur bei cut: Array zum Entfernen aus Quelle
}
```

#### Helferfunktionen

| Funktion | Zweck |
|----------|-------|
| `_regenNodeUids(node)` | Frische UIDs für ganzen Teilbaum beim **Kopieren** |
| `_regenImpactUid(imp)` | Frische UID für Auswirkung beim **Kopieren** |
| `_containsNode(root, target)` | Zyklus-Schutz: Ziel darf nicht im zu verschiebenden Teilbaum liegen |
| `_moveInArray(arr, uid, dir)` | ▲/▼ – Reihenfolge im gleichen Eltern-Array |
| `_mkIconBtn(...)` | Einheitliche Icon-Buttons mit Tooltip |
| `pasteInto(editor, targetNode)` | Zentrale Einfüge-Logik |

#### Verhalten im Detail

**Kopieren (`mode: copy`)**
- Deep-Clone via `structuredClone`
- Knoten: alle UIDs im Teilbaum neu → **beliebig oft einfügbar**, keine Kollision mit Restrisiko-Schlüsseln
- Auswirkung: neue Impact-UID

**Ausschneiden + Einfügen (`mode: cut`)**
- Objekt wird aus `sourceArr` entfernt und am Ziel eingehängt = **Verschieben**
- Einmalig (nach Einfügen ist `_clip` leer)
- Funktioniert **über Ebenen hinweg** (z. B. Auswirkung von Pfad A nach Pfad B; Zwischenpfad von Pfad A unter Pfad B)

**Einfügen-Regeln (`pasteInto`)**

| Inhalt Zwischenablage | Ziel | Ergebnis |
|----------------------|------|----------|
| **Knoten** (Pfad/Zwischenpfad) | Anderer Knoten | Als **Kind** (`targetNode.children`) |
| **Knoten** | Root (`targetNode = null`) | Als neuer **Angriffspfad** (`root.children`) |
| **Auswirkung** | Knoten (Pfad/Zwischenpfad) | In `targetNode.impacts` (Limit 10) |
| **Auswirkung** | Root | **Nicht erlaubt** (Toast-Warnung) |

**Zyklus-Schutz:** Knoten kann nicht in sich selbst oder eigenen Teilbaum verschoben werden.

**▲ / ▼:** Nur Reihenfolge innerhalb desselben Eltern-Knotens (`parent.children` bzw. `node.impacts`).

#### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `js/attack_tree/attack_tree_editor_v2.js` | Zwischenablage, Helfer, Buttons, `pasteInto`, Root-Verdrahtung |
| `index.html` | Button `btnPasteAttackPath` neben „Angriffspfad anlegen" |

#### Test (Copy/Paste/Move)

1. `index.html` öffnen (Hard-Reload), Angriffsbaum öffnen
2. Auswirkung **kopieren** → in anderen Pfad **Einfügen**
3. Zwischenpfad **ausschneiden** → in anderem Pfad **Einfügen** (Quelle verschwindet)
4. **▲/▼** – Reihenfolge prüfen
5. Pfad kopieren → oben **„Pfad einfügen"** → neuer Angriffspfad
6. Speichern & Schließen → erneut öffnen → Struktur bleibt

---

## 2. PDF-Report – schärfere Baum-Grafiken

**Problem:** SVG (Graphviz) wurde auf max. 1600 px Breite gerastert und als JPEG komprimiert → auf A3 nur ~100 DPI, unscharf bei großen Bäumen.

**Fix:**
- SVG→Raster in **Zielauflösung ~300 DPI** (skaliert auch hoch)
- Einbettung bevorzugt **verlustfreies PNG** (JPEG nur Fallback bei >12 MB)
- `imageSmoothingQuality = 'high'`

| Datei | Änderung |
|-------|----------|
| `js/report/report_pdf_helpers.js` | `svgTextToPng` – DPI-Skalierung, PNG/JPEG-Fallback |
| `js/report/report_export.js` | Zielbreite = `availW/25.4*300` für Angriffsbaum + Restrisiko |

---

## 3. DOT-/Graphviz-Export

### 3.1 Stammbaum-Optik – alle Blätter unten

- Alle Auswirkungen auf **einer gemeinsamen untersten Ebene** (`rank=sink`)
- Kein versetztes Ranking nach Baumtiefe (z. B. SATA und DisplayPort auf gleicher Linie)

### 3.2 Gerade Verbindungslinien (Junction-Bus)

- `splines=polyline` statt `splines=spline`
- `concentrate=false`
- Bei mehreren Kindern: **unsichtbarer Junction-Knoten** unter dem Parent
  - Senkrechter Stamm ohne Pfeilspitze → Junction
  - Gerade Äste zu jeder Ziel-Box mit Pfeilspitze
- Hilfsfunktionen: `_dotGraphHeader`, `_dotConnectFanout`
- Gilt für Angriffsbaum **und** Restrisiko (treeV2)

**Datei:** `js/attack_tree/dot_export.js`

---

## 4. UI / Tooltips (Angriffsbaum)

### 4.1 STRIDE-Tooltips

- Floating Tooltips (`position: fixed`, am `body`) – entkommen Modal-Overflow, nicht abgeschnitten

### 4.2 Impact-Checkboxen mit vollem Label

| Vorher | Nachher |
|--------|---------|
| `DS1` | `DS1 (Safety)` |
| Kurzlabel | Hover: Titel, Kategorie, Beschreibung aus Schadensszenarien |

- Neue Funktion `getDisplayDamageScenarios()` in `utils.js` (Default + Custom-Szenarien)

| Datei | Änderung |
|-------|----------|
| `js/attack_tree/attack_tree_editor_v2.js` | Tooltip-Binding, DS-Labels |
| `js/core/utils.js` | `getDisplayDamageScenarios()` |
| `css/style.css` | `.at-floating-tooltip`, `.ds-tag` |

---

## 5. Bewertungsconfig – portable Nutzung (ohne Webserver)

### Problem (vorher)

- `assessment_config.json` per XHR unter `file://` blockiert → Fallback mit alten K/S/T/U-Texten in `globals.js` („Produktportfolio" …)
- Hard-Reload half nicht; nur `.bat`-Sync als Workaround

### Lösung (drei Wege)

| Weg | Beschreibung |
|-----|--------------|
| **1. Button „Bewertungsconfig laden"** | Tab Übersicht → Datei-Dialog → `assessment_config.json` wählen → sofortige Aktualisierung **ohne** Seiten-Reload |
| **2. `config/assessment_config.js`** | Per `<script>` beim Start geladen (funktioniert mit Doppelklick/`file://`) |
| **3. Optional: `tools/sync_assessment_config.bat`** | Regeneriert `.js` aus `.json` |

### Technik

- `reloadAssessmentConfigFromJsonText()` – Laufzeit-Reload aus Datei-Inhalt
- `syncGlobalsFromAssessmentConfig()` – aktualisiert KSTU-Dropdowns, Schwellen, Impact-Skalen
- `rebuildTreeRiskLevelsFromConfig()` – Risiko-Schwellen im Baum
- `onAssessmentConfigReloaded()` – UI-Refresh nach Laden
- Diagnose: F12 → `taraConfigStatus()`

### SES-Anpassung S (Skalierung)

Neue Texte in `config/assessment_config.json`:

| Wert | Text |
|------|------|
| `0.5` | IT-Netzwerk beim Kunden |
| `0.3` | OT-Netzwerk beim Kunden |
| `0.1` | Einzelprodukt / lokale Maschine |

*(Hinweis: Zeile 61 enthält optional Tippfehler extra `)` bei IT-Netzwerk-Text.)*

### Geänderte/neue Dateien

| Datei | Änderung |
|-------|----------|
| `config/assessment_config.json` | S-Skalierung SES |
| `config/assessment_config.js` | Auto-generiert aus JSON |
| `js/core/config_loader.js` | Preload + Runtime-Reload |
| `js/core/globals.js` | Reload-fähige Globals |
| `js/core/init.js` | Button + File-Input |
| `js/attack_tree/attack_tree_calc.js` | `rebuildTreeRiskLevelsFromConfig` |
| `index.html` | Script-Tag, Button, hidden file input |
| `tools/sync_assessment_config.py` | JSON→JS Sync |
| `tools/sync_assessment_config.bat` | Windows-Starter |

---

## 6. Gesamtübersicht geänderte Dateien

| Datei | Bereich |
|-------|---------|
| `js/attack_tree/attack_tree_editor_v2.js` | Limit 10, Copy/Cut/Paste/Move, DS-Labels, Tooltips |
| `js/attack_tree/dot_export.js` | Blatt-Ranking, Junction-Bus |
| `js/attack_tree/attack_tree_calc.js` | Config-Reload Risiko-Schwellen |
| `js/report/report_pdf_helpers.js` | Hochauflösende SVG→PNG |
| `js/report/report_export.js` | DPI-Bildbreite PDF |
| `js/core/utils.js` | `getDisplayDamageScenarios()` |
| `js/core/config_loader.js` | Portable Load + Runtime-Reload |
| `js/core/globals.js` | Reload-fähige Config-Globals |
| `js/core/init.js` | Config-Button, File-Picker |
| `css/style.css` | Floating Tooltips, DS-Tags |
| `index.html` | Pfad einfügen, Bewertungsconfig laden, assessment_config.js |
| `config/assessment_config.json` | S-Skalierung SES |
| `config/assessment_config.js` | Portable Config |
| `tools/sync_assessment_config.*` | JSON→JS Sync |
| `CHANGELOG_DEVSES.md` | Kurz-Changelog im Repo |

---

## 7. Bewusst nicht geändert

- **Datenhaltung:** weiterhin `localStorage` (`taraAnalyses`) – kein Dateisystem-Server
- **Legacy-Angriffsbaum** ohne `treeV2`: 5er-Index-System unverändert
- **`sync.ffs_db`:** FreeFileSync-Artefakt, nicht versioniert

---

## 8. Test-Checkliste (lokal)

- [ ] **Limit:** 10 Auswirkungen pro Pfad
- [ ] **Copy/Paste/Move:** Auswirkung kopieren, Pfad ausschneiden, ▲/▼, „Pfad einfügen" am Root
- [ ] **PDF:** großer Baum → Schärfe + gerade Bus-Pfeile
- [ ] **DOT-Export:** Blätter auf einer Linie unten
- [ ] **Tooltips:** STRIDE + DS-Labels am Rand sichtbar
- [ ] **Config:** JSON ändern → „Bewertungsconfig laden" → S-Dropdown prüfen
- [ ] **Konsole:** `taraConfigStatus()` → neue S-Texte

---

## 9. Workflow für Kollegen

```text
git fetch origin
git checkout DevSES
# index.html per Doppelklick öffnen (portable)
# Nach Config-Änderung: Übersicht → „Bewertungsconfig laden"
```
