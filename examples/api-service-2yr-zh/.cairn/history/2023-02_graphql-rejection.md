type: experiment
domain: api-gateway
decision_date: 2023-02
recorded_date: 2023-02
summary: 经过 3 周评估后拒绝 GraphQL；当前客户端数量下 REST + OpenAPI 已足够
rejected: GraphQL——3 周 Spike 暴露出以下问题：未引入 DataLoader 时存在 N+1 查询风险；
  跨 3 个服务边界进行 Schema Stitching 的复杂度超出预期；4 个现有 REST 客户端不愿意
  同步迁移，协调成本高。GraphQL 联邦方案也被考虑，但运维复杂度对 3 人团队而言不可接受。
reason: 3 人团队维护两套 API 接口层不可持续。现有 4 个 REST 客户端同步迁移的协调风险
  过高，而当前数据查询模式尚未复杂到必须引入 GraphQL 的程度。REST + OpenAPI 在
  客户端数量较少时提供足够的类型契约。
revisit_when: 客户端数量超过 10 个且存在差异化的数据形态需求，或有专职 GraphQL 平台
  工程师可用
