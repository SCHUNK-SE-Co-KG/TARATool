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

| Status          | Option-ID  | Bedeutung                                          |
| --------------- | ---------- | -------------------------------------------------- |
| **Todo**        | `f75ad846` | Noch nicht begonnen                                |
| **In Progress** | `47fc9ee4` | Dev-Agent arbeitet daran                           |
| **inReview**    | `2338665f` | Review-Agent aktiv / PR offen                      |
| **Freigabe**    | `d98e05b2` | Wartet auf PO-Freigabe nach Merge                  |
| **Blocking**    | `a21de5e9` | Blockiert – offene Findings oder Prozessverletzung |
| **Done**        | `98236657` | PO hat freigegeben, abgeschlossen                  |

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

## Statusübergänge im Workflow

```
Todo → In Progress → inReview → Freigabe → Done
              ↕                      ↑
           Blocking  ←───────────────┘
     (P-18 Vorbedingung verletzt)
```

| Wer setzt              | Von         | Nach         | Bedingung (P-18)                                                |
| ---------------------- | ----------- | ------------ | --------------------------------------------------------------- |
| Dev-Agent              | Todo        | In Progress  | PO-Freigabe nachgewiesen (Chat/Issue)                           |
| Dev-Agent              | In Progress | inReview     | Prettier ✅ ESLint ✅ Tests ✅ Commit gepusht                   |
| Dev-Agent              | inReview    | Freigabe     | Kein offenes Critical/High Finding, PR gemergt, Branch gelöscht |
| **GitHub Automation**  | Freigabe    | **Done**     | **PO-OK im Issue-Kommentar**                                    |
| Prozess-Guard          | any         | **Blocking** | P-18-Vorbedingung verletzt, Finding-Issue angelegt              |
| Dev-Agent (nach PO-OK) | Blocking    | In Progress  | Alle Blocking-Gründe behoben                                    |

---
