# GitHub Project Boards – TARATool

Alle IDs für programmatischen Zugriff via `gh api graphql`.

---

## Projekt-Übersicht

### SCHUNK-SE-Co-KG/TARATool (Projekt #4)

| Eigenschaft      | Wert                                          |
| ---------------- | --------------------------------------------- |
| **Project Name** | TARATool                                      |
| **Project ID**   | `PVT_kwDOBu4dv84BfbaR`                        |
| **Owner**        | `SCHUNK-SE-Co-KG` (Organization)              |
| **Repo**         | `https://github.com/SCHUNK-SE-Co-KG/TARATool` |
| **Status**       | Primary / Source of Truth                     |

### Status-Feld

| Eigenschaft   | Wert                             |
| ------------- | -------------------------------- |
| **Feld-Name** | Status                           |
| **Feld-ID**   | `PVTSSF_lADOBu4dv84BfbaRzhZuYME` |

| Status          | Option-ID  | Bedeutung                                                                                                                                                                                                               |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Todo**        | `f75ad846` | Noch nicht begonnen                                                                                                                                                                                                     |
| **PO Accepted** | `d2d86c41` | PO hat die Bearbeitung erlaubt (TARA-0121, P-26) – nur per gebundenem `PO Accepted TARA-XXXX`-Kommando setzbar                                                                                                          |
| **In Progress** | `47fc9ee4` | Dev-Agent arbeitet daran                                                                                                                                                                                                |
| **inReview**    | `2338665f` | Review-Agent aktiv / PR offen                                                                                                                                                                                           |
| **Accepted**    | `d98e05b2` | PO hat vor dem Merge akzeptiert (Statusmodell B, P-25, ehemals "Freigabe")                                                                                                                                              |
| **PO Release**  | `a21de5e9` | PO hat den gemergten Stand fachlich/releasebezogen freigegeben (TARA-0121, P-27) – nur per gebundenem `PO Release TARA-XXXX`-Kommando setzbar; ehemals "Blocking" (gleiche Options-ID, Status entfaellt seit TARA-0121) |
| **Done**        | `98236657` | Automatisch nach PO Release gesetzt (P-27), Story abgeschlossen                                                                                                                                                         |

#### Projekt-ID ermitteln (falls Board neu aufgesetzt wird):

```bash
gh api repos/SCHUNK-SE-Co-KG/TARATool/projects --jq '.[] | {id, name}'
```

---

## Story-Points-Feld

| Eigenschaft   | Wert                           |
| ------------- | ------------------------------ |
| **Feld-Name** | Story Points                   |
| **Feld-ID**   | `PVTF_lAHOBLN4284BfLtbzhZgbzQ` |

Story Points werden als **Zahl** gesetzt (kein Single-Select).

---

## Labels

| Label            | Zweck                                       |
| ---------------- | ------------------------------------------- |
| `epic`           | Gruppiert mehrere Stories                   |
| `story`          | User Story                                  |
| `bug`            | Fehler                                      |
| `review-finding` | Finding vom Review-Agent oder Prozess-Guard |
| `blocked`        | Blockiert (mit Begründung im Issue)         |
| `sp:1` … `sp:13` | Story Points (Fibonacci: 1,2,3,5,8,13)      |

---

## GraphQL-Beispiele

> **TARA-0117/P-18:** Fuer die Statusuebergaenge "PO Accepted → In Progress" und
> "In Progress → inReview" MUSS `gh workflow run transition.yml -f story=... -f to=...`
> verwendet werden (siehe `.github/workflows/transition.yml` und
> `scripts/workflow/transition_engine.py` - einzige Quelle der
> `updateProjectV2ItemFieldValue`-Mutation fuer diese beiden Uebergaenge, inkl.
> Vorbedingungs-Pruefung und Audit-Kommentar). `scripts/set_story_status.py`
> lehnt diese beiden Status explizit ab. Die folgenden Rohbeispiele dienen nur
> dem Verstaendnis des zugrunde liegenden GraphQL-Musters.

### Status eines Items setzen

```bash
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOBLN4284BfLtb"
    itemId: "PVTI_..."
    fieldId: "PVTSSF_lAHOBLN4284BfLtbzhZgYuI"
    value: { singleSelectOptionId: "47fc9ee4" }
  }) {
    projectV2Item { id }
  }
}'
```

### Issue zum Board hinzufügen

```bash
ISSUE_NODE_ID=$(gh issue view 42 --json id --jq .id)

gh api graphql -f query="
mutation {
  addProjectV2ItemById(input: {
    projectId: \"PVT_kwHOBLN4284BfLtb\"
    contentId: \"$ISSUE_NODE_ID\"
  }) {
    item { id }
  }
}"
```

### Story Points setzen

```bash
gh api graphql -f query='
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOBLN4284BfLtb"
    itemId: "PVTI_..."
    fieldId: "PVTF_lAHOBLN4284BfLtbzhZgbzQ"
    value: { number: 3 }
  }) {
    projectV2Item { id }
  }
}'
```

### Story als native Sub-Issue mit ihrem Epic verknuepfen (P-24, ab TARA-0113)

Seit TARA-0113 wird eine **neu** angelegte Story nicht mehr per manueller
Text-Checkliste im Epic-Body verknuepft, sondern ueber die native
GitHub-Sub-Issues-Beziehung. Bestehende Epics (z.B. #176) behalten ihre
Text-Checkliste unveraendert (Bestandsschutz, keine rueckwirkende
Migration).

```bash
scripts/workflow/link_epic_subissue.sh \
  --owner SCHUNK-SE-Co-KG --repo TARATool \
  --epic <Epic-Issue-Nr> --story <Story-Issue-Nr>
```

Das Skript ruft intern den REST-Endpunkt
`POST /repos/{owner}/{repo}/issues/{epic}/sub_issues` auf. Wichtig:
`sub_issue_id` erwartet die **numerische REST-Datenbank-ID** des
Story-Issues (Feld `id` der Issue-Ressource), NICHT die sichtbare
Issue-Nummer und NICHT die GraphQL-Node-ID (Feld `node_id`):

```bash
# Datenbank-ID der Story ermitteln:
gh api repos/SCHUNK-SE-Co-KG/TARATool/issues/<Story-Nr> --jq .id

# Sub-Issue-Beziehung anlegen:
gh api repos/SCHUNK-SE-Co-KG/TARATool/issues/<Epic-Nr>/sub_issues \
  -f sub_issue_id=<Story-Datenbank-ID>
```

Die installierte `gh`-CLI (Stand TARA-0113, gh 2.86.0) bietet keinen
nativen `gh issue ... sub-issue`-Subbefehl, daher der direkte `gh api`-Aufruf.

### Alle Status-Optionen mit IDs abrufen (z.B. nach Anlage von „Freigabe")

```bash
gh api graphql -f query='{
  node(id: "PVT_kwHOBLN4284BfLtb") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id name options { id name }
          }
        }
      }
    }
  }
}' --jq '.data.node.fields.nodes[] | select(.name=="Status") | .options[] | "\(.name): \(.id)"'
```

### Board-Item-ID eines Issues abfragen

```bash
# Alle Items des Boards mit Issue-Nummer
gh api graphql -f query='{
  node(id: "PVT_kwHOBLN4284BfLtb") {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          content { ... on Issue { number title } }
        }
      }
    }
  }
}' --jq '.data.node.items.nodes[] | select(.content.number==XXXX) | .id'
```

---

## Statusübergänge im Workflow (Statusmodell C, seit TARA-0121)

Seit TARA-0110 erfolgt die technische PO-Akzeptanz **vor** dem Merge (nicht
mehr danach). Seit **TARA-0121** kommen zwei weitere, eigens geschützte
Status hinzu: **"PO Accepted"** (Bearbeitungserlaubnis, vor In Progress) und
**"PO Release"** (fachliche/releasebezogene Abnahme des gemergten Stands,
vor Done). Beide dürfen ausschließlich über ein an die TARA-ID gebundenes
Kommando eines Nutzers mit Schreibrechten gesetzt werden (`PO Accepted
TARA-XXXX` bzw. `PO Release TARA-XXXX`) – Agenten/Skripte dürfen sie nicht
selbst setzen (`set_story_status.py` weist das explizit zurück).

Der frühere Status "Blocking" entfällt bewusst (PO-Entscheidung, TARA-0121);
die Options-ID wurde zu "PO Release" umbenannt. Blockierte Items werden
seitdem über das bestehende Issue-Label `blocked` markiert (Board-Status
bleibt unverändert).

```
Todo → PO Accepted → In Progress → inReview → Accepted → (Merge) → PO Release → Done
                             ↕
                    Label "blocked" (P-18 Vorbedingung verletzt,
                    Board-Status bleibt unveraendert)
```

| Wer setzt                         | Von         | Nach            | Bedingung (P-18)                                                                                                                                                                                                                             |
| --------------------------------- | ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Automation**             | Todo        | **PO Accepted** | **P-26: gebundenes `PO Accepted TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten**                                                                                                                                                       |
| **GitHub Automation**             | PO Accepted | In Progress     | **TARA-0117/P-18: Dev-Agent triggert `gh workflow run transition.yml -f story=TARA-XXXX -f to="In Progress"` - Vorbedingung (Status = "PO Accepted") wird automatisiert geprueft**                                                           |
| **GitHub Automation**             | In Progress | inReview        | **TARA-0117/P-18: Dev-Agent triggert `gh workflow run transition.yml -f story=TARA-XXXX -f to=inReview -f head_sha=<SHA>` - Vorbedingung (Prettier ✅ ESLint ✅ Tests ✅ Commit gepusht) wird vom Dev-Agent vor dem Trigger sichergestellt** |
| **GitHub Automation**             | inReview    | **Accepted**    | **P-25: gebundene PO-Akzeptanz auf dem PR (nach letztem Push) UND gültiger SHA-Review-Nachweis (P-10)**                                                                                                                                      |
| **GitHub Automation (P-25-Gate)** | Accepted    | **(Merge)**     | Merge nur zulässig, wenn Status bereits "Accepted" ist (required Status-Check in process-guard.yml)                                                                                                                                          |
| **GitHub Automation**             | Accepted    | **PO Release**  | **P-27: gebundenes `PO Release TARA-XXXX`-Kommando eines Nutzers mit Schreibrechten, nach Erreichen von "Accepted"**                                                                                                                         |
| **GitHub Automation**             | PO Release  | **Done**        | Automatisch im selben Lauf wie Accepted → PO Release (P-27)                                                                                                                                                                                  |
| Review-Agent/Prozess-Guard        | any         | Label `blocked` | P-18-Vorbedingung verletzt, Finding-Issue angelegt (Board-Status bleibt unverändert)                                                                                                                                                         |
| Dev-Agent (nach PO-OK)            | -           | Label entfernt  | Alle Blocking-Gründe behoben                                                                                                                                                                                                                 |

Das Kommando zur PO-Akzeptanz (P-25, inReview → Accepted) muss an die
TARA-ID gebunden sein (TARA-0109-Format, z.B. "TARA-0110 akzeptiert") und
**auf dem Pull Request selbst** gepostet werden (nicht nur auf dem
Story-Issue), damit der Bezug zum geprüften `head_sha` eindeutig ist. Die
neuen Kommandos `PO Accepted TARA-XXXX` und `PO Release TARA-XXXX` (P-26/
P-27) können sowohl auf dem Story-/Epic-Issue als auch auf dem PR gepostet
werden.

---
