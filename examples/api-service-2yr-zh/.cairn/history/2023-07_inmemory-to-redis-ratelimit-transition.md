type: decision
domain: rate-limiting
decision_date: 2023-07
recorded_date: 2023-07
summary: 在经历部署重置事故后，将限流从进程内内存迁移至 Redis 令牌桶实现
rejected: 继续使用进程内内存——部署时状态被清空，导致限流窗口重置；Fargate 上粘性会话
  不可靠，无法保证同一客户端请求路由到同一实例。Postgres 共享表方案也被评估，但会
  给数据库增加高频写入负载，且延迟不满足限流场景要求（P99 目标 < 1ms）。
reason: Redis 基于 TTL 的 Key 提供跨 ECS 实例的持久化快速状态，P99 延迟 < 1ms，
  满足限流性能要求。Redis 已在技术栈中用于缓存，无需引入新的基础设施依赖。部署和
  实例扩缩容不再影响限流状态，彻底消除了此前的重置事故根因。
revisit_when: Redis 连接成为瓶颈，或迁移至边缘计算架构时需要在 CDN 层实现限流
