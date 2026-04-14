---
domain: api-gateway
hooks: ["api", "endpoint", "REST", "OpenAPI", "route", "handler", "middleware"]
updated: 2024-12
status: stable
---

# api-gateway

## current design

Express + OpenAPI-spec-first: routes are generated from the OpenAPI schema and validated on ingress. All public-facing routes pass through a shared middleware chain (auth-check → rate-limit → request-log → body-validation). Internal service-to-service calls bypass rate-limiting but not auth. Spec file is source of truth for client SDK generation.

## trajectory

2022-12 Fastify evaluated, chose Express — team familiarity, richer middleware ecosystem
2023-02 GraphQL rejected after 3-week spike — see rejected paths
2023-05 API gateway extracted from monolith → standalone Node.js service
2023-05 Kong evaluated for gateway layer → rejected, custom Express middleware sufficient
2024-08 gRPC evaluated for internal traffic → rejected
2024-12 OpenAPI spec-first adopted, routes now generated from schema → current state

## rejected paths

- GraphQL: evaluated for 3 weeks targeting type-safe client contracts. Query flexibility introduced N+1 risk without a DataLoader layer, schema stitching added complexity across 3 service boundaries, and zero REST clients were willing to migrate simultaneously. REST + OpenAPI covers all current contract needs.
  Re-evaluate when: client count > 10 with divergent data-shape requirements, or a dedicated GraphQL platform team is available
- Kong (API gateway): evaluated as a managed proxy layer. Our routing logic is too application-specific (auth-context injection, per-tenant overrides) to delegate to a config-driven proxy. Custom Express middleware gives full control.
  Re-evaluate when: team dedicated to platform operations (> 2 platform-ops) and cross-service routing rules exceed 50 entries
- gRPC (internal traffic): evaluated after scale-up to 6 services. Bidirectional streaming not needed; unary calls over HTTP/2 offered ~15% latency improvement but required Go/Node protobuf toolchain maintenance. HTTP/JSON internal calls are simpler to debug and test.
  Re-evaluate when: internal P99 latency > 50ms AND team has a dedicated platform engineer to own protobuf schema governance

## known pitfalls

- Do NOT add business logic to middleware — middleware is for cross-cutting concerns only (auth, rate-limit, logging). Reviewers should reject any PR that puts domain logic in a middleware file.
- Do NOT bypass body-validation middleware even for "internal" endpoints — every endpoint that touches user data must go through the validation chain.
- RATE-GLOBAL-ONLY (accepted debt): rate limiting is currently global per route, not per user. Do NOT implement per-user buckets as a "quick improvement" — this is accepted debt with a defined revisit condition (paying-tier > 50 OR peak RPS > 500).

## open questions

- Should we version the OpenAPI spec (v1/v2 prefix) now or wait for first breaking change?
- Deprecation strategy for legacy v0 endpoints still used by 3 older mobile clients
