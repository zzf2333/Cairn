# Release Readiness — 1.0 发布就绪清单

> 这份清单不是"应该写的文档列表"，而是 **1.0 发布的硬性准入指标**。
>
> 1.0 意味着 SemVer 生效：`.cairn/` schema、MCP 工具签名、CLI 命令一旦标 1.0，破坏性变更必须走 major bump。在此之前的所有"现在能跑"都不构成 1.0 准入。

---

## 当前状态快照

| 维度 | 评分 | 说明 |
|------|------|------|
| 单测覆盖 | ✅ | 247/247 通过，行覆盖阈值 80% |
| 架构落地 | ✅ | 13 schema / 11 store / 14 engine / 14 tool 全部 wired，无 dormant 代码 |
| MCP 协议 | ✅ | stdio 真实启动通过 |
| Claude Code 适配 | ✅ | 25/25 反向回归通过 |
| Codex 适配 | 🟡 | 21/25（86%），4 个稳定平台差异已记录但未给 workaround |
| 文档同步 | ✅ | README / mcp/README / 架构文档 / 设计哲学 / 7 个 adapter / SKILL 全部对齐代码 |
| Dogfood | ❌ | Cairn 没有用 Cairn 跑过自己的开发 |
| 长周期数据验证 | ❌ | DNA / decay / resurrection 阈值是设计值，不是测量值 |
| 稳定性承诺 | ❌ | 没有 `docs/STABILITY.md` 划定 stable / experimental 边界 |
| 错误恢复 | ❌ | 损坏 / 并发 / 中断三类场景没有文档化路径 |
| 性能基准 | 🟡 | scale 测试到 1k blood events，但没 p50/p99 数字 |
| 迁移路径 | ❌ | 0.x → 1.0 schema 变更没有 migration script |

整体评级：**0.3.0（功能 RC），距 1.0 还差 dogfood + 稳定性承诺 + 错误恢复**。

---

## 1.0 准入硬指标（必须全部 ✅）

### A. 稳定性承诺

- [ ] **`docs/STABILITY.md`** 划定边界：
    - Stable：MCP 工具名 + 参数签名、`.cairn/` 顶层目录、`config.yaml` 字段
    - Experimental（可能变更）：DNA trait 字段、resurrection 阈值常量、governance policy 格式
    - Internal（不承诺）：views 输出格式、session record 结构
- [ ] **`docs/MIGRATION.md`** 给出 0.x → 1.0 升级步骤，包括 schema diff 与自动迁移脚本
- [ ] `cairn_init_status` 输出新增 `cairn_version` 字段，老版本 `.cairn/` 启动时给出明确升级提示

### B. Dogfood

- [ ] 在本仓库自身启用 `.cairn/`，连续运行 **≥ 30 天**
- [ ] 至少 **20 条真实 blood event**（不是测试合成）
- [ ] 至少 **1 个 DNA trait 候选** 通过人工裁决（emerged 或 rejected 都算，需要走完流程）
- [ ] 期间发现的 bug / 阈值问题写入 `tests/scenarios/_findings.md`，并对应回归测试

### C. 错误恢复路径

- [ ] **损坏自愈**：`cairn_doctor` 能识别并修复以下损坏：
    - 单个 yaml 文件 parse 失败（隔离后继续）
    - blood 引用了不存在的 skeleton 节点
    - staged/ 中的 draft_event 缺字段
- [ ] **并发写入**：两个 AI 会话同时调用 `cairn_signal` 不丢失数据（文件锁 or 原子 write+rename）
- [ ] **session_end 中途崩溃**：下次启动时 `cairn_init_status` 检测出未完成 session，给出恢复建议
- [ ] **`docs/RECOVERY.md`** 列出所有受支持的恢复场景与命令

### D. Codex 4 个稳定 fail 给 workaround

| 场景 | 现状 | 1.0 准入要求 |
|------|------|--------------|
| **A7 stage maintenance** 弱于 hard_constraint | 已记录 | 在 `skills/codex.md` 补充"maintenance phase 视为 reflective challenge 强度"的显式指令 |
| **B3 multi-turn user_rejection** resume 丢上下文 | 已记录 | 修 `platform-codex-cli.ts` 或在文档明示用户单轮使用 |
| **C3 staged review** 空 cwd 时 Codex 走 no_op | 已记录 | `cairn_context` 在空目录场景下输出更强提示，引导处理 staged 队列 |
| **D3 empty init flow** 同 C3 | 已记录 | 同 C3 修复，或在 SKILL 里给出空目录场景的标准应答模板 |

通过标准：至少 3/4 修复，剩余 1 个明确标记为"Codex 平台限制"并在 README 警告。

### E. 性能基准

- [ ] `cairn_context` 在以下规模下记录 p50 / p99：
    - 100 blood events
    - 1,000 blood events
    - 10,000 blood events
- [ ] 任一规模下 p99 **≤ 2s**（典型 AI 工具调用容忍上限）
- [ ] `cairn_session_end` 全流水线在 1k 规模下 **≤ 5s**
- [ ] 基准写入 `docs/PERFORMANCE.md`，与每个 release 对比

### F. 外部 alpha 验证

- [ ] 至少 **3 个外部用户**完成完整使用循环（init → 30 天使用 → 至少 1 次 session_end）
- [ ] 收到 **至少 5 条**外部反馈并记录在 `tests/scenarios/_findings.md`
- [ ] 所有阻塞性 issue 关闭

---

## 1.0 强烈建议（不阻塞，但显著降低后续风险）

### G. 可观测性

- [ ] 结构化日志：MCP 工具调用的入参 / 出参 / 耗时落到 `.cairn/logs/`（默认开启，可关）
- [ ] `cairn doctor --metrics` 输出当前 .cairn 健康度指标（blood 数量、DNA traits、staged backlog、上次 session_end 距今）

### H. 用户文档

- [ ] README 增加 **trauma / reevaluation_mode** 两个机制的用户视角解释
- [ ] `docs/TROUBLESHOOTING.md` — 常见症状 → 诊断步骤
- [ ] `docs/EXAMPLES.md` — 三个典型项目（小型 / 中型 / 维护期）的真实 `.cairn/` 样本

### I. CLI 完整性

- [ ] `cairn` 子命令全部跑过端到端：`init / status / doctor / review / audit / dna / skeleton / blood / stage`
- [ ] 任一子命令崩溃不破坏 `.cairn/` 状态
- [ ] 标准输出 / 错误输出分离，exit code 规范化

---

## 阶段路径

| 阶段 | 目标 | 准入 | 预计周期 |
|------|------|------|----------|
| **0.4.0** | Stability + 错误恢复文档化 | A + C 完成 | 1-2 周 |
| **0.5.0 RC** | Codex 4 fail workaround + 性能基准 | D + E 完成 | 1 周 |
| **0.9.0 alpha** | 外部 alpha 用户开始使用 | F 启动 | 即时 |
| **1.0.0** | Dogfood 30 天 + alpha 反馈消化 | B + F 完成 | 1-2 月 |

---

## 不进入 1.0 的范围（明确划线）

以下功能即便完成也不阻塞 1.0，留给 1.x：

- 多语言文档（中文外）
- Web UI / 可视化 dashboard
- 多 AI 协作冲突解决的更强机制（当前文件锁足够）
- DNA trait 的更多种类（当前只有 `simplicity_bias` / `infra_aggressiveness`）
- 跨项目共享 DNA / blood
- 实时双向同步（当前是文件 + git）

---

## 自检问题

发布 1.0 前必须能回答 yes：

1. 一个新用户在 Codex 上跟着 README 跑 30 分钟，能不能产生 ≥ 1 条 blood 且不出错？
2. 我自己用 Cairn 写 Cairn，1 个月后 `.cairn/` 里的内容能不能让我说"是的，这就是我的设计史"？
3. 如果 `.cairn/blood/` 有一个文件被手动改坏，Cairn 还能跑起来吗？
4. 0.3.0 用户升级到 1.0.0，他的 `.cairn/` 数据会被吃掉还是平稳迁移？
5. 我能不能在 1.0 之后承诺至少 6 个月不破坏 MCP 工具签名？

任何一个回答是 no → 不发 1.0。
