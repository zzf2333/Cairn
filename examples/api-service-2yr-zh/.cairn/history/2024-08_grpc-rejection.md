type: experiment
domain: api-gateway
decision_date: 2024-08
recorded_date: 2024-08
summary: 性能评估后拒绝将 gRPC 用于内部服务通信；HTTP/JSON 已满足当前需求
rejected: gRPC——性能基准测试显示内部 P99 延迟从 180ms 降至 153ms，约 15% 提升，
  未达到启动迁移的 30% 阈值。引入 protobuf 工具链需要持续维护（代码生成、Schema
  版本管理、团队培训）。gRPC 调试需要专用工具（grpcurl、grpc-gateway），日常排查
  成本增加。Datadog APM 需要额外配置才能支持 gRPC 追踪，偏离现有可观测性设置。
reason: 15% 的延迟改善不足以证明引入新工具链、调试复杂度和可观测性集成成本的合理性。
  当前 HTTP/JSON 接口满足内部服务 SLA，团队无需掌握额外的 protobuf 相关知识栈。
  工具链维护成本对 3 人团队而言是持续负担。
revisit_when: 内部 P99 持续超过 200ms 且有专职平台工程师可负责 gRPC 工具链维护
