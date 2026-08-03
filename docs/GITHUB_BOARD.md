# GitHub Project Board – TARATool Überarbeitung

Alle IDs für programmatischen Zugriff via `gh api graphql`.

---

## Projekt-Metadaten

| Eigenschaft      | Wert                                   |
| ---------------- | -------------------------------------- |
| **Project Name** | TARATool Überarbeitung                 |
| **Project ID**   | `PVT_kwHOBLN4284BfLtb`                 |
| **Owner**        | `Bheowulf`                             |
| **Repo**         | `https://github.com/Bheowulf/TARATool` |

---

## Status-Feld

| Eigenschaft   | Wert                             |
| ------------- | -------------------------------- |
| **Feld-Name** | Status                           |
| **Feld-ID**   | `PVTSSF_lAHOBLN4284BfLtbzhZgYuI` |

### Status-Optionen

| Status          | Option-ID  | Bedeutung                         |
| --------------- | ---------- | --------------------------------- |
| **Todo**        | `f75ad846` | Noch nicht begonnen               |
| **In Progress** | `47fc9ee4` | Dev-Agent arbeitet daran          |
| **inReview**    | `bbeb708d` | Review-Agent aktiv / PR offen     |
| **Freigabe**    | `d2e53e50` | Wartet auf PO-Freigabe nach Merge |
| **Done**        | `98236657` | PO hat freigegeben, abgeschlossen |

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

## Statusübergänge im Workflow

```
Todo → In Progress → inReview → Freigabe → Done
                         ↑
                   (PR offen, Review-Agent aktiv)
```

| Wer setzt         | Von         | Nach        | Bedingung                               |
| ----------------- | ----------- | ----------- | --------------------------------------- |
| Dev-Agent         | Todo        | In Progress | Story freigegeben (PO-OK)               |
| Dev-Agent         | In Progress | inReview    | Prettier ✅ ESLint ✅ Tests ✅ PR offen |
| Dev-Agent         | inReview    | Freigabe    | PR gemergt, P-01–P-15 OK                |
| **Product Owner** | Freigabe    | **Done**    | **Explizites PO-OK**                    |
