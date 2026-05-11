# Cairn v2 — 技术规格书

---

## 愿景：我们要做什么

我们要做的不是一个文件格式，不是一个文档规范，不是一个 CLI 工具。

**我们要做一个由 AI 自动维护的项目记忆系统。**

它持续观察项目的演化——代码怎么变、依赖怎么换、方案怎么选、哪些路走过走不通——自动把这些信号提炼成结构化的项目记忆，然后在 AI 做下一次方案设计时，把这些记忆注入进去，让 AI 知道这个项目走过什么路、现在处于什么阶段、哪些方向不该再提。

它就是这个项目的历史指导手册，由 AI 自己写，由 AI 自己用，人类只在关键时刻审核和纠偏。

结合新的需求和当下项目的阶段，它能帮助 AI 输出真正对齐项目现实的最优方案——而不是每次都从零开始，像一个空降架构师一样反复提出已经被否决的建议。

---

## 这个想法从哪里来

### 核心问题

AI 编程助手有一个根本性的缺陷：**它没有项目时间感。**

它知道你的项目用什么技术栈（语义记忆），知道怎么写符合规范的代码（程序性记忆），但它完全不知道这个项目**走过什么路**——哪些技术方向试过但失败了，哪些技术债是主动接受的，项目现在处于什么阶段，这个阶段不应该做什么。

结果是：每次新会话，AI 都像一个第一天入职的人——聪明，充满建议，但对项目历史一无所知。它会反复提出三个月前已经被否决的方案，在融资冲刺期建议大重构，在已知的坑上浪费你的时间。

### 现有工具为什么不够

我们调研了所有主流方案：

**Memory Bank（Cline 社区）** 用六个 Markdown 文件记录项目的当前状态——技术栈、架构、进度。这解决了"项目是什么"的问题，但它是静态快照，没有时间轴，没有"项目活到第几年"的概念，也没有否决记录。

**Cursor Rules / CLAUDE.md / Copilot Instructions** 是系统提示的分布式版本，告诉 AI "怎么写代码"。但它们不知道"为什么这么写"——哪些决策背后有什么权衡，哪些替代方案已经被排除。

**ADR（架构决策记录）** 有否决记录，但它是写给人类看的正式文档，格式重，独立开发者几乎没人执行，而且从未被设计成 AI 可消费的上下文。

**所有这些方案的共同问题是：它们都需要人类手动维护。** 一旦维护成本稍高，就没有人写了，三个月后文件腐烂，系统等于不存在。

### 学术界的验证

2025-2026 年的学术研究正好验证了这个方向：

**A-MEM（NeurIPS 2025）** 提出 agentic memory——让 agent 自主决定何时创建、链接、更新记忆，而不是用固定的预定义规则。

**AgeMem（2026）** 更进一步——把 store / retrieve / update / summarize / discard 全部变成 agent 可以自主调用的工具操作，通过强化学习训练 agent 学会何时执行哪种操作。

**MemCoder（2026）** 直接面向编程场景——从 git 提交历史中自动提取意图到代码的映射，引入"经验自内化机制"，在 SWE-bench 上提升 9.4%。

**核心共识是：记忆应该由 agent 自主管理，而不是由人类编写。** 但这些论文做的都是对话级或任务级的记忆，没有人做过**项目生命周期级别**的记忆——跨越月和年的决策积累、阶段判断、路径依赖约束。

这就是 Cairn 要填的空白。

---

## 为什么 v1 走偏了

Cairn v1 做了一个优秀的格式规范：`.cairn/` 目录、三层文件结构（output.md / domains/ / history/）、8 个工具的 Skill 适配、CLI 四个命令、MCP Server 六个工具、完整的测试。

但 v1 本质上变成了：

> 一套结构化 Markdown 规范 + Skill 适配 + CLI 初始化器。

它解决的是"AI 应该读哪些文件、这些文件怎么写"。但我们最初想要的是：

> AI 和项目协作过程中，项目记忆应该如何**自动产生、自动演化、自动约束未来行为**。

v1 最根本的问题是：**用户仍然要手写 `.cairn/` 文件。** AI 只是被动读取。没有信号捕获，没有记忆准入，没有记忆演化，没有项目阶段推理，没有"建议前的历史感知规划"。

v1 是一个**静态上下文格式**。我们需要的是一个**动态记忆引擎**。

---

## v2 的设计思路

### 从"人写 AI 读"到"AI 写 AI 读 人审"

v1 的信息流是：

```
人类写 → .cairn/ 文件 → AI 读取
```

v2 的信息流是：

```
项目事件自然发生
  → Cairn 双耳捕获信号（Git 变更 + AI 对话）
  → 信任策略过滤分级
  → 结构化记忆自动生成
  → 自动生成 AI 可消费的约束视图
  → AI 在约束下工作
  → 新的交互继续产生信号
  → 人类只在高风险变更时审核
```

**用户从不手写记忆。** 所有记忆由 Server 自动或半自动产生。

### 双耳设计：为什么需要两个信号源

项目的重要信号分布在两个地方：

**代码层面（Git 耳朵）：** 依赖怎么变、文件怎么改、什么被 revert 了、提交频率如何——这些是客观的项目演化事实，Git 里全部有记录。

**对话层面（对话耳朵）：** 用户为什么否决 AI 的建议、"我们之前试过这个不行"、"现在在冲刺融资别搞大改"——这些是最有价值的约束信号，但只存在于人和 AI 的对话里，Git 里拿不到。

只有 Git 耳朵，你知道"发生了什么"但不知道"为什么"。
只有对话耳朵，你知道"用户说了什么"但不知道代码实际怎么变的。
两只耳朵合起来，才能完整地理解项目的路径依赖。

### 信任策略：为什么不能完全自动

完全自动写入记忆是危险的。一条错误的 no-go 会像错误的系统提示词一样不断放大——AI 后续所有建议都会被这条错误约束影响。

学术界对此有明确警告（arXiv 2604.16548，Mnemonic Sovereignty）：**危险不仅在于插入单条错误条目，而在于该错误通过总结、反思或经验记忆机制被提升为高权重。**

所以 Cairn 设计了四级信任策略（L0 Drop / L1 Candidate / L2 Staged / L3 Auto-write），核心原则是：**任何会改变 AI 全局行为的记忆，永远不能自动写入。** 全局 no-go、阶段变更、技术栈主路径变化——这些必须人工审核。只有来源明确、范围局部、无冲突的条目才允许自动写入。

### 阶段判断：为什么这是独有能力

在所有调研到的论文和工具中，**没有任何一个做过"从项目信号自动推断项目阶段"。**

同一个技术建议，在探索期和成熟期的答案完全不同：探索期可以引入新依赖快速验证，成熟期引入新依赖需要强论证。但现有所有 AI 工具都不知道项目处于哪个阶段——它们根据代码本身的特征来推断，而这种推断往往是错误的。

Cairn 通过综合多维信号（项目年龄、提交频率趋势、依赖变更率、新文件占比、团队规模变化）来推断阶段，并输出推理模式和约束建议。**但早期阶段判断只输出 advisory，不产生硬约束**——直到置信度足够高且人工确认后，才升级为正式约束。

### behavior_effect：为什么每条记忆必须回答"AI 该做什么不同"

Cairn 不是文档系统，是约束系统。**如果一条记忆不能改变 AI 的行为，它就不应该存在于 memory 里。**

所以每条 MemoryEntry 都必须包含 `behavior_effect` 字段——明确声明这条记忆对 AI 的约束是什么：不要建议这个方向（avoid_suggestion）、优先推荐这个方案（prefer_approach）、可以建议但先说明风险（warn_before）、在这个域做建议前必须读历史（require_review）。

这让 Cairn 的记忆不是"信息的堆积"，而是"约束的集合"。

### Memory / Views 分离：为什么源数据和视图要分开

v1 的问题是 output.md / domains/*.md 既是源数据又是运行时上下文——不知道哪些内容是原始事实、哪些是摘要，文件容易腐烂，AI 修改摘要时可能破坏历史真实性，Git diff 看不出是事实变化还是投影变化。

v2 把这两者严格分离：

**memory/ 是源数据（Source of Truth）**——每条记忆是一个 YAML 文件，包含完整的来源追溯、置信度、behavior_effect。这是人类审核的对象。

**views/ 是自动生成的视图（Projection）**——output.md、domains/*.md、stage.md 全部从 memory/ 自动聚合生成。AI 消费视图，人类审核源数据。views/ 的格式和 v1 完全兼容，所以 v1 的 Skill 适配文件可以直接作为降级方案。

### 为什么选择 MCP Server 作为核心架构

四个候选方向：

**A. 纯 MCP Server（Server-centric）**——所有逻辑在 Server 里，通过 MCP 协议和 AI 工具通信。
**B. Git-native Observer**——纯粹从 Git 事件提取，不接触对话层。
**C. 双耳引擎（Dual-source）**——Git + 对话两个信号源汇入同一个引擎。
**D. 单工具深度集成**——先只做一个 AI 工具的原生插件。

我们选择了 **C（双耳引擎）通过 A（MCP Server）来落地**。

原因：MCP 已成为跨 AI 工具的标准协议（Cursor、Claude Code、Cline、Windsurf 全部支持）。MCP Server 以 stdio 模式按项目、按会话启动——不是全局后台服务，不需要数据库，不需要云端，用户打开项目时启动、关闭时退出，和语言服务器（LSP）完全一样的运行模式。同一台电脑 10 个项目，只有当前打开的项目有 Server 在跑。

### 为什么 v0.1 就要做完整闭环

最初我们按传统 MVP 思路把 v0.1 削减到只有 schema + views + context 三个模块。但这个项目有一个特殊性：**它是 AI 编写为主的项目，过度削减会让下一轮实现时丢掉系统完整性，最后偏成一个小工具。**

正确的策略不是"砍功能"，而是**分层实现但架构一次性铺完整**。

v0.1 交付所有核心模块，但每个模块的智能深度用规则实现——Git 耳朵只做模式匹配，阶段判断只用规则引擎，信任策略只用 if-else。后续版本逐步加深每个模块的智能程度，但系统骨架从第一天就完整。

一句话：**不删模块，降深度；不降架构，控权限。**

### 命名：为什么叫 Cairn

Cairn，登山者沿途堆起的石标。

在没有 GPS 的年代，登山者每走过一段路，就在险要处堆起一个石堆——标记这条路走得通，那条路有危险，此处应该转向。后来者不需要重新探索每一条岔路，只需要沿着石标前行。

AI 每次进入一个项目，都像第一次踏上这片山地的攀登者。Cairn 把项目积累的判断结构化地堆在路边：这个技术方向已经试过，走不通；这个模块有已知陷阱，小心绕过；现在处于冲刺阶段，不是大改的时机。

每一条 rejection 记录，是一块石头。每一个 known pitfall，是一块石头。每一次阶段切换，是一块石头。石标越完整，后来者偏离的可能性就越小。

---

## 设计原则总结

> **Memory is source. Views are projections. Human reviews memory, AI consumes views/tools.**

> **不删模块，降深度；不降架构，控权限。**

> **先把整条链路完整竖切跑通，再逐步加深每个模块。**

> **如果一条记忆不能回答"AI 以后应该做什么不同的事"，它就不应该进入 memory。**

> **任何会改变 AI 全局行为的记忆，永远不能自动写入。**

---
---

# 以下是完整技术规格

---

## 1. 产品边界

### Cairn 是

本地优先的项目记忆引擎。通过 Git 与对话信号捕获项目路径依赖，
经由信任策略沉淀为结构化 memory，再生成 AI 可消费的 views/context，
持续约束 AI 不重复走错路。

### Cairn 不是

- 不是 AI 架构师（不替用户做决策）
- 不是文档生成器（不是给人读的文档系统）
- 不是代码分析工具（不做静态分析、不做 lint）
- 不是云服务（纯本地，零远程依赖）

### 权限模型（贯穿全系统）

| 能力 | 读权限 | 写 memory 权限 | 说明 |
|---|---|---|---|
| cairn_context | read-only | **否** | 只读约束上下文 |
| cairn_plan | read-only | **否，永远不得写入 signals/staged/memory** | advisory 推测 ≠ 项目事实记忆 |
| cairn_status | read-only | **否** | 只读状态 |
| cairn_doctor | read-only | **否** | 只读诊断 |
| cairn_signal | — | **间接**，经 Trust Router 分流 | 产生信号，不直接写 memory |
| cairn_session_end | — | **间接**，经 Trust Router 分流 | 触发批量处理，不直接写 memory |
| cairn review | — | **是**，人工确认后写入 | 唯一的人工写入路径 |
| L3 auto-write | — | **是**，严格条件自动写入 | 唯一的自动写入路径 |
| stage engine | advisory | **否** | 只更新 state.yaml，不写 memory |
| Git 耳朵 | — | **否**，只产生 signals | signal only |
| 对话耳朵 | — | **否**，只产生 signals | signal only |
| views generator | read memory | **否** | 只读 memory 后生成视图 |

**硬规则：cairn_plan 永远不得写入 signals / staged / memory。**
AI 规划推测不等于项目事实记忆。如果 plan 也产生记忆，会混淆"AI 猜测"和"项目事实"的边界。

---

## 2. 系统架构

```
┌───────────────────────────────────────────────────┐
│                  AI 工具                          │
│          (Cursor / Claude Code / Cline)           │
│                    ↕ MCP 协议                     │
├───────────────────────────────────────────────────┤
│               Cairn Server (stdio MCP)            │
│                                                    │
│  ┌───────────┐   ┌───────────┐                    │
│  │  Git 耳朵  │   │  对话耳朵  │                    │
│  │ (启动扫描) │   │ (实时 MCP) │                    │
│  └─────┬─────┘   └─────┬─────┘                    │
│        └───────┬───────┘                           │
│                ↓                                   │
│  ┌──────────────────────┐                          │
│  │    信号准入控制         │                          │
│  │  (Trust Router L0-L3) │                          │
│  └───┬──────┬──────┬────┘                          │
│      ↓      ↓      ↓                              │
│   signals/ staged/ memory/                         │
│   (L1)     (L2)    (L3+reviewed)                   │
│                       ↓                            │
│              ┌────────────────┐                    │
│              │  Views Engine   │                    │
│              │  output.md      │                    │
│              │  domains/*.md   │                    │
│              │  stage.md       │                    │
│              └────────────────┘                    │
│                       ↓                            │
│  ┌────────────────────────────────────┐            │
│  │  MCP Tools                         │            │
│  │  context / signal / session_end    │            │
│  │  status / plan / doctor            │            │
│  └────────────────────────────────────┘            │
│                                                    │
│  ┌────────────────────────────────────┐            │
│  │  Stage Advisory Engine              │            │
│  │  (规则版，advisory only)             │            │
│  └────────────────────────────────────┘            │
└───────────────────────────────────────────────────┘
```

**运行模式：** stdio-based MCP Server。AI 工具打开项目时启动，关闭时退出。
每个项目独立实例，零全局配置，零后台 daemon，零云端依赖。

---

## 3. 目录结构

```
.cairn/
├── config.yaml              ← 项目配置
├── state.yaml               ← Server 运行状态
├── signals/                 ← L1 候选信号池
│   ├── sig_2026_05_11_001.yaml
│   └── ...
├── staged/                  ← L2 待审核条目
│   ├── staged_2026_05_11_api_trpc.yaml
│   └── ...
├── memory/                  ← 正式记忆（源数据）
│   ├── mem_2024_03_api_tRPC_rejection.yaml
│   ├── mem_2024_03_state_mgmt_transition.yaml
│   └── ...
├── views/                   ← 自动生成视图（不可手动编辑）
│   ├── output.md            ← 全局约束快照
│   ├── stage.md             ← 阶段判断详情
│   └── domains/             ← 各域摘要
│       ├── api-layer.md
│       └── auth.md
└── sessions/                ← 会话记录（审计用）
    ├── sess_2026_05_11_001.yaml
    └── ...
```

### 各目录职责

| 目录 | 写入者 | 读取者 | 生命周期 |
|---|---|---|---|
| config.yaml | 人类（init 时 + 手动调整）| Server | 长期稳定 |
| state.yaml | Server | Server | 每次启动更新 |
| signals/ | 双耳 → Trust Router | Trust Router | L1 积累后升级或过期丢弃 |
| staged/ | Trust Router | 人类（review 时）| 审核后移入 memory 或丢弃 |
| memory/ | review 确认 / L3 auto-write | Views Engine / MCP Tools | 长期持久 |
| views/ | Views Engine（自动）| AI（MCP 或 Skill）| 每次 memory 变更后重新生成 |
| sessions/ | Server（session_end 时）| 审计 / 回溯 | 可定期清理 |

---

## 4. Schemas

### 4.1 MemoryEntry

```yaml
# .cairn/memory/mem_2024_03_api_tRPC_rejection.yaml

id: mem_2024_03_api_tRPC_rejection
type: rejection                          # decision | rejection | transition | debt | experiment
domain: api-layer
scope: local                             # local | global

status: active                           # active | superseded | archived（生命周期）

health:
  state: ok                              # ok | stale | conflicted（当前健康度）
  reason: null                           # 不健康时填原因

confidence:
  level: high                            # high | medium | low
  score: 0.86
  reason: "explicit user rejection with git revert evidence"

source:
  kind: git-revert                       # git-revert | git-dependency | conversation | manual
  refs:
    - type: commit
      id: a1b2c3d
    - type: session
      id: sess_2024_03_15_001
  captured_at: 2024-03-15T10:00:00Z

subject:
  name: tRPC
  category: api-framework

summary: "tRPC 试用两周后回退，与现有 REST 客户端集成成本过高"

rejected:
  what: "tRPC migration"
  reason: "REST 客户端改造代价超过 tRPC 类型安全收益"

chosen:
  what: "REST + OpenAPI"
  reason: "适合当前客户端和团队工作流"

behavior_effect:
  type: avoid_suggestion                 # avoid_suggestion | prefer_approach | warn_before | require_review
  instruction: "不要建议迁移到 tRPC，除非 revisit 条件满足"

revisit:
  when:
    - "现有 REST 客户端全部替换"
    - "启动全新的 greenfield API 服务"
  status: not_met                        # not_met | possibly_met | met

relations:
  related:
    - mem_2024_03_api_openapi_decision
  conflicts: []

created_at: 2024-03-15T10:00:00Z
updated_at: 2024-03-15T10:00:00Z
```

### 4.2 Signal

```yaml
# .cairn/signals/sig_2026_05_11_001.yaml

id: sig_2026_05_11_001
source_ear: git                          # git | conversation
signal_type: dependency-removed          # dependency-removed | dependency-replaced | revert |
                                         # large-refactor | user-rejection | user-constraint |
                                         # historical-reference | stage-signal
raw_data:
  package: tRPC
  appeared: 2024-02-15
  disappeared: 2024-03-02
  related_commits:
    - a1b2c3d
    - e4f5g6h
inferred:
  probable_type: rejection
  probable_domain: api-layer
  confidence: high
routing:
  level: L3                              # L0 | L1 | L2 | L3
  reason: "git-revert + local scope → auto-write eligible"
captured_at: 2026-05-11T08:00:00Z
```

### 4.3 StagedEntry

```yaml
# .cairn/staged/staged_2026_05_11_api_trpc.yaml

id: staged_2026_05_11_api_trpc
origin_signal: sig_2026_05_11_001
draft_memory:
  type: rejection
  domain: api-layer
  scope: local
  summary: "tRPC 出现后移除"
  rejected:
    what: tRPC
    reason: "[TODO: 请补充原因]"
  behavior_effect:
    type: avoid_suggestion
    instruction: "不建议迁移到 tRPC"
  revisit:
    when: ["[TODO]"]
    status: not_met
review_status: pending                   # pending | accepted | rejected | expired
routing_reason: "global impact requires review"
created_at: 2026-05-11T08:00:00Z
```

### 4.4 StageSnapshot

```yaml
# 存储在 .cairn/state.yaml 的 stage 章节

stage:
  phase: growth                          # exploration | growth | maturity | maintenance
  confidence: 0.68
  status: advisory                       # advisory | confirmed
  evidence:
    - source: git
      signal: "dependency changes decreased over last 3 months"
    - source: git
      signal: "commit frequency stable at 12/week"
    - source: conversation
      signal: "user requests mostly feature additions"
  guidance:
    - "平衡速度与稳定性"
    - "新增依赖需要评估维护成本"
  last_updated: 2026-05-11T08:00:00Z
```

### 4.5 SessionRecord

```yaml
# .cairn/sessions/sess_2026_05_11_001.yaml

id: sess_2026_05_11_001
started_at: 2026-05-11T10:00:00Z
ended_at: 2026-05-11T12:30:00Z
summary: "重构用户认证模块，从 session-based 迁移到 JWT"
signals_captured: 3
signals_routed:
  L0: 0
  L1: 1
  L2: 1
  L3: 1
domains_touched:
  - auth
  - api-layer
decisions_made:
  - "认证从 session 迁移到 JWT"
unresolved:
  - "JWT refresh token 存储位置未决"
context_injections:
  - tool: cairn_context
    domains_returned: ["auth", "api-layer"]
    no_go_returned: ["tRPC"]
```

### 4.6 config.yaml

```yaml
version: "2.0"

project:
  name: "my-saas"
  created: 2023-01

domains:
  locked:
    - api-layer
    - auth
    - state-management
    - database
    - deployment

trust_policy:
  L3_auto_write:
    - "source.kind == 'git-revert' AND scope == 'local'"
    - "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'"
  L2_staged:
    - "scope == 'global'"
    - "type == 'transition' AND affects_output == true"
  never_auto:
    - "新增全局 no-go"
    - "阶段变更"
    - "output 级别 stack 变更"
    - "scope == 'global' 的 behavior_effect"

stage:
  override: null
  auto_constraint: false
```

---

## 5. Trust Router

所有信号必须经过 Trust Router 分流，没有任何信号可以绕过。

### 四级分流

| 级别 | 名称 | 存储位置 | 行为 |
|---|---|---|---|
| L0 | Drop | 不存储 | 噪音、重复、低置信度，直接丢弃 |
| L1 | Candidate | signals/ | 进入候选池，积累更多信号后再升级 |
| L2 | Staged | staged/ | 等待人工审核 |
| L3 | Auto-write | memory/ | 满足严格条件时自动写入 |

### 路由规则（v0.1 规则版实现）

**核心原则：L2 safety rules must override L3 auto-write rules.**
即使一条信号来源明确、置信度高，只要触发了硬规则 L2 条件，就不能自动写入。

```
信号进入 Trust Router
  │
  ├→ 是否重复？
  │    ├── 是 → 合并到已有条目的 source.refs → L0 / merge
  │    └── 否 → 继续
  │
  ├→ 是否触发硬规则 L2？（never_auto 列表）
  │    ├── 是 → 写入 staged/（不论来源多可靠）
  │    └── 否 → 继续
  │
  ├→ 是否满足 L2 条件？（config.yaml trust_policy.L2_staged）
  │    ├── 是 → 写入 staged/
  │    └── 否 → 继续
  │
  ├→ 是否满足 L3 条件？（config.yaml trust_policy.L3_auto_write）
  │    ├── 是 → 写入 memory/ → 触发 views 重新生成
  │    └── 否 → 继续
  │
  ├→ 置信度判断
  │    ├── confidence >= medium → L1（写入 signals/）
  │    └── confidence < medium → L0（丢弃）
  │
  └→ L1 候选池逻辑
       同一 domain + 同一 subject 的 L1 信号积累超过 N 条时
       → 自动升级为 L2 staged
```

### 硬规则（不可配置，不可被 AI 修改）

- 新增全局 no-go → 永远 L2
- 阶段变更 → 永远 L2
- scope == global 的任何 behavior_effect → 永远 L2
- never_auto 列表中的任何条目 → 永远 L2

---

## 6. Git 耳朵

### 触发时机

Server 启动时，扫描 `state.yaml.last_session_commit` 到 HEAD 之间的所有变更。

### v0.1 实现的信号类型

| 信号类型 | 检测方式 | 输出 |
|---|---|---|
| `revert` | commit message 包含 "revert" 或 git revert 标记 | experiment-failed signal |
| `dependency-removed` | diff 依赖文件，包出现后消失 | rejection-candidate signal |
| `dependency-replaced` | 同功能域包一删一增 | transition-candidate signal |
| `large-file-movement` | 大量文件删除 + 新增（阈值：>10 文件）| transition-candidate signal |
| `commit-frequency` | 统计最近 30 天 commit 数 vs 项目平均 | stage-signal |
| `new-contributor` | git log author 新增 | stage-signal |

### 边界（严格遵守）

- Git 耳朵只产生 signals，不产生 memories
- Git 耳朵不做语义分析，只做模式匹配和统计
- Git 能给"发生了什么"，不能给"为什么"
- "为什么"必须来自对话耳朵或人工补充

### 依赖文件支持列表

```
package.json      (Node.js)
go.mod            (Go)
requirements.txt  (Python)
Cargo.toml        (Rust)
build.gradle      (Java/Kotlin)
Gemfile           (Ruby)
composer.json     (PHP)
pyproject.toml    (Python)
pom.xml           (Java)
```

---

## 7. 对话耳朵

### 信号来源

AI 在对话中通过 `cairn_signal()` MCP 工具传递信号。
Skill 文件规范 AI 在以下场景调用：

| 场景 | signal_type |
|---|---|
| 用户否决 AI 建议并给出原因 | user-rejection |
| 用户说"我们之前试过这个" | historical-reference |
| 用户描述业务约束或技术限制 | user-constraint |
| 做了一个明确的技术决策 | decision |
| 发现并接受了一个技术债 | debt-acceptance |

### 边界

- 对话耳朵只产生 signals，不直接写 memory
- 不对所有会话默认提取，只在明确约束场景触发
- 对话信号的 confidence 默认不超过 medium（除非有 git 证据佐证）

---

## 8. Memory Engine

### 写入路径

```
signals/ ──L1 积累升级──→ staged/
staged/  ──人工 review──→ memory/
信号     ──L3 直接写入──→ memory/
```

### memory → views 生成

每次 memory/ 发生变更（新增、修改、删除），触发 views 重新生成：

**views/output.md 生成规则：**
1. 从所有 active memory 中提取 scope == global 或 behavior_effect.type == avoid_suggestion 的条目 → no-go 章节
2. 从所有 active memory 中提取 type == decision 且 status == active → stack 章节
3. 从所有 active memory 中提取 type == debt → debt 章节
4. 从 config.yaml domains.locked + memory 中的 hooks 关键词 → hooks 章节
5. 从 state.yaml stage → stage 章节
6. 合计 token 不超过 hard limit 800

**views/domains/*.md 生成规则：**
1. 按 domain 分组所有 active memory 条目
2. 生成 trajectory（按时间排列的 summary 列表）
3. 生成 rejected paths（所有 type == rejection 的条目）
4. 生成 known pitfalls（所有 behavior_effect.type == warn_before 的条目）
5. 生成 open questions（所有 revisit.status == possibly_met 的条目）

**views/ 文件头部标注：**

```markdown
<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/memory/*.yaml
Last generated: 2026-05-11T10:30:00+09:00
-->
```

### v0.1 的记忆维护能力

| 能力 | v0.1 实现 |
|---|---|
| 重复合并 | 同 domain + 同 subject + 同 type → 合并 source.refs |
| 冲突标记 | 同 domain 内 behavior_effect 矛盾 → 设置 health.state = conflicted，填写 health.reason，同时在 relations.conflicts 记录冲突对方 id |
| 过期检测 | 暂不实现（schema 已预留 health.state = stale）|
| 自动压缩 | 暂不实现 |
| 归档 | 暂不实现 |

---

## 9. Views Engine

### 生成触发

- memory/ 任何文件变更时
- cairn review accept 后
- L3 auto-write 后
- state.yaml stage 变更后

### 格式兼容

views/ 的格式和 Cairn v1 的 output.md / domains/*.md **完全兼容**。
v1 的 8 个 Skill 适配文件可直接读取 views/ 作为降级方案。

### token 控制

- views/output.md：target 500 / hard limit 800
- views/domains/*.md：每个文件 target 300 / hard limit 500
- 超限时优先保留 behavior_effect.type == avoid_suggestion 的条目

---

## 10. Stage Advisory Engine

### v0.1 实现（规则版，advisory only）

```typescript
function inferStage(signals: StageSignal[]): StageSnapshot {
  const age = projectAgeMonths(signals);
  const commitTrend = commitFrequencyTrend(signals);
  const depChanges = dependencyChangeRate(signals);
  const newFileRatio = newFileRatio(signals);

  if (age < 6 && depChanges > 0.3) return { phase: 'exploration', confidence: 0.6 };
  if (commitTrend > 1.2 && depChanges < 0.15) return { phase: 'growth', confidence: 0.65 };
  if (newFileRatio < 0.15 && age > 18) return { phase: 'maturity', confidence: 0.6 };
  if (commitTrend < 0.5 && age > 24) return { phase: 'maintenance', confidence: 0.55 };

  return { phase: 'growth', confidence: 0.4 }; // 默认保守判断
}
```

### 输出规则

- confidence < 0.7 → 不产生任何硬约束
- status 永远是 advisory，除非人工 `cairn stage confirm`
- guidance 是建议性语言，不是禁止性语言
- 阶段变更 → 永远 L2（需人工确认后才写入 state.yaml）

---

## 11. MCP Tools（6 个）

### cairn_context — stable

```typescript
cairn_context({
  task?: string,
  files?: string[]
}): {
  stage: StageAdvisory,
  no_go: NoGoEntry[],
  relevant_domains: DomainSummary[],
  active_debt: DebtEntry[],
  warnings: string[]
}
```

AI 工作前调用。如果传入 task/files，Server 判断相关 domain 只返回相关内容。

### cairn_signal — stable

```typescript
cairn_signal({
  type: SignalType,
  domain?: string,
  details: { what: string, reason?: string, rejected_alternatives?: string[], revisit_when?: string[] },
  evidence: { user_said?: string, files?: string[], commit?: string }
}): {
  accepted: boolean,
  level: "L0" | "L1" | "L2" | "L3",
  route: "dropped" | "signals" | "staged" | "memory",
  reason: string
}
```

AI 工作中自然调用。返回告诉 AI 这个信号被路由到哪里。

### cairn_session_end — stable

```typescript
cairn_session_end({
  summary: string,
  changed_domains?: string[],
  decisions_made?: string[],
  unresolved?: string[]
}): {
  signals_processed: number,
  new_staged: number,
  new_memory: number,
  views_regenerated: boolean
}
```

会话结束时调用。触发候选批量处理、views 重新生成。

### cairn_status — stable

```typescript
cairn_status(): {
  memory_count: number,
  staged_count: number,
  signals_count: number,
  stale_domains: string[],
  conflicts: ConflictEntry[],
  last_git_scan: string,
  stage: StageAdvisory
}
```

### cairn_plan — experimental

```typescript
cairn_plan({
  task: string
}): {
  task: string,
  stage_guidance: string,
  historical_constraints: string[],
  recommended_direction: string,
  warnings: string[]
}
```

不替 AI 做完整方案，只提供历史感知的规划框架。标记 experimental。

**cairn_plan 永远不得写入 signals / staged / memory。** 它是纯只读 advisory 工具。
AI 的规划推测不等于项目事实记忆。如果 plan 也产生记忆，会混淆"AI 猜测"和"项目事实"的边界。

### cairn_doctor — experimental

```typescript
cairn_doctor(): {
  output_tokens: { count: number, status: "ok" | "warning" | "over_limit" },
  orphan_no_go: string[],          // no-go 无 memory 支撑
  stale_domains: DomainStaleInfo[],
  conflicts: ConflictEntry[],
  staged_backlog: number,
  todos_in_memory: number          // memory 里有 [TODO] 的条目数
}
```

健康度诊断。规则型检查，不依赖 LLM。

---

## 12. CLI Commands

```bash
cairn init                # 两步式初始化（规则扫描 + 选择性 AI 分析）
cairn status              # 等同于 cairn_status()
cairn review              # 逐条审核 staged/（accept / edit / skip / delete）
cairn doctor              # 等同于 cairn_doctor()
cairn stage confirm       # 人工确认阶段判断（advisory → confirmed）
cairn memory show <id>    # 查看单条 memory
cairn memory archive <id> # 归档一条 memory
```

---

## 13. Server 生命周期

```
安装（一次性）
  npm install -g cairn-server

首次使用（每个项目一次）
  $ cd my-project
  $ cairn init
  → Step 1：纯规则扫描 git 历史，列出候选信号
  → Step 2：用户选择要分析的信号
  → Step 3：AI 生成 staged 条目（reason/revisit 标 [TODO]）
  → Step 4：用户 review 并补充
  → 生成 .cairn/ 完整目录
  → 输出 MCP 配置指引

日常使用（完全自动）
  打开项目 → AI 工具启动 cairn-server
    → Git 耳朵扫描上次关闭后的变更
    → 加载 memory 和 state
    → AI 调用 cairn_context() 获取约束
    → AI 工作，cairn_signal() 捕获对话信号
    → 信号经 Trust Router 分流
    → L3 自动写入 / L2 进 staged / L1 进候选池
    → 会话结束，cairn_session_end() 整理
    → views 重新生成
  关闭项目 → Server 退出

定期审查（可选）
  $ cairn review           # 审核 staged
  $ cairn doctor           # 健康度诊断
  $ cairn stage confirm    # 确认阶段判断
```

---

## 14. 降级策略

| 场景 | 降级方案 |
|---|---|
| AI 工具不支持 MCP | Skill 读 views/（v1 兼容模式）|
| Server 没有运行 | views/ 保留上次生成的快照 |
| 完全离线 | CLI 独立运行 cairn status / review / doctor |

---

## 15. 版本路线

### v0.1.0 — Alpha Skeleton：完整闭环版

> 所有核心模块都存在，系统能完整跑通。每个智能模块用规则实现。

交付清单：

```
目录结构
  .cairn/ 完整 6 个子目录

Schemas
  MemoryEntry / Signal / StagedEntry / StageSnapshot / SessionRecord / Config

Trust Router
  规则版 L0-L3 四级路由

Git 耳朵
  revert / dependency-removed / dependency-replaced /
  large-file-movement / commit-frequency / new-contributor

对话耳朵
  cairn_signal() 完整实现
  cairn_session_end() 基础整理

Memory Engine
  memory → views 自动生成
  重复合并
  冲突标记

MCP Tools（6 个）
  cairn_context (stable)
  cairn_signal (stable)
  cairn_session_end (stable)
  cairn_status (stable)
  cairn_plan (experimental)
  cairn_doctor (experimental)

CLI
  cairn init（两步式）
  cairn status / review / doctor

Stage Advisory
  规则版阶段推断（advisory only）

Views Engine
  output.md + domains/*.md + stage.md 自动生成
  v1 Skill 兼容
```

不做深的地方：
- 不做复杂 LLM 自动总结
- 不做强阶段约束
- 不做复杂语义冲突检测
- 不做复杂记忆压缩
- 不做完全自治写入（L3 条件严格）

### v0.1 Implementation Order

实现顺序决定了系统是否能从第一天就跑通闭环。
严格按以下顺序实现，避免从 cairn_plan 或 Stage Engine 开始写导致核心闭环没先跑通。

```
Step 1:  项目骨架 + CLI 入口 + MCP Server 入口
Step 2:  Zod Schemas（MemoryEntry / Signal / StagedEntry / Config / StageSnapshot / SessionRecord）
Step 3:  .cairn/ 初始化目录生成（cairn init 最基础版）
Step 4:  Memory Store / Signal Store / Staged Store / State Store（YAML 文件读写层）
Step 5:  Views Engine（memory/ → views/output.md + views/domains/*.md + views/stage.md）
Step 6:  cairn_context（MCP 工具，AI 能拿到约束上下文）
Step 7:  Trust Router（四级路由规则版）
Step 8:  cairn_signal（对话耳朵，信号经 Trust Router 分流）
Step 9:  cairn review（staged → memory 审核流 + views 重新生成）
Step 10: Git Ear（启动时扫描 git 变更，产出候选信号）
Step 11: Stage Advisory Engine（规则版阶段推断）
Step 12: cairn_session_end（会话整理 + 批量信号处理）
Step 13: cairn_status / cairn_doctor（状态查看 + 健康度诊断）
Step 14: cairn_plan experimental（只读历史感知规划框架）
Step 15: 集成测试：signal → route → memory → views → context 全链路
```

**Step 1-6 完成后系统可以读。Step 7-9 完成后系统可以写。Step 10-15 完成后系统完整。**

### v0.2.0 — Signal Quality

```
Git 耳朵增强：依赖替换识别、文件路径 domain mapping、commit message pattern
对话信号去重、候选积累升级、routing_reason 增强
signal_refs 合并
```

### v0.3.0 — Stage Engine

```
多维阶段信号：项目年龄、commit trend、dependency trend、new file ratio、
test file ratio、contributor trend、对话任务分布
stage confidence 增强
stage confirmed override
```

### v0.4.0 — Plan Engine

```
cairn_plan() 从 experimental → stable
历史 × 阶段 × domain 交叉推理
no-go conflict warning
revisit condition check
open question warning
```

### v0.5.0 — Memory Maintenance

```
L3 auto-write 放宽条件
memory merge 增强
stale detection
conflict graph
superseded memory
archive policy
doctor 增强
```

### v1.0.0 — Autonomous Project Memory

```
长期运行验证
记忆不腐烂
AI 建议质量提升可量化
跨工具可用
稳定 API
官方工作流文档
```

---

## 16. 技术选型

| 组件 | 选型 | 原因 |
|---|---|---|
| Server 语言 | TypeScript | MCP SDK 最成熟，npm 分发 |
| MCP 协议 | stdio transport | 无需 HTTP，AI 工具原生支持 |
| 记忆存储 | YAML 文件 | git 可追踪，人类可读，无需数据库 |
| 索引 | 内存构建（启动加载）| 记忆量 < 1000 条，无需数据库 |
| Git 分析 | simple-git (npm) | 轻量，跨平台 |
| 阶段判断 | 规则引擎 | 初期不依赖 LLM |
| Views 生成 | Markdown 模板 | v1 格式兼容 |
| Schema 校验 | Zod (TypeScript) | 类型安全，运行时校验 |
| 测试 | Vitest | 和 v1 MCP 测试一致 |

---

## 17. 成功标准

1. **用户从不手写记忆** — 所有记忆由 Server 自动或半自动产生
2. **AI 建议质量可感知提升** — 使用 Cairn 后 AI 更少提被否决的方案
3. **项目记忆不腐烂** — 三个月后记忆仍然准确、有用、无矛盾
4. **换工具不丢记忆** — .cairn/ 跟着 repo 走，换 AI 工具无缝衔接
5. **完整闭环可运行** — v0.1 就能跑通 signal → route → memory → views → context 全链路
