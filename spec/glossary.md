# Cairn Glossary / 术语表

Bilingual reference for core Cairn concepts. All Chinese translations in `.zh.md` documents must follow this table.

## Core Concepts

| English | 中文 | Notes |
|---------|------|-------|
| path-dependency | 路径依赖 | Core concept: past decisions constrain future choices |
| constraint system | 约束系统 | What Cairn is |
| no-go | 禁区方向 | Technical directions AI must never suggest |
| accepted debt | 已接受的技术债 | Known issues intentionally left in place, with `revisit_when` |
| known pitfalls | 已知陷阱 | Operational traps to avoid |
| reactive operation | 响应式操作 | Maintaining `.cairn/` in response to events, not on a schedule |

## Architecture

| English | 中文 | Notes |
|---------|------|-------|
| dual-ear design | 双耳设计 | Architecture using both Git and conversation signal sources |
| Git ear | Git 耳朵 | Signal source: scans git history for revert, dependency, refactor patterns |
| conversation ear | 对话耳朵 | Signal source: AI reports signals via `cairn_signal()` |
| Trust Router | 信任路由 | Engine that routes signals to L0–L3 destinations |
| trust level | 信任等级 | L0–L3 routing level for signals |
| L0 Drop | L0 丢弃 | Signal too noisy or duplicate, discarded |
| L1 Candidate | L1 候选 | Signal enters candidate pool for accumulation |
| L2 Staged | L2 待审 | Signal requires human review before becoming memory |
| L3 Auto-write | L3 自动写入 | Signal meets strict conditions for automatic memory creation |
| Views Engine | 视图引擎 | Engine that regenerates `views/` from `memory/` |
| Stage Engine | 阶段引擎 | Engine that infers project lifecycle phase |
| Memory Engine | 记忆引擎 | Engine that manages memory writes, merging, and conflict detection |
| MCP (Model Context Protocol) | MCP 协议 | Cross-tool protocol for AI tool communication |

## Data Model

| English | 中文 | Notes |
|---------|------|-------|
| memory entry | 记忆条目 | Formal YAML record in `.cairn/memory/` — source of truth |
| signal | 信号 | Raw event captured by Git ear or conversation ear |
| signal type | 信号类型 | Event category: `user-rejection`, `decision`, `revert`, etc. |
| staged entry | 待审条目 | L2 entry in `.cairn/staged/` awaiting human review |
| views | 视图 | Auto-generated projections from memory for AI consumption |
| session record | 会话记录 | Audit record in `.cairn/sessions/` |
| behavior_effect | 行为约束 | How a memory changes AI behavior: `avoid_suggestion`, `prefer_approach`, `warn_before`, `require_review` |
| stage advisory | 阶段建议 | Non-binding phase inference (`advisory` vs `confirmed`) |
| config.yaml | 项目配置 | Project-level Cairn configuration (domains, trust policy) |
| state.yaml | 运行状态 | Server runtime state (last scan, stage snapshot) |

## File Structure

| English | 中文 | Notes |
|---------|------|-------|
| `.cairn/memory/` | 记忆目录 | Formal memory entries (YAML) — source of truth |
| `.cairn/signals/` | 信号目录 | L1 candidate signals |
| `.cairn/staged/` | 待审目录 | L2 entries pending human review |
| `.cairn/views/` | 视图目录 | Auto-generated projections (Markdown) |
| `.cairn/sessions/` | 会话目录 | Session audit records |
| token budget | Token 预算 | Size limit for generated views |

## Operations

| English | 中文 | Notes |
|---------|------|-------|
| cairn init | 初始化 | Creates `.cairn/` with 6 subdirectories + config |
| cairn review | 审核 | Interactive review of staged entries |
| cairn doctor | 健康诊断 | Rule-based health checks |
| slug | 文件名标识符 | ASCII short identifier in filenames |

## v1 Legacy Terms

| English | 中文 | Notes |
|---------|------|-------|
| three-layer architecture | 三层架构 | v1: output.md / domains/ / history/ — replaced by memory + views in v2 |
| Layer 1 / output.md | 第一层 / 全局约束 | v1: always-on global constraints — v2 equivalent: `views/output.md` |
| Layer 2 / domains/ | 第二层 / 域上下文 | v1: per-domain files — v2 equivalent: `views/domains/*.md` |
| Layer 3 / history/ | 第三层 / 决策历史 | v1: raw events — v2 equivalent: `memory/*.yaml` |
| hooks | 关键词触发（hooks） | v1: keywords triggering domain file injection |
| frontmatter | 前置元数据 | v1: YAML header in domain files |
| skill adapter | Skill 适配文件 | Per-tool behavior instructions |
| domain files | 域文件 | Per-domain constraint files |
| history entries | 历史条目 | v1: decision records in `.cairn/history/` |
| injection timing | 注入时机 | v1: when each layer is read by the AI |
| current design | 当前设计 | Active state of a domain |
| trajectory | 发展轨迹 | Chronological list of design changes |
| rejected paths | 被拒路径 | Directions evaluated and excluded |
| open questions | 开放问题 | Unresolved design decisions |
| staging area | 暂存区 | v1: `.cairn/staged/` — v2: L2 staged entries |
| human-in-the-loop | 人工审核 | Principle that AI proposes, humans approve |
