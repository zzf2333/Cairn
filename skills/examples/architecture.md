# Example: Architecture Decision

## Scenario

User asks: "Let's switch from REST to GraphQL for the API layer."

## Lifecycle Walkthrough

### 1. cairn_context

```
cairn_context({ task: "Evaluate REST to GraphQL migration" })
```

Response includes:

```json
{
  "constraints": {
    "no_go": [
      {
        "what": "GraphQL considered and rejected in 2024 due to N+1 query complexity and team inexperience",
        "gravity": "G2",
        "archived": false
      }
    ]
  },
  "challenges": [
    {
      "level": "reflective_challenge",
      "conflict_with": "evt_api_rejection_graphql",
      "description": "GraphQL was previously rejected. Justify why premises have changed."
    }
  ]
}
```

### 2. Challenge Response

Because the challenge is `reflective_challenge`, you MUST explain why historical context no longer applies:

> Historical context: GraphQL was rejected in 2024 due to N+1 query complexity and team inexperience with GraphQL resolvers. Since then, the team has grown from 2 to 8 engineers, three of whom have GraphQL production experience. DataLoader patterns are now well-established. The API surface has grown to 47 endpoints with significant over-fetching on mobile clients. These changes may invalidate the original premises.

### 3. cairn_plan

```
cairn_plan({ task: "REST to GraphQL migration" })
```

Returns historical constraints, DNA guidance (if `simplicity_bias` is active, it may raise an additional challenge against the complexity increase), and recommended direction.

### 4. cairn_signal (if user decides)

If the user says "Yes, let's go with GraphQL":

```
cairn_signal({
  signal_type: "decision",
  domain: "api",
  details: {
    what: "Adopt GraphQL for API layer",
    aliases: ["graphql", "gql", "query language"],
    reason: "Mobile over-fetching, team now has GraphQL experience",
    rejected_alternatives: [{ path: "Keep REST", reason: "47 endpoints with over-fetching" }]
  },
  evidence: { user_said: "Yes, let's go with GraphQL" }
})
```

This signal will route through TrustRouter, which will detect the conflict with the historical rejection and likely stage it (G2+) for human ratification.

### 5. cairn_observe (before commit)

Before committing the initial GraphQL schema:

```
cairn_observe({
  summary: "Added GraphQL schema and resolvers for User and Project types. REST endpoints preserved for backward compat.",
  candidates: [
    {
      signal_type: "decision",
      domain: "api",
      details: { what: "GraphQL schema established", reason: "Foundation for REST migration" },
      recommendation: "capture",
      recommendation_reason: "Architectural decision affecting all API consumers"
    }
  ]
})
```

### 6. cairn_session_end

```
cairn_session_end({
  summary: "Initiated REST to GraphQL migration. Added schema for User and Project types with DataLoader. REST endpoints preserved. User overrode historical GraphQL rejection based on team growth.",
  changed_domains: ["api"],
  decisions_made: ["Adopt GraphQL", "Preserve REST during transition"],
  unresolved: ["Timeline for REST deprecation", "Mobile client migration plan"]
})
```
