---
domain: rate-limiting
hooks: ["rate", "limit", "throttle", "quota", "abuse", "Redis", "bucket"]
updated: 2024-03
status: active
---

# rate-limiting

## current design

Token bucket algorithm implemented as Express middleware backed by Redis. Single global bucket per route (not per-user). Limits: 60 req/min for authenticated users, 10 req/min for unauthenticated. Redis TTL-based key expiry; no persistent rate-limit logs. Configuration lives in rate-limit.config.ts; no runtime override without deploy.

## trajectory

2022-12 No rate limiting — single trusted client
2023-03 First abuse incident: a partner scraper hit /export endpoint 4,000 times in 2 minutes → added basic in-memory limiting
2023-07 Migrated to Redis-backed token bucket — in-memory state lost on every deploy
2023-10 Evaluated AWS API Gateway managed throttling → rejected
2024-03 Added per-route config, tightened unauthenticated limits to 10 req/min → current state

## rejected paths

- AWS API Gateway managed throttling: evaluated to offload rate-limiting to infrastructure. Requires all traffic routing through API Gateway (currently direct ALB → ECS), cost at our request volume (~3M req/day) would be ~$900/month vs ~$30/month for Redis. Also loses per-request context (auth state, tenant) needed for future per-user buckets.
  Re-evaluate when: moving to full API Gateway for other reasons (e.g., multi-region routing), making the per-request cost marginal
- Per-user token buckets: more granular than global route limits. Implementation requires user-ID in Redis key, separate bucket config per tier. Deferred as RATE-GLOBAL-ONLY debt — current abuse patterns are from unauthenticated scrapers, not authenticated users.
  Re-evaluate when: paying-tier > 50 OR peak RPS > 500 (documented in output.md debt)

## known pitfalls

- RATE-GLOBAL-ONLY (accepted debt): a paying user who makes 60 legitimate requests/min counts against the same bucket as an abusive free-tier user on the same route. Do NOT attempt to split buckets without a full per-user implementation — partial fixes create fairness bugs.
- Do NOT increase global limits to fix single-customer complaints — increase is a policy decision requiring sign-off. File a ticket instead.
- Redis key format is `rl:<route-slug>:<client-ip>`. Do NOT change the key format without a migration — in-flight keys will reset all current counters on deploy.

## open questions

- Per-IP vs per-user-ID for unauthenticated limits — IP-based punishes shared offices
- Sliding window vs fixed window — current fixed window causes burst-at-window-edge issue
