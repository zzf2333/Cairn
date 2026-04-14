type: experiment
domain: api-layer
decision_date: 2023-09
recorded_date: 2025-01
summary: 经过两周试验后拒绝 tRPC；现有 REST 消费方的迁移成本过高
rejected: tRPC——基于 React Query 构建的类型安全 RPC 层。两周 Spike 揭示，迁移现有
  REST 消费方（移动端 App、3 个 Webhook 集成、2 个合作伙伴 API 客户端）需要多客户端
  协调同步上线。tRPC 全量切换的路由模型不提供渐进式接入路径。GraphQL 也作为备选方案
  被考虑，但未正式评估——当前数据复杂度和团队规模不足以支撑引入成本。
reason: 现有 REST API 面有 6 个以上的消费方客户端。对于 2 人团队而言，承担多客户端
  同步迁移的协调成本不可行。tRPC 的类型安全收益不足以抵消迁移风险和时间成本。
revisit_when: 新建无现有 REST 消费方的绿地服务，或 tRPC 正式发布支持与现有接口渐进
  共存的一等 REST 兼容层
