type: transition
domain: rate-limiting
decision_date: 2023-07
recorded_date: 2023-07
summary: Migrated rate limiting from in-memory to Redis-backed token bucket after deploy-reset incidents
rejected: Continuing with in-memory token bucket — after 3 deploy incidents where rate-limit state
  was wiped mid-abuse-event (partner scraper), in-memory state is not viable for persistent
  enforcement. Evaluated sticky sessions on ALB to keep a user on the same instance, but ECS
  Fargate with rolling deploys makes sticky sessions unreliable. Evaluated a shared database table
  (Postgres) as the rate-limit store — viable but adds write load to the primary DB for every
  request, unacceptable at current request volume (~500k req/day).
reason: Redis with TTL-based keys provides persistent, fast (P99 < 1ms) rate-limit state across
  all ECS instances without impacting the primary DB. The token bucket implementation (ioredis +
  Lua atomic script) handles concurrent bucket decrements correctly. Redis is already in the stack
  for session caching, so no new infrastructure dependency.
revisit_when: Redis becomes a reliability concern (> 2 outages in 6 months) or AWS API Gateway
  becomes cost-effective for our traffic volume
