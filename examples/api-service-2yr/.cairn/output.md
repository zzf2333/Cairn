## stage

phase: scale (2024-12+)
mode: reliability > maintainability > velocity
team: 6, platform-ops: 1
reject-if: migration > 2 weeks or requires coordinated deploy across > 2 services

## no-go

- GraphQL (REST + OpenAPI sufficient, GraphQL complexity unjustified at current client count)
- gRPC (internal-only benefit, added complexity for no external consumer gain)
- microservices split (team size and operational maturity not there yet; modular monolith first)
- Prisma ORM (evaluated and rejected; raw SQL with sqlc is the established pattern)
- Kafka (SQS sufficient for current throughput; Kafka adds broker ops overhead)

## hooks

planning / designing / suggesting for:

- api / endpoint / REST / OpenAPI / route / handler / middleware → read domains/api-gateway.md first
- rate / limit / throttle / quota / abuse / Redis / bucket → read domains/rate-limiting.md first
- observability / metrics / tracing / logging / OTel / Datadog / alert / monitor → read domains/observability.md first
- db / database / query / migration / SQL / PostgreSQL / schema / ORM → read domains/db-layer.md first

## stack

api: Express + OpenAPI (generated)
db: PostgreSQL 15 + raw SQL (sqlc)
messaging: AWS SQS
observability: OpenTelemetry → Datadog
rate-limiting: Redis token bucket (custom middleware)
deploy: AWS ECS (Fargate) + ALB
auth: JWT + refresh token rotation (shared auth-service)

## debt

RATE-GLOBAL-ONLY: accepted | per-user buckets when paying-tier > 50 OR peak RPS > 500 | single global bucket per route now
SQL-NO-ORM: accepted | reconsider at team > 8 or if query complexity > 300 LOC avg per domain | raw sqlc; no ORM ever
