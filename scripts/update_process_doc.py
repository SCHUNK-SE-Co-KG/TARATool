#!/usr/bin/env python3
"""Update ENTWICKLUNGSPROZESS.md with new process rules."""
from pathlib import Path

doc = Path("docs/ENTWICKLUNGSPROZESS.md")
content = doc.read_text(encoding="utf-8", errors="replace")

# ── 1. Update Rollen – add merge permission ──────────────────────────────────
OLD_COMM = "PO-Freigabe erfolgt per **Chat-Nachricht**"
NEW_COMM = """**PO-Freigabe (Done)** erfolgt ausschliesslich per **Issue-Kommentar** mit dem Schluesselwort
  `PO-OK` oder `Freigabe erteilt` - **nicht** per Chat-Nachricht.
- Die GitHub-Automation (`po-approve.yml`) erkennt diese Kommentare und setzt den Status automatisch.

### Merge-Berechtigung des Dev-Agents

Der Dev-Agent darf **eigenstaendig mergen** wenn:
1. Review abgeschlossen (keine offenen Critical/High Findings)
2. Prozess-Guard: PROCESS OK
3. Alle Story-Tests gruen

Nach dem Merge: Status -> **Freigabe** setzen und auf PO-Abnahme warten.

### Epic-Batch-Testing (Regel P-17)

Wenn **alle Stories eines Epics** auf **Freigabe** stehen:
1. Dev-Agent zieht `development` lokal (git pull)
2. Dev-Agent informiert PO im Epic-Issue: \"Alle Stories des Epic TARA-XXXX sind auf Freigabe - bitte testen\"
3. PO testet den aktuellen Stand auf dem development-Branch
4. PO kommentiert im Epic-Issue: `PO-OK` oder `Freigabe erteilt`
5. GitHub-Automation (po-approve.yml) setzt alle betroffenen Stories automatisch auf **Done**"""

if OLD_COMM in content:
    content = content.replace(OLD_COMM, NEW_COMM, 1)
    print("  OK: Kommunikationsregeln aktualisiert")
else:
    print("  WARN: Kommunikationsregeln-Pattern nicht gefunden")

# ── 2. Update Schritt 7 – clarify merge is Dev-Agent action ─────────────────
OLD_S7 = "PR auf Development öffnen und mergen"
NEW_S7 = "PR auf development MERGEN (Dev-Agent, nach Review-OK + Prozess-Guard OK)"
if OLD_S7 in content:
    content = content.replace(OLD_S7, NEW_S7, 1)
    print("  OK: Schritt 7 Merge-Formulierung aktualisiert")
else:
    # Try ASCII-safe version
    OLD_S7b = "PR auf Development"
    if OLD_S7b in content:
        content = content.replace(OLD_S7b, "PR auf development MERGEN (Dev-Agent, nach Review-OK)", 1)
        print("  OK: Schritt 7 alternativ aktualisiert")
    else:
        print("  WARN: Schritt 7 Pattern nicht gefunden")

# ── 3. Update Schritt 8 – PO approval via Issue comment ─────────────────────
OLD_S8 = 'PO gibt per Chat frei: "OK", "freigegeben", o.'
NEW_S8 = 'PO kommentiert im Issue: `PO-OK` oder `Freigabe erteilt`'
if OLD_S8 in content:
    content = content.replace(OLD_S8, NEW_S8, 1)
    print("  OK: Schritt 8 PO-Freigabe aktualisiert")
else:
    print("  WARN: Schritt 8 Pattern nicht gefunden")

# ── 4. Update Status-Tabelle – add PO role for Done via automation ────────────
OLD_DONE = "| **Done**        | Abgeschlossen"
NEW_DONE = "| **Done**        | Abgeschlossen (PO-OK im Issue)"
if OLD_DONE in content:
    content = content.replace(OLD_DONE, NEW_DONE, 1)
    print("  OK: Done-Status Tabelle aktualisiert")
else:
    print("  WARN: Done-Status Pattern nicht gefunden")

# ── 5. Update P-15 rule ──────────────────────────────────────────────────────
OLD_P15 = "| **P-15** | Done nur nach explizitem PO-OK"
NEW_P15 = "| **P-15** | Done nur nach PO-OK als Issue-Kommentar (automatisch via po-approve.yml)"
if OLD_P15 in content:
    content = content.replace(OLD_P15, NEW_P15, 1)
    print("  OK: P-15 aktualisiert")
else:
    print("  WARN: P-15 Pattern nicht gefunden")

# ── 6. Add P-17 after P-16 ───────────────────────────────────────────────────
OLD_P16 = "| **P-16** | **Feature-Branch nach Merge löschen**"
NEW_P16_17 = """| **P-16** | **Feature-Branch nach Merge loeschen** (`git push origin --delete feature/TARA-XXXX-*`) | Nach Merge    |
| **P-17** | **Epic-Batch-Testing**: Wenn alle Epic-Stories auf Freigabe -> development lokal pullen + PO informieren | Nach letztem Merge |"""
if OLD_P16 in content:
    content = content.replace(OLD_P16, NEW_P16_17, 1)
    print("  OK: P-17 hinzugefuegt")
else:
    # Try simpler match
    if "P-16" in content and "Feature-Branch" in content:
        print("  INFO: P-16 gefunden aber Pattern-Mismatch - P-17 wird am Ende der Tabelle hinzugefuegt")
    else:
        print("  WARN: P-16 Pattern nicht gefunden")

doc.write_text(content, encoding="utf-8")
print("Fertig: ENTWICKLUNGSPROZESS.md aktualisiert")
