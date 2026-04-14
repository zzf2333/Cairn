type: debt
domain: rate-limiting
decision_date: 2024-04
recorded_date: 2025-04
summary: Accepted RATE-GLOBAL-ONLY debt — per-user rate buckets deferred until scale signals are met
rejected: Immediate per-user bucket implementation — proposed after 2 enterprise customers requested
  per-user rate limits to isolate their usage from shared global buckets. Implementation would
  require user-ID-keyed Redis buckets, separate limit config per subscription tier, and token
  refresh logic on tier upgrades. Estimated 3-week implementation + 1 week testing. Rejected
  because paying-tier count is currently 8 customers (target threshold: > 50). Building multi-tier
  rate-limit infrastructure for 8 paying customers is premature optimization. A simpler workaround
  (dedicated high-limit route profiles for enterprise accounts) was also considered and rejected —
  it creates an unmaintainable config proliferation without solving the underlying architecture.
reason: Current abuse patterns are from unauthenticated scrapers, not paying users. Global buckets
  are sufficient to protect the service. The 2 enterprise customers requesting per-user limits were
  given temporary limit increases via environment variable config pending the full implementation.
  Accepting this as explicit debt ensures the revisit condition is tracked and not forgotten.
revisit_when: paying-tier > 50 customers OR peak RPS sustained > 500 req/sec (current peak: ~80
  req/sec); whichever comes first
