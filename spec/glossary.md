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
| bootstrap | 自动初始化 | Auto-creates `.cairn/` on first MCP tool call |
| cairn_review | 审核 | MCP tool: AI-mediated review of staged entries (list/accept/reject) |
| cairn_memory | 记忆管理 | MCP tool: browse and manage memory entries (list/show/archive) |
| cairn_doctor | 健康诊断 | MCP tool: rule-based health checks |
| slug | 文件名标识符 | ASCII short identifier in filenames |

## Other Terms

| English | 中文 | Notes |
|---------|------|-------|
| skill adapter | Skill 适配文件 | Per-tool behavior instructions |
| trajectory | 发展轨迹 | Chronological list of design changes |
| rejected paths | 被拒路径 | Directions evaluated and excluded |
| open questions | 开放问题 | Unresolved design decisions |
| human-in-the-loop | 人工审核 | Principle that AI proposes, humans approve |
