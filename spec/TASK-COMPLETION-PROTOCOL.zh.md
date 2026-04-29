English | [中文](TASK-COMPLETION-PROTOCOL.zh.md)

# Cairn 任务完成协议

> 状态：任务完成行为的权威参考文档（v0.0.13+）。
> 与 [spec/FORMAT.md](FORMAT.zh.md)（三层文件结构）以及各项目安装的
> `.cairn/SKILL.md`（协议副本）配合使用。

## 目的

本文档定义了在 Cairn 语境下"任务完成"的含义、需要哪些 reflection（反思）、
以及 AI 在每个非简单任务结束时必须输出的确切格式。

`spec/FORMAT.md` 规定 `.cairn/` 文件的静态结构。本文档规定动态行为——任务结束时 AI 做什么。

---

## 什么算"任务完成"

以下情形需要 reflection：

- 实现功能、重构模块，或修复具有架构影响的 bug
- 评估、选择或拒绝某项技术或设计方案
- 完成迁移或阶段过渡
- 做出一个会约束未来 AI 建议的决策

以下情形**不需要** reflection：

- 纯粹的问答或探索性对话（无文件改动）
- 只读分析（"解释这段代码"、"X 是什么作用"）
- 机械性简单改动（错别字、仅格式化、注释修改）
- 明确要在下个 session 继续的未完成工作（在最后一个 session 结束时 reflect）

---

## 何时需要 reflection

每次任务完成（如上定义）都需要输出一个 `Cairn reflection` block。

reflection 只服务于一个目的：让写回行为可见。它把"我已经更新了 Cairn"（一个散文式声明）
转换成一份结构化、可审计的记录，清楚记录向哪一层写了什么。

**Reflection 是写出来的，不是想出来的。** 如果你只在文字里描述了做了什么，reflection 就没有发生。

---

## Reflection 结果枚举

每个 `Cairn reflection` block 必须包含以下三个结果值之一：

| 结果 | 含义 |
|------|------|
| `no-op` | 本次任务对 Cairn 三层记忆没有产生可记录的事件。未向 `.cairn/` 写入任何内容。 |
| `memory-updated` | 本次任务向 history、domains 或 `output.md` 中 ≥1 层产生了写回。 |
| `audit-required` | 本次任务涉及迁移、替换或收口风险，需要后续 residue 检查。 |

**`no-op`** 是合法且常见的结果。常规 bug 修复、文档任务、格式化改动都会产生 no-op。
即便如此，block 仍然是必须的——它的价值在于证明判断步骤已经执行过了。

**`audit-required`** 表示本次任务引入了可能尚未完全解决的义务：尚未清理的废弃代码、
尚未全量更新的迁移引用、或有潜在残留的已删除功能。它不代表工作做得不对——
它代表还有更多需要检查的地方。

---

## 必须输出的任务收尾格式

每次任务完成都必须以这个 block 结束。无例外。

有写回时（`memory-updated` 或 `audit-required`）：

```
Task completion summary
- Completed work: <一行描述>
- Changed files / domains: <逗号分隔，或 ->
- Risk level: <low | medium | high>

Cairn reflection
- Result: <memory-updated | audit-required>
- Impacted domains: <域 key 列表，或 ->
- History recorded: <文件名，或 ->
- Output updated: <yes | no>
- Domains updated: <域 key 列表，或 ->
- Audit required: <yes | no>
- Next action: <一行说明，或 none>

cairn: recorded <N> event(s): <逗号分隔的文件名>
```

无写回时（`no-op`）：

```
Task completion summary
- Completed work: <一行描述>
- Changed files / domains: -
- Risk level: low

Cairn reflection
- Result: no-op
- Impacted domains: -
- History recorded: -
- Output updated: no
- Domains updated: -
- Audit required: no
- Next action: none

cairn: no event recorded
```

**字段说明：**

- `Result` 与 verification line 必须一致：`memory-updated` 或 `audit-required` 对应
  `cairn: recorded …`；`no-op` 对应 `cairn: no event recorded`。
- `Audit required: yes` 意味着 `Result: audit-required`。
- 空字段的正确占位符是 `-`，不是空白或"N/A"。
- verification line（`cairn: recorded …` 或 `cairn: no event recorded`）是机器可读的锚点——
  保持其格式不变。

---

## Verification line 契约

block 的最后一行必须是以下两者之一：

    cairn: recorded <N> event(s): <逗号分隔的文件名>
    cairn: no event recorded

这个格式是 Cairn verification handshake 的一部分：

- 用户通过它确认协议已执行。
- `git diff .cairn/` 显示实际写入了什么。
- `cairn doctor --json` 通过 `write_back` 字段发现写回缺失的情况。

不要改变这行的格式，不要用散文替代它。

---

## 核心记忆闭环质量

v0.1.1 将写回闭环本身纳入健康契约。一次有效的任务完成写回，必须保持 Cairn
三层之间的可追溯性：

| 层级边 | 要求 |
|--------|------|
| History → domain | 如果新的 history 事件改变了当前设计、rejected paths、known pitfalls 或 open questions，必须在同一任务中更新对应 domain 文件。 |
| Domain → history | 每个 `domains/*.md` 的 `## rejected paths` 条目都必须能追溯到同域 history 条目。 |
| Output → history | 每个 `output.md` 的 `## no-go` 条目必须有 history 支撑；每个 `## debt` 条目必须有 `type: debt` 的 history 条目支撑。 |
| History 字段质量 | 每个 history 条目都必须包含非空 `rejected:` 字段，即使是 `decision` 条目也一样。 |

`rejected:` 是 history 条目中杠杆最高的字段：它记录未来 AI 最可能重新建议、
但项目已经排除过的路径。

---

## 协议违规（机器可检测）

`cairn doctor --json` 在 `write_back` 字段中暴露以下写回缺失信号。
这些是警告信号，不是硬性失败——`cairn doctor` 仅因 `write_back` 信号不会以 1 退出，
也不会阻断 CI。

| 信号 | 触发条件 |
|------|---------|
| `missing-write-back` | 最近 14 天内有大量代码改动（≥100 净行），但 `.cairn/history/` 在同一窗口内无新增条目 |
| `missing-output-follow-up` | 依赖文件（`package.json`、`go.mod`、`requirements.txt`、`pyproject.toml`、`Cargo.toml`）近期有变动，但 `.cairn/output.md` 未更新 |
| `missing-audit-flag` | 近期提交 subject 含迁移关键词（`migrate`、`rename`、`replace`、`deprecate`、`remove`、`delete`），但同一窗口内无 `type: transition` 的 history 条目 |

`write_back.status` 字段的值为 `ok`、`warn` 或 `skipped`（项目无 `.git/` 目录时为 `skipped`）。
具体信号见 `write_back.signals`。

`cairn doctor --json` 还会在 `memory_loop` 字段中暴露核心记忆闭环的可追溯性：

| 信号 | 触发条件 |
|------|----------|
| `history-missing-rejected` | 某个 history 条目没有非空 `rejected:` 字段 |
| `domain-rejected-path-unsupported` | 某个 domain 的 `## rejected paths` 条目没有同域 history 支撑 |
| `output-debt-unsupported` | 某个 `output.md` `## debt` 条目没有 `type: debt` history 支撑 |

`memory_loop.status` 字段的值为 `ok` 或 `warn`。记忆闭环警告会增加普通 `issues`
计数，因为它意味着压缩后的记忆不可完全信任。

---

## 与其他规范的关系

- **[spec/FORMAT.md](FORMAT.zh.md)** — `history/*.md`、`domains/*.md` 和 `output.md` 文件格式的权威参考。字段名、必需章节和命名约定请参阅此文档。
- **[spec/adoption-guide.md](adoption-guide.zh.md)** — 用散文和示例描述 `## After-Task Write-Back` 流程。本文档是规范性定义；adoption-guide 是操作指引。
- **`.cairn/SKILL.md`** — 由 `cairn init` 安装到每个项目的协议副本。它包含完整的 `## ON TASK COMPLETION — DECIDE AND WRITE` 章节，以及分步 AI 判断流程。本文档中定义的格式嵌入在该章节的 Step 3 中。
- **`cairn doctor --json`** — 机器可检测的执行层。其 `write_back` 字段反映上述三个可检测信号。
