type: experiment
domain: db-layer
decision_date: 2023-11
recorded_date: 2023-11
summary: Rejected Prisma ORM after 6-week evaluation; raw SQL + sqlc adopted as permanent pattern
rejected: Prisma ORM — evaluated as a replacement for Sequelize after Sequelize migration complexity
  became painful at 40+ migration files. Prisma's developer experience is excellent for greenfield
  projects. However, a 6-week evaluation revealed critical issues: (1) Prisma's migration system
  required all schema changes through Prisma schema DSL, incompatible with our direct SQL migration
  files (golang-migrate); (2) EXPLAIN analysis of Prisma-generated SQL on 5 evaluated endpoints
  showed N+1 patterns in 3 of them, requiring findMany + include rewrites that were harder to
  reason about than equivalent SQL; (3) Prisma shadow database requirement adds a second Postgres
  instance in CI, increasing pipeline complexity. TypeORM was also rejected without a formal
  evaluation — decorator-based schema definition is fundamentally wrong for our SQL-first review
  workflow.
reason: Raw SQL with sqlc type generation gives full control and predictability. EXPLAIN ANALYZE
  on every query during PR review is now standard. sqlc generates TypeScript types from .sql files,
  so there is no ORM-to-SQL translation layer to reason about. The migration cost from Sequelize
  was ~2 weeks; accepted as SQL-NO-ORM technical debt with explicit revisit conditions.
revisit_when: sqlc type generation becomes a maintenance bottleneck (> 3 engineers blocked on
  schema changes per quarter) OR Prisma ships full raw-SQL-first mode without shadow database
  requirement AND team > 8 developers
