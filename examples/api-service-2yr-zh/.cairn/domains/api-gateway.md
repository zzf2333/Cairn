---
domain: api-gateway
hooks: ["api", "endpoint", "REST", "OpenAPI", "route", "handler", "middleware", "接口", "路由", "中间件"]
updated: 2024-12
status: stable
---

# api-gateway

## current design

Express + OpenAPI 规范优先：路由由 OpenAPI schema 生成并在入口校验。所有公开路由经过共享中间件链（auth-check → rate-limit → request-log → body-validation）。服务内部调用绕过限流但不绕过鉴权。spec 文件是生成客户端 SDK 的唯一来源。

## trajectory

2022-12 评估 Fastify，选择 Express — 团队熟悉度更高，中间件生态更丰富
2023-02 GraphQL 经 3 周 spike 后否决 — 见 rejected paths
2023-05 API 网关从单体中提取为独立 Node.js 服务
2023-05 评估 Kong 作为网关层 → 否决，自定义 Express 中间件已足够
2024-08 评估 gRPC 用于内部流量 → 否决
2024-12 采用 OpenAPI 规范优先，路由现由 schema 生成 → 当前状态

## rejected paths

- GraphQL：评估 3 周，目标为为合作方集成提供类型安全的客户端契约。查询灵活性在未加 DataLoader 层时引发 N+1 风险，跨 3 个服务边界的 schema 拼接增加了共享 schema 注册表依赖，且现有 4 个 REST 客户端（移动端、2 个合作方集成、内部仪表板）均不愿意同时迁移。作为第二 API 并行维护也被否决——在团队规模 3 人的情况下维护两套 API 不可持续。
  Re-evaluate when: 客户端数量 > 10 且数据形状需求分歧明显，或有专属 GraphQL 平台团队
- Kong（API 网关）：评估作为托管代理层以卸载鉴权、限流和路由。我们的路由逻辑过于业务化（注入租户鉴权上下文、租户级覆盖）无法委托给配置驱动的代理。自定义 Express 中间件提供完全控制权。
  Re-evaluate when: 专属平台运维人员 > 2 人，且跨服务路由规则超过 50 条
- gRPC（内部流量）：扩展至 6 个服务模块后评估以降低内部 P99 延迟。负载测试显示 gRPC 单向调用相比 HTTP/JSON 延迟改善约 15%（180ms → 153ms），低于我们设定的 30% 迁移合理性阈值。此外，Go 和 Node.js protobuf 工具链需要保持同步，每次 schema 变更需跨所有消费服务协调部署。
  Re-evaluate when: 内部 P99 延迟持续 > 200ms，且有专属平台工程师负责 protobuf schema 治理

## known pitfalls

- 禁止在中间件中添加业务逻辑——中间件仅用于横切关注点（鉴权、限流、日志）。审查者应拒绝任何在中间件文件中放入域逻辑的 PR。
- 禁止绕过 body-validation 中间件，即使是"内部"端点——所有接触用户数据的端点必须经过校验链。
- RATE-GLOBAL-ONLY（已接受技术债）：限流当前为全局路由级别，非用户级别。禁止以"快速改进"为由实现按用户分桶——这是已接受的技术债，有明确的重新评估条件（付费用户 > 50 或峰值 RPS > 500）。

## open questions

- OpenAPI spec 是否现在就要加版本前缀（v1/v2），还是等到第一次破坏性变更时再加？
- 3 个旧版移动端仍在使用的 legacy v0 端点的下线策略
