---
domain: state-management
hooks: ["state", "store", "状态", "全局状态", "Zustand", "Redux", "context", "MobX", "Jotai"]
updated: 2024-03
status: stable
---

# state-management

## current design

Zustand 管理所有客户端状态。无服务端状态库（未使用 React Query，未使用 SWR）。
API 调用封装在自定义 Hook 中，写入 Zustand Store。全局 Store 拆分为 3 个切片：
auth、ui、data。全面使用基于 Selector 的订阅模式。

## trajectory

2022-12 React useState + Context，单文件全局状态
2023-03 迁移至 Zustand——Context 在任何状态变更时触发完整子树重渲染
2023-08 评估 Redux Toolkit → 拒绝，2 人团队的样板代码开销不成比例
2024-02 评估 React Query 处理服务端状态 → 搁置，未拒绝
2024-03 引入切片模式（auth / ui / data），当前状态

## rejected paths

- **Redux / Redux Toolkit**：2023-08 评估；对 2 人团队而言，当前状态复杂度下样板代码
  和中间件开销不成比例。
  重新评估时机：团队 > 5 人且状态复杂度需要中间件或 DevTools 支持

## known pitfalls

- **Store 切片边界**：auth 切片被 data 切片读取以获取 Token。
  保持该数据流严格单向（auth → data）。不要创建反向依赖，即 data 切片的
  Action 触发 auth 切片更新
- **SSR 水合**：Zustand Store 在服务端渲染期间存在 Stale Closure 边界情况。
  始终使用 useStore(selector) 模式，不要在 React 组件生命周期外访问 Store 状态

## open questions

- 是否为服务端状态引入 React Query（2024-02 已搁置，未拒绝）
- 若新增离线支持，需要确定持久化策略
