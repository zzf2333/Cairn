type: rejection
domain: api-gateway
decision_date: 2023-02
recorded_date: 2023-02
summary: Rejected GraphQL after 3-week evaluation; REST + OpenAPI sufficient for current client count
rejected: GraphQL — evaluated as the API layer for a new partner integration requiring flexible data
  shapes. Three-week spike with graphql-yoga revealed: (1) N+1 query risk on 4 of 7 evaluated
  resolver patterns required a DataLoader layer that tripled implementation time; (2) schema
  stitching across 3 service boundaries added a shared schema registry dependency; (3) all 4
  existing REST clients (mobile app, 2 partner integrations, internal dashboard) were unwilling
  to migrate simultaneously. GraphQL-as-second-API alongside REST was also considered and rejected
  — maintaining two API surfaces with different auth and validation patterns is unsustainable at
  team size 3.
reason: REST + OpenAPI already covers all contract needs. The one partner requesting flexible data
  shapes was satisfied by adding 2 filtered query parameters to the existing REST endpoint. The
  full GraphQL migration would have required 3–4 weeks of client-side work per consumer with no
  immediate business value. At team size 3, the operational overhead is unjustifiable.
revisit_when: client count > 10 with divergent data-shape requirements, or a dedicated GraphQL
  platform team is available (not just one backend engineer owning the schema)
