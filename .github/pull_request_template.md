## Story

**TARA-ID:** TARA-XXXX  
**Issue:** #XX  
**Story Points:** X

---

## Definition of Ready – Bestätigung

> Vor dem ersten Commit muss der Dev-Agent alle Punkte bestätigt haben.

- [ ] TARA-ID vergeben, Akzeptanzkriterien ≥ 2 vorhanden
- [ ] Story Points (Label `sp:N`) gesetzt
- [ ] Kein offenes Blocking-Finding zu dieser Story
- [ ] PO-Freigabe erhalten (Chat)

---

## Änderungen

<!-- Was wurde implementiert? -->

> ⚠️ **Kein `Closes #NNN` / `Fixes #NNN` / `Resolves #NNN` verwenden!**
> Diese Schlüsselwörter lassen GitHub das Issue beim Merge automatisch
> schließen und unterlaufen damit P-11/P-15 (Status erst "Freigabe", Status
> "Done" erst nach explizitem PO-OK-Kommentar). Stattdessen den Issue-Bezug
> so formulieren: `Bezug: #NNN` (siehe TARA-0085, PR #139 als Negativ-Beispiel).

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

- [ ] Review-Agent aktiviert (Status → inReview)
- [ ] Alle Kritisch/Hoch-Findings behoben

## Nach dem Merge (P-11, P-16)

- [ ] Status → **Freigabe** gesetzt (nicht Done!)
- [ ] Feature-Branch gelöscht: `git push origin --delete feature/TARA-XXXX-...`

## PO-Freigabe (nach Merge)

> ⏳ Nach dem Merge setzt der Dev-Agent den Status auf **„Freigabe"** und wartet auf
> das explizite OK des Product Owners, bevor der Status auf **„Done"** gesetzt wird.
