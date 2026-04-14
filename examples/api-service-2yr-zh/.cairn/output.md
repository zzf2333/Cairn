## stage

phase: scale (2024-12+)
mode: reliability > maintainability > velocity
team: 6, platform-ops: 1
reject-if: migration > 2 weeks or requires coordinated deploy across > 2 services

## no-go

- GraphQL（当前客户端数量不需要，REST + OpenAPI 已足够，复杂度不合理）
- gRPC（仅有内部收益，对外部消费者无增量价值，引入额外复杂度）
- 微服务拆分（团队规模和运维成熟度尚不支持；先做模块化单体）
- Prisma ORM（已评估并否决；raw SQL + sqlc 是既定模式）
- Kafka（当前吞吐量用 SQS 已够；Kafka 需要额外的 Broker 运维开销）

## hooks

planning / designing / suggesting for:

- api / endpoint / REST / OpenAPI / route / handler / middleware → read domains/api-gateway.md first
- rate / limit / throttle / quota / abuse / Redis / bucket → read domains/rate-limiting.md first
- observability / metrics / tracing / logging / OTel / Datadog / alert / monitor → read domains/observability.md first
- db / database / query / migration / SQL / PostgreSQL / schema / ORM → read domains/db-layer.md first

## stack

api: Express + OpenAPI（生成式）
db: PostgreSQL 15 + raw SQL（sqlc）
messaging: AWS SQS
observability: OpenTelemetry → Datadog
rate-limiting: Redis token bucket（自定义中间件）
deploy: AWS ECS（Fargate）+ ALB
auth: JWT + refresh token 轮换（共享 auth-service）

## debt

RATE-GLOBAL-ONLY: accepted | 付费用户 > 50 或峰值 RPS > 500 时修复 | 当前每路由单一全局桶，暂不改动
SQL-NO-ORM: accepted | 团队 > 8 人或平均每域查询复杂度 > 300 行时重新评估 | raw sqlc；永不引入 ORM
