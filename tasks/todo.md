# v0.0.14 计划：自检链路收敛

## 目标

让 v0.0.12 之后的核心承诺更可靠：CLI 保持小表面，AI 直接维护 `.cairn/`，`cairn doctor --json` 提供稳定、可机器读取的自检结果。

## 版本判断

- 不恢复 `stage/analyze/reflect/audit` 等已移除命令。
- 不推进旧路线图里的 staged workflow 或 Trust Policy。
- 优先修正协议、CLI、MCP、文档之间的契约一致性。

## 待办

- [ ] 收敛 `cairn doctor --json` 结构：无 `.cairn/`、正常项目、异常项目都返回同一顶层 schema。
- [ ] 补齐 write-back signals 的机器可测字段：`status/reason/signals` 在 MCP fallback 与 CLI JSON 中保持一致。
- [ ] 增强 `cairn_doctor` MCP 测试：覆盖无 `.cairn/`、有 issue、write_back warn/skipped 三类结果。
- [ ] 清理 v0.0.12 后遗留文案：删除用户可见输出中 `stage/analyze/reflect/audit/sync/log/status` 的旧建议，或改成当前直接写文件协议。
- [x] 修复 Claude Code 全局引导块写入路径：写入 `~/CLAUDE.md`，不要写入 `~/.claude/CLAUDE.md`。
- [ ] 更新版本号到 `0.0.14`：CLI、MCP package、MCP server、CHANGELOG。
- [ ] 跑验证：Shell 测试、MCP Vitest、必要的 JSON 解析 smoke。

## 待同步文档清单

- `CHANGELOG.md`：新增 `0.0.14` 条目，说明自检 schema 与遗留文案修正。
- `README.md` / `README.zh.md`：如 doctor JSON 字段或用户提示发生变化，同步 Daily Usage 与 MCP 工具说明。
- `mcp/README.md` / `mcp/README.zh.md`：如 `cairn_doctor` 返回结构说明变化，同步工具表。
- `spec/TASK-COMPLETION-PROTOCOL.md` / `.zh.md`：只有 write-back signal 语义变化时才更新；若只是实现对齐，不改。
- `spec/adoption-guide.md` / `.zh.md`：同步 Claude Code 全局配置路径为 `~/CLAUDE.md`。
- `docs/roadmap.md`：补一段 v0.0.14，标记旧 v0.0.6/v0.1.0 路线需要按 v0.0.12 后的新方向重写。

## 验收标准

- `cairn doctor --json` 输出始终可被 `JSON.parse` 解析。
- MCP `cairn_doctor` 返回的缺省对象与 CLI JSON 顶层字段一致。
- 用户可见提示不再引导运行已移除命令。
- 测试覆盖新增或修正的契约。

## 回顾

- 做了什么：为下一版本确定一个小而硬的版本目标，聚焦 v0.0.12 后的自检契约。
- 关键决策：暂不做新功能扩张，先修 CLI/MCP/文档的一致性，避免路线图继续和实际产品分叉。
- 下一步：等用户确认后进入实现，按待办逐项修改并同步文档。

## 回顾：Claude Code 全局路径修复

- 做了什么：将 `cairn init --global` 的 Claude Code 全局写入目标从 `~/.claude/CLAUDE.md` 改为 `~/CLAUDE.md`，并同步帮助文案与采用指南。
- 关键决策：只调整全局路径，项目级 Claude Code 引导块仍写入 `.claude/CLAUDE.md`。
- 下一步：继续按 v0.0.14 计划收敛 doctor JSON 与 MCP 自检契约。
