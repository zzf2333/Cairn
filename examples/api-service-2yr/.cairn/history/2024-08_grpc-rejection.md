type: rejection
domain: api-gateway
decision_date: 2024-08
recorded_date: 2024-08
summary: Rejected gRPC for internal service traffic after performance evaluation; HTTP/JSON sufficient
rejected: gRPC (internal traffic) — evaluated after expanding to 6 microservice-style modules to
  reduce internal P99 latency on synchronous calls between api-gateway and auth-service. Load
  test showed gRPC unary calls over HTTP/2 offered ~15% P99 latency improvement (180ms → 153ms)
  vs current HTTP/JSON. This improvement was below the 30% threshold we set for justifying a
  protocol migration. Additionally: (1) Go and Node.js protobuf toolchains must be kept in sync
  — any schema change requires coordinated deploy across all consuming services; (2) debugging
  gRPC traffic requires specialized tooling (grpcurl, Wireshark) vs plain curl for HTTP/JSON;
  (3) Datadog APM traces gRPC only with additional instrumentation config, adding observability
  maintenance overhead.
reason: At current scale (internal P99: ~180ms, well under 200ms SLO), the operational cost of
  gRPC toolchain maintenance is not justified by a 15% latency gain. HTTP/JSON internal calls are
  observable, debuggable, and testable with standard tools. The team should not introduce protocol
  complexity until a clear SLO violation requires it.
revisit_when: internal P99 latency > 200ms sustained AND a dedicated platform engineer is
  available to own protobuf schema governance and toolchain maintenance
