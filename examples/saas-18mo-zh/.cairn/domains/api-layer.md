---
domain: api-layer
hooks: ["api", "endpoint", "tRPC", "GraphQL", "REST", "OpenAPI", "接口", "数据获取"]
updated: 2024-03
status: stable
---

# api-layer

## current design

REST + OpenAPI。不使用 GraphQL，不使用 tRPC。所有接口遵循 /v1/ 前缀，
但版本控制策略尚未正式确定。错误格式存在部分不一致——新接口必须使用
{ code, message, data } 结构。限流尚未实现。

## trajectory

2023-01 Express 裸路由，无请求校验
2023-05 引入 Zod 请求校验
2023-09 试验 tRPC 两周 → 回滚，现有 REST 客户端迁移成本过高
2024-03 接入 OpenAPI 文档生成，当前状态

## rejected paths

- **tRPC**：2023-09 进行了为期两周的试验；迁移 6 个以上现有 REST 消费方（移动端 App、
  Webhook 集成、合作伙伴 API 客户端）需要多客户端协调同步上线，
  tRPC 全量切换的路由模型不支持渐进式接入。
  重新评估时机：不存在现有 REST 消费方，或 tRPC 正式支持 REST 兼容层
- **GraphQL**：未正式评估；当前团队规模和数据复杂度不足以支撑引入成本。
  重新评估时机：前端频繁需要跨资源聚合查询

## known pitfalls

- 限流尚未实现：实现时不要破坏现有客户端的重试逻辑——客户端使用带硬编码阈值的指数退避策略
- 文件上传：认证方式尚未定义，不要直接复用现有 JWT 流程
- 错误格式不一致：旧接口返回 { error: string }，新接口使用 { code, message, data }
  ——迁移时需同时兼容两种格式
- WebSocket 并发：多标签页连接会触达 Railway 的连接数上限；不要构建依赖 WS 强一致性的功能
  （见 WS-CONCURRENCY 技术债）

## open questions

- v2 版本控制策略未定：URL 版本号（/v2/）vs. Header 版本控制
- 文件上传接口的认证设计尚未启动
