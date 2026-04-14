---
domain: db-layer
hooks: ["db", "database", "query", "migration", "SQL", "PostgreSQL", "schema", "ORM", "数据库", "查询", "迁移", "索引", "事务"]
updated: 2024-12
status: stable
---

# db-layer

## current design

PostgreSQL 15 配合 raw SQL 查询，由 sqlc 管理（从 .sql 文件生成类型安全的 TypeScript 封装）。迁移由 golang-migrate 管理；迁移文件为纯 SQL，无 ORM DSL。通过 pg（node-postgres）进行连接池管理，每个服务实例连接池大小为 10。只读副本尚未启用，但副本端点已预置（RDS 只读副本，零流量）。

## trajectory

2022-12 Sequelize ORM — 初始搭建，Node.js 团队熟悉
2023-01 Sequelize 迁移复杂度增长 → 评估 Prisma
2023-03 Prisma 评估 6 周 → 否决（见 rejected paths）
2023-04 从 Sequelize 迁移至 raw SQL + sqlc — 接受 SQL-NO-ORM 技术债
2024-01 pg 连接池从默认 5 调至 10，应对 P95 查询延迟峰值
2024-08 评估只读副本路由用于分析查询 → 推迟（见 open questions）
2024-12 升级 PostgreSQL 15，新增 generated columns 用于搜索优化 → 当前状态

## rejected paths

- Prisma ORM：作为 Sequelize 替代方案评估 6 周。Prisma 的开发者体验对于绿地项目极佳。但评估中发现关键问题：(1) Prisma 迁移系统要求所有 schema 变更通过 Prisma schema DSL，与我们的直接 SQL 迁移文件（golang-migrate）不兼容；(2) 对 5 个评估端点的 Prisma 生成 SQL 进行 EXPLAIN 分析，其中 3 个存在 N+1 模式；(3) Prisma shadow database 要求在 CI 中添加第二个 Postgres 实例。TypeORM 无需正式评估直接否决——基于装饰器的 schema 定义对我们的 SQL 优先审查工作流根本不适配。
  Re-evaluate when: Prisma 发布完整 raw-SQL 优先模式（无需 shadow database），且团队 > 8 人因 sqlc 冗长度出现开发瓶颈
- TypeORM：与 Prisma 一并简要考虑。基于装饰器的 schema 定义将数据库 schema 与 TypeScript 类定义耦合，使 schema 迁移更难审查和回滚。未经正式评估直接否决。
  Re-evaluate when: 永不 — 这种方式从根本上与我们的审查工作流不兼容
- Drizzle ORM：2024-08 作为更轻量替代方案评估。在 ORM 选项中最接近 raw SQL。推迟是因为 sqlc 目前运行良好，迁移成本不合理。
  Re-evaluate when: sqlc 类型生成成为维护瓶颈，或 Drizzle 发布 v1.0 稳定版

## known pitfalls

- SQL-NO-ORM（已接受技术债）：所有查询均为 .sql 文件中的 raw SQL，通过 sqlc 生成。禁止以"快速实现"为由引入任何 ORM 库——这是已接受的技术债，有明确的重新评估条件。引入 ORM 会造成两个 schema 事实来源。
- 禁止将每实例连接池大小提升到 15 以上——RDS 实例规格（db.t3.medium）最多支持约 85 个连接；6 个 ECS 任务，15×6 = 90 超过上限，高负载下会导致连接拒绝。
- 禁止对主库运行耗时分析查询——即使已预置只读副本，路由逻辑尚未启用。所有查询打主库。超过 100ms 的分析查询应调度为异步任务。
- 迁移文件是追加式的。禁止编辑已有迁移文件——golang-migrate 对迁移文件做校验，初次应用后任何文件被修改都会拒绝运行。

## open questions

- 只读副本路由：预置已就绪，但尚无客户端路由逻辑。值得在下次扩容里程碑前为分析端点实现。
- events 表分区策略 — 当前 4,000 万行，查询时间可接受但每天增长约 50 万行
