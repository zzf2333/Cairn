[English](DESIGN.md) | 中文

# Cairn — 设计文档 (V3)

> 状态：AI 原生工程认知引擎。

---

## 命名由来

Cairn（石堆）是登山者在岔路口和山顶堆起的一组石头。在 GPS 出现之前，登山者通过在关键位置堆石来标记进度：这条路可以走，那条山脊是死路，这里要转弯。后来的旅行者不必重新发现每一个弯路。所有前人的判断已经堆叠在路边。

这正是 Cairn 对 AI 编程助手所扮演的角色。

每个演化事件是一块石头。每条被拒路径是一块石头。每次认知创伤是一块石头。石堆越完整，之后来的人——无论是新的人类开发者，还是开始新会话的 AI——就越不可能偏离方向。

---

## 问题所在

软件项目通过路径依赖积累约束。AI 编程工具无法感知这一点——它们在会话之间没有记忆。结果是一个循环往复的模式：AI 不断重新提出已经被尝试并拒绝的方向。

这不是模型能力问题。AI 需要的信息不以它可以使用的形式存在。文档是为人类编写的。ADR 描述了做了什么决定，但不会告诉 AI 避免提出什么建议，或者在什么条件下过去的拒绝值得重新考虑。

---

## V3 架构：认知热力学

V3 将项目记忆建模为一个热力学系统，包含六个持续过程：

1. **沉积** — 信号进入并积累（Git 耳朵、对话耳朵、校准耳朵）
2. **路由** — Trust Router 分配 Gravity（G0–G3）并路由至 Blood 或 Staged
3. **激活** — 因果检索管线：Task → Skeleton → Capillary → Blood → DNA → Context
4. **衰减** — 未使用的事件老化并变为陈旧；创伤事件豁免
5. **压缩** — 重复模式压缩为 DNA 特征
6. **复活** — 持续被引用的归档事件被恢复

### 核心数据结构

| 结构 | 角色 | 存储 |
|------|------|------|
| **Skeleton** | 域所有权映射（role, owns, does_not_own, causal_keywords） | `skeleton/` |
| **Blood** | 演化事件——带完整生命周期的认知原子 | `blood/` |
| **DNA** | 涌现的项目人格特征 | `dna/` |
| **Capillaries** | 域级约束通道（constraints, debt, rejected paths） | `domains/` |
| **Staged** | 等待人类审核的事件 | `staged/` |
| **Views** | 为 AI 消费自动生成的投影 | `views/` |

---

## Gravity 系统（G0–G3）

替代 V2 的 L0–L3 信任等级。Gravity 衡量认知信号的权重。

| 级别 | 名称 | 行为 |
|------|------|------|
| G0 | Drop | 噪声、重复——丢弃 |
| G1 | Suggestion | AI 提议，无需人类批准 |
| G2 | Reflective Challenge | AI 必须呈现推理和替代方案 |
| G3 | Hard Constraint | 进入 Blood 前需要人类批准 |

Gravity 是多维的：`architectural`、`operational`、`local`——每个维度可以是 low/medium/high。`level` 字段（G0–G3）是主路由键。

### DNA 调制

DNA 特征在路由时修改 Gravity。例如：如果 `simplicity_bias` 为 high，引入复杂框架会自动升级 Gravity。

### Trauma 调制

具有创伤事件的域会永久提升该域新信号的 Gravity。

---

## Trust Router v3

所有信号必须经过 Trust Router。没有信号可以绕过它。

```
信号进入 Trust Router
  │
  ├→ 重复？→ 合并到已有事件 → 丢弃
  │
  ├→ 治理硬规则？（G3、DNA 变更、创伤）→ staged + human_ratified
  │
  ├→ 创伤域？→ 升级 Gravity
  │
  ├→ DNA 调制？→ 基于人格特征调整 Gravity
  │
  ├→ Gravity 路由：
  │     G0 → 丢弃
  │     G1 → blood（auto 或 system_validated 取决于 cognitive_mode）
  │     G2 → staged 或 blood（取决于 cognitive_mode）
  │     G3 → staged + human_ratified
  │
  └→ 返回路由结果
```

---

## 治理：三级权限

| 层级 | 描述 | 时机 |
|------|------|------|
| `agent_proposed` | AI 写入无需验证 | lightweight 模式下 G0–G1 |
| `system_validated` | 系统检查通过，无需人类 | standard/institutional 模式下 G1 |
| `human_ratified` | 需要显式人类批准 | standard 模式下 G2+、所有创伤、所有 DNA 变更 |

### 认知模式

| 模式 | 人类批准的 G_min | 衰减速度 | DNA 证据阈值 |
|------|------------------|----------|-------------|
| `lightweight` | 仅 G3 | 快速（30/60 天） | 5 个事件 |
| `standard` | G2+ | 中等（90/120 天） | 3 个事件 |
| `institutional` | G1+ | 缓慢（180/240 天） | 3 个事件 |

---

## 认知创伤

创伤事件是永远不会衰减的永久记忆标记。它们：

- 设置 `decay_override: permanent`
- 对受影响域应用 `sensitivity_multiplier: 2.0`
- 始终要求 `human_ratified` 治理
- 影响 DNA 特征（`affects_dna: true`）

创伤域中的任何新信号都会自动升级其 Gravity。

---

## 五条一致性规则

一致性引擎验证跨子系统的连贯性：

1. **DNA-事件一致性** — 高值 DNA 特征不应与近期高 Gravity 事件矛盾
2. **No-Go 支撑** — 具有陈旧健康度的 no-go 事件是孤立约束
3. **Skeleton-现实** — Skeleton 所有权应匹配代码现实（V3.0 中为占位实现）
4. **归档复活** — 近期频繁命中的归档事件应被复活
5. **约束一致性** — 同一主题不能同时具有 avoid 和 prefer 效果

---

## 双耳设计 + 校准耳朵

### Git 耳朵

从 Git 历史中检测 revert、依赖变更、大规模重构。使用因果关键词将变更文件映射到 Skeleton 域。

### 对话耳朵

在 AI 对话中通过 `cairn_signal` MCP 工具捕获用户拒绝、约束声明、决策、债务接受。

### 校准耳朵

将代码现实与认知状态对比：检测 package.json 中仍存在的 no-go 依赖、Skeleton 漂移、DNA 不一致。

---

## Blood / Views 分离

**`blood/` 是源数据。** 每个演化事件是一个 YAML 文件，包含完整来源追溯、Gravity、生命周期元数据、创伤标记和治理状态。

**`views/` 是投影。** `output.md`、`domains/*.md` 和 `stage.md` 从 Blood 事件、Skeleton、DNA 和域 Capillaries 聚合生成。视图可随时从源数据重新生成。

### Token 预算

- `output.md` — 目标 500 tokens，硬限制 800
- `domains/*.md` — 每文件目标 300 tokens，硬限制 500

---

## 设计原则

### 1. 无头认知运行时

Cairn 存储、验证、路由。宿主 AI 解读。Cairn 没有 LLM——它是纯数据引擎加规则智能。

### 2. 人审核权不可绕过

任何改变全局行为的事件——G2+ 事件、创伤、DNA 变更——必须经过人类批准。没有配置可以绕过这道门。

### 3. 事实与推测分离

`cairn_plan` 是只读的。AI 的规划推测永远不会成为项目记忆。

### 4. 通过 Gravity 渐进信任

信号以评估的 Gravity 进入，可能被 DNA/创伤调制升级，并相应路由。没有跳过治理检查的机制。

### 5. 认知不腐烂

六个持续过程（沉积、路由、激活、衰减、压缩、复活）维持热力学平衡。`cairn_doctor` 验证一致性。

---

## 工具兼容性

Cairn 以 MCP Server（stdio 传输）运行。11 个工具构成完整的认知生命周期：初始化、上下文激活、信号捕获、会话管理、治理审核和健康诊断。

对不支持 MCP 的 AI 工具，`views/` 通过 Skill 适配文件提供降级路径。

| 工具 | MCP 支持 | 降级方案 |
|------|----------|----------|
| Claude Code | 原生 MCP | views/ via CLAUDE.md |
| Cursor | 原生 MCP | views/ via cairn.mdc |
| Cline / Roo Code | 原生 MCP | views/ via .clinerules |
| Windsurf | 原生 MCP | views/ via .windsurfrules |
| GitHub Copilot | — | views/ via copilot-instructions.md |
| Codex CLI | — | views/ via AGENTS.md |
| Gemini CLI | — | views/ via GEMINI.md |
