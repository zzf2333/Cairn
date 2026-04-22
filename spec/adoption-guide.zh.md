English | [中文](adoption-guide.zh.md)

# Cairn 采用指南

本指南涵盖采用 Cairn 的两个阶段：

- **Phase 1 — Init（初始化）：** 一次性历史盘点。目标：30 分钟内建立可工作的初始状态。
- **Phase 2 — Reactive（响应式）：** 长期运营。核心原则：不主动维护；让 AI 的错误告诉你该记录什么。

---

## Phase 1：Init — 一次性历史盘点

### 目标

在 30 分钟或更短时间内建立一个可工作的 `.cairn/` 目录。目标是一个今天就能改变 AI 行为的约束系统——而不是项目曾经做出的每个决策的完整档案。

**原则：不完整没关系，错误不行。**

如果你还没有识别出任何禁区方向，空的 `## no-go` 章节是正确的。用猜测填充的 `## no-go` 章节比没有更糟——AI 会将这些条目视为真实约束。只记录你知道是真实的内容。

---

### 第 1 步：选择你的域

初始化时可用的 11 个标准域：

| 键 | 领域 |
|----|------|
| `state-management` | 前端状态管理 |
| `api-layer` | API 设计与通信 |
| `database` | 数据存储 |
| `auth` | 认证与授权 |
| `frontend-framework` | 前端框架 |
| `testing` | 测试策略 |
| `deployment` | 部署与基础设施 |
| `monitoring` | 监控与告警 |
| `architecture` | 整体架构模式 |
| `performance` | 性能优化 |
| `security` | 安全策略 |

**选择 3–7 个适用于你项目的域。** 你也可以以 `kebab-case` 格式添加自定义域（例如 `payments`、`data-pipeline`、`ml-inference`）。

一旦选定，域列表就被锁定。AI 在编写历史条目时不得自行创造新的域键——它必须使用你在初始化时选择的键。

**选择指导：**

对于早期阶段项目（独立开发者、产品市场契合前），从以下开始：
`api-layer`、`database`、`auth`、`deployment`

对于全栈产品团队（2–5 名工程师，成熟代码库），考虑：
`api-layer`、`database`、`auth`、`state-management`、`frontend-framework`、`deployment`、`testing`

拿不定主意时，选少一些。你随时可以在下一次 `cairn init` 运行前扩展列表。未使用的域会给 `## hooks` 章节增加噪音。

---

### 第 2 步：填写 `output.md`

按顺序创建包含五个必需章节的 `.cairn/output.md`。根据今天你所知道的内容填写每个章节。

**`## stage`** — 描述当前项目阶段以及 AI 应如何排列优先级：

```
## stage

phase: early-growth (2024-09+)
mode: stability > speed > elegance
team: 2, no-ops
reject-if: migration > 1 week
```

`mode:` 字段直接影响 AI 的权衡决策。诚实反映项目的现状。MVP 冲刺期间的"speed > stability"是有效的约束。

**`## no-go`** — 列出 AI 不得建议的技术方向（禁区方向）：

```
## no-go

- tRPC (REST integration cost, see domains/api-layer.md)
- Redux (boilerplate overhead at team-2)
```

如果你还没有确定任何明确的排除方向，将此章节留空。不要用你仅仅持怀疑态度的事情来填充它——只有在你有具体原因认为某个方向被排除在外时才添加条目。

**`## hooks`** — 触发域文件注入的关键词映射。这个章节可以根据你选择的域自动生成：

```
## hooks

planning / designing / suggesting for:

- api / endpoint / REST / GraphQL → read domains/api-layer.md first
- auth / login / JWT / session → read domains/auth.md first
- db / migration / ORM / schema → read domains/database.md first
- deploy / infra / CI → read domains/deployment.md first
```

每个域一行。添加 AI 在讨论该领域时会使用的任何项目特定关键词。

**`## stack`** — 你的活跃技术选择：

```
## stack

api: REST
db: PostgreSQL
auth: JWT + Refresh Token
deploy: Railway
```

每层一个 `key: value` 键值对。只列出今天真实在用的技术。

**`## debt`** — AI 不得尝试修复的正式接受的技术债：

```
## debt

AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now
```

格式：`<ID>: accepted | <revisit_when condition> | <constraint>`。

如果你还没有正式接受的技术债，将此章节留空。这个区别很重要：这个章节不是用于"可以更好的事情"——它是用于你已经有意识决定暂时承担的缺陷。

---

### 第 3 步：初始化 `history/`

创建 `.cairn/history/` 目录。

```
mkdir -p .cairn/history/
```

**可选地，为最重要的历史决策回填 1–3 条记录。** 重点关注那些如果 AI 重新提出被丢弃的替代方案会造成最大损害的决策——通常是：团队试用并放弃的技术、被明确排除的方向，或具有非显而易见约束的重大架构选择。

你不需要重建完整的历史。在不确定的地方留下空白。缺失的条目不会造成伤害。错误的条目（错误的拒绝原因、错误的日期、虚构的上下文）会破坏 AI 的约束模型。

对于回填的条目，双时间戳很重要：将 `decision_date` 设置为决策实际发生的时间，将 `recorded_date` 设置为今天。AI 使用 `decision_date` 来评估时效性。

---

### 第 4 步：初始化 `domains/`

创建 `.cairn/domains/` 目录。

```
mkdir -p .cairn/domains/
```

**将其留空。这是正确的。**

域文件是积累历史的压缩摘要。没有历史，就没有什么可以压缩。在初始化时手动编写域文件——在任何历史记录存在之前——会产生看起来权威但实际上反映作者记忆而非实际记录的猜测。等到每个域有 2–3 条历史记录后，再从这些记录生成域文件（见 Phase 2）。

---

### 第 5 步：安装 Skill 适配文件

为你的团队使用的 AI 工具复制 Cairn Skill 文件：

| 工具 | 要安装的文件 | 位置 |
|------|------------|------|
| Claude Code | `skills/claude-code/SKILL.md` | `.claude/CLAUDE.md`（追加） |
| Cursor | `skills/cursor.mdc` | `.cursor/rules/cairn.mdc` |
| Windsurf | `skills/windsurf.md` | 追加到 `.windsurfrules` |
| Cline / Roo Code | `skills/cline.md` | 追加到 `.clinerules` |
| GitHub Copilot | `skills/copilot-instructions.md` | 追加到 `.github/copilot-instructions.md` |

Skill 文件教会 AI 三层协议：始终读取 `output.md`，规划时读取 `domains/*.md`，精确查找时查询 `history/`。没有 Skill 文件，AI 不知道 `.cairn/` 目录的存在。

---

## Phase 2：响应式 — 长期运营

### 核心原则

不要主动维护 Cairn。不要安排审查，不要定期审计域文件，不要试图使历史记录详尽无遗。让 AI 的错误告诉你该记录什么。

系统响应真实摩擦而增长。每次 AI 提出你已经排除的方向，这就是一个信号：记录拒绝。每次你做出 AI 应该知道的决策，记录它。随着时间推移，历史记录自然围绕着真正重要的 AI 对齐决策积累起来。

---

### 五个触发事件

#### 事件 A：AI 建议了你已经拒绝的方向

AI 刚刚提出了一件事——一种技术、一个架构模式、一种方法——你已经评估过并决定反对。

1. 以 `rejection` 类型在 `history/` 中记录拒绝：
   ```
   type: rejection
   domain: <domain>
   decision_date: <when you originally made the call>
   recorded_date: <today>
   summary: <one sentence>
   rejected: <the direction> — <why it was ruled out>
   reason: <what made you certain>
   revisit_when: <what would need to change>
   ```
2. 考虑将该方向添加到 `output.md` 的 `## no-go` 章节，特别是如果 AI 可能再次提出它。如果该方向是你技术领域中常见的 AI 推荐，就添加它。
3. 如果域文件已存在，更新对应 `domains/*.md` 的 `## rejected paths` 章节。

这个事件是最常见的触发器。AI 频繁重新提出被拒绝的方向，因为没有记录，它就无法知道某个方向已经被尝试过。每条拒绝记录直接防止下次会话出现同样的错误。

---

#### 事件 B：你做出了重要的技术决策

你的团队选择了新技术、改变了架构方法，或者做出了将影响未来工作的重大权衡。

1. 请 AI 根据你的描述起草历史记录：
   > "We just decided to use Zod for request validation instead of Joi. Draft a Cairn
   > history entry for this."
   审查草稿，纠正任何错误，并以 `decision` 或 `transition` 类型写入 `history/`。
2. 如果决策改变了你的活跃技术栈，更新 `output.md` 的 `## stack` 章节。
3. 如果域文件存在，更新对应 `domains/*.md` 的发展轨迹和被拒路径。

这条记录中的 `rejected` 字段至关重要：记录被考虑但未被选择的内容。即使决策感觉显而易见，也要记录替代方案。否则，AI 不知道为什么替代方案被跳过。

---

#### 事件 C：你尝试了一个方向但放弃了

你运行了一个探针、构建了一个原型，或者开始走一条路——然后停下来了。该方向没有成功。

1. 以 `experiment` 类型在 `history/` 中记录结论：
   ```
   type: experiment
   domain: <domain>
   decision_date: <when you started/stopped>
   recorded_date: <today>
   summary: <what was tried and what happened>
   rejected: <the direction> — <why it was abandoned>
   reason: <the specific failure mode or incompatibility discovered>
   revisit_when: <what would need to be different>
   ```
2. 如果域文件存在，更新域文件的 `## rejected paths` 章节。

**重点记录你为什么放弃它。** 这是记录中最有价值的部分。AI 可以从 `experiment` 类型推断某件事被尝试过。它无法推断的是特定的失败模式——这个方向对这个项目来说错误的原因。因多客户端迁移复杂性而失败的 tRPC 实验与因 TypeScript 版本不兼容而失败的实验是不同的信号。两者都建议避免 tRPC，但原因不同，`revisit_when` 条件也不同。

被放弃的实验通常是最有价值的历史条目。那些不起作用的路径正是 AI 需要避免重走的。

---

#### 事件 D：你接受了一个已知缺陷

你在代码库中识别出一个问题——设计缺陷、扩展限制、架构耦合——并决定暂时保留它。

1. 以 `debt-accepted` 类型在 `history/` 中记录接受：
   ```
   type: debt
   domain: <domain>
   decision_date: <today>
   recorded_date: <today>
   summary: Accepted <ID> as known debt; will revisit when <condition>
   rejected: Immediate fix — cost/risk not justified at current scale
   reason: <why this is tolerable now>
   revisit_when: <the specific condition that changes the calculus>
   ```
2. 将条目添加到 `output.md` 的 `## debt` 章节：
   ```
   <ID>: accepted | <revisit_when condition> | no refactor now
   ```
3. 在域文件中添加对应的 `## known pitfalls` 条目，描述工程师（人类或 AI）在技术债存在期间应避免触发的条件。

`revisit_when` 条件对已接受的技术债是必需的。没有它，技术债会默认成为永久的。让条件具体且可衡量："team > 4" 或 "MAU > 100k" 或 "CDN migration complete"——而不是"当我们有时间的时候"。

---

#### 事件 E：项目进入了新阶段

项目优先级发生了变化。你从 MVP 转到增长期，从增长期转到稳定期，或者从稳定期转到新的产品面。`output.md` 中的 `mode:` 和 `reject-if:` 条件不再反映现实。

1. 用新阶段和推理模式更新 `output.md` 的 `## stage` 章节。
2. 写一条 `transition` 类型的历史记录，标记上一阶段的结束：
   ```
   type: transition
   domain: architecture
   decision_date: <today>
   recorded_date: <today>
   summary: Project transitioned from <old phase> to <new phase>
   rejected: Continuing prior mode — <why the old priorities no longer apply>
   reason: <what changed: team size, user scale, product maturity>
   revisit_when: n/a — transition is a point-in-time event
   ```

阶段过渡是高价值的历史条目。AI 的 `mode:` 约束影响它做出的每一个权衡决策。以 `mode: speed > stability` 运行的 AI 会给出不同于以 `mode: stability > speed > elegance` 运行的 AI 的建议。保持阶段章节最新是 Cairn 中最高价值的维护任务之一。

---

### 正向反馈循环

响应式运营创造了复利回报。随着历史记录积累：

- 域文件成为每个领域真实约束的更精确表示
- AI 的建议与项目现实更紧密对齐
- AI 提出更少需要被拒绝或纠正的建议
- 更少的错误意味着需要更少的新历史记录
- 随着系统成熟，维护成本下降

系统不需要持续努力来改进。它随着使用而自动改进。每次纠正生成一条记录；每条记录减少未来的纠正。拥有 18 个月 Cairn 历史的项目通常每周生成不到一条新历史记录——不是因为团队停止记录，而是因为 AI 停止犯需要纠正的错误。

---

## 何时生成域文件

域文件是 Cairn 的中间层——为 AI 提供规划工作所需的适当细节量，而无需读取原始历史记录。它们应该经过深思熟虑地生成，而不是提前生成。

**不要在初始化时编写域文件。** 空的 `domains/` 目录是正确的初始状态。基于记忆而非已记录历史手工编写的域文件是一个风险：它看起来权威，但反映的是作者的回忆而不是实际记录。

**等到某个域有 2–3 条历史记录后再生成。** 此时，该域已经有足够的记录上下文可以压缩。请 AI 从原始历史记录生成域文件：

> "Read these three history entries for the `api-layer` domain and generate a
> `domains/api-layer.md` file following the Cairn domain format."

审查生成的文件。纠正任何误解。确认并写入 `domains/api-layer.md`。

**之后，使用覆盖式更新。** 域文件不是追加日志——它们代表域的当前状态。当新历史记录改变了域的约束时，从所有相关历史记录重新生成域文件。旧文件被替换，而不是编辑。原始事件保留在 `history/`；域文件是可重新推导的摘要。

这种模式保持域文件准确，而无需逐行手动编辑。AI 做压缩；人类做确认。

---

## 使用 CLI（Phase 2）

Cairn CLI 自动化最常见的工作流程步骤。所有命令需要当前项目中存在一个 `.cairn/` 目录（由 `cairn init` 创建）。

### `cairn init`

运行交互式初始化向导。创建 `.cairn/output.md`、`.cairn/history/`、`.cairn/domains/`，并为你的 AI 工具安装 Skill 适配文件。等同于直接运行 `scripts/cairn-init.sh`。

```bash
cairn init
```

### `cairn status`

打印当前项目状态的三层摘要。通过对比每个域的 `updated:` 前置元数据字段与其历史记录的 `recorded_date` 来检测需更新的域文件。

```bash
cairn status

# 输出：
# stage:   early-growth (2024-09+)
# domains: 3 active, 1 not created
#
# ⚠  api-layer   last updated 2024-03 · 2 new history entries since
#                run: cairn sync api-layer
# ✓  auth        up to date (2024-06)
```

在工作会话开始时使用 `cairn status` 检查是否有任何域文件需要更新，然后再请求 AI 提供规划帮助。

### `cairn log`

记录历史条目。支持交互式模式（引导式提示）和标志模式（用于脚本或命令行快速输入）。

```bash
# 交互式模式
cairn log

# 标志模式
cairn log \
    --type rejection \
    --domain api-layer \
    --summary "Rejected GraphQL after evaluation" \
    --rejected "GraphQL: data complexity doesn't justify it" \
    --reason "Current team size makes GraphQL overhead unwarranted" \
    --revisit-when "Frontend needs regular cross-resource aggregation"
```

在五个响应式触发事件（A–E）的任何一个之后使用 `cairn log`。在标志模式下，必须提供所有必需字段：`--type`、`--domain`、`--summary`、`--rejected`、`--reason`。`--revisit-when` 字段是可选的。

创建条目后，运行 `cairn status` 检查域文件是否需要同步。

### `cairn sync`

生成包含当前域文件和所有相关历史记录的 AI 提示词。将提示词粘贴到你的 AI 工具中以生成更新后的域文件。

```bash
# 为特定域生成提示词（打印到 stdout）
cairn sync api-layer

# 为所有需更新的域生成提示词
cairn sync --stale

# 预览将包含的内容（不输出提示词）
cairn sync api-layer --dry-run

# 直接将提示词复制到剪贴板
cairn sync api-layer --copy
```

生成的提示词指示 AI 按照 Cairn 格式覆盖域文件，并包含历史记录中的所有被拒路径。AI 生成新文件后，将其保存到 `.cairn/domains/<domain>.md` 并运行 `cairn status` 确认域已是最新状态。

**Phase 3 说明：** 如果你使用 Cairn MCP Server（`mcp/`），请使用 `cairn_sync_domain("api-layer")` 代替——它直接将相同的提示词上下文返回给 AI，无需复制粘贴步骤。

---

## Phase 3: 任务后写回

完成有意义的功能、重构或迁移后，Cairn 需要反思发生了什么变更。
没有写回步骤，Cairn 会变得过期，下次 AI 会话读取的是过时的记忆。

**核心规则：任务未完成直到 `cairn reflect` 运行。**

### `cairn reflect`

分析近期提交并生成四种类型的暂存候选更新。始终输出显式反思结果。

```bash
# 反思最近 3 次提交
cairn reflect --since HEAD~3

# 反思自特定提交起的变更
cairn reflect --from-commit <sha>

# 反思显式提交范围
cairn reflect --from-range abc123..def456

# 反思当前已暂存/未暂存的变更
cairn reflect --from-diff

# 预览候选条目，不写入（dry-run）
cairn reflect --dry-run
```

#### 反思结果

每次 `cairn reflect` 运行都会输出三种明确结果之一：

| 结果 | 含义 | 下一步 |
|------|------|--------|
| `no-op` | 未检测到信号；Cairn 无需更新 | 无需操作；记录已写入 |
| `candidates-created` | 已写入暂存候选 | 运行 `cairn stage review` |
| `audit-required` | 检测到迁移模式 | 运行 `cairn stage review` 后再运行 `cairn audit start` |

`no-op` 对于小改动是预期且有效的结果。反思记录仍会写入 `.cairn/reflections/`，供 `cairn doctor` 验证反思已执行。

若结果为 `candidates-created` 或 `audit-required`，审查生成的候选条目：

```bash
cairn stage review
```

`cairn stage review` 根据文件名前缀路由每个候选：
- `history-candidate_*` → 移至 `.cairn/history/`
- `domain-update-candidate_*` → 在编辑器中打开目标域文件
- `output-update-candidate_*` → 在编辑器中打开 `output.md`
- `audit-candidate_*` → 移至 `.cairn/audits/`

### `cairn audit`

对于大型迁移，显式追踪清理义务。

```bash
# 迁移后创建审计文件
cairn audit start state-management --trigger "从 Redux 迁移到 Zustand"

# 扫描残留（遗留的 import、已删除的依赖仍被引用）
cairn audit scan
cairn audit scan state-management   # 只扫描某个域
```

查看 `.cairn/audits/<name>.md` 以审查发现并标记已解决的项目。

### 推荐的任务后工作流

1. 完成编码
2. `cairn reflect --since HEAD~3` → 始终输出显式结果
3. 若为 `candidates-created` 或 `audit-required`：`cairn stage review`
4. 若为 `audit-required`：`cairn audit start <domain> --trigger "<变更>"` + `cairn audit scan`
5. `cairn doctor` → 确认无漂移、过期审计或缺失反思记录

---

## 从 v0.0.9 或更早版本升级

v0.0.9 及更早版本的 `cairn init` 会把 Claude Code Skill 写到 `.claude/skills/cairn/SKILL.md`（按需加载）。从 v0.0.10 起，正确位置改为 `.claude/CLAUDE.md`（每次会话自动加载）。

**如果你用 v0.0.9 或更早初始化过项目**，Skill 在错误位置，约束协议不会触发。用以下任一方式修复，不会碰数据层：

**方式 A — 新命令（推荐）**

```bash
cd <你的项目>
cairn install-skill claude-code
# 提示 "Remove old skill files? [y/N]" → 输入 y 清理旧文件
```

**方式 B — 通过 `cairn init` 三选菜单**

```bash
cd <你的项目>
cairn init
# 遇到"已存在 .cairn/"提示时：
#   [2] 保留数据层，仅重新安装 Skill 文件
# 然后照常选择工具
```

完成后运行 `cairn doctor` 验证 —— Skill files 区段应显示 ✓。

**启用全局协议**

以上两种方式都只安装项目级 Skill。如需在未加载 Skill 文件的场景下也生效，运行：

```bash
cairn install-global
```

该命令将 Cairn Memory Protocol 块写入 `~/.claude/CLAUDE.md`（Claude Code）、`~/.codex/AGENTS.md`（Codex CLI）或 `~/GEMINI.md`（Gemini CLI）。
