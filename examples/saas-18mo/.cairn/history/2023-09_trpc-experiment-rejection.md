type: experiment
domain: api-layer
decision_date: 2023-09
recorded_date: 2025-01
summary: Rejected tRPC after a 2-week trial; migration cost for existing REST consumers too high
rejected: tRPC — type-safe RPC layer built on top of React Query. Two-week spike revealed that
  migrating existing REST consumers (mobile app, 3 webhook integrations, 2 partner API clients)
  required a coordinated, multi-client flag day release. tRPC's all-or-nothing router model
  offered no incremental adoption path. GraphQL was also considered as an alternative but not
  formally evaluated — current data complexity and team size don't justify it.
reason: Six or more clients consumed the existing REST API surface. Absorbing the coordination
  cost of a simultaneous multi-client migration was not viable for a team of 2. The type-safety
  benefit of tRPC did not outweigh the migration risk and timeline.
revisit_when: New greenfield service with no existing REST consumers, or tRPC ships a first-class
  REST compatibility layer that allows incremental adoption alongside existing endpoints
