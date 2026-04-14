type: decision
domain: api-gateway
decision_date: 2024-01
recorded_date: 2024-01
summary: 异步任务队列选择 AWS SQS 而非 Kafka；当前吞吐量需求不足以支撑消息代理的运维成本
rejected: Kafka（MSK）——每日 8,000 个任务量下月费约 $400，而 SQS 月费约 $0.40，
  成本差距达 500 倍；MSK 集群运维（Broker 管理、分区规划、消费者组协调）对小团队
  负担过重。RabbitMQ 也被评估，AMQP 协议复杂度和自托管运维开销使其不适合当前规模；
  与 AWS 生态集成不如 SQS 原生。
reason: 500 倍的成本差距在当前规模下无法忽视。SQS FIFO 队列满足消息顺序性要求，
  DLQ 提供失败任务的可见性和重试能力。SQS 作为 AWS 托管服务无需运维，与现有
  ECS + Fargate 基础设施天然集成，IAM 权限模型统一管理。
revisit_when: 日任务量超过 100 万且需要流式处理语义，或需要消息回放能力，或延迟
  要求降至毫秒级别时
