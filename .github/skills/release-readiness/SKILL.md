# Skill: Release-Readiness

## Zweck

Dieser Skill beschreibt die abschliessenden Schritte nach einer
PO-Akzeptanz (Status "Accepted"): Merge des PR, Branch-Cleanup (P-16) und
die finalen Release-Checks bis zum Status "Done". Er deckt insbesondere
Faelle ab, in denen bekannte Automatisierungsluecken (siehe Issue #211:
main-Branch-Staleness bei `issue_comment`-Workflows, Shallow-Checkout-Bug
in `po-approve.yml`) eine manuelle Nacharbeit am Board-Status erfordern.

## Voraussetzungen

- PR-Status ist "Accepted" (P-25 erfuellt: SHA-aktueller P-10-Nachweis +
  gebundene PO-Akzeptanz auf dem PR).
- Alle CI-Checks sind gruen (`gh pr checks <NNN>`).
- `gh pr view <NNN> --json mergeable,mergeStateStatus` zeigt `MERGEABLE`
  (kein offener Merge-Konflikt mit `development`).

## Schritte

1. **Mergefaehigkeit pruefen.**

   ```bash
   gh pr view <NNN> --repo SCHUNK-SE-Co-KG/TARATool --json mergeable,mergeStateStatus
   ```

   Bei `CONFLICTING`: `development` lokal in den Feature-Branch mergen,
   Konflikt aufloesen, volle Regression erneut gruen, neuen P-10-Nachweis
   mit der neuen Head-SHA posten (siehe Skill `independent-code-review`,
   Schritt 6) und eine **neue** PO-Akzeptanz auf dem PR einholen (die alte
   Akzeptanz bezieht sich auf eine ueberholte SHA und zaehlt nicht mehr).

2. **Merge durchfuehren** (Dev-Agent-Merge-Berechtigung, siehe
   `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 1 "Merge-Berechtigung des
   Dev-Agents" - nur wenn alle 4 Bedingungen erfuellt sind: Review
   abgeschlossen, Prozess-Guard OK, Tests gruen, PO-Akzeptanz-Gate
   erfuellt):

   ```bash
   gh pr merge <NNN> --repo SCHUNK-SE-Co-KG/TARATool --merge --delete-branch
   ```

   Das `--delete-branch`-Flag deckt P-16 (Feature-Branch-Cleanup nach
   Merge) automatisch ab.

3. **Automatische Post-Merge-Status-Transition pruefen.** Der Status
   sollte automatisch zu "PO Release" (nach gebundenem `PO Release
   TARA-XXXX`-Kommando, P-27) und danach zu "Done" wechseln. Pruefen mit:

   ```bash
   gh run list --repo SCHUNK-SE-Co-KG/TARATool --workflow=po-approve.yml --limit 5
   ```

4. **Bei fehlgeschlagener Automation: Bootstrap-Ausnahme dokumentieren.**
   Falls die Automation wegen einer bekannten Infrastruktur-Luecke (siehe
   Issue #211) nicht greift:
   - Board-Status per GraphQL-Mutation manuell nachziehen (Pattern siehe
     `docs/GITHUB_BOARD.md`).
   - **Audit-Trail-Kommentar auf dem betroffenen Issue posten**, der die
     Root-Cause benennt und auf das Folge-Issue verweist (siehe Beispiel
     in den Kommentaren zu #187/#188/#189).
   - Niemals den protected Status ("Accepted", "PO Release", "Done") ohne
     nachvollziehbare Begruendung manuell setzen - `transition_engine.py`
     verweigert dies aus gutem Grund (siehe
     `scripts/workflow/transition_engine.py`, `PROTECTED_STATUSES`).

5. **Epic-Abschluss pruefen.** Sind dies die letzte offene Story eines
   Epics, Epic-Completion-Regel pruefen (`docs/ENTWICKLUNGSPROZESS.md`,
   Abschnitt 3) und ggf. Epic-Batch-Regression ausloesen (siehe
   TARA-0125, Option 2 "Epic-basierter Batch").

6. **Regressionsstrategie gemaess TARA-0125 beachten.** Je nach
   DoD-Festlegung der Story, Epic-Abschlussstatus oder zeitbasiertem
   Trigger kann die volle Regressionssuite erst an dieser Stelle (statt
   bei jeder einzelnen Story) faellig werden. Siehe
   `docs/ENTWICKLUNGSPROZESS.md` fuer die aktuelle Regelung.

## Verifikation

- Der Feature-Branch existiert nach dem Merge nicht mehr remote (P-16).
- Board-Status des Issues ist "Done" (ggf. nach manueller
  Bootstrap-Ausnahme mit dokumentiertem Audit-Trail-Kommentar).
- Keine offenen `blocked`- oder `review-finding`-Issues mit Critical/High
  Severity fuer diese Story verbleiben offen.
- Bei Epic-Abschluss: Epic-Issue selbst ist geschlossen/Done gemaess
  Epic-Completion-Regel.

## Bezug zu Regeln/Stories

- Prozessschritt: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 4 (Schritt 8)
- Merge-Berechtigung: `docs/ENTWICKLUNGSPROZESS.md`, Abschnitt 1
- Branch-Cleanup: P-16
- Protected Status Transitions: P-25, P-26, P-27,
  `scripts/workflow/transition_engine.py`
- Bekannte Automatisierungsluecken: Issue #211 (main-Branch-Staleness,
  Shallow-Checkout-Bug in `po-approve.yml`)
- Regressionsstrategie: TARA-0125
