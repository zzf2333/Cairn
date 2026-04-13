# api-layer

## current design

REST + OpenAPI. No GraphQL, no tRPC. All endpoints follow /v1/ prefix,
but versioning strategy is not formally defined. Error format partially
inconsistent — new endpoints MUST use { code, message, data } structure.
Rate limiting not yet implemented.

## trajectory

2023-01 Express bare routes, no validation
2023-05 Added Zod request validation
2023-09 Trialed tRPC for 2 weeks → reverted, existing REST client migration cost too high
2024-03 Added OpenAPI doc generation, current state

## rejected paths

- tRPC: 2-week trial in 2023-09; migrating 6+ existing REST consumers (mobile app,
  webhooks, partner clients) required a coordinated multi-client flag day release
  Re-evaluate when: no existing REST consumers, or tRPC adds REST compatibility layer
- GraphQL: not formally evaluated; current team size and data complexity don't justify it
  Re-evaluate when: frontend needs cross-resource aggregation queries regularly

## known pitfalls

- Rate limiting not implemented: when adding it, do not break existing client retry
  logic — clients use exponential backoff with hardcoded thresholds
- File uploads: auth method not defined, do not reuse existing JWT flow directly
- Error format inconsistent: legacy endpoints return { error: string }, new ones use
  { code, message, data } — handle both formats during any migration work
- WebSocket concurrency: multi-tab connections hit Railway's connection limit; do not
  build features that rely on WS strong consistency (see WS-CONCURRENCY debt)

## open questions

- v2 versioning strategy undecided: URL versioning (/v2/) vs. header versioning
- File upload endpoint auth design not started
