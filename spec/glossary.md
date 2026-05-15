# Cairn Glossary / 术语表

Bilingual reference for core Cairn V3 concepts. All Chinese translations in `.zh.md` documents must follow this table.

## Core Concepts

| English | 中文 | Notes |
|---------|------|-------|
| path-dependency | 路径依赖 | Core concept: past decisions constrain future choices |
| cognitive thermodynamics | 认知热力学 | V3 architecture model: project memory as a thermodynamic system |
| constraint system | 约束系统 | What Cairn is |
| no-go | 禁区方向 | Technical directions AI must never suggest |
| accepted debt | 已接受的技术债 | Known issues intentionally left in place, with `revisit_when` |
| known pitfalls | 已知陷阱 | Operational traps to avoid |
| cognitive mode | 认知模式 | Project governance level: lightweight / standard / institutional |

## Architecture

| English | 中文 | Notes |
|---------|------|-------|
| dual-ear design | 双耳设计 | Architecture using Git, conversation, and calibration signal sources |
| Git ear | Git 耳朵 | Signal source: scans git history for revert, dependency, refactor patterns |
| conversation ear | 对话耳朵 | Signal source: AI reports signals via `cairn_signal()` |
| calibration ear | 校准耳朵 | Signal source: compares code reality against cognitive state |
| Trust Router | 信任路由 | Engine that routes signals through Gravity system to blood or staged |
| Gravity | 引力 | G0–G3 signal weight system replacing V2 trust levels |
| G0 Drop | G0 丢弃 | Signal is noise or duplicate, discarded |
| G1 Suggestion | G1 建议 | AI proposes, no human approval needed |
| G2 Reflective Challenge | G2 反思质询 | AI must present reasoning and alternatives |
| G3 Hard Constraint | G3 硬约束 | Requires human ratification before entering blood |
| Skeleton | 语义能力结构 | Domain ownership map — role, owns, does_not_own, causal_keywords |
| Blood | 演化事件 | The cognitive atom — evolution events with full lifecycle metadata |
| DNA | 项目人格 | Emergent project personality traits compressed from repeated patterns |
| Capillaries | 域认知通道 | Per-domain constraint channels: constraints, debt, rejected paths |
| Activation Engine | 激活引擎 | Causal retrieval: Task → Skeleton → Capillary → Blood → DNA → Context |
| Challenge Engine | 质询引擎 | Produces reflective challenges for areas with known constraints |
| Stage Engine | 阶段引擎 | Engine that infers project lifecycle phase |
| Decay Engine | 衰减引擎 | Ages stale blood events based on cognitive mode |
| Compression Engine | 压缩引擎 | Identifies DNA trait candidates from repeated blood patterns |
| Resurrection Engine | 复活引擎 | Detects access patterns warranting archived event resurrection |
| Consistency Engine | 一致性引擎 | Validates cross-subsystem consistency (5 rules) |
| Views Engine | 视图引擎 | Regenerates `views/` from blood, skeleton, DNA, and capillaries |
| Governance Engine | 治理引擎 | Permission checks and audit log writes |
| Blood Engine | Blood 引擎 | Blood write orchestration |
| MCP (Model Context Protocol) | MCP 协议 | Cross-tool protocol for AI tool communication |

## Data Model

| English | 中文 | Notes |
|---------|------|-------|
| evolution event | 演化事件 | Formal YAML record in `.cairn/blood/` — V3 cognitive atom |
| skeleton node | Skeleton 节点 | Domain ownership definition in `.cairn/skeleton/` |
| DNA identity | DNA 身份 | Emergent personality traits in `.cairn/dna/identity.yaml` |
| DNA imprint | DNA 印记 | Inherited traits for forked projects in `.cairn/dna/imprint.yaml` |
| domain capillary | 域认知通道 | Per-domain constraints/debt/rejected paths in `.cairn/domains/` |
| signal | 信号 | Raw event: GitSignal, ConversationSignal, or CalibrationSignal |
| staged entry | 待审条目 | Entry in `.cairn/staged/` awaiting human review |
| views | 视图 | Auto-generated projections from blood for AI consumption |
| session record | 会话记录 | Audit record in `.cairn/sessions/` |
| behavior_effect | 行为约束 | How an event changes AI behavior: `avoid_suggestion`, `prefer_approach`, `warn_before`, `require_review` |
| gravity (multi-dimensional) | 引力（多维） | architectural, operational, local — each low/medium/high |
| lifecycle | 生命周期 | Event validity: transient, tactical, strategic, identity |
| trauma | 认知创伤 | Permanent domain sensitivity marker, never decays |
| governance status | 治理状态 | agent_proposed, system_validated, or human_ratified |
| stage advisory | 阶段建议 | Non-binding phase inference (`advisory` vs `confirmed`) |
| config.yaml | 项目配置 | Project-level configuration (cognitive_mode, stage override) |
| state.yaml | 运行状态 | Server runtime state (last scan, stage snapshot) |

## File Structure

| English | 中文 | Notes |
|---------|------|-------|
| `.cairn/skeleton/` | Skeleton 目录 | Domain ownership maps (one YAML per domain) |
| `.cairn/blood/` | Blood 目录 | Evolution events (YAML) — source of truth |
| `.cairn/dna/` | DNA 目录 | Project personality (identity.yaml + imprint.yaml) |
| `.cairn/domains/` | 域通道目录 | Per-domain capillaries (constraints, debt, rejected paths) |
| `.cairn/signals/` | 信号目录 | Raw signals (raw_git/, raw_conversation/, raw_calibration/) |
| `.cairn/staged/` | 待审目录 | Entries pending human review |
| `.cairn/governance/` | 治理目录 | Policy and audit log |
| `.cairn/views/` | 视图目录 | Auto-generated projections (Markdown) |
| `.cairn/sessions/` | 会话目录 | Session audit records |
| token budget | Token 预算 | Size limit for generated views |

## Operations

| English | 中文 | Notes |
|---------|------|-------|
| bootstrap | 自动初始化 | `cairn init --empty` creates empty `.cairn/` structure |
| two-phase init | 两阶段初始化 | `cairn_init_status` checks state, `cairn_init_commit` writes initial cognition |
| cairn_init_status | 初始化状态检查 | MCP tool: checks project state for initialization |
| cairn_init_commit | 初始化提交 | MCP tool: writes initial skeleton, blood, DNA, stage in one batch |
| cairn_context | 上下文激活 | MCP tool: activation + challenge for current task |
| cairn_signal | 信号捕获 | MCP tool: conversation ear captures user signals |
| cairn_session_end | 会话结束 | MCP tool: triggers decay, compression, resurrection, views regeneration |
| cairn_status | 状态查看 | MCP tool: project status overview |
| cairn_plan | 规划顾问 | MCP tool: read-only historical constraints for planning |
| cairn_stage_list | 待审列表 | MCP tool: list staged entries for review |
| cairn_stage_accept | 接受待审 | MCP tool: accept staged entry into blood |
| cairn_stage_reject | 拒绝待审 | MCP tool: reject staged entry |
| cairn_doctor | 健康诊断 | MCP tool: consistency, decay, resurrection checks |
| slug | 文件名标识符 | ASCII short identifier in filenames |

## Other Terms

| English | 中文 | Notes |
|---------|------|-------|
| skill adapter | Skill 适配文件 | Per-tool behavior instructions for non-MCP fallback |
| trajectory | 发展轨迹 | Chronological list of evolution events |
| rejected paths | 被拒路径 | Directions evaluated and excluded |
| DNA modulation | DNA 调制 | DNA traits modify gravity at routing time |
| trauma modulation | Trauma 调制 | Trauma domains permanently increase gravity for new signals |
| sedimentation | 沉积 | Signals enter and accumulate |
| activation | 激活 | Causal retrieval pipeline |
| decay | 衰减 | Unused events age and become stale |
| compression | 压缩 | Repeated patterns compress into DNA traits |
| resurrection | 复活 | Archived events revived by access patterns |
| human-in-the-loop | 人工审核 | Principle that AI proposes, humans approve |
| sensitivity_multiplier | 灵敏度倍增器 | Trauma domain gravity modifier (default 2.0) |
