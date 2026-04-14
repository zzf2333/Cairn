type: transition
domain: api-gateway
decision_date: 2023-05
recorded_date: 2023-05
summary: Transitioned from evaluating Kong to custom Express middleware; API gateway layer stays in-process
rejected: Kong (self-hosted) — evaluated as a managed API gateway layer to offload auth, rate
  limiting, and routing from the application. Kong's declarative config could not express our
  per-tenant auth-context injection (injecting tenant-specific claims into request context
  required business logic). Kong's plugin ecosystem also meant vendor-specific Lua scripting for
  any custom behavior. Evaluated Kong Enterprise for 2 weeks; infrastructure cost (~$600/month)
  and operational overhead (a Postgres-backed Kong cluster) were unjustifiable at team size 3.
  AWS API Gateway was also briefly considered but rejected for the same reason as Kong: business
  logic would leak into configuration.
reason: Extracting the API gateway as a standalone Express service with a shared middleware chain
  (auth-check → rate-limit → request-log → body-validation) gives full control over auth context
  injection. The middleware code is testable TypeScript, not Lua plugins or YAML config. At current
  team size, in-process middleware is simpler to deploy, debug, and extend.
revisit_when: team dedicated to platform operations (> 2 platform-ops) and cross-service routing
  rules exceed 50 entries, making a config-driven gateway more maintainable than code
