English | [中文](vs-adr.zh.md)

# Cairn vs. ADR

## 简而言之

ADR 是为人类阅读而写的。Cairn 是为 AI 使用而写的。它们捕获不同的内容，服务于不同的受众，并且应该同时存在于同一个项目中。

---

## ADR 做什么

架构决策记录（ADR），由 Michael Nygard 于 2011 年推广，为团队提供了一种轻量级格式，用于随时间记录重要的技术决策。典型的 ADR 包含三个部分：

- **Context（上下文）** — 迫使做出决策的情况
- **Decision（决策）** — 选择了什么
- **Consequences（后果）** — 结果有什么变化，包括权衡取舍

ADR 对人类很有效。加入团队的新工程师可以阅读 ADR 日志，了解为什么代码库是现在这个样子——为什么团队选择了 PostgreSQL 而不是 MongoDB，为什么 Redux 被放弃，为什么 API 层在第二年被重新设计。这种格式对散文友好，按时间顺序排列，设计为由能够对不完整信息做出判断的人阅读。

ADR 被广泛采用。`adr-tools`、Backstage 和 Notion 等工具都支持这种格式。许多团队已经有了 ADR 目录。

---

## ADR 对 AI 的局限性

使 ADR 对人类有用的同样属性，使它们不太适合作为 AI 约束输入。

**1. 没有 Token 预算意识的自由散文格式。**
ADR 以段落形式编写——上下文、理由、权衡取舍、替代方案、未来考虑。接收一组 ADR 的 AI 没有关于哪些句子是承重约束与背景叙述的信号。一个 600 字的 ADR 可能包含一句应该改变 AI 行为的句子，埋藏在三段历史背景中。AI 没有办法区分它们。

**2. 没有注入时机的概念。**
ADR 放在一个目录中，要么全部读取，要么全部忽略。没有机制说"始终读取这个"、"仅在规划 API 工作时读取这个"或"只有在用户询问认证历史时才获取这个"。在会话开始时读取 30 个 ADR 的 AI 将大部分上下文预算消耗在可能与当前任务无关的历史记录上。Cairn 的三层注入——始终开启（`output.md`）、按域按需（`domains/*.md`）和精确查询（`history/`）——是 ADR 没有建模的概念。

**3. 没有明确的 no-go 执行机制。**
ADR 可能记录 tRPC 被试用并放弃。但 ADR 格式中没有任何内容向 AI 发出信号："不要再提出 tRPC 了。"AI 可能读取了 ADR，理解了历史，但在未来的对话中仍然将 tRPC 作为建议提出——因为格式中没有任何内容将其标记为禁区方向。Cairn 在 `output.md` 中的 `## no-go` 章节是一个直接的行为指令：AI 不得建议这些方向。

**4. 没有域范围的上下文分离。**
拥有 20 个 ADR 的团队在同一目录中按时间顺序混合了关于认证、API 设计、状态管理、部署和测试的决策。当 AI 规划 API 变更时，它没有有效的方法只提取与 API 相关的历史记录。Cairn 的 `domains/*.md` 层按域预先压缩决策历史，使 AI 能够在不读取完整档案的情况下获得恰好相关的上下文。

**5. `rejected` 字段在结构上缺失。**
ADR 有"考虑的替代方案"章节，但它是可选的、自由格式的，很少以 AI 使用的足够具体性编写。被拒路径——被评估并排除的方向——是防止 AI 重新提出已放弃选项的最重要输入。Cairn 将 `rejected` 视为每条历史记录中最关键的字段：即使是 `decision` 条目也必须记录被评估但未选择的内容。

---

## Cairn 为 AI 增加了什么

Cairn 不替代 ADR。它在团队已有的任何文档之上（或旁边）添加了一个结构化的、面向 AI 的约束层。

**自动信号捕获（v2）。**
v2 Cairn 从两个来源自动捕获项目信号：Git 耳朵（revert、依赖变更、大规模重构）和对话耳朵（AI 通过 `cairn_signal()` 报告用户拒绝、决策、约束）。ADR 需要人类作者编写每条记录。Cairn 的双耳设计意味着约束相关事件在发生时即被捕获，无需手动文档步骤。

**信任路由的记忆与人工审核。**
捕获的信号通过 Trust Router 分配信任等级（L0–L3）。低置信度信号在候选池中积累。高影响信号进入待审队列，在成为正式记忆前需要人工批准。只有具有强证据的信号（如 local scope 的 git revert）才会自动写入。这确保了记忆质量，同时不要求人类编写每条记录。

**Token 预算感知的约束视图。**
Cairn 从记忆自动生成 `views/output.md`，Token 预算目标 500，硬限制 800。格式使用 `key: value` 键值对和简短列表，而不是散文。每行必须能改变 AI 行为——如果删去一行不会改变回复，Views Engine 不会包含它。

**机器可读的 `behavior_effect` 字段。**
每条记忆条目声明其 `behavior_effect` ——AI 行为应如何改变。支持四种类型：

- `avoid_suggestion`：AI 不得建议此方向
- `prefer_approach`：AI 应优先采用此方案
- `warn_before`：AI 在触及此区域前应发出警告
- `require_review`：此区域的变更需要人工审批

这是直接的行为指令，而非叙事上下文。ADR 用散文描述后果；Cairn 将它们编码为机器可读的约束。

**域范围的上下文分离。**
每个域（`api-layer`、`auth`、`state-management` 等）都有自己的压缩视图文件。当 AI 调用 `cairn_context({ task: "API 设计" })` 时，它只收到与 API 相关的约束——而不是认证历史，也不是部署历史。

---

## 同时使用两者

ADR 和 Cairn 不是竞争系统。同一技术事件在每个系统中产生不同的产物：

| | ADR | Cairn 记忆条目 |
|--|-----|--------------|
| 受众 | 人类工程师 | AI 约束系统 |
| 格式 | 散文段落 | 结构化 YAML 字段 |
| 目的 | 制度记忆 | 行为输入 |
| 创建方式 | 人类编写 | 从信号捕获，经信任路由 |
| 注入 | 人类按需阅读 | 由 `cairn_context()` MCP 工具返回 |
| 约束 | 无——仅供参考 | `behavior_effect`、`revisit`、`relations` |

### 示例：选择 PostgreSQL

**ADR 版本**（`docs/decisions/0012-database-choice.md`）：

> **Status:** Accepted
>
> **Context:** We needed a primary data store for the application. The team evaluated
> several options in early 2023 as user data complexity grew. We had prior experience
> with MongoDB from a previous project but wanted to evaluate relational options given
> our data's increasingly structured nature.
>
> **Decision:** We will use PostgreSQL as our primary database.
>
> **Consequences:** We gain strong consistency guarantees, ACID transactions, and
> mature tooling (Prisma, pgAdmin). We lose the schema flexibility of document
> databases. The team will need to manage migrations. MongoDB was the primary
> alternative; DynamoDB was briefly considered but ruled out due to vendor lock-in
> concerns and the team's lack of AWS familiarity at the time.

这是面向人类读者的正确格式：叙事性强、有上下文、完整解释了推理过程、无需任何工具即可阅读。

**Cairn v2 版本**（`.cairn/memory/mem_2023_03_database_postgresql.yaml`）：

```yaml
id: mem_2023_03_database_postgresql
type: decision
domain: database
scope: local
status: active
confidence:
  level: high
source:
  kind: conversation
  refs:
    - type: session
      id: sess_2023_03_15
  captured_at: "2023-03-15T00:00:00Z"
subject:
  name: PostgreSQL
summary: Chose PostgreSQL as primary database; relational model fits structured data
rejected:
  what: MongoDB, DynamoDB
  reason: >
    MongoDB — document model ill-fitted to relational data requirements.
    DynamoDB — vendor lock-in risk, team had no AWS ops familiarity.
chosen:
  what: PostgreSQL
  reason: >
    Data is highly relational. ACID guarantees required for financial records.
    Prisma ORM reduces migration friction for a team of 2.
behavior_effect:
  type: prefer_approach
  instruction: Use PostgreSQL for new data storage needs
revisit:
  when:
    - Data model becomes document-heavy
    - Multi-region latency demands a globally distributed store
  status: not_met
```

Views Engine 自动生成 `views/output.md`（stack 章节含 `db: PostgreSQL`）和 `views/domains/database.md`（含被拒路径）。

ADR 讲述了故事。Cairn 记忆条目执行了约束。两者都是正确的，各自服务于其目的。两者互不替代。
