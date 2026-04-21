English | [中文](FORMAT.zh.md)

# Cairn 格式规范

本文档定义了 `.cairn/` 目录三层的完整格式。它是编写、验证和工具化 Cairn 文件的权威参考。

---

## 目录结构

每个使用 Cairn 的项目在其仓库根目录放置一个 `.cairn/` 目录：

```
.cairn/
├── output.md          # 第一层：全局约束，始终注入
├── domains/           # 第二层：域上下文，按需注入
│   ├── api-layer.md
│   ├── auth.md
│   └── state-management.md
├── history/           # 第三层：原始决策事件，按需查询
│   ├── 2023-03_state-mgmt-transition.md
│   ├── 2023-09_trpc-experiment-rejection.md
│   └── 2024-01_auth-debt-accepted.md
├── staged/            # 候选收件箱：等待审阅的前缀文件
│   ├── history-candidate_2026-04_trpc-rejection.md
│   ├── domain-update-candidate_2026-04_auth-open-question.md
│   ├── output-update-candidate_2026-04_stack-drift.md
│   └── audit-candidate_2026-04_state-cleanup.md
└── audits/            # 迁移清理追踪（由 cairn audit start 创建）
    └── 2026-04_state-management-migration.md
```

---

## 第一层：`output.md` — 全局约束

### 目的

`output.md` 在每次 AI 会话开始时注入。它建立了所有 AI 建议必须在其中运行的约束框架。

### 注入时机

**每次会话，始终注入。** AI 在任何回复前必须读取 `.cairn/output.md`。

### Token 预算

| 目标 | 硬限制 |
|------|--------|
| 500 tokens | 800 tokens |

如果 `output.md` 超过 800 tokens，内容应移至 `domains/` 或 `history/`。500–800 tokens 之间是可接受的。500 以下是理想的。

### 必需章节

`output.md` **必须**按此顺序包含以下六个章节：

```markdown
## stage
## no-go
## hooks
## stack
## debt
## open questions
```

#### `## stage`

项目阶段和推理模式。

```
## stage

phase: <name> (<YYYY-MM>+)
mode: <priority-1> > <priority-2> > <priority-3>
team: <size>, <constraint>
reject-if: <condition>
```

| 字段 | 是否必需 | 格式 | 示例 |
|------|---------|------|------|
| `phase:` | 必须 | `name (YYYY-MM+)` | `early-growth (2024-09+)` |
| `mode:` | 必须 | 用 `>` 分隔的优先级 | `stability > speed > elegance` |
| `team:` | 建议 | 规模 + 约束 | `2, no-ops` |
| `reject-if:` | 建议 | 纯粹条件 | `migration > 1 week` |

#### `## no-go`

AI **不得**建议的技术方向（禁区方向）。

```
## no-go

- <direction> (<one-line hint>)
- <direction> (<one-line hint>, see domains/<domain>.md)
```

规则：
- 每条记录是一个单行项目符号
- 括号是提示——完整理由属于 `domains/` 或 `history/`
- 如果尚未排除任何方向，可以为空

#### `## hooks`

触发域文件注入的关键词到域的映射（关键词触发）。

```
## hooks

planning / designing / suggesting for:

- <keyword list> → read domains/<domain>.md first
- <keyword list> → read domains/<domain>.md first
```

规则：
- 每个域一行
- 关键词用逗号或斜杠分隔
- 应覆盖项目域列表中的所有域
- 可由 `cairn-init.sh` 根据所选域自动生成

#### `## stack`

当前活跃的技术选择。仅使用 `key: value` 键值对。

```
## stack

<layer>: <technology>
<layer>: <technology>
```

示例：`state: Zustand`、`api: REST`、`db: PostgreSQL`、`auth: JWT + Refresh`、`deploy: Railway`

#### `## debt`

AI **不得**尝试修复的已接受技术债。

```
## debt

<ID>: accepted | <revisit_when condition> | <constraint>
```

| 部分 | 是否必需 | 示例 |
|------|---------|------|
| `<ID>` | 必须 | `AUTH-COUPLING` |
| `accepted` | 必须 | 字面字符串 |
| `revisit_when condition` | 必须 | `fix when team>4 or MAU>100k` |
| `<constraint>` | 必须 | `no refactor now` |

如果尚未正式接受任何技术债，可以为空。

#### `## open questions`

影响未来 AI 建议的全局未解决问题。

```
## open questions

- <尚未决定的全局问题>
```

规则：
- 仅用于**全局**未解决问题——不是域级问题（那些放在 `domains/` 中）
- 不是 no-go，不是技术债清单，不是设计提案积压
- 已解决的条目必须移除；解决后的记录属于 `history/`
- 可以为空

### 编写规则

1. **只写约束，不写解释。** 括号是提示。完整理由进入 `domains/` 和 `history/`。
2. **结构优于散文。** 使用 `key: value` 键值对和简短列表。不写完整句子。
3. **每行必须改变 AI 行为。** 删去一行后问：AI 的回复会有所不同吗？如果不会，删掉它。
4. **执行 Token 预算。** 超过 800 tokens 的内容属于更深的层级。

### 完整示例

```markdown
## stage

phase: early-growth (2024-09+)
mode: stability > speed > elegance
team: 2, no-ops
reject-if: migration > 1 week

## no-go

- tRPC (REST integration cost, see domains/api-layer.md)
- Redux (boilerplate overhead at team-2)
- kubernetes (no ops capacity)
- microservices (no B2B product)

## hooks

planning / designing / suggesting for:

- api / endpoint / tRPC / GraphQL → read domains/api-layer.md first
- auth / login / JWT / session → read domains/auth.md first
- state / store / Zustand → read domains/state-management.md first
- db / migration / ORM → read domains/database.md first

## stack

state: Zustand
api: REST
db: PostgreSQL
auth: JWT + Refresh
deploy: Railway

## debt

AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now
WS-CONCURRENCY: accepted | CDN migration resolves | no polling fallback

## open questions

- Whether billing should remain in the monolith for the next 2 quarters
- Whether auth session storage should be unified this cycle
```

---

## 第二层：`domains/*.md` — 域上下文

### 目的

域文件为代码库特定领域提供预压缩的设计上下文。它们是始终开启的全局约束（`output.md`）和无限制的原始历史（`history/`）之间的关键中间层。

### 注入时机

在规划、架构设计、技术选型或迁移评估期间。当用户请求与 `output.md` 的 `## hooks` 章节中的关键词匹配时，AI 应读取对应的域文件。

### Token 预算

| 每个文件 |
|---------|
| 200–400 tokens |

### 前置元数据

域文件必须在 `# <domain-name>` 标题行之前包含 YAML 前置元数据：

```yaml
---
domain: <domain-key>
hooks: ["keyword1", "keyword2", "..."]
updated: <YYYY-MM>
status: <active | stable>
related: ["domain-name"]   # 可选
---
```

| 字段 | 是否必需 | 格式 | 用途 |
|------|---------|------|------|
| `domain` | 必须 | kebab-case | 必须与文件名主干和 `# title` 标题匹配 |
| `hooks` | 必须 | 字符串 JSON 数组 | 触发注入的关键词。被 `output.md` hooks 章节引用。Phase 3 MCP Server 使用此字段进行精确匹配而无需 AI 推断。 |
| `updated` | 必须 | `YYYY-MM` | 最后实质性更新日期。被 `cairn status` 用于过期检测。 |
| `status` | 建议 | `active` 或 `stable` | `active`——设计仍在演进；`stable`——设计已稳定。过期状态始终根据 `updated` 与历史日期计算，绝不手动声明。 |
| `related` | 可选 | YAML flow-style 字符串数组 | 声明与该 domain 相关的其他 domain 名称。MCP `cairn_match` 使用该字段为匹配的主 domain 推荐加载相关 domain 的 `## trajectory` 章节。展开规则：BFS 仅展开 1 跳（不做传递展开）；最多展开 2 个；按作者声明顺序取前 2；引用不存在的 domain 时静默丢弃并返回 warning；禁止循环引用（主 domain 自身不展开）。 |

### 必需章节

```markdown
# <domain-name>

## current design
## trajectory
## rejected paths
## known pitfalls
## open questions
```

#### `# <domain-name>`

文件标题。必须与域键匹配（例如 `# api-layer`）。

#### `## current design`（当前设计）

一到三句话描述当前状态。必须包含：
- 正在使用的主要设计选择
- 任何值得了解的未解决边界或约束

#### `## trajectory`（发展轨迹）

按时间顺序排列的设计变化列表。每个事件一行。

```
## trajectory

[YYYY-MM] <initial state>
[YYYY-MM] <change> → <one-line reason>
[YYYY-MM] <current state>
```

#### `## rejected paths`（被拒路径）

已评估并排除的方向。

```
## rejected paths

- <option>: <rejection reason, one sentence>
  Re-evaluate when: <condition under which this direction is worth reconsidering>
```

每条被拒路径记录**必须**包含 `Re-evaluate when:`（重新评估时机）注释。

#### `## known pitfalls`（已知陷阱）

AI 在该域工作时必须主动考虑的操作陷阱。

```
## known pitfalls

- <pitfall name>: <trigger condition> / <why it happens> / <what NOT to do>
```

这些**不是**技术债，**不是**拒绝记录。它们是在该域工作时的持续警告。

#### `## open questions`（开放问题）

影响该域未来工作的未解决设计决策。

```
## open questions

- <question that has not been decided yet>
```

可以为空。

#### `## residue checklist`（残留清单，可选）

该域的迁移清理义务。仅在重大迁移或架构变更后添加，需要明确的清理追踪。

```
## residue checklist

- [ ] <清理项——需要删除或更新的内容>
- [x] <已完成的项目>
```

规则：
- 可选——仅在迁移产生明确清理债务时添加
- 条目使用复选框；已完成的条目可以保留为 `[x]` 作为历史记录
- 所有项目都勾选后，应从域文件中删除
- 通过 `.cairn/audits/` 中对应的文件跨会话追踪

### 生命周期

- **创建：** 当某个域积累了 2–3 条 `history/` 记录后。从历史条目用 AI 生成，并经过人工确认。在历史记录存在之前，不要手动编写。
- **更新：** 覆盖整个文件（绝不追加）。文件只反映当前状态。原始事件保留在 `history/`。
- **长度：** 文件不得随时间增长。内容被替换，而不是积累。

### 完整示例

```markdown
---
domain: api-layer
hooks: ["api", "endpoint", "tRPC", "GraphQL", "REST", "OpenAPI"]
updated: 2024-03
status: stable
related: ["auth"]
---

# api-layer

## current design

REST + OpenAPI. No GraphQL, no tRPC. All endpoints follow /v1/ prefix,
but versioning strategy is not formally defined. Error format partially
inconsistent — new endpoints MUST use { code, message, data } structure.

## trajectory

2023-01 Express bare routes, no validation
2023-05 Added Zod request validation
2023-09 Trialed tRPC for 2 weeks → reverted, integration cost too high
2024-03 Added OpenAPI doc generation, current state

## rejected paths

- tRPC: 2-week trial in 2023-09; existing REST clients cost too much to migrate
  Re-evaluate when: existing clients have a defined migration path
- GraphQL: not formally evaluated; current team size and data complexity don't need it
  Re-evaluate when: frontend needs cross-resource aggregation queries

## known pitfalls

- Rate limiting not implemented: when adding it, do not break existing client retry
  logic (clients use exponential backoff)
- File uploads: auth method undefined, do not reuse existing JWT approach directly
- Error format inconsistent: legacy endpoints return { error: string }, handle
  both formats during migration

## open questions

- v2 versioning strategy not decided (URL versioning vs. header versioning)
- File upload endpoint auth design not started
```

---

## 第三层：`history/*.md` — 原始决策事件

### 目的

`history/` 存储所有带完整上下文的原始决策事件。它是 `domains/*.md` 的数据来源，并支持精确的历史查询。

### 注入时机

按需注入，当 AI 需要查找特定的历史决策或拒绝记录时。

### Token 预算

**无限制。** 历史条目应尽可能详细。

### 文件命名

```
YYYY-MM_<short-slug>.md
```

示例：
- `2023-09_trpc-experiment-rejection.md`
- `2024-01_auth-debt-accepted.md`
- `2024-09_growth-stage-transition.md`

### 条目类型

| 类型 | 使用时机 |
|------|---------|
| `decision` | 做出了技术选择 |
| `rejection` | 排除了一个方向，但没有采用替代方案 |
| `transition` | 方案从 A 更改为 B |
| `debt` | 接受（`debt-accepted`）或解决（`debt-resolved`）了技术债 |
| `experiment` | 探索性尝试已结束（成功或失败） |

### 必需字段

```
type: <decision | rejection | transition | debt | experiment>
domain: <domain key from project domain list>
decision_date: <YYYY-MM>
recorded_date: <YYYY-MM>
summary: <one sentence>
rejected: <rejected alternatives and reasons>
reason: <why this choice was made>
revisit_when: <condition for re-evaluation>
```

| 字段 | 是否必需 | 说明 |
|------|---------|------|
| `type` | 必须 | 以上五种类型之一 |
| `domain` | 必须 | 必须与项目锁定域列表中的键匹配 |
| `decision_date` | 必须 | 决策实际发生的时间 |
| `recorded_date` | 必须 | 写入 Cairn 的时间（可能与 `decision_date` 不同） |
| `summary` | 必须 | 一句话 |
| `rejected` | 必须 | **最关键字段。** 即使 `decision` 条目也必须记录哪些被考虑但未被选择 |
| `reason` | 必须 | 为什么走了这条路 |
| `revisit_when` | 建议 | 应重新考虑此决策的条件 |

### 双时间戳

`decision_date` 和 `recorded_date` 可以不同。2022 年的决策可以在 2025 年记录。AI 必须使用 `decision_date` 来评估时效性，而不是 `recorded_date`。

### `rejected` 字段

`rejected` 字段是任何历史条目中最关键的字段。它记录了被考虑但未被选择的内容——AI 最可能重新建议的路径。即使对于 `decision` 和 `transition` 类型，该字段也必须捕获被评估但被放弃的替代方案。

### 必须记录的事件

| 事件 | 条目类型 | 同时更新 |
|------|---------|---------|
| 技术方案已更改 | `transition` | `output.md` stack + `domains/*.md` |
| 实验失败，已回滚 | `experiment` 或 `rejection` | `output.md` no-go（如果高频出现）+ `domains/*.md` |
| 已知缺陷被接受 | `debt`（`debt-accepted`）| `output.md` debt + `domains/*.md` |
| 技术债已解决 | `debt`（`debt-resolved`）| `output.md` debt |
| 项目进入新阶段 | `transition` | `output.md` stage |
| 方向被明确拒绝 | `rejection` | `output.md` no-go（如果高频出现）+ `domains/*.md` |

### 完整示例

```
type: rejection
domain: api-layer
decision_date: 2023-09
recorded_date: 2025-01
summary: Rejected tRPC after a 2-week trial; migration cost for existing REST clients too high
rejected: tRPC — type-safe RPC layer. Two-week spike showed that migrating existing
  REST consumers (mobile app, 3 webhook integrations, 2 partner API clients) would
  require a coordinated multi-client release. No incremental adoption path found.
reason: Existing REST API surface consumed by 6+ clients. tRPC's all-or-nothing router
  model made migration a flag day, not a gradual rollout. A team of 2 could not absorb
  the coordination cost.
revisit_when: Greenfield service with no existing REST consumers, or tRPC adds
  first-class REST compatibility
```

---

## 命名规范

### 域键

- 格式：`kebab-case`
- 子域：`<domain>/<scope>`（例如 `api-layer/user-service`、`database/primary`）
- 域列表必须在 `cairn init` 时锁定
- AI 在写历史条目时不得自行创造新的域键

### 标准域列表

以下 11 个域在初始化时可用。项目应选择 3–7 个适用的域。

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

允许使用自定义域。它们必须采用 `kebab-case` 格式，并在初始化时锁定。

---

## 概念区分

三个概念容易混淆。它们的区别决定了 AI 的行为。

| | `no-go` | `accepted debt` | `known pitfalls` |
|--|---------|-----------------|-----------------|
| **性质** | 方向性排除 | 代码库中的已知缺陷 | 操作陷阱 |
| **AI 反应** | 不建议此方向 | 不尝试修复；在约束内工作 | 主动规避触发条件 |
| **代码中存在？** | 否（评估结论） | 是（缺陷存在） | 是（副作用存在） |
| **`revisit_when`** | 可选 | 必需 | 无（持续警告） |
| **写在** | `output.md` + `domains/` | `output.md` + `history/` + `domains/` | 仅 `domains/` |

**no-go** 表示："我们决定不走这条路。"  
**accepted debt** 表示："我们知道这里有问题，暂时不修复。"  
**known pitfalls** 表示："在这里工作时要小心。"

同一个底层问题可以同时以多种形式出现。例如，一个被接受为技术债的 WebSocket 并发 bug（在 `output.md` debt 中），同时也可能在 `domains/api-layer.md` 中生成一条已知陷阱，警告未来的工作不要依赖 WebSocket 一致性保证。

---

## 支持目录

`.cairn/staged/` 和 `.cairn/audits/` 是支持目录。它们不构成额外的协议层——它们的存在是为了维护官方三层系统。

### `.cairn/staged/` — 候选收件箱

暂存候选是等待人工审阅的前缀文件。文件名前缀决定 `cairn stage review` 在接受时如何路由文件。

#### 候选类型

| 前缀 | 接受时 | 生成来源 |
|------|--------|---------|
| `history-candidate_` | 移动到 `history/`（去除前缀） | `cairn reflect`、`cairn analyze`、`cairn log --quick` |
| `domain-update-candidate_` | 在目标 `domains/<name>.md` 上打开 `$EDITOR` | `cairn reflect`、`cairn analyze` |
| `output-update-candidate_` | 在 `output.md` 上打开 `$EDITOR` | `cairn reflect`、`cairn analyze` |
| `audit-candidate_` | 移动到 `audits/`（去除前缀） | `cairn reflect`、`cairn analyze` |

#### 文件命名

```
<kind>-candidate_YYYY-MM_<slug>.md
```

示例：
- `history-candidate_2026-04_trpc-rejection.md`
- `domain-update-candidate_2026-04_auth-open-question.md`
- `output-update-candidate_2026-04_stack-drift.md`
- `audit-candidate_2026-04_state-cleanup.md`

#### 向后兼容

没有已识别前缀的文件（例如 v0.0.8 之前工具产生的 `2024-03_foo.md`）在接受时被视为 `history-candidate` 并移动到 `history/`。不执行重命名。

---

### `.cairn/audits/` — 迁移清理追踪

审计文件记录明确的迁移清理义务。由 `cairn audit start` 创建，由 `cairn audit scan` 更新。

#### 文件命名

```
YYYY-MM_<domain>-<slug>.md
```

#### 格式

```markdown
# Audit: <description>
date: YYYY-MM
domain: <domain-key>
trigger: <触发此审计的变更>
status: open|partial|complete

## Expected removals
- <需要删除的旧依赖、目录或模式>

## Findings
- <发现结果：仍然存在 / 确认已删除>

## Follow-up
- <剩余行动项>
```

| 字段 | 是否必需 | 说明 |
|------|---------|------|
| `date` | 必须 | 审计创建时间 |
| `domain` | 必须 | 项目域列表中的域键 |
| `trigger` | 必须 | 需要清理的变更的一行描述 |
| `status` | 必须 | `open`（未开始）、`partial`（进行中）、`complete`（完成） |

#### 生命周期

- **创建：** 重大迁移后运行 `cairn audit start <domain> --trigger "<change>"`
- **扫描：** 运行 `cairn audit scan` 用残留检测结果填充 Findings
- **更新：** 直接编辑文件标记已解决的项目；完成时更改 `status`
- **归档：** 将 `status: complete` 的文件保留在 `audits/` 中作为历史记录；`cairn doctor` 不再标记它们
