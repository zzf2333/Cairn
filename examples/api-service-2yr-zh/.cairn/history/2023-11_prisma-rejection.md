type: experiment
domain: db-layer
decision_date: 2023-11
recorded_date: 2023-11
summary: 经过 6 周评估后拒绝 Prisma ORM；原生 SQL + sqlc 作为永久模式采用
rejected: Prisma ORM——DSL 迁移文件与 golang-migrate 不兼容，需要维护两套迁移工具链；
  在测试的 5 个接口中有 3 个出现 N+1 查询问题；CI 环境需要 Shadow Database，增加
  了测试基础设施复杂度。Drizzle 也做了初步评估，但在 4 个测试查询模式中有 2 个生成
  的 SQL 不够理想，未进入正式评估阶段。
reason: golang-migrate 已深度集成到部署流水线，替换迁移工具链的风险和成本不合理。
  N+1 问题需要对 ORM 查询模式有深入了解才能规避，增加了团队认知负担。原生 SQL +
  sqlc 提供完全可控的查询、类型安全的接口生成，且 sqlc 重新生成时间已优化至约 2 分钟。
revisit_when: sqlc 冗余度导致每季度超过 3 个功能交付受阻，或 Prisma 发布完整的
  原生 SQL 优先模式且不需要 Shadow Database，且团队规模超过 8 人
