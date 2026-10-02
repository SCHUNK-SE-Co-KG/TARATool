# TARATool – Entwicklungsharness: Gesamtüberblick (TARA-0124)

> Dieses Dokument ist ein **menschenlesbarer Einstiegspunkt**, der die wichtigsten
> Bausteine des Dev-Agent-Harness (Agent-Rollen, Board-Statusautomat,
> Story-Lebenszyklus, Prozessregeln) in einer Seite zusammenfasst. Es
> **dupliziert keine Details** – jeder Abschnitt verweist auf die jeweils
> massgebliche Quelldatei (`.github/agents/*`, `docs/process_definition.yml`,
> `docs/ENTWICKLUNGSPROZESS.md`). Bei Widersprüchen gilt immer die Quelldatei.

---

## 1. Agent-Rollen auf einen Blick

| Rolle                  | Datei                                    | Kurzbeschreibung                                                                                        |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Dev-Agent**          | `.github/agents/developer.agent.md`      | Implementiert Stories per TDD, führt Commits/PRs durch, hält Board-Status aktuell                       |
| **Review-Agent**       | `.github/agents/reviewer.agent.md`       | Unabhängiges Code-Review je PR, erstellt Finding-Issues (Label `review-finding`)                        |
| **Requirements-Agent** | `.github/agents/requirements.agent.md`   | Wandelt Chat-Anforderungen in Stories mit AC/Scope/DoR um, keine fachliche Freigabe                     |
| **Acceptance-Agent**   | `.github/agents/acceptance.agent.md`     | Konzeptionelle Rolle: bereitet Entscheidungsgrundlage für PO-Abnahme auf, keine eigene Freigabebefugnis |
| **Prozess-Guard**      | `.github/agents/process-guard.policy.md` | Deterministische Pre-Transition-Checks (P-01–P-27), setzt Label `process-violation` bei Verstoss        |

Alle Rollen und ihre Rechte/Grenzen im Detail: siehe die jeweilige Datei oben.

---

## 2. Board-Status-Zustandsautomat (Statusmodell C, TARA-0121)

```text
  Todo
    │  PO Accepted TARA-XXXX   (P-26, gebundenes Kommando)
    ▼
  PO Accepted
    │  Dev-Agent beginnt Arbeit (P-02, Audit-Kommentar)
    ▼
  In Progress
    │  Tests gruen, Branch/Commits ok (P-05/P-06/P-07/P-08)
    ▼
  inReview
    │  PR offen, Review-Agent ohne offene Critical/High-Findings (P-10)
    │  + PO-Akzeptanz-Keyword auf dem PR (P-25)
    ▼
  Accepted
    │  Merge nach development (P-11, P-19: kein Auto-Close via Closes/Fixes)
    │  PO Release TARA-XXXX   (P-27, gebundenes Kommando, NACH Merge)
    ▼
  PO Release
    │  automatisch (P-27)
    ▼
  Done
```

Blockierte Items bekommen stattdessen das Label `blocked` (kein eigener
Status, P-18). Vollständige Options-IDs/GraphQL-Beispiele:
`docs/GITHUB_BOARD.md`.

---

## 3. Story-Lebenszyklus (Red-Green-TDD, Gate 1/Gate 2)

```text
 PO-Freigabe (Chat oder Issue-Kommentar, gebundenes Kommando)
        │
        ▼
 Gate 1 (vor erstem Commit):
   [ ] Status -> In Progress (Audit-Kommentar)
   [ ] Testdatei tests/test_TARA_XXXX.py existiert bereits
        │
        ▼
 RED:   Test schreiben, Test schlägt fehl (P-03/P-04)
        │
        ▼
 GREEN: Implementierung, Test wird gruen (P-05)
        │
        ▼
 Regression: volle Story-Testdatei + relevante Suite gruen (P-06/P-06b)
 Qualität:   Prettier (P-12) + ESLint (P-13) bei JS/HTML/CSS-Aenderung
        │
        ▼
 Gate 2 (vor `gh pr create`):
   [ ] Status -> inReview (Audit-Kommentar)
   [ ] Story-Tests lokal gruen
   [ ] Prettier/ESLint gruen
   [ ] PR-Body: `Bezug: #NNN`, kein `Closes/Fixes #NNN`
        │
        ▼
 Review-Agent (P-10) -> PO-Akzeptanz-Kommando auf PR (P-25)
        │
        ▼
 Merge -> Accepted -> PO Release TARA-XXXX -> Done (P-11/P-27)
```

Vollständiger Ablauf inkl. Rollen und Kommunikationsregeln:
`docs/ENTWICKLUNGSPROZESS.md` (Abschnitt 4 "Der vollständige
Story-Workflow").

---

## 4. Prozessregeln P-01 bis P-27 (Kurzübersicht)

> Kompakte Übersicht – **keine** Volltexte. Massgeblich und einzige
> Quelle der Wahrheit: `docs/process_definition.yml`, generiert nach
> `.github/agents/process-guard.policy.md`.

| Regel | Kurzbeschreibung                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------ |
| P-01  | Dev-Agent nennt TARA-ID in jeder Chat-Antwort                                                                            |
| P-02  | Item auf „In Progress" gesetzt bevor Arbeit begann                                                                       |
| P-03  | Tests vor Implementierung geschrieben – Testdatei existiert                                                              |
| P-04  | Tests haben initial fehlgeschlagen – Red-Commit vor Green-Commit                                                         |
| P-04b | Finaler Red-Green-Nachweis (TARA-0111): PR-Head-Stand rot auf Basis, gruen auf Head                                      |
| P-05  | Story-spezifische Tests vor Commit ausgefuehrt → alle gruen                                                              |
| P-06  | Story-Testdatei gruen vor PR (Teilmenge von `test:unit`, TARA-0112)                                                      |
| P-06b | Regressionsschutz bei gemeinsam genutztem Code (TARA-0111)                                                               |
| P-07  | Branch-Name folgt `feature/TARA-XXXX-*` Schema                                                                           |
| P-08  | Commit-Messages referenzieren TARA-ID                                                                                    |
| P-09  | Item auf „inReview" gesetzt vor PR-Erstellung                                                                            |
| P-10  | Review-Agent aufgerufen, Nachweis als SHA-gebundener JSON-Block                                                          |
| P-11  | Nach Merge: Status bleibt „Accepted" (Sicherheitscheck); Done nur noch via P-27                                          |
| P-12  | Prettier (`npm run format:check`) bei JS/HTML-Aenderungen                                                                |
| P-13  | ESLint (`npm run lint`) bei JS-Aenderungen                                                                               |
| P-14  | TARA-IDs sind atomar und unveraenderlich – keine ID mehrfach vergeben                                                    |
| P-15  | Done NUR nach vorherigem „Accepted" (Statusmodell B, seit TARA-0110)                                                     |
| P-16  | Feature-Branch nach Merge loeschen                                                                                       |
| P-17  | Epic-Batch-Testing: PO informieren wenn alle Stories auf Freigabe                                                        |
| P-18  | Pre-Transition Check: Vorbedingungen vor jedem Status-Wechsel                                                            |
| P-19  | Kein `Closes/Fixes/Resolves #NNN` im PR-Body (unterlaeuft P-11/P-15)                                                     |
| P-20  | Audit-Trail-Kommentar bei jedem Board-Status-Wechsel                                                                     |
| P-21  | Verbindliches Gate vor Commit/PR (Gate 1/Gate 2, s. Abschnitt 3 oben)                                                    |
| P-22  | Review-Finding-Abschluss & Priorisierung                                                                                 |
| P-23  | Kein eigenstaendiger Arbeitsbeginn bei `/init`/Session-Start                                                             |
| P-24  | Epic-Sync-Pflicht (native Sub-Issues, TARA-0113)                                                                         |
| P-25  | PO-Akzeptanz-Gate vor Merge (Statusmodell B, TARA-0110)                                                                  |
| P-26  | PO-Accepted-Gate (Bearbeitungserlaubnis, TARA-0121): Todo → PO Accepted nur per gebundenem Kommando                      |
| P-27  | PO-Release-Gate (fachliche/releasebezogene Abnahme, TARA-0121): Accepted → PO Release → Done nur per gebundenem Kommando |

Details, Automatisierungsstatus und Review-Regeln R-01–R-36:
`.github/agents/process-guard.policy.md` (generiert aus
`docs/process_definition.yml`).

---

## 5. Weiterführende Dokumente

| Dokument                                                    | Pfad                                             |
| ----------------------------------------------------------- | ------------------------------------------------ |
| Vollständiger Entwicklungsprozess                           | `docs/ENTWICKLUNGSPROZESS.md`                    |
| Board-IDs & GraphQL-Beispiele                               | `docs/GITHUB_BOARD.md`                           |
| Kernregeln (Instructions)                                   | `.github/copilot-instructions.md`                |
| Operative Abläufe (Session-Start, Gates, Freigabe-Keywords) | `.github/instructions/workflows.instructions.md` |
| Prozessregel-Quelle (Single Source of Truth)                | `docs/process_definition.yml`                    |
