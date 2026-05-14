[English](FORMAT.md) | 中文

# Cairn 格式规范

`.cairn/` 目录 YAML schema 格式的权威参考文档，适用于 Cairn 动态记忆引擎。

---

## 目录结构

```
.cairn/
├── config.yaml          # 项目配置
├── state.yaml           # 运行状态（含阶段快照）
├── signals/             # L1 候选信号（YAML）
├── staged/              # L2 待审条目（YAML）
├── memory/              # 正式记忆（YAML）— 数据源
├── views/               # 自动生成的视图（Markdown，只读）
│   ├── output.md        # 全局约束视图
│   ├── stage.md         # 阶段建议
│   └── domains/         # 域视图
│       └── <name>.md
└── sessions/            # 会话记录（YAML）
```

| 目录 | 写入者 | 读取者 | 生命周期 |
|------|--------|--------|---------|
| config.yaml | 人类（init 时 + 手动调整） | Server | 长期稳定 |
| state.yaml | Server | Server | 每次启动更新 |
| signals/ | 双耳经 Trust Router | Trust Router | 积累后升级或过期丢弃 |
| staged/ | Trust Router | 人类（通过 `cairn_review` MCP 工具） | 审核后写入 memory 或丢弃 |
| memory/ | `cairn_review` / L3 自动写入 | Views Engine、MCP Tools | 长期持久 |
| views/ | Views Engine（自动） | AI（MCP 或 Skill） | memory 变更后重新生成 |
| sessions/ | Server（session_end 时） | 审计 / 回溯 | 可定期清理 |

---

## config.yaml

项目级配置。首次使用时自动创建（bootstrap），之后极少变动。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| version | string | `"2.0"` | Schema 版本 |
| project.name | string | 必填 | 项目名称 |
| project.created | string | 必填 | 项目创建时间（YYYY-MM） |
| domains.locked | string[] | `[]` | 锁定的域列表 |
| trust_policy.L3_auto_write | string[] | 见下方 | 自动写入 memory 的规则 |
| trust_policy.L2_staged | string[] | 见下方 | 强制进入待审的规则 |
| trust_policy.never_auto | string[] | 见下方 | 永远需要人工审核的硬规则 |
| stage.override | string \| null | `null` | 手动覆盖阶段 |
| stage.auto_constraint | boolean | `false` | 阶段是否产生硬约束 |

### 示例

```yaml
version: "2.0"

project:
  name: "my-saas"
  created: "2023-01"

domains:
  locked:
    - api-layer
    - auth
    - state-management

trust_policy:
  L3_auto_write:
    - "source.kind == 'git-revert' AND scope == 'local'"
    - "source.kind == 'git-dependency' AND type == 'rejection' AND scope == 'local'"
  L2_staged:
    - "scope == 'global'"
    - "type == 'transition' AND affects_output == true"
  never_auto:
    - "New global no-go"
    - "Stage change"
    - "Output-level stack change"
    - "scope == 'global' behavior_effect"

stage:
  override: null
  auto_constraint: false
```

---

## Signal

双耳（Git / 对话）捕获的原始信号，路由前的原始形态。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | string | 必填 | 信号唯一 ID |
| source_ear | `"git"` \| `"conversation"` | 必填 | 信号来源 |
| signal_type | enum | 必填 | `dependency-removed`、`dependency-replaced`、`revert`、`large-refactor`、`user-rejection`、`user-constraint`、`historical-reference`、`stage-signal`、`decision`、`debt-acceptance` |
| raw_data | Record<string, unknown> | `{}` | 原始证据数据 |
| inferred.probable_type | string | 可选 | 推断的记忆类型 |
| inferred.probable_domain | string | 可选 | 推断的目标域 |
| inferred.confidence | `"high"` \| `"medium"` \| `"low"` | `"medium"` | 推断置信度 |
| routing.level | `"L0"` \| `"L1"` \| `"L2"` \| `"L3"` | 可选 | 分配的路由级别 |
| routing.reason | string | 可选 | 路由原因 |
| captured_at | string (ISO 8601) | 必填 | 捕获时间戳 |

### 示例

```yaml
# .cairn/signals/sig_2026_05_11_001.yaml

id: sig_2026_05_11_001
source_ear: git
signal_type: dependency-removed
raw_data:
  package: tRPC
  appeared: "2024-02-15"
  disappeared: "2024-03-02"
  related_commits:
    - a1b2c3d
    - e4f5g6h
inferred:
  probable_type: rejection
  probable_domain: api-layer
  confidence: high
routing:
  level: L3
  reason: "git-revert + local scope -> auto-write eligible"
captured_at: "2026-05-11T08:00:00Z"
```

---

## StagedEntry

等待人工审核的条目。Trust Router 分配 L2 时创建。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | string | 必填 | 待审条目唯一 ID |
| origin_signal | string | 必填 | 来源信号 ID |
| draft_memory | DraftMemory | 必填 | 草拟的记忆内容（见下方） |
| review_status | `"pending"` \| `"accepted"` \| `"rejected"` \| `"expired"` | `"pending"` | 审核状态 |
| routing_reason | string | 必填 | 路由到 staged 的原因 |
| created_at | string (ISO 8601) | 必填 | 创建时间戳 |

### DraftMemory

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | enum | 必填 | `MEMORY_TYPES` 之一 |
| domain | string | 必填 | 目标域 |
| scope | `"local"` \| `"global"` | `"local"` | 影响范围 |
| subject.name | string | 必填 | 主题标识 |
| subject.category | string | 可选 | 主题分类 |
| summary | string | 必填 | 一句话摘要 |
| behavior_effect.type | enum | 必填 | `BEHAVIOR_EFFECT_TYPES` 之一 |
| behavior_effect.instruction | string | 必填 | AI 应做的行为改变 |
| confidence.level | `"high"` \| `"medium"` \| `"low"` | `"medium"` | 置信度 |

### 示例

```yaml
# .cairn/staged/staged_2026_05_11_api_trpc.yaml

id: staged_2026_05_11_api_trpc
origin_signal: sig_2026_05_11_001
draft_memory:
  type: rejection
  domain: api-layer
  scope: local
  subject:
    name: tRPC
    category: api-framework
  summary: "tRPC 试用后移除"
  behavior_effect:
    type: avoid_suggestion
    instruction: "不要建议迁移到 tRPC"
  confidence:
    level: medium
review_status: pending
routing_reason: "全局影响，需人工审核"
created_at: "2026-05-11T08:00:00Z"
```

---

## MemoryEntry

正式记忆 — 数据源。`memory/` 中每个文件对应一条记忆。

### 记忆类型

| 类型 | 说明 |
|------|------|
| `decision` | 做出了技术选择 |
| `rejection` | 排除了一个方向 |
| `transition` | 方案从 A 变为 B |
| `debt` | 接受了一项技术债 |
| `experiment` | 探索性尝试已结束 |

### 行为效应类型

| 类型 | AI 指令 |
|------|---------|
| `avoid_suggestion` | 不要建议此方向 |
| `prefer_approach` | 优先推荐此方案 |
| `warn_before` | 操作前先警告风险 |
| `require_review` | 建议前必须读域历史 |

### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | string | 必填 | 记忆唯一 ID |
| type | enum | 必填 | `MEMORY_TYPES` 之一 |
| domain | string | 必填 | 域键 |
| scope | `"local"` \| `"global"` | `"local"` | 影响范围 |
| status | `"active"` \| `"superseded"` \| `"archived"` | `"active"` | 生命周期状态 |
| health.state | `"ok"` \| `"stale"` \| `"conflicted"` | `"ok"` | 当前健康度 |
| health.reason | string \| null | `null` | 不健康时的原因 |
| confidence.level | `"high"` \| `"medium"` \| `"low"` | `"high"` | 置信度 |
| confidence.score | number (0-1) | 可选 | 数值分数 |
| confidence.reason | string | 可选 | 置信度理由 |
| source.kind | `"git-revert"` \| `"git-dependency"` \| `"conversation"` \| `"manual"` | 必填 | 来源类型 |
| source.refs | Array<{type, id}> | 必填 | 引用列表；type 为 `"commit"` \| `"session"` \| `"file"` \| `"manual"` |
| source.captured_at | string (ISO 8601) | 必填 | 捕获时间 |
| subject.name | string | 必填 | 主题标识 |
| subject.category | string | 可选 | 主题分类 |
| summary | string | 必填 | 一句话摘要 |
| rejected | {what, reason} | 可选 | 被拒绝的内容及原因 |
| chosen | {what, reason} | 可选 | 被选择的内容及原因 |
| behavior_effect.type | enum | 必填 | `BEHAVIOR_EFFECT_TYPES` 之一 |
| behavior_effect.instruction | string | 必填 | 具体的 AI 行为指令 |
| revisit.when | string[] | `[]` | 重新评估条件 |
| revisit.status | `"not_met"` \| `"possibly_met"` \| `"met"` | `"not_met"` | 当前重评状态 |
| relations.related | string[] | `[]` | 关联的记忆 ID |
| relations.conflicts | string[] | `[]` | 冲突的记忆 ID |
| created_at | string (ISO 8601) | 必填 | 创建时间戳 |
| updated_at | string (ISO 8601) | 必填 | 最后更新时间戳 |

### 示例

```yaml
# .cairn/memory/mem_2024_03_api_tRPC_rejection.yaml

id: mem_2024_03_api_tRPC_rejection
type: rejection
domain: api-layer
scope: local

status: active

health:
  state: ok
  reason: null

confidence:
  level: high
  score: 0.86
  reason: "用户明确拒绝 + git revert 证据"

source:
  kind: git-revert
  refs:
    - type: commit
      id: a1b2c3d
    - type: session
      id: sess_2024_03_15_001
  captured_at: "2024-03-15T10:00:00Z"

subject:
  name: tRPC
  category: api-framework

summary: "tRPC 试用两周后回退，与现有 REST 客户端集成成本过高"

rejected:
  what: "tRPC 迁移"
  reason: "REST 客户端改造代价超过 tRPC 类型安全收益"

chosen:
  what: "REST + OpenAPI"
  reason: "适合当前客户端和团队工作流"

behavior_effect:
  type: avoid_suggestion
  instruction: "不要建议迁移到 tRPC，除非 revisit 条件满足"

revisit:
  when:
    - "现有 REST 客户端全部替换"
    - "启动全新的 greenfield API 服务"
  status: not_met

relations:
  related:
    - mem_2024_03_api_openapi_decision
  conflicts: []

created_at: "2024-03-15T10:00:00Z"
updated_at: "2024-03-15T10:00:00Z"
```

---

## StageSnapshot

存储在 `state.yaml` 的 `stage` 键下。表示推断的项目生命周期阶段。

### 阶段类型

| 阶段 | 说明 |
|------|------|
| `exploration` | 早期，依赖变动频繁，快速试验 |
| `growth` | 功能速度提升，架构逐步稳定 |
| `maturity` | 架构稳定，变更以增量为主 |
| `maintenance` | 低活跃度，主要是修 bug 和更新依赖 |

### 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| phase | enum | 必填 | `STAGE_PHASES` 之一 |
| confidence | number (0-1) | 必填 | 推断置信度 |
| status | `"advisory"` \| `"confirmed"` | `"advisory"` | 是否经人工确认 |
| evidence | Array<{source, signal}> | `[]` | 支撑证据 |
| guidance | string[] | `[]` | 阶段性建议 |
| last_updated | string (ISO 8601) | 必填 | 最后更新时间戳 |

### 示例

```yaml
# .cairn/state.yaml 中

stage:
  phase: growth
  confidence: 0.68
  status: advisory
  evidence:
    - source: git
      signal: "近 3 个月依赖变更减少"
    - source: git
      signal: "提交频率稳定在 12 次/周"
    - source: conversation
      signal: "用户请求以功能添加为主"
  guidance:
    - "平衡速度与稳定性"
    - "新增依赖需要评估维护成本"
  last_updated: "2026-05-11T08:00:00Z"
```

---

## SessionRecord

每次 AI 会话的审计记录。`sessions/` 中每个文件对应一次会话。

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | string | 必填 | 会话 ID |
| started_at | string (ISO 8601) | 必填 | 会话开始时间 |
| ended_at | string (ISO 8601) | 必填 | 会话结束时间 |
| summary | string | 必填 | 会话摘要 |
| signals_captured | number | `0` | 捕获的信号总数 |
| signals_routed.L0 | number | `0` | 丢弃的信号数 |
| signals_routed.L1 | number | `0` | 进入候选池的信号数 |
| signals_routed.L2 | number | `0` | 进入待审的信号数 |
| signals_routed.L3 | number | `0` | 自动写入的信号数 |
| domains_touched | string[] | `[]` | 涉及的域 |
| decisions_made | string[] | `[]` | 记录的决策 |
| unresolved | string[] | `[]` | 未解决的事项 |
| context_injections | string[] | `[]` | 执行的上下文注入 |

### 示例

```yaml
# .cairn/sessions/sess_2026_05_11_001.yaml

id: sess_2026_05_11_001
started_at: "2026-05-11T10:00:00Z"
ended_at: "2026-05-11T12:30:00Z"
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
  - "cairn_context 返回域: auth, api-layer; no-go: tRPC"
```

---

## Views 生成规则

Views 是从 `memory/` 自动生成的 Markdown 投影，只读。每个视图文件以如下注释开头：

```markdown
<!--
Generated by Cairn. Do not edit manually.
Source: .cairn/memory/*.yaml
Last generated: <ISO 8601 时间戳>
-->
```

### views/output.md

全局约束快照，每次 AI 会话开始时注入。

| 章节 | 数据源筛选 |
|------|-----------|
| no-go | `scope == 'global'` 或 `behavior_effect.type == 'avoid_suggestion'`，status 为 `active` |
| stack | `type == 'decision'` 且 `status == 'active'` |
| debt | `type == 'debt'` |
| hooks | `config.yaml` 的 `domains.locked` + memory 关键词提取 |
| stage | `state.yaml` 阶段快照 |

**Token 预算：** 目标 500，硬限制 800。超限时优先保留 `behavior_effect.type == 'avoid_suggestion'` 条目。

### views/domains/\<name\>.md

按域的设计上下文，按需注入。

| 章节 | 数据源筛选 |
|------|-----------|
| trajectory | 该域所有 active 条目，按 `created_at` 排序 |
| rejected paths | `type == 'rejection'` |
| known pitfalls | `behavior_effect.type == 'warn_before'` |
| open questions | `revisit.status == 'possibly_met'` |

**Token 预算：** 每文件目标 300，硬限制 500。

### views/stage.md

阶段建议详情视图，从 `state.yaml` 阶段快照生成。包含 phase、confidence、status、evidence 列表和 guidance 列表。

---

## Trust Router

所有信号必须经过 Trust Router，无信号可绕过。

### 路由级别

| 级别 | 名称 | 存储位置 | 行为 |
|------|------|---------|------|
| L0 | Drop | 不存储 | 噪音、重复、低置信度 — 丢弃 |
| L1 | Candidate | signals/ | 积累；证据充足后升级 |
| L2 | Staged | staged/ | 等待人工审核 |
| L3 | Auto-write | memory/ | 严格条件下自动写入 |

### 路由流程

```
信号进入 Trust Router
  |
  +-> 重复检测？（同 domain + 同 subject）
  |     是 -> 合并到已有条目的 source.refs -> L0
  |     否 -> 继续
  |
  +-> 命中硬规则 L2？（never_auto 列表）
  |     是 -> 写入 staged/（无论来源多可靠）
  |     否 -> 继续
  |
  +-> 命中配置 L2？（trust_policy.L2_staged 匹配）
  |     是 -> 写入 staged/
  |     否 -> 继续
  |
  +-> 命中配置 L3？（trust_policy.L3_auto_write 匹配）
  |     是 -> 写入 memory/ -> 触发 views 重新生成
  |     否 -> 继续
  |
  +-> 置信度判断
  |     >= medium -> L1（写入 signals/）
  |     < medium  -> L0（丢弃）
  |
  +-> L1 积累逻辑
        同 domain + 同 subject 的 L1 信号 >= 3（L1_ACCUMULATION_THRESHOLD）
        -> 自动升级为 L2 staged
```

**硬规则：L2 安全规则始终优先于 L3 自动写入规则。**

### 硬规则（不可配置）

- 新增全局 no-go -> 永远 L2
- 阶段变更 -> 永远 L2
- `scope == 'global'` 的 behavior_effect -> 永远 L2
- `never_auto` 列表中的任何条目 -> 永远 L2

---

## ID 命名规范

| 实体 | 模式 | 示例 |
|------|------|------|
| Signal | `sig_<YYYY_MM_DD>_<seq>` | `sig_2026_05_11_001` |
| StagedEntry | `staged_<YYYY_MM_DD>_<domain>_<slug>` | `staged_2026_05_11_api_trpc` |
| MemoryEntry | `mem_<YYYY_MM>_<domain>_<slug>` | `mem_2024_03_api_tRPC_rejection` |
| Session | `sess_<YYYY_MM_DD>_<seq>` | `sess_2026_05_11_001` |

域键使用 `kebab-case`。域列表在初始化时锁定。

