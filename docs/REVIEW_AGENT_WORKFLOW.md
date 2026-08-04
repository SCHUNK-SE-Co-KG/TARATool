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

### Runtime-Scanner-Aktivierung (TARA-0038 Browser Runtime Introspection)

Für Stories mit Browser-Laufzeitprüfung wird zusätzlich übergeben:

```
App-URL:           file:///path/to/index.html  (oder http://localhost:PORT)
Base-Branch:       Development
Scanner-Module:    [console, network, dom, storage, performance, accessibility,
                    csp, service_worker, permissions, dom_xss, html_injection,
                    eval, cors, clickjacking, storage_deep]
```

Der Scanner wird aufgerufen mit:
```bash
python tools/review_agent/runtime_scanner.py \
  --url <APP_URL> \
  --output security/reports/ \
  --modules all
```

---

## Prüfkatalog

| #    | Bereich     | Prüfung                                                  |
| ---- | ----------- | -------------------------------------------------------- |
| R-01 | Korrektheit | Alle Akzeptanzkriterien der Story erfüllt                |
| R-02 | Korrektheit | Keine offensichtlichen Logikfehler, Edge Cases behandelt |
| R-03 | Architektur | IIFE-Pattern korrekt (nur Dateien mit internem State)    |
| R-04 | Architektur | `_`-Prefix für intern konzipierte Funktionen             |
| R-05 | Architektur | Nur `document.getElementById()`, kein `window.elementId` |
| R-06 | Architektur | Script-Ladereihenfolge in `index.html` eingehalten       |
| R-07 | Sicherheit  | Keine neuen CDN-Abhängigkeiten ohne SRI-Hash             |
| R-08 | Sicherheit  | Kein `eval()`, keine unsichere DOM-Manipulation          |
| R-09 | Tests       | Alle bestehenden Tests weiterhin grün                    |
| R-10 | Tests       | Neue Funktionalität durch Story-Tests abgedeckt (TDD)    |
| R-11 | Qualität    | Kein duplizierter Code (DRY)                             |
| R-12 | Qualität    | Keine auskommentierten Code-Blöcke                       |
| R-13 | Runtime     | Konsolen-Fehler und -Warnungen erfasst (TARA-0040)       |
| R-14 | Runtime     | Fehlgeschlagene Netzwerkaufrufe erkannt (TARA-0041)      |
| R-15 | Runtime     | DOM-Zustand und Event-Listener-Leaks geprüft (TARA-0042) |
| R-16 | Runtime     | localStorage, sessionStorage, Cookies analysiert (TARA-0043) |
| R-17 | Runtime     | Performance-Timing und Speicherentwicklung gemessen (TARA-0044) |
| R-18 | Runtime     | Accessibility-Tree auf ARIA-Verletzungen geprüft (TARA-0045) |
| R-19 | Runtime     | CSP-Verletzungen und unbehandelte Promise-Rejections erfasst (TARA-0046) |
| R-20 | Runtime     | Service-Worker-Verhalten und Cross-Origin-Kommunikation überwacht (TARA-0047) |
| R-21 | Runtime     | Browser-Berechtigungen inventarisiert (TARA-0048)        |
| R-22 | Sicherheit  | DOM-XSS-Sinks erkannt – innerHTML, document.write etc. (TARA-0050) |
| R-23 | Sicherheit  | HTML-Injection in dynamisch gerenderte Inhalte geprüft (TARA-0051) |
| R-24 | Sicherheit  | Ressourcen-Manipulation via script/link src geprüft (TARA-0051) |
| R-25 | Sicherheit  | eval()/Function()-Aufrufe zur Laufzeit erkannt (TARA-0052) |
| R-26 | Sicherheit  | CORS-Header auf Wildcard + Credentials geprüft (TARA-0053) |
| R-27 | Sicherheit  | Clickjacking-Schutz (X-Frame-Options / CSP frame-ancestors) geprüft (TARA-0054) |
| R-28 | Sicherheit  | Reverse-Tabnabbing – target=_blank ohne noopener erkannt (TARA-0054) |
| R-29 | Sicherheit  | Storage-Deep-Scan: sensible Schlüssel in localStorage/sessionStorage (TARA-0055) |
| R-30 | Sicherheit  | XSSI-Risiko: SRI-Hash auf externen Skripten geprüft (TARA-0055) |

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

| Ergebnis           | Vorgehen                                                           |
| ------------------ | ------------------------------------------------------------------ |
| Keine Findings     | PR auf Development, Item → **Freigabe** (PO-OK abwarten → Done)    |
| Nur Niedrig/Mittel | PR möglich, Findings als neue Backlog-Items anlegen → **Freigabe** |
| Hoch/Kritisch      | Item zurück auf „In Progress", Findings zuerst beheben             |
