# v0.0.15 计划：协议一致性 / 信任修复

## 目标

让 v0.0.12 之后的核心承诺在代码、文档、MCP README、CLI 提示和测试里保持一致：CLI 保持小表面，AI 直接维护 `.cairn/`，`cairn doctor` 只做健康检查，不再引导旧的 staging/reflect/analyze/audit 工作流。

## 版本判断

- 不恢复 `stage/analyze/reflect/audit` 等已移除命令。
- 不推进旧路线图里的 staged workflow 或 Trust Policy。
- 优先修正公开叙事、CLI 提示、MCP 文档与真实工具清单之间的契约一致性。

## 待办

- [x] 更新 `mcp/README.md` 与 `mcp/README.zh.md`：工具表、推荐工作流、架构树同步到真实 6 个工具，移除 `cairn_propose` / `cairn_sync_domain` / `.cairn/staged/` 工作流。
- [x] 清理用户可见 CLI/doctor 文案：把 `run: cairn sync`、`cairn stage review`、`cairn log --quick`、`cairn install-skill` 等旧建议改成当前 `cairn init --refresh-skills`、直接编辑 `.cairn/` 或运行 `cairn doctor` 的表述。
- [x] 收敛规范与采用指南：`spec/adoption-guide*`、`spec/FORMAT*`、`docs/design.md` 不再把旧命令作为当前用法推荐；必要时保留为历史说明。
- [x] 重写 `docs/roadmap.md` 的当前版本方向：标明 v0.0.12 后路线从 CLI ceremony 收缩为 AI-direct protocol，并加入 v0.0.15。
- [x] 增加反回归测试：公开文档和 MCP README 不再暴露已删除命令/旧 MCP 工具作为当前用法。
- [x] 更新 `CHANGELOG.md`，记录 v0.0.15 的一致性修复。
- [x] 跑验证：Shell 测试、MCP Vitest。

## 待同步文档清单

- `mcp/README.md` / `mcp/README.zh.md`：必须同步工具表、工作流、架构树。
- `spec/adoption-guide.md` / `.zh.md`：必须移除旧 CLI 当前用法叙事，改为 AI 直接维护 `.cairn/`。
- `spec/FORMAT.md` / `.zh.md`：必须移除 staged/audit 作为当前格式组成部分的描述，或降级为历史迁移说明。
- `docs/design.md` / `docs/roadmap.md`：必须同步 v0.0.12 后的新产品方向。
- `cli/lang/en.sh` / `cli/lang/zh.sh`：若用户可见提示变化，同步双语文案。
- `CHANGELOG.md`：新增 `0.0.15` 条目。
- `README.md` / `README.zh.md`：若发现旧叙事残留则同步；否则无需改。

## 验收标准

- MCP README 的工具清单与 `mcp/src/server.ts` 注册工具一致。
- 用户可见提示不再引导运行已移除命令。
- 公开文档不再把旧 workflow 当作当前推荐路径。
- 测试覆盖新增或修正的契约。

## 回顾：v0.0.15 协议一致性修复

- 做了什么：同步 MCP README、中文采用指南、格式规范、设计文档、示例说明和集成图到 v0.0.12+ 的 AI-direct file protocol；修复 doctor 与 MCP domain 工具中的旧命令建议；新增文档反回归测试。
- 关键决策：不恢复 staging/reflect/analyze/audit 工作流，只把它们保留为历史迁移背景；当前用户路径保持 `init` 初始化、AI 直接写 `.cairn/`、`doctor` 自检。
- 下一步：提交 v0.0.15。

## 回顾：v0.0.14 自检链路收敛

- 做了什么：确定并完成 v0.0.14 的自检链路收敛方向，修复 Claude Code 全局路径到 `~/CLAUDE.md`，并保持 CLI 小表面。
- 关键决策：不恢复 v0.0.11 之前的旧命令，把 `doctor` 和 `.cairn/SKILL.md` 作为核心可靠性边界。
- 下一步：进入 v0.0.15，集中清理文档和提示中的旧协议残留。

## 回顾

- 做了什么：为下一版本确定一个小而硬的版本目标，聚焦 v0.0.12 后的自检契约。
- 关键决策：暂不做新功能扩张，先修 CLI/MCP/文档的一致性，避免路线图继续和实际产品分叉。
- 下一步：等用户确认后进入实现，按待办逐项修改并同步文档。

## 回顾：Claude Code 全局路径修复

- 做了什么：将 `cairn init --global` 的 Claude Code 全局写入目标从 `~/.claude/CLAUDE.md` 改为 `~/CLAUDE.md`，并同步帮助文案与采用指南。
- 关键决策：只调整全局路径，项目级 Claude Code 引导块仍写入 `.claude/CLAUDE.md`。
- 下一步：继续按 v0.0.14 计划收敛 doctor JSON 与 MCP 自检契约。
