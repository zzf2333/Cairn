# Example: Debugging

## Scenario

User reports: "Production is returning 500 errors on the /api/orders endpoint since the last deploy."

## Lifecycle Walkthrough

### 1. cairn_context

```
cairn_context({ task: "Debug 500 errors on /api/orders", files: ["src/api/orders.ts"] })
```

Response includes:

```json
{
  "constraints": {
    "no_go": [
      {
        "what": "Direct database queries in API handlers — all DB access goes through the repository layer",
        "gravity": "G2"
      }
    ]
  },
  "relevant_domains": [
    {
      "domain": "api",
      "rejected_paths": [
        { "path": "Inline SQL in handlers", "reason": "Caused injection vulnerability in 2024-Q2" }
      ],
      "pitfalls": ["Orders endpoint depends on inventory service — check for timeout cascades"]
    }
  ]
}
```

### 2. Investigation Guided by Context

The context tells you:

- Do not add direct DB queries to debug — use the repository layer
- The orders endpoint depends on the inventory service — timeouts are a known pitfall
- Historical SQL injection incident means extra caution with query changes

This context prevents you from suggesting "let's add a quick raw SQL query to check the data" as a debugging approach.

### 3. cairn_signal (if root cause reveals a constraint)

After investigation, you find the bug: a recent migration added a NOT NULL column without a default value, and existing rows fail validation.

User: "We need to allow null for now and backfill later. Add it to the debt list."

```
cairn_signal({
  signal_type: "debt_acceptance",
  domain: "api",
  details: {
    what: "orders.priority column allows NULL despite schema intent",
    reason: "Backfill needed for 50k existing rows, blocking production fix",
    revisit_when: ["backfill migration completed", "next quarterly maintenance window"]
  },
  evidence: {
    user_said: "Allow null for now and backfill later",
    files: ["migrations/20260519_add_priority.sql"]
  }
})
```

### 4. cairn_session_end

```
cairn_session_end({
  summary: "Fixed 500 errors on /api/orders caused by NOT NULL migration without default. Accepted NULL as temporary debt pending backfill. Root cause: migration did not account for existing rows.",
  changed_domains: ["api"],
  decisions_made: ["Allow NULL on orders.priority temporarily"],
  unresolved: ["Backfill 50k rows", "Add migration pre-check to CI"]
})
```
