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
