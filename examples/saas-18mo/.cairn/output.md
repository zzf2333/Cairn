## stage

phase: early-growth (2024-09+)
mode: stability > speed > elegance
team: 2, no-ops
reject-if: migration > 1 week

## no-go

- tRPC (REST client migration cost too high, see domains/api-layer.md)
- Redux (boilerplate overhead unsustainable at team-2)
- kubernetes (no ops capacity)
- microservices (no B2B product, no justification)

## hooks

planning / designing / suggesting for:

- api / endpoint / tRPC / GraphQL / REST / OpenAPI → read domains/api-layer.md first
- auth / login / JWT / session / token / OAuth → read domains/auth.md first
- state / store / Zustand / Redux / context → read domains/state-management.md first
- db / database / migration / ORM / PostgreSQL → read domains/database.md first

## stack

state: Zustand
api: REST + OpenAPI
db: PostgreSQL
auth: JWT + Refresh token rotation
deploy: Railway

## debt

AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now
WS-CONCURRENCY: accepted | resolves on CDN migration | no polling fallback
