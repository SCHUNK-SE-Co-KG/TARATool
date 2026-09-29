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

| Status          | Option-ID  | Bedeutung                                                                  |
| --------------- | ---------- | -------------------------------------------------------------------------- |
| **Todo**        | `f75ad846` | Noch nicht begonnen                                                        |
| **In Progress** | `47fc9ee4` | Dev-Agent arbeitet daran                                                   |
| **inReview**    | `2338665f` | Review-Agent aktiv / PR offen                                              |
| **Accepted**    | `d98e05b2` | PO hat vor dem Merge akzeptiert (Statusmodell B, P-25, ehemals "Freigabe") |
| **Blocking**    | `a21de5e9` | Blockiert – offene Findings oder Prozessverletzung                         |
| **Done**        | `98236657` | Automatisch nach Merge gesetzt (P-11), Story abgeschlossen                 |

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

## Statusübergänge im Workflow (Statusmodell B, seit TARA-0110)

Seit TARA-0110 erfolgt die PO-Akzeptanz **vor** dem Merge (nicht mehr danach).
Der Status "Freigabe" wurde in **"Accepted"** umbenannt (gleiche Option-ID
`d98e05b2`, keine bestehenden Zuordnungen verloren gegangen). "Done" wird
automatisch **nach dem Merge** gesetzt (P-11), sofern der Status vorher
"Accepted" war (Sicherheitscheck gegen P-25-Umgehung).

```
Todo → In Progress → inReview → Accepted → (Merge) → Done
              ↕                      ↑
           Blocking  ←───────────────┘
     (P-18 Vorbedingung verletzt)
```

| Wer setzt                         | Von         | Nach         | Bedingung (P-18)                                                                                        |
| --------------------------------- | ----------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Dev-Agent                         | Todo        | In Progress  | PO-Freigabe nachgewiesen (Chat/Issue)                                                                   |
| Dev-Agent                         | In Progress | inReview     | Prettier ✅ ESLint ✅ Tests ✅ Commit gepusht                                                           |
| **GitHub Automation**             | inReview    | **Accepted** | **P-25: gebundene PO-Akzeptanz auf dem PR (nach letztem Push) UND gültiger SHA-Review-Nachweis (P-10)** |
| **GitHub Automation (P-25-Gate)** | Accepted    | **(Merge)**  | Merge nur zulässig, wenn Status bereits "Accepted" ist (required Status-Check in process-guard.yml)     |
| **GitHub Automation**             | Accepted    | **Done**     | Automatisch nach erfolgreichem Merge (P-11), sofern Status vorher "Accepted" war                        |
| Prozess-Guard                     | any         | **Blocking** | P-18-Vorbedingung verletzt, Finding-Issue angelegt                                                      |
| Dev-Agent (nach PO-OK)            | Blocking    | In Progress  | Alle Blocking-Gründe behoben                                                                            |

Das Kommando zur PO-Akzeptanz muss an die TARA-ID gebunden sein (TARA-0109-
Format, z.B. "TARA-0110 akzeptiert") und **auf dem Pull Request selbst**
gepostet werden (nicht nur auf dem Story-Issue), damit der Bezug zum
geprüften `head_sha` eindeutig ist.

---
