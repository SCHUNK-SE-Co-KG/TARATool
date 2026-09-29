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
> schließen und unterlaufen damit P-11/P-25 (Status erst "Accepted" nach
> gebundener PO-Akzeptanz auf dem PR, Status "Done" erst automatisch nach
> dem Merge). Stattdessen den Issue-Bezug so formulieren: `Bezug: #NNN`
> (siehe TARA-0085, PR #139 als Negativ-Beispiel).

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

## PO-Akzeptanz VOR dem Merge (P-25, Statusmodell B)

> ⏳ Der Merge ist erst zulässig, wenn der PO ein an diese TARA-ID
> GEBUNDENES Akzeptanz-Kommando auf **diesem PR** postet (z. B.
> `TARA-XXXX akzeptiert`), gepostet **nach** dem letzten Push. Die
> Automation setzt den Status daraufhin automatisch von **inReview** auf
> **Accepted**. Ein required Status-Check blockiert den Merge, solange
> dieses Gate nicht erfüllt ist.

- [ ] Gebundenes PO-Akzeptanz-Kommando auf diesem PR gepostet
- [ ] Status automatisch auf **Accepted** gewechselt

## Nach dem Merge (P-11, P-16)

- [ ] Status automatisch → **Done** (nur wenn Status vorher „Accepted" war)
- [ ] Feature-Branch gelöscht (gekoppelt an den Merge, `git push origin --delete feature/TARA-XXXX-...` bzw. automatisch)
