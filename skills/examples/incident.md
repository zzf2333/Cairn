# Example: Incident Response

## Scenario

User: "We had a production outage last night. The cache layer started returning stale data after a Redis failover, and users saw other users' data for 20 minutes."

## Lifecycle Walkthrough

### 1. cairn_context

```
cairn_context({ task: "Post-incident: Redis failover caused cross-user data leak" })
```

### 2. cairn_signal (trauma event)

This is a security incident with real user impact. Signal immediately:

```
cairn_signal({
  signal_type: "user_rejection",
  domain: "security",
  details: {
    what: "Redis cache must invalidate on failover — stale connections served cross-user data",
    aliases: ["redis failover", "cache invalidation", "stale cache", "cross-user data leak"],
    reason: "20-minute production incident where users saw other users' data due to stale Redis connections after failover",
    rejected_alternatives: [
      { path: "Trust Redis connection pool to handle failover transparently", reason: "Pool held stale connections that returned wrong user's cached data" }
    ],
    revisit_when: ["never — this is a security invariant"]
  },
  evidence: {
    user_said: "Users saw other users' data for 20 minutes after Redis failover"
  }
})
```

The TrustRouter will assign this high gravity (likely G3) due to security domain + trauma indicators. It will be routed to staged for human ratification.

### 3. Review Staged Entry

```
cairn_stage_list()
```

Present the staged trauma event to the user. After confirmation:

```
cairn_stage_accept({ id: "evt_security_..." })
```

This becomes a permanent blood event with trauma flag. Future suggestions involving Redis connection pooling will trigger `hard_constraint` challenges.

### 4. Future Impact

In a future session, when someone asks "Can we use Redis connection pooling without health checks?":

```json
{
  "challenges": [
    {
      "level": "hard_constraint",
      "conflict_with": "evt_security_redis_failover",
      "description": "Redis cache must invalidate on failover. Historical incident: 20-min cross-user data leak.",
      "trauma": true
    }
  ]
}
```

The AI MUST NOT proceed. It must inform the user about the historical incident and require explicit reevaluation authorization.

### 5. cairn_session_end

```
cairn_session_end({
  summary: "Post-incident review: Redis failover caused cross-user data leak. Added trauma constraint requiring cache invalidation on failover. Implemented connection health checks and cache namespace isolation.",
  changed_domains: ["security", "infrastructure"],
  decisions_made: [
    "Redis connections require health check before use",
    "Cache keys must include user scope prefix",
    "Failover triggers full cache flush"
  ],
  unresolved: ["Load test the failover scenario", "Add failover simulation to CI"]
})
```
