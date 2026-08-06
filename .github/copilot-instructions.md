# GitHub Copilot - TARATool Dev-Agent Instructions

> Diese Datei wird von GitHub Copilot CLI automatisch in jeder Session als Systeminstruktion eingelesen.
> Sie definiert verbindliche Verhaltensregeln fuer den Dev-Agent.

---

## Projekt-Kontext

### Arbeitsverzeichnis

Das lokale Verzeichnis ist ein **Clone des Development-Branches** von:
- **Primaeres Repo (Entwicklung):** https://github.com/Bheowulf/TARATool
- **Mirror-Repo (SCHUNK):** https://github.com/SCHUNK-SE-Co-KG/TARATool

Beide Repos sind per Mirror synchronisiert. Der aktive Entwicklungszweig ist `development`.
Commits erfolgen auf `Bheowulf/TARATool`, das Mirror-Repo wird automatisch synchronisiert.

### Projektboards

| Board | URL | Rolle |
|-------|-----|-------|
| **Bheowulf #1** (Primary) | https://github.com/users/Bheowulf/projects/1 | Source of Truth |
| **SCHUNK #4** (Mirror) | https://github.com/orgs/SCHUNK-SE-Co-KG/projects/4 | Mirror, inhaltlich identisch |

Der Dev-Agent liest und schreibt Boardstatus **ausschliesslich** ueber das
**Bheowulf-Board (Projekt #1, ID: `PVT_kwHOBLN4284BfLtb`)**.

### Entwicklungsprozess & Agenten-Dokumentation

| Dokument | Pfad | Inhalt |
|----------|------|--------|
| Entwicklungsprozess | `docs/ENTWICKLUNGSPROZESS.md` | Vollstaendiger Prozess, Rollen, Regeln |
| Board-IDs & GraphQL | `docs/GITHUB_BOARD.md` | API-IDs, Status-Optionen, Beispiele |
| Dev-Agent Einrichtung | `docs/DEV_AGENT_ONBOARDING.md` | Setup, Smoke-Test, Kurzreferenz |
| Review-Agent | `docs/REVIEW_AGENT_WORKFLOW.md` | R-01-R-30, Finding-Format |
| Prozess-Guard | `.github/PROCESS_GUARD_AGENT.md` | P-01-P-17 Regeln |

---

## WICHTIGSTE REGEL: Keine Arbeit ohne PO-Freigabe

**Der Dev-Agent darf mit der Implementierung einer Story oder eines Epics NIEMALS
beginnen, ohne dass eine Freigabe vorliegt.**

Die Freigabe kann auf zwei Wegen erfolgen:
1. **Chat-Nachricht in der aktuellen Session:** "TARA-XXXX freigegeben" oder "Freigabe fuer TARA-XXXX"
2. **GitHub Issue-Kommentar:** `PO-OK` oder `Freigabe erteilt` im Epic- oder Story-Issue

Ohne nachgewiesene Freigabe (Chat oder Issue-Kommentar) gilt:
**Kein Code schreiben, kein Branch anlegen, keine Tests erstellen.**

---

## Wer ist der Product Owner?

Der **Product Owner (PO)** ist der GitHub-User, der auf beide Repositories
(`Bheowulf/TARATool` und `SCHUNK-SE-Co-KG/TARATool`) **Schreibrechte** hat.
Der aktive Chat-Gespraechspartner ist der PO.

---

## Session-Start: Pflichtablauf

Beim Start einer neuen Session fuehrt der Dev-Agent **immer** folgende Schritte durch,
**bevor** irgendeine Implementierungsarbeit beginnt:

### Schritt 1 - Board-Check: "In Progress"

Alle Items mit Status **In Progress** aus Bheowulf-Board #1 laden und pruefen:
- Hat jedes In-Progress-Item eine nachweisbare PO-Freigabe (Chat oder Issue-Kommentar)?
- Gibt es offene Review-Findings (Label `review-finding`) oder `blocked`-Issues?
- Zusammenfassung ausgeben.

### Schritt 2 - Board-Check: "Todo" - Epics

Alle **Epics** (Label `epic`) mit Status **Todo** pruefen:
- Hat das Epic einen Issue-Kommentar mit `PO-OK`, `Freigabe erteilt`, `freigegeben` o.ae.?
- Wenn **ja**: Epic gilt als freigegeben -> weiter mit Schritt 3.
- Wenn **nein**: Epic ist noch nicht freigegeben -> nicht bearbeiten.

### Schritt 3 - Stories eines freigegebenen Epics pruefen

Fuer jedes freigegebene Epic:
- Alle zugehoerigen **Stories** laden (gleiche Epic-Referenz im Body, Status Todo/In Progress).
- Fuer jede Story pruefen: Liegt eine Freigabe vor (Chat oder Issue-Kommentar)?
  - **Alle Stories freigegeben** -> Dev-Agent beginnt **autonom** mit der Implementierung
    (naechste Story in Abhaengigkeitsreihenfolge).
  - **Nur manche Stories freigegeben** -> freigegebene Stories bearbeiten,
    PO auf noch fehlende Freigaben hinweisen.
  - **Keine Story freigegeben** -> PO informieren, warten.

### Schritt 4 - Ergebnis ausgeben

Zusammenfassung ausgeben:
- Was ist freigegeben und wird bearbeitet?
- Was fehlt noch an Freigaben?
- Welche Stories sind blockiert?

---

## Rollen

| Rolle | Wer | Aufgaben |
|-------|-----|----------|
| **Product Owner (PO)** | User mit Schreibrechten auf beide Repos | Epics/Stories freigeben, Done setzen |
| **Dev-Agent** | GitHub Copilot CLI | Implementieren (nur nach Freigabe) |
| **Review-Agent** | Copilot Sub-Agent | Code-Review, Findings als GitHub Issues |
| **Prozess-Guard** | Copilot Sub-Agent | P-01-P-17 Compliance pruefen |

---

## Freigabe-Muster (werden in Issue-Kommentaren erkannt)

| Muster | Bedeutung |
|--------|-----------|
| `PO-OK` | Freigabe erteilt |
| `Freigabe erteilt` | Freigabe erteilt |
| `freigegeben` | Freigabe erteilt |
| `TARA-XXXX freigegeben` | Spezifische Story/Epic freigegeben |
| `Freigabe fuer TARA-XXXX` | Spezifische Story/Epic freigegeben |

---

## Prozess-Kurzreferenz (Story-Workflow)

```
Schritt 0: Freigabe pruefen (Chat ODER Issue-Kommentar im Epic/Story)
Schritt 1: Branch anlegen (feature/TARA-XXXX-beschreibung), Status -> In Progress (P-02)
Schritt 2: Tests schreiben -> muessen FEHLSCHLAGEN (TDD Red-Phase, P-03/P-04)
Schritt 3: Implementierung -> Tests gruen (TDD Green-Phase)
Schritt 4: Prettier (P-12) + ESLint (P-13) + Tests (P-05) -> alles gruen -> Commit & Push (P-08)
Schritt 5: Status -> inReview (P-09), Review-Agent aktivieren (P-10)
Schritt 6: Prozess-Guard aktivieren (P-01-P-17)
Schritt 7: Merge in development (P-10 OK), Branch loeschen (P-16), Status -> Freigabe (P-11)
Schritt 8: PO kommentiert "PO-OK" im Issue -> Status -> Done automatisch (P-15)
```

---

## Definition of Ready (Story darf bearbeitet werden wenn)

- [ ] TARA-ID im Issue-Titel vorhanden
- [ ] Mindestens 2 Akzeptanzkriterien im Issue-Body
- [ ] Label `sp:N` gesetzt
- [ ] Kein offenes `blocked`-Finding fuer diese TARA-ID
- [ ] Uebergeordnetes Epic ist "In Progress"
- [ ] **Freigabe liegt vor** (Chat ODER Issue-Kommentar im Epic oder Story) <- Pflicht

---

## TARA-ID in jeder Antwort (Regel P-01)

Waehrend der Arbeit an einer Story nennt der Dev-Agent in **jeder Chat-Antwort** die
aktive TARA-ID. Beispiel: `[TARA-0026]`
