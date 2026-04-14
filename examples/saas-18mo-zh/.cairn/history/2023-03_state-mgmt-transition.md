type: transition
domain: state-management
decision_date: 2023-03
recorded_date: 2025-01
summary: 将客户端状态管理从 React Context 迁移至 Zustand，原因是完整子树重渲染导致的性能问题
rejected: 尝试用 useMemo 优化 React Context——首先尝试了此方案，但随着状态规模扩大，
  该方案被证明脆弱且难以维护。Redux Toolkit 也经过评估后被拒绝：对 2 人团队、当前状态
  复杂度而言，Reducer、Action、Selector、中间件配置等样板代码开销不成比例。
reason: React Context 在任何状态变更时触发完整子树重渲染。性能分析显示仪表盘页面有
  40% 以上的无效渲染。Zustand 提供了极简 API、无需 Provider 包裹，并开箱即用支持
  基于 Selector 的订阅——以零样板代码实现了同等能力。
revisit_when: 状态复杂度超出 Zustand 扁平模型的承载范围（例如需要跨切片事务、
  复杂中间件，或在生产环境中进行时间旅行调试）
