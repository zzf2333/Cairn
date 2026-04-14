type: debt
domain: db-layer
decision_date: 2024-12
recorded_date: 2024-12
summary: Formally accepted SQL-NO-ORM debt — raw SQL + sqlc is the permanent pattern, not a temporary workaround
rejected: ORM reintroduction after 18 months on raw SQL — raised during a 2024-12 sprint retro
  where 2 engineers noted that sqlc schema regeneration on every migration added ~10 minutes to
  feature development per schema change. Drizzle ORM was the specific candidate: lighter than
  Prisma, TypeScript-native, SQL-like query builder. Evaluated Drizzle for 1 week. Drizzle still
  introduces a query-builder abstraction layer that can generate suboptimal SQL without EXPLAIN
  verification (confirmed on 2 of 4 tested query patterns). sqlc regeneration overhead is real
  but the correct fix is faster CI, not an ORM. The sqlc pipeline was subsequently optimized
  (cached codegen) to reduce regeneration to ~2 minutes.
reason: After 18 months with raw SQL, EXPLAIN review of every query has caught 6 significant
  N+1 or missing-index issues that an ORM would have obscured. The team has built strong SQL
  intuition. Reverting to an ORM now would lose that discipline without providing commensurate
  developer experience gains. SQL-NO-ORM is accepted as explicit, named debt with clear revisit
  conditions — not as a permanent ideological position.
revisit_when: team > 8 developers and sqlc verbosity is blocking > 3 feature completions per
  quarter, OR a new ORM ships that is fully raw-SQL-first with no shadow database or query
  builder abstraction layer
