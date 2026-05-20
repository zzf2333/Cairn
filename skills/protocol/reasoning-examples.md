# Reasoning Examples

Behavioral examples showing correct lifecycle execution. Each example shows the reasoning chain, not just the tool call.

---

## Example 1: User references historical failure

```
User: "We tried Kafka before and it caused operational pain. Let's not go there again."
```

Reasoning:
1. This is explicit long-term cognition — a historical reference with rejection intent.
2. Future sessions must know this to avoid re-suggesting Kafka.
3. Signal immediately.

```
cairn_signal({
  signal_type: "historical_reference",
  domain: "messaging",
  details: {
    what: "Kafka rejected due to operational complexity",
    aliases: ["kafka", "event streaming", "message queue"],
    reason: "Caused operational pain in previous attempt",
    rejected_alternatives: [{ path: "Kafka", reason: "operational complexity" }]
  },
  evidence: { user_said: "We tried Kafka before and it caused operational pain" }
})
```

Response: Acknowledge the history, confirm it's captured, suggest alternatives that avoid the same pain point.

---

## Example 2: User rejects a suggestion

```
Assistant: "We could use Redis for caching here."
User: "No — we don't want to add Redis as a dependency. Keep it in-process."
```

Reasoning:
1. The user rejected a specific technical direction with a clear constraint.
2. This is both a rejection and a constraint declaration.
3. Signal as user_rejection so future sessions know Redis is off the table.

```
cairn_signal({
  signal_type: "user_rejection",
  domain: "caching",
  details: {
    what: "Redis rejected as caching layer",
    aliases: ["redis", "external cache"],
    reason: "User wants to avoid adding Redis as a dependency",
    rejected_alternatives: [{ path: "Redis caching", reason: "unwanted dependency" }]
  },
  evidence: { user_said: "No — we don't want to add Redis as a dependency" }
})
```

---

## Example 3: Implicit constraint during discussion

```
User: "We're a two-person team, so anything that needs dedicated ops is out."
```

Reasoning:
1. This constrains future architecture decisions — not just this task.
2. It explains WHY certain paths are unavailable (team size, no ops capacity).
3. Signal as constraint_declaration.

```
cairn_signal({
  signal_type: "constraint_declaration",
  details: {
    what: "No infrastructure requiring dedicated operations",
    aliases: ["ops-heavy", "dedicated ops", "complex infra"],
    reason: "Two-person team, no ops capacity"
  },
  evidence: { user_said: "We're a two-person team, so anything that needs dedicated ops is out" }
})
```

---

## Example 4: Implicit cognition before commit

After a session implementing a new auth system, before committing:

Reasoning:
1. During implementation, several implicit decisions were made — choosing JWT over sessions, putting tokens in httpOnly cookies, adding refresh token rotation.
2. None of these were explicitly signaled during conversation.
3. Use observe to capture them before they disappear.

```
cairn_observe({
  summary: "Implemented JWT auth with httpOnly cookies and refresh token rotation",
  candidates: [
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "JWT over server sessions", reason: "Stateless scaling, team familiarity" },
      evidence: { files: ["src/auth/jwt.ts", "src/middleware/auth.ts"] },
      recommendation: "capture",
      recommendation_reason: "Architectural decision affecting all authenticated endpoints"
    },
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "Refresh token rotation enabled", reason: "Security best practice" },
      evidence: { files: ["src/auth/refresh.ts"] },
      recommendation: "capture",
      recommendation_reason: "Security decision that should not be silently reverted"
    },
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "Token stored in httpOnly cookie", reason: "XSS protection" },
      evidence: { files: ["src/auth/cookie.ts"] },
      recommendation: "skip",
      recommendation_reason: "Standard practice, not a project-specific decision"
    }
  ]
})
```

---

## Example 5: Trivial task — no Cairn needed

```
User: "Fix the typo in the error message on line 42 of utils.ts"
```

Reasoning:
1. Single-line typo fix. No architectural implication.
2. No future session would benefit from knowing about this.
3. Skip the entire Cairn lifecycle. Just fix the typo.

No Cairn tools called. Fix directly.

---

## Example 6: Context returns a challenge

```
cairn_context({ task: "Add microservice for payments" })
```

Response includes a `reflective_challenge` from a previous rejection of microservices.

Reasoning:
1. A reflective_challenge means: explain in writing why history no longer applies, or do not proceed.
2. Do NOT silently proceed. Do NOT ignore the challenge.
3. Present the historical context to the user and justify why premises may have changed.

Response:
> Historical context: Microservices were rejected 6 months ago due to team size (2 engineers) and operational complexity. The team has since grown to 6 engineers with dedicated DevOps. This may change the calculus. Should we revisit?

Only proceed after the user explicitly confirms.
