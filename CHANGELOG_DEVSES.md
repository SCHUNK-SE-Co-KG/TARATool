# Changelog – TaraTool Branch `DevSES`

**Stand:** 13.07.2026  
**Basis:** `Development` → Branch `DevSES` (Commit `51bd877`)  
**Remote:** https://github.com/SCHUNK-SE-Co-KG/TARATool/tree/DevSES

---

## Angriffsbaum-Editor (v2)

### Auswirkungen-Limit erhöht
- Maximal **10 Auswirkungen** pro Pfad/Zwischenpfad (vorher 5).
- Zähler, Tooltip und Prüflogik in `attack_tree_editor_v2.js` angepasst.

### Kopieren, Ausschneiden, Einfügen, Verschieben
- **Auswirkungen (Blätter):** Kopieren, Ausschneiden, nach oben/unten verschieben.
- **Pfade / Zwischenpfade:** Einfügen, Kopieren, Ausschneiden, nach oben/unten verschieben.
- **Root:** neuer Button „Pfad einfügen“ für kopierte/ausgeschnittene Angriffspfade.
- Kopien erhalten **neue UIDs** (keine Kollision mit Restrisiko-Schlüsseln).
- Ausschneiden + Einfügen = Verschieben über Ebenen hinweg; Zyklus-Schutz beim Verschieben von Knoten in den eigenen Teilbaum.

---

## PDF-Report (Angriffsbaum & Restrisiko)

### Schärfere Baum-Grafiken
- SVG→Raster-Konvertierung rendert jetzt in **Zielauflösung (~300 DPI)** statt fest 1600 px Breite.
- Einbettung bevorzugt **verlustfreies PNG** (JPEG nur als Fallback bei sehr großen Bildern).
- Deutlich schärfere Linien und Text bei großen Bäumen auf A3-Seiten.

---

## DOT-/Graphviz-Export (PDF & Baumdaten)

### Stammbaum-Optik für Auswirkungen
- Alle **Auswirkungen (Blätter)** liegen auf **einer gemeinsamen untersten Ebene** (`rank=sink`).
- Kein versetztes Ranking mehr (z. B. SATA höher als DisplayPort), obwohl Pfade unterschiedlich tief sind.

### Gerade Verbindungslinien (Stamm- und Bus-Optik)
- `splines=spline` → `splines=polyline`: **gerade Segmente** statt Kurven.
- Bei mehreren Abzweigungen: **unsichtbarer Knotenpunkt (Junction)** unter dem Parent.
  - Senkrechter **Stamm** bis zum Knotenpunkt (ohne Pfeilspitze).
  - Von dort **gerade Äste** zu jeder Ziel-Box (mit Pfeilspitze).
- Gilt für Auswirkungen, Zwischenpfade und Angriffspfade; `concentrate=false` verhindert zusammengezogene Kurven.
- Angriffsbaum- und Restrisiko-Export nutzen dieselbe Logik (`_dotConnectFanout`).

---

## UI / Tooltips

### STRIDE-Tooltips nicht mehr abgeschnitten
- Tooltips werden als **fixed Overlay** am `body` positioniert (entkommen Modal-`overflow`).
- Gilt für STRIDE- und Impact-Tooltips einheitlich.

### Impact-Checkboxen mit vollem Label und Erklärung
- Statt nur `DS1` … jetzt z. B. **`DS1 (Safety)`** (wie in der Schadensauswirkungsmatrix).
- Hover-Tooltip: **Titel** (`DS1: Gefahr für Leib und Leben`), **Kategorie** `(Safety)`, **Beschreibung** aus den Schadensszenarien.
- Neue Hilfsfunktion `getDisplayDamageScenarios()` in `utils.js` (Default + benutzerdefinierte Szenarien).

---

## Geänderte Dateien

| Datei | Inhalt |
|-------|--------|
| `js/attack_tree/attack_tree_editor_v2.js` | Limit 10, Clipboard, Verschieben, DS-Labels |
| `js/attack_tree/dot_export.js` | Blatt-Ranking, Polyline-Kanten, Junction-Bus-Routing |
| `js/report/report_pdf_helpers.js` | Hochauflösende SVG→PNG-Konvertierung |
| `js/report/report_export.js` | DPI-basierte Bildbreite im PDF |
| `js/core/utils.js` | `getDisplayDamageScenarios()` |
| `css/style.css` | `.at-floating-tooltip`, `.ds-tag` |
| `index.html` | Button „Pfad einfügen“ |
| `docs/SCHASAM_Methodenbeschreibung.docx` | Dokument aktualisiert (Binäränderung) |

---

## Nicht geändert / bewusst offen

- **Datenhaltung:** weiterhin `localStorage` im Browser; kein Dateisystem-Server (nur diskutiert).
- **Legacy-Angriffsbaum** (`attack_tree_structure.js`): 5er-Index-System für Alt-Daten ohne `treeV2` unverändert.
- **`sync.ffs_db`:** nicht versioniert (FreeFileSync-Artefakt).

---

## Testhinweise (lokal)

1. `index.html` im Browser öffnen (Hard-Reload wegen JS-Cache).
2. Angriffsbaum: bis 10 Auswirkungen, Kopieren/Verschieben testen.
3. PDF-Export: großen Baum zoomen → Schärfe prüfen.
4. STRIDE/Impact: Tooltips am Rand und bei DS-Checkboxen prüfen.
