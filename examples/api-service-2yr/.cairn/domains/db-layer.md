---
domain: db-layer
hooks: ["db", "database", "query", "migration", "SQL", "PostgreSQL", "schema", "ORM"]
updated: 2024-12
status: stable
---

# db-layer

## current design

PostgreSQL 15 with raw SQL queries managed by sqlc (generates type-safe Go-like TS wrappers from .sql files). Migrations managed by golang-migrate; migration files are SQL-only, no ORM DSL. Connection pooling via pg (node-postgres) with pool size 10 per service instance. Read replicas not yet active but replica endpoint is provisioned (RDS read replica, zero traffic).

## trajectory

2022-12 Sequelize ORM — initial setup, familiar to Node.js team
2023-01 Sequelize migration complexity growing → evaluated Prisma
2023-03 Prisma evaluated for 6 weeks → rejected (see rejected paths)
2023-04 Migrated from Sequelize to raw SQL + sqlc — SQL-NO-ORM debt accepted
2024-01 pg connection pool tuned from default 5 → 10 after P95 query latency spike
2024-08 Evaluated read replica routing for analytics queries → deferred (see open questions)
2024-12 PostgreSQL 15 upgrade, added generated columns for search optimization → current state

## rejected paths

- Prisma ORM: evaluated for 6 weeks as a Sequelize replacement. Prisma's migration system required all schema changes through Prisma schema DSL, which conflicted with our direct SQL migrations. At the time (~2023-03) Prisma's generated SQL was not inspectable without running EXPLAIN, leading to N+1 queries in 3 of 5 evaluated endpoints. Raw SQL gives full control and predictability.
  Re-evaluate when: Prisma ships full raw-SQL-first mode (shadow database not required) AND team > 8 developers struggling with sqlc verbosity
- TypeORM: briefly considered alongside Prisma. Decorator-based schema definition couples DB schema to TypeScript class definitions, making schema migrations harder to review and rollback. Rejected without formal evaluation.
  Re-evaluate when: never — approach is fundamentally wrong for our review workflow
- Drizzle ORM: evaluated in 2024-08 as a lighter alternative. Closest to raw SQL of the ORM options. Deferred because sqlc is already working, migration cost not justified.
  Re-evaluate when: sqlc type generation becomes a maintenance bottleneck OR Drizzle reaches v1.0 stability

## known pitfalls

- SQL-NO-ORM (accepted debt): all queries are raw SQL in .sql files, generated via sqlc. Do NOT introduce any ORM library as a "quick win" — this is accepted debt with explicit revisit conditions. Adding an ORM would create two schema sources of truth.
- Do NOT increase pool size beyond 15 per instance — RDS instance class (db.t3.medium) supports max ~85 connections; with 6 ECS tasks, 15×6 = 90 would exceed the limit and cause connection refusals under load.
- Do NOT run long-running analytical queries against the primary — even with read replicas provisioned, routing is not yet enabled. All queries hit primary. Analytical queries > 100ms should be scheduled as async jobs.
- Migration files are append-only. Do NOT edit existing migration files — golang-migrate checksums migrations and will refuse to run if any file is modified after initial apply.

## open questions

- Read replica routing: provision is ready, but no client-side routing logic exists yet. Worth implementing for analytics endpoints before next scale milestone.
- Partitioning strategy for events table — currently 40M rows, query time acceptable but growing ~500k rows/day
