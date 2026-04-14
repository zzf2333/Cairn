---
domain: rate-limiting
hooks: ["rate", "limit", "throttle", "quota", "abuse", "Redis", "bucket", "限流", "配额", "滥用"]
updated: 2024-03
status: active
---

# rate-limiting

## current design

Token bucket 算法通过 Express 中间件实现，由 Redis 提供状态存储。每条路由单一全局桶（非用户级）。限制：认证用户 60 次/分钟，未认证用户 10 次/分钟。Redis 基于 TTL 的 key 过期；无持久化限流日志。配置位于 rate-limit.config.ts；无需部署无法在运行时覆盖。

## trajectory

2022-12 无限流 — 单一受信任客户端
2023-03 首次滥用事件：合作方爬虫在 2 分钟内访问 /export 端点 4,000 次 → 添加基础内存级限流
2023-07 迁移至 Redis 支持的 token bucket — 内存状态在每次部署时丢失
2023-10 评估 AWS API Gateway 托管限流 → 否决
2024-03 新增路由级配置，收紧未认证限制至 10 次/分钟 → 当前状态

## rejected paths

- AWS API Gateway 托管限流：评估以将限流卸载至基础设施。需要所有流量经 API Gateway 路由（当前直接 ALB → ECS），在我们的请求量（约 300 万次/天）下费用约 900 美元/月，相比 Redis 的约 30 美元/月。此外还会失去每请求上下文（鉴权状态、租户信息），而这些对未来按用户分桶是必需的。
  Re-evaluate when: 出于其他原因（如多区域路由）迁移至完整 API Gateway 时，使得每请求成本边际化
- 按用户分桶：比全局路由限制更精细。实现需要在 Redis key 中加入用户 ID，并按层级配置独立的桶参数。作为 RATE-GLOBAL-ONLY 技术债推迟——当前滥用模式来自未认证爬虫，而非认证用户。
  Re-evaluate when: 付费用户 > 50 或峰值 RPS > 500（已记录在 output.md 技术债中）

## known pitfalls

- RATE-GLOBAL-ONLY（已接受技术债）：付费用户每分钟 60 次合法请求与免费层级滥用用户共享同一路由桶。禁止在没有完整按用户实现方案的情况下尝试分离桶——部分修复会造成公平性问题。
- 禁止为解决单个客户投诉而提升全局限流阈值——提升是策略决策，需要审批。请提交工单。
- Redis key 格式为 `rl:<route-slug>:<client-ip>`。禁止在不迁移的情况下更改 key 格式——飞行中的 key 在部署时将重置所有当前计数器。

## open questions

- 未认证限流按 IP 还是按用户 ID — IP 限制会误伤共享办公室的合法用户
- 滑动窗口 vs 固定窗口——当前固定窗口在窗口边缘存在突发问题
