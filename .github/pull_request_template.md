## Story

**TARA-ID:** TARA-XXXX  
**Issue:** #XX  
**Story Points:** X

---

## Änderungen

<!-- Was wurde implementiert? -->

## TDD – Pflicht-Nachweis

- [ ] Tests **vor** Implementierung geschrieben (`tests/test_TARA_XXXX.py`)
- [ ] Tests haben initial **fehlgeschlagen** (Red-Phase ✓)
- [ ] **Prettier** grün: `npm run format:check` → Exit-Code 0
- [ ] **ESLint** grün: `npm run lint` → Exit-Code 0
- [ ] Story-Tests nach Implementierung **grün**: `pytest tests/test_TARA_XXXX.py -v`
- [ ] Vollständige Suite grün: `pytest -x -q`

**Test-Output (Story-Tests):**

```
<pytest output hier einfügen>
```

## Akzeptanzkriterien

- [ ] ...

## Prozess-Guard Freigabe

- [ ] Prozess-Guard aufgerufen
- [ ] Ergebnis: ✅ PROCESS OK

## Review-Agent

- [ ] Review-Agent aktiviert (Status → Review)
- [ ] Alle Kritisch/Hoch-Findings behoben

## PO-Freigabe (nach Merge)

> ⏳ Nach dem Merge setzt der Dev-Agent den Status auf **„Freigabe"** und wartet auf
> das explizite OK des Product Owners, bevor der Status auf **„Done"** gesetzt wird.
