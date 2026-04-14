## stage

phase: 早期增长 (2024-09+)
mode: 稳定性 > 交付速度 > 优雅性
team: 2 人，无专职运维
reject-if: 迁移工作量 > 1 周

## no-go

- tRPC（REST 客户端迁移成本过高，见 domains/api-layer.md）
- Redux（样板代码开销在 2 人团队中不可持续）
- Kubernetes（无运维能力）
- 微服务（无 B2B 产品，无业务支撑）

## hooks

planning / designing / suggesting for:

- api / endpoint / tRPC / GraphQL / REST / OpenAPI / 接口 / 数据获取 → read domains/api-layer.md first
- auth / login / 登录 / 认证 / JWT / session / token / OAuth / 用户权限 → read domains/auth.md first
- state / store / 状态 / Zustand / Redux / context / 全局状态 → read domains/state-management.md first
- db / database / 数据库 / migration / ORM / PostgreSQL → read domains/database.md first

## stack

state: Zustand
api: REST + OpenAPI
db: PostgreSQL
auth: JWT + Refresh Token 轮换
deploy: Railway

## debt

AUTH-COUPLING: 已接受 | 团队 > 4 人或 MAU > 10 万时修复 | 暂不重构
WS-CONCURRENCY: 已接受 | 迁移至 CDN 时自动解决 | 暂不添加轮询兜底
