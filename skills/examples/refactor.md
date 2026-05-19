# Example: Refactoring

## Scenario

User asks: "Refactor the auth module to use dependency injection instead of global singletons."

## Lifecycle Walkthrough

### 1. cairn_context

```
cairn_context({ task: "Refactor auth to dependency injection", files: ["src/auth/"] })
```

Response includes:

```json
{
  "constraints": {
    "accepted_debt": [
      {
        "what": "Auth module uses global singletons for session store and token validator",
        "reason": "Accepted during MVP to ship faster",
        "revisit_when": ["test coverage > 80%", "second auth provider needed"]
      }
    ]
  },
  "stage": { "phase": "growth", "confidence": 0.85 }
}
```

### 2. Check Revisit Conditions

The accepted_debt has `revisit_when` conditions. Before proceeding, verify:

- Is test coverage > 80%? Check.
- Is a second auth provider needed? Ask the user.

If conditions are met, the refactor is sanctioned. If not, explain:

> This singleton pattern is accepted technical debt. The revisit conditions (test coverage > 80% or second auth provider needed) are not yet met. Proceeding with the refactor now would violate the accepted debt constraint. Would you like to override?

### 3. cairn_signal (during work)

If the user establishes a new constraint during refactoring:

User: "Make sure the DI container doesn't become a service locator. I've seen that anti-pattern kill testability."

```
cairn_signal({
  signal_type: "constraint_declaration",
  domain: "auth",
  details: {
    what: "DI container must not become a service locator",
    aliases: ["service locator", "DI anti-pattern"],
    reason: "Service locator pattern kills testability"
  },
  evidence: { user_said: "Make sure the DI container doesn't become a service locator" }
})
```

### 4. cairn_observe (before commit)

```
cairn_observe({
  summary: "Refactored auth module from global singletons to constructor injection. SessionStore and TokenValidator now injected via factory.",
  candidates: [
    {
      signal_type: "decision",
      domain: "auth",
      details: { what: "Constructor injection over container-based DI", reason: "Avoid service locator anti-pattern" },
      recommendation: "capture",
      recommendation_reason: "Establishes DI pattern for future modules"
    },
    {
      signal_type: "constraint_declaration",
      domain: "auth",
      details: { what: "No service locator pattern", reason: "Already captured via cairn_signal" },
      recommendation: "skip",
      recommendation_reason: "Duplicate of signal already captured this session"
    }
  ]
})
```

### 5. cairn_session_end

```
cairn_session_end({
  summary: "Refactored auth from singletons to constructor injection. Revisit conditions for accepted debt were met (coverage at 87%). Established no-service-locator constraint.",
  changed_domains: ["auth"],
  decisions_made: ["Constructor injection pattern", "No service locator"],
  unresolved: ["Apply same DI pattern to other modules?"]
})
```
