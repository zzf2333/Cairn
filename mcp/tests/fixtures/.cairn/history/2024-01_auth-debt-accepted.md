type: debt
domain: auth
decision_date: 2024-01
recorded_date: 2025-01
summary: Accepted AUTH-COUPLING debt — auth checks remain inline in route handlers rather than extracted to middleware
rejected: Middleware extraction was scoped at approximately 2 weeks for a 2-person team. At the
  time, 38 protected routes all required refactoring and regression testing. The risk of
  introducing a subtle auth bypass during migration was considered too high for the current
  team capacity and release cadence. A phased extraction (route-by-route) was also considered
  but rejected — it would require maintaining two auth patterns simultaneously, increasing
  cognitive overhead with no intermediate user-facing benefit.
reason: Auth coupling is annoying but not blocking. Each new route copies the same 5-line
  auth check — mechanical duplication unlikely to cause divergent behavior. The cost of living
  with it is lower than the cost of fixing it at current team size and MAU. Formally accepting
  it as debt prevents well-intentioned but untimely refactors from introducing risk.
revisit_when: team > 4 (enough capacity to dedicate someone to the migration) OR MAU > 100k
  (auth performance becomes a concern and a middleware layer would enable response caching)
