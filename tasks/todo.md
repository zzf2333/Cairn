# v0.1.0 计划：Verifiable Onboarding

## 目标

让 Cairn 的首次接入路径从“文档说可以”变成“测试证明可以”：外部用户能初始化 `.cairn/`、安装 guide block、通过 `doctor` 自检，并且公开英文文档与真实 CLI/MCP surface 保持一致。

## 版本判断

- 这是 v0.1.0，不是 v0.0.16：v0.0.12–v0.0.15 已完成协议收敛，下一步要证明陌生用户路径可用。
- 不扩大 CLI 命令面；继续保持 `init / doctor / version / help`。
- 不恢复旧 `stage/analyze/reflect/audit` 工作流。
- 对外主文档和发布说明使用英文；中文只同步 `.zh.md` 镜像或内部任务记录。

## 待办

- [x] 新增首次接入 E2E：临时 git 项目中跑 `cairn init`，断言 `.cairn/output.md`、`.cairn/SKILL.md`、guide block 生成，并且 `cairn doctor` 通过。
- [x] 扩展公开英文文档契约测试：覆盖 `README.md`、`mcp/README.md`、`spec/adoption-guide.md`、`examples/README.md`，禁止旧命令和旧 MCP 工具作为当前用法出现。
- [x] 增强 `cairn doctor --json` schema 测试：覆盖 clean、stale domain、missing guide、v0.0.11 residue、write-back warn。
- [x] 更新版本号到 `0.1.0`：CLI、MCP package、MCP server、doctor JSON。
- [x] 更新 `CHANGELOG.md`，记录 v0.1.0。
- [x] 跑验证：Shell 测试、MCP Vitest。

## 待同步文档清单

- `CHANGELOG.md`：新增 `0.1.0` 条目，使用英文。
- `docs/roadmap.md`：把 v0.1.0 当前方向补为可验证 onboarding。
- `README.md` / `mcp/README.md` / `spec/adoption-guide.md` / `examples/README.md`：本次若测试暴露契约缺口则同步；否则无需改。
- `README.zh.md` / `mcp/README.zh.md` / `spec/*.zh.md`：本次不主动改，除非英文主文档语义变化需要镜像。

## 验收标准

- 新 onboarding E2E 稳定通过，能证明 fresh project 的 `init → doctor` 路径可用。
- `doctor --json` 每个核心状态都有稳定字段可断言。
- 公开英文主文档不再把旧 CLI/MCP 工作流当作当前路径。
- 全量 Shell 测试和 MCP Vitest 通过。

## 回顾：v0.1.0 Verifiable Onboarding

- 做了什么：新增 fresh-project onboarding E2E，扩展英文公开文档契约测试，强化 `doctor --json` schema 与关键状态断言，并同步版本号到 `0.1.0`。
- 关键决策：把 v0.1.0 定义为“可验证接入路径”，不扩大 CLI 命令面，不恢复旧 workflow。
- 下一步：提交 v0.1.0 后准备发布验证。

---

# v0.1.1 计划：Core Memory Loop

## 目标

把 Cairn 的核心从“能初始化并自检”推进到“能验证任务结束后的记忆写回质量”：AI 完成任务后，应该能判断是否要写回，并把事件沉淀到正确层级；`doctor` 能发现记忆闭环断裂，而不是只检查文件是否存在。

## 版本判断

- 这是 v0.1.1，不是 v0.2.0：仍处在 Human-reviewed 阶段，重点是强化写回判断与质量门，不引入更高自治能力。
- 不扩大 CLI 命令面；继续保持 `init / doctor / version / help`。
- 不做 release hardening、发布脚本、tag/publish 周边事项。
- 对外主文档和发布说明使用英文；中文只同步 `.zh.md` 镜像或内部任务记录。

## 待办

- [x] 强化 `.cairn/SKILL.md` 任务结束写回规则：明确 history / domain / output 三层何时必须同步，以及可追溯性要求。
- [x] 扩展 `spec/TASK-COMPLETION-PROTOCOL.md`：把 “Core Memory Loop” 的质量判定写成规范。
- [x] 增强 `cairn doctor`：新增 memory loop 检查，发现 history 缺少 `rejected`、domain rejected paths 无 history 支撑、output debt 无 debt history 支撑。
- [x] 扩展 `doctor --json` schema：暴露 `memory_loop.status` 与 `memory_loop.signals[]`，便于 AI 自检。
- [x] 新增/扩展 Shell 测试覆盖核心闭环断裂场景。
- [x] 更新版本号到 `0.1.1`：CLI、MCP package、MCP server、doctor JSON。
- [x] 更新 `CHANGELOG.md` 与 `docs/roadmap.md`。
- [x] 跑验证：Shell 测试、MCP Vitest。

## 待同步文档清单

- `skills/claude-code/SKILL.md`：同步核心写回决策规则。
- `spec/TASK-COMPLETION-PROTOCOL.md`：同步 memory loop 规范与 doctor 信号。
- `docs/roadmap.md`：新增 v0.1.1 Core Memory Loop 当前方向。
- `CHANGELOG.md`：新增 `0.1.1` 条目，使用英文。
- `README.md` / `mcp/README.md` / `spec/adoption-guide.md` / `examples/README.md`：本次若测试暴露公开契约缺口则同步；否则无需改。
- `README.zh.md` / `mcp/README.zh.md` / `spec/*.zh.md`：本次不主动改，除非英文主文档语义变化需要镜像。

## 验收标准

- `doctor` 能抓到三类核心写回质量问题：缺失 `rejected`、domain rejected paths 无来源、output debt 无 debt history。
- `doctor --json` 对 memory loop 状态机器可读。
- `.cairn/SKILL.md` 与任务完成协议明确三层同步判断。
- 全量 Shell 测试和 MCP Vitest 通过。

## 回顾：v0.1.1 Core Memory Loop

- 做了什么：新增 `doctor` memory loop 检查与 JSON schema，强化任务完成协议，并让示例 domain 的 rejected paths 回到有 history 支撑的约束集合。
- 关键决策：不扩大 CLI 命令面，把核心能力放在既有 `doctor` 的质量门里；组合 rejected path 支持按 `/` 拆分匹配，避免把 `Redux / Redux Toolkit` 这类自然写法误判为无来源。
- 下一步：继续推进 v0.1.x 的 AI 写回质量，重点观察真实任务中 `memory_loop.signals[]` 是否足够准确。
