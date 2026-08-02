# Review-Agent Workflow

**Version:** 1.0 | **Stand:** 2026-08-02 | **Branch:** Development

---

## Überblick

Der Review-Agent ist ein separater Copilot-Sub-Agent. Er prüft Änderungen **unabhängig vom Dev-Agent** und kommuniziert ausschließlich über GitHub Issues (Label: `review-finding`).

```
Dev-Agent implementiert Story
        ↓
Dev-Agent setzt Item auf "Review" und aktiviert Review-Agent
        ↓
Review-Agent analysiert Diff / geänderte Dateien
        ↓
Review-Agent öffnet GitHub Issues mit Label review-finding
        ↓
Dev-Agent sieht Findings als Issues im Board – kein direkter Dialog
```

---

## Aktivierung

Der Dev-Agent übergibt beim Aufruf:

```
Story-ID:          TARA-XXXX
Branch:            feature/TARA-XXXX-kurzbeschreibung
Geänderte Dateien: [Liste]
Commit:            <SHA>
TDD-Tests:         tests/test_TARA_XXXX.py (PASSED)
```

---

## Prüfkatalog

| # | Bereich | Prüfung |
|---|---------|---------|
| R-01 | Korrektheit | Alle Akzeptanzkriterien der Story erfüllt |
| R-02 | Korrektheit | Keine offensichtlichen Logikfehler, Edge Cases behandelt |
| R-03 | Architektur | IIFE-Pattern korrekt (nur Dateien mit internem State) |
| R-04 | Architektur | `_`-Prefix für intern konzipierte Funktionen |
| R-05 | Architektur | Nur `document.getElementById()`, kein `window.elementId` |
| R-06 | Architektur | Script-Ladereihenfolge in `index.html` eingehalten |
| R-07 | Sicherheit | Keine neuen CDN-Abhängigkeiten ohne SRI-Hash |
| R-08 | Sicherheit | Kein `eval()`, keine unsichere DOM-Manipulation |
| R-09 | Tests | Alle bestehenden Tests weiterhin grün |
| R-10 | Tests | Neue Funktionalität durch Story-Tests abgedeckt (TDD) |
| R-11 | Qualität | Kein duplizierter Code (DRY) |
| R-12 | Qualität | Keine auskommentierten Code-Blöcke |

---

## Finding-Format

**Titel:** `[TARA-REVIEW] TARA-XXXX – <Kurzbeschreibung>`  
**Labels:** `review-finding` + `sp:1` (Aufwand zur Behebung)

```markdown
## Review Finding

**Story:** TARA-XXXX  
**Typ:** Bug | Architektur | Sicherheit | Test | Code-Qualität  
**Schwere:** Kritisch | Hoch | Mittel | Niedrig  
**Regel:** R-XX  
**Datei:** `path/to/file.js` (Zeile X)

### Problem
<Beschreibung>

### Erwartung
<Was sollte stattdessen sein?>

### Vorschlag
<Konkreter Lösungsvorschlag>
```

---

## Merge-Freigabe

| Ergebnis | Vorgehen |
|---|---|
| Keine Findings | PR auf Development, Item → Done |
| Nur Niedrig/Mittel | PR möglich, Findings als neue Backlog-Items anlegen |
| Hoch/Kritisch | Item zurück auf „In Progress", Findings zuerst beheben |
