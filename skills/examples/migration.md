# Example: Migration

## Scenario

User asks: "We need to migrate from MySQL to PostgreSQL."

## Lifecycle Walkthrough

### 1. cairn_context

```
cairn_context({ task: "Migrate from MySQL to PostgreSQL" })
```

Response includes:

```json
{
  "stage": { "phase": "maturity", "confidence": 0.8 },
  "constraints": {
    "stage_constraints": [
      "Maturity phase: new deps require strong justification, conservative changes"
    ]
  },
  "dna": {
    "relevant_traits": [
      { "name": "simplicity_bias", "level": "moderate", "implication": "Complexity increase will be challenged" }
    ]
  },
  "challenges": [
    {
      "level": "reflective_challenge",
      "conflict_with": "stage:maturity",
      "description": "Database migration is a high-risk change in maturity phase. Justify why this cannot wait or be done incrementally."
    }
  ]
}
```

### 2. Challenge Response

The project is in maturity phase, and the DNA has `simplicity_bias`. Two challenges fire:

> **Stage challenge**: This project is in maturity phase. A full database migration is a high-risk structural change. The standard guidance is conservative changes only. I need to understand: is there a forcing function (MySQL EOL, licensing change, missing feature) that makes this urgent, or could this be done incrementally?

> **DNA challenge (simplicity_bias)**: The project has a simplicity bias. A database migration introduces significant short-term complexity (dual-write, schema translation, data migration tooling). This conflicts with the project's emergent identity. Is the long-term simplification worth the transition cost?

### 3. cairn_plan

After user provides justification:

```
cairn_plan({ task: "MySQL to PostgreSQL migration" })
```

Returns:

```json
{
  "historical_constraints": [
    "Repository layer abstraction exists — queries do not use MySQL-specific syntax (confirmed by blood event)"
  ],
  "warnings": [
    "3 stored procedures use MySQL-specific features (GROUP_CONCAT, ON DUPLICATE KEY UPDATE)",
    "Backup scripts assume mysqldump format"
  ],
  "recommended_direction": "Dual-write migration with shadow reads. Convert stored procedures first.",
  "open_questions": [
    "What is the data volume? Migration time estimate needed.",
    "Are there external systems reading from MySQL directly?"
  ]
}
```

### 4. cairn_signal (during migration)

User: "We're not going to support both databases simultaneously. Clean cut after migration weekend."

```
cairn_signal({
  signal_type: "decision",
  domain: "infrastructure",
  details: {
    what: "Clean-cut database migration, no dual-write period",
    aliases: ["big bang migration", "cutover"],
    reason: "Team cannot maintain two database backends",
    rejected_alternatives: [
      { path: "Dual-write with gradual migration", reason: "Team capacity — cannot maintain both" },
      { path: "Incremental table-by-table migration", reason: "Foreign key dependencies make partial migration fragile" }
    ]
  },
  evidence: { user_said: "Clean cut after migration weekend" }
})
```

### 5. cairn_observe (before commit)

```
cairn_observe({
  summary: "Completed PostgreSQL schema translation. Converted 3 stored procedures. Migration scripts tested against staging copy.",
  candidates: [
    {
      signal_type: "decision",
      domain: "infrastructure",
      details: { what: "PostgreSQL replaces MySQL as primary database" },
      recommendation: "capture",
      recommendation_reason: "Fundamental infrastructure decision affecting all data access"
    },
    {
      signal_type: "constraint_declaration",
      domain: "infrastructure",
      details: { what: "No MySQL-specific SQL in application code" },
      recommendation: "capture",
      recommendation_reason: "Prevents regression to MySQL-specific patterns"
    }
  ]
})
```

### 6. cairn_session_end

```
cairn_session_end({
  summary: "MySQL to PostgreSQL migration: schema translated, stored procedures converted, migration scripts created. Clean-cut approach chosen over dual-write. Stage challenge overridden with user justification (MySQL 5.7 EOL).",
  changed_domains: ["infrastructure"],
  decisions_made: [
    "PostgreSQL as primary database",
    "Clean-cut migration (no dual-write)",
    "No MySQL-specific SQL in codebase"
  ],
  unresolved: [
    "Schedule migration weekend",
    "Update backup scripts for pg_dump",
    "Notify external consumers of connection string change"
  ]
})
```
