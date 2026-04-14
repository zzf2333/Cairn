type: decision
domain: api-gateway
decision_date: 2023-05
recorded_date: 2023-05
summary: 从评估 Kong 转向自定义 Express 中间件；API 网关层保持进程内实现
rejected: Kong 自托管——按租户注入认证上下文需要业务逻辑，不适合在网关层处理；3 人团队
  规模下自托管月费约 $600，成本不合理。AWS API Gateway 存在同样问题：无法在网关层
  注入租户业务上下文，仍需在应用层处理，形成双层冗余。
reason: 进程内 Express 中间件是可测试的 TypeScript，部署、调试和扩展均更简单。认证上下文
  注入与业务逻辑紧密耦合，放在应用层处理比外置网关更直接。避免引入额外的基础设施运维
  负担，与团队当前规模和能力相匹配。
revisit_when: 服务数量超过 5 个且需要统一的跨服务限流、认证策略，或团队规模增长到有专职
  平台工程师负责网关运维
