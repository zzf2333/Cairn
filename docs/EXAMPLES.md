# Examples

> 三个典型项目的脱敏 `.cairn/` 片段,展示不同阶段 Cairn 应该长什么样。
>
> 这些是**说明性的样本**,不是要拷贝粘贴的模板。真实 `.cairn/` 是 AI 在长期使用中自然涌现的,不应手写。

---

## 1. 小型项目 — 刚启动的 side project

**特征**:5 个 blood event 以内,1-2 个 domain,没 DNA,exploration 阶段。

### `.cairn/config.yaml`
```yaml
version: "3.0"
project:
  name: "url-shortener"
  created: "2026-04"
domains: ["api-layer", "data-layer"]
cognitive_mode: "lightweight"
stage: { override: null }
```

### `.cairn/blood/evo_001.yaml`(典型 decision)
```yaml
id: evo_001
time: "2026-04-15"
domain: "data-layer"
type: "architecture_decision"
gravity: { level: "G1" }
subject: { name: "sqlite" }
decision_or_change: "Use SQLite as initial storage, defer postgres"
rejected_paths:
  - path: "postgres"
    reason: "operational overhead too high for prototype phase"
behavior_effect:
  type: "prefer_approach"
  instruction: "Use SQLite. Postgres migration is later."
lifecycle: { validity: "tactical", decay_policy: "downgrade" }
health: { state: "ok" }
trauma: { is_trauma: false }
```

### `cairn doctor --metrics` 典型输出
```
.cairn health:
  cairn_version:       0.4.0
  blood events:        3 (3 active, 0 archived, 0 trauma)
  DNA identity:        not_yet_emerged
  DNA traits:          0 (none)
  staged backlog:      1
  last session_end:    2 days ago
  stage:               exploration (confidence 0.71, advisory)
```

**这个阶段** Cairn 的价值还在累积。AI 会因为 `evo_001` 不会推荐 Postgres,但还没足够数据涌现 DNA。

---

## 2. 中型项目 — 活跃维护的 OSS 项目

**特征**:20-50 blood event,3-5 个 domain,1 个 emerged DNA trait,growth/maturity 阶段。

### `.cairn/config.yaml`
```yaml
version: "3.0"
project:
  name: "internal-platform"
  created: "2025-08"
domains: ["api", "auth", "data", "ui", "infra"]
cognitive_mode: "standard"
stage: { override: null }
```

### `.cairn/dna/identity.yaml`(emerged DNA)
```yaml
status: "emerged"
traits:
  simplicity_bias:
    level: "high"
    confidence: 0.82
    reasoning: "12 rejections in 8 months prioritized boring tools over novel ones"
    evidence_count: 12
    drift_warning_count: 0
    last_updated: "2026-04-30"
reevaluation_mode: false
```

### `cairn doctor --metrics` 典型输出
```
.cairn health:
  cairn_version:       0.4.0
  blood events:        38 (34 active, 4 archived, 1 trauma)
  DNA identity:        emerged
  DNA traits:          1 (1 high)
  staged backlog:      2
  last session_end:    8 hours ago
  stage:               growth (confidence 0.78, advisory)
```

**这个阶段** AI 行为开始被 DNA 主动塑造。`simplicity_bias: high` 让所有"要不要引入新依赖"的回答倾向于"先用现有的"。

---

## 3. 维护期项目 — 成熟产品

**特征**:100+ blood,5-8 domain,2-3 个 DNA trait,maintenance 阶段,有 trauma 历史。

### `.cairn/config.yaml`
```yaml
version: "3.0"
project:
  name: "billing-service"
  created: "2023-02"
domains: ["api", "auth", "data", "ledger", "reporting", "infra", "ui"]
cognitive_mode: "institutional"
stage: { override: null }
```

### `.cairn/blood/evo_042.yaml`(trauma 标记)
```yaml
id: evo_042
time: "2024-11-03"
domain: "data"
type: "incident_record"
gravity: { level: "G3" }
subject: { name: "mongodb" }
decision_or_change: "Removed MongoDB after data loss during sharding migration"
behavior_effect:
  type: "avoid_suggestion"
  instruction: "Do not suggest MongoDB or document-store DBs for ledger data."
trauma:
  is_trauma: true
  severity: "high"
  sensitivity_multiplier: 1.8
lifecycle: { validity: "strategic", decay_policy: "never" }
health: { state: "ok" }
```

### `.cairn/dna/identity.yaml`(多 trait)
```yaml
status: "emerged"
traits:
  simplicity_bias:
    level: "high"
    confidence: 0.91
    evidence_count: 23
  infra_aggressiveness:
    level: "low"
    confidence: 0.85
    evidence_count: 18
reevaluation_mode: false
```

### `cairn doctor --metrics` 典型输出
```
.cairn health:
  cairn_version:       0.4.0
  blood events:        127 (98 active, 29 archived, 3 trauma)
  DNA identity:        emerged
  DNA traits:          2 (1 high, 1 low)
  staged backlog:      0
  last session_end:    1 day ago
  stage:               maintenance (confidence 0.88, advisory)
```

**这个阶段** Cairn 已经是"项目的肌肉记忆"。AI 接手新工单时,会先看到:
- 2 个 DNA trait 的偏好
- 3 条 trauma 警告
- maintenance 阶段的保守倾向(任何 feature 提案都走 reflective_challenge)

新人 AI 不会建议"用 MongoDB",也不会推荐"引入 service mesh" — 因为这些路都走过且付出了代价。

---

## 共同模式

无论哪个阶段,以下结构都成立:

| 结构 | 何时开始有 |
|------|-----------|
| `config.yaml` + `skeleton/` | 项目第 1 天 |
| `blood/` 几条 | 1 周内 |
| `staged/` 偶尔有 | 第 2 周起 |
| DNA trait emerged | 通常 3+ 月,evidence ≥ 3-5 |
| `dna/staged/` 候选 | DNA 出现之前的过渡 |
| Trauma 标记 | 真出过事故才标 — 不要为了演示而标 |
| `views/output.md` | 始终有,自动生成,AI 在 MCP 不可用时降级读 |

---

## 不要做的事

- **不要手动编辑 `blood/*.yaml`** — 它们是 trust router 写入的产物。手改会破坏因果链
- **不要给 DNA staged 自动接受** — 一个错的 trait 会静默扭曲所有未来决策
- **不要把 `.cairn/` 加入 `.gitignore`** — 它是项目认知的存档,必须 tracked
- **不要为了"演示"而手动写一堆 trauma 标记** — trauma 是真实事故的产物,不是装饰
