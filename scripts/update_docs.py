#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Apply all process documentation improvements."""
from pathlib import Path

# ── ENTWICKLUNGSPROZESS.md ─────────────────────────────────────────────────
ep_path = Path("docs/ENTWICKLUNGSPROZESS.md")
content = ep_path.read_text(encoding="utf-8")

# 1. Update section 7 heading: P-01 bis P-15 → P-01 bis P-16
content = content.replace(
    "## 7. Prozessregeln (P-01 bis P-15)",
    "## 7. Prozessregeln (P-01 bis P-16)"
)

# 2. Add P-16 row to the P-rules table
old_p15_row = "| **P-15** | Done nur nach explizitem PO-OK                    | Nach Merge    |"
new_rows = """\
| **P-15** | Done nur nach explizitem PO-OK                    | Nach Merge    |
| **P-16** | Feature-Branch nach Merge löschen                 | Nach Merge    |"""
content = content.replace(old_p15_row, new_rows)

# 3. Fix "R-01–R-12" → "R-01–R-30" in docs table
content = content.replace("R-01\u2013R-12, Finding-Format", "R-01\u2013R-30, Finding-Format")
# Also catch the garbled variant if present
content = content.replace("R-01\u00e2\u20ac\u201cR-12", "R-01\u2013R-30")

# 4. Add DoR + Epic-Completion after the TARA-ID section in section 3
tara_id_block = "IDs sind **fortlaufend, atomar und unveränderlich**. Nächste freie ID ermitteln:"

dor_epic_addition = """IDs sind **fortlaufend, atomar und unveränderlich**. Nächste freie ID ermitteln:"""

# Check if DoR already inserted
if "### Definition of Ready (DoR)" not in content:
    # Find the end of section 3 (TARA-ID block ends before section 4 separator)
    marker = "---\n\n## 4. Der vollständige Story-Workflow"
    # Try multiple encodings of the em-dash
    if marker not in content:
        marker = "---\n\n## 4. Der vollst\u00e4ndige Story-Workflow"

    dor_section = """
### Definition of Ready (DoR)

Eine Story darf erst bearbeitet werden, wenn alle folgenden Punkte erfüllt sind:

| Kriterium | Prüfung |
| --------- | ------- |
| TARA-ID vergeben | `[TARA-XXXX]` im Titel |
| Akzeptanzkriterien vorhanden | Mindestens 2 Kriterien im Issue-Body |
| Story Points geschätzt | Label `sp:N` gesetzt |
| Kein offenes Blocking-Finding | Kein Issue mit Label `blocked` + dieser TARA-ID |
| Epic aktiv (In Progress) | Übergeordnetes Epic nicht Done/geschlossen |

> Der PO bestätigt die DoR per Chat-Freigabe. Ohne explizites OK startet der Dev-Agent **nicht**.

### Epic-Completion-Regel

Ein Epic wechselt automatisch auf **Done**, wenn alle zugehörigen Stories den Status Done erreicht haben.

**Vorgehen:**
1. Dev-Agent oder PO prüft nach jeder Story-Fertigstellung, ob alle Child-Stories Done sind.
2. Wenn ja → Epic-Status → **Freigabe** setzen, PO bestätigt → **Done**.
3. Ein Epic geht **nicht** direkt von In Progress auf Done (gleiche P-15-Regel wie bei Stories).

"""
    if marker in content:
        content = content.replace(marker, dor_section + marker)

# 5. Add Hotfix-Process to section 8
if "### Hotfix-Prozess" not in content:
    hotfix_section = """
### Hotfix-Prozess

Wenn nach einem Merge auf `development` ein **kritischer Bug** gefunden wird:

```
1. PO gibt Hotfix per Chat frei: "Hotfix für TARA-XXXX"
2. Branch anlegen von development:
   git checkout development && git pull
   git checkout -b hotfix/TARA-XXXX-kurzbeschreibung
3. Fix implementieren (TDD Green-Phase – Red-Phase entfällt bei Kritisch)
4. pytest + Prettier + ESLint grün
5. Review-Agent: entfällt (PO-Entscheid)
6. Prozess-Guard: Nur P-05, P-06, P-07, P-08, P-12, P-13
7. PR direkt auf development – kein separater Review-Zyklus
8. PO merged und setzt Status → Done
```

> ⚠️ Hotfixes sind Ausnahmen. Wenn möglich, den normalen Prozess verwenden.
> Ein Hotfix-Finding (mit Begründung) wird vom Prozess-Guard im Issue dokumentiert.

"""
    # Insert before the last section marker or end of file
    insert_marker = "\n---\n\n## 9. Dokumente auf einen Blick"
    if insert_marker in content:
        content = content.replace(insert_marker, hotfix_section + insert_marker)

ep_path.write_text(content, encoding="utf-8")
print(f"[OK] {ep_path} updated")


# ── PROCESS_GUARD_AGENT.md ─────────────────────────────────────────────────
pg_path = Path("agents/process_guard/PROCESS_GUARD_AGENT.md")
pg = pg_path.read_text(encoding="utf-8")

if "P-16" not in pg:
    old_p15 = "| P-15  | **Done erst nach expliziter PO-Freigabe**"
    new_p15_p16 = """\
| P-15  | **Done erst nach expliziter PO-Freigabe**""" + pg[pg.index(old_p15)+len(old_p15):][:0] + ""

    # Find the P-15 row and add P-16 after it
    p15_idx = pg.find("| P-15  |")
    if p15_idx != -1:
        # Find end of that line
        line_end = pg.find("\n", p15_idx)
        p16_row = "\n| P-16  | **Feature-Branch nach Merge löschen** (`git push origin --delete feature/TARA-XXXX-*`) |"
        pg = pg[:line_end] + p16_row + pg[line_end:]

pg_path.write_text(pg, encoding="utf-8")
print(f"[OK] {pg_path} updated")


# ── REVIEW_AGENT_WORKFLOW.md ───────────────────────────────────────────────
ra_path = Path("agents/review_agent/REVIEW_AGENT_WORKFLOW.md")
ra = ra_path.read_text(encoding="utf-8")

if "## Scope-Entscheidung" not in ra:
    scope_section = """
## Scope-Entscheidung: Welche R-Checks laufen wann?

| Änderungen betreffen | Pflicht-Checks | Optionale Checks |
| --------------------- | -------------- | ---------------- |
| `js/`, `index.html` | R-01–R-12 + R-22–R-30 | R-13–R-21 (Runtime, nur wenn App startbar) |
| `agents/`, `scripts/` | R-01–R-12 | R-22–R-30 entfallen (kein Browser-Code) |
| `tests/` | R-09, R-10 | – |
| `docs/`, `*.md` | R-01 | – |

**Runtime-Checks (R-13–R-30) sind Pflicht** für alle Commits, die `index.html`, `js/` oder
`agents/review_agent/` verändern. Sie erfordern eine lauffähige App-Instanz.

Wenn keine App-URL übergeben wird, **entfallen R-13–R-30 ohne Fehler** — der Review-Agent
vermerkt dies im Finding-Bericht als `[SKIP Runtime: kein App-URL übergeben]`.

"""
    # Insert after the "## Überblick" section
    insert_after = "kein direkter Dialog mit dem Dev-Agent\n```\n"
    if insert_after in ra:
        idx = ra.find(insert_after) + len(insert_after)
        ra = ra[:idx] + "\n" + scope_section + ra[idx:]
    else:
        # fallback: append after Aktivierung section
        ra = ra + "\n" + scope_section

ra_path.write_text(ra, encoding="utf-8")
print(f"[OK] {ra_path} updated")

print("\nAll documentation updates applied successfully.")
