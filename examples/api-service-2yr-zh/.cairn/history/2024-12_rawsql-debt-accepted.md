type: debt
domain: db-layer
decision_date: 2024-12
recorded_date: 2024-12
summary: 正式接受 SQL-NO-ORM 技术债——原生 SQL + sqlc 是永久模式，而非临时方案
rejected: 重新引入 ORM——对 Drizzle 进行了 1 周评估，在 4 个测试查询模式中有 2 个
  生成的 SQL 不够理想（额外 JOIN 和冗余子查询）；TypeORM 因装饰器过度和迁移工具链
  冲突在初筛阶段直接排除。sqlc 重新生成时间已优化至约 2 分钟，不再是日常开发瓶颈。
reason: 原生 SQL + sqlc 在过去 13 个月的实际交付中表现稳定，无因查询层问题导致的
  线上事故。sqlc 提供完全可控的查询和类型安全的接口，团队已建立成熟的 SQL 编写规范。
  将其定性为永久模式而非技术债，有助于防止未来因"感觉应该用 ORM"而引发的重复评估
  和分心。
revisit_when: 团队规模超过 8 人且 sqlc 冗余度导致每季度超过 3 个功能交付受阻，或
  出现完全原生 SQL 优先、无 Shadow Database 需求的新一代 ORM
