[English](README.md) | 中文

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>让你的 AI 拥有一位在项目工作了两年的同事的上下文。</strong></p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=mcp%20server&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

<p align="center"><img src="docs/diagrams/02-three-layer-architecture.png" alt="三层架构" width="880"/></p>

---

> **本文档是中文总览。所有详细设计文档以英文为权威版本。**
> 项目的中文设计原稿与架构思想存档保留在仓库本地(`docs/internal/*.zh.md`),作为英文文档的 source-of-intent。

---

## Cairn 是什么

Cairn 是一个 **AI 原生的工程认知引擎**:它从 Git 历史和 AI 对话中捕获项目决策、被拒绝的路径、被接受的权衡,通过基于决策引力(Gravity)的信任路由系统加以结构化,再把约束作为行为护栏供 AI 编程助手实时调用。

**为什么需要这样一个东西。** 当代码生产因为 AI 而变得无限充裕,真正稀缺的就变成了 **长期稳定的工程认知** —— 团队过去的判断、教训、踩过的坑。没有这个,AI 会一次又一次推荐六个月前刚刚被拒绝的方案;事故级别的决策会因为没人记得而被重新讨论;同一道墙会被撞穿两次。Cairn 就是抵抗这种 "认知坍塌" 的主动维护层。

完整阐述见 [`docs/PHILOSOPHY.md`](./docs/PHILOSOPHY.md)(英文)。中文原稿见 [`docs/internal/philosophy.zh.md`](./docs/internal/philosophy.zh.md)(仓库本地,未公开)。

---

## 当前支持的 AI 平台

| 宿主 | 协议文件 | 状态 |
|------|----------|------|
| **Claude Code** | [`skills/claude-code/SKILL.md`](./skills/claude-code/SKILL.md) | 一线支持 |
| **Codex** | [`skills/codex.md`](./skills/codex.md) | 一线支持 |

其他 MCP 兼容宿主(Cline / Windsurf / Cursor / Copilot / Gemini CLI / OpenCode)在 1.x 路线图上。0.4.1 把它们的 adapter 移除,集中精力让这两个支持的平台做到位 —— 等到每个新平台都能通过和 Claude Code / Codex 同样严格的反向回归测试,再把它们加回来。

---

## 快速开始

```bash
# 1. 安装
npm install -g cairn-mcp-server

# 2a. Claude Code —— 编辑 ~/.claude.json
#     "mcpServers": { "cairn": { "command": "cairn-mcp-server" } }

# 2b. Codex —— 编辑 ~/.codex/config.toml
#     [mcp_servers.cairn]
#     command = "cairn-mcp-server"

# 3. 验证
cairn doctor --metrics
```

随后把对应的协议文件(`skills/claude-code/SKILL.md` 或 `skills/codex.md`)追加到项目的 `CLAUDE.md` / `AGENTS.md`。

完整步骤:[`docs/QUICK_START.md`](./docs/QUICK_START.md)。

---

## 工作原理

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="工作原理" width="880"/></p>

三种信号来源 —— git 提交、对话轮次、代码与认知漂移 —— 全部经过 **TrustRouter** 这一个中央闸门,落到三个目的地之一:`dropped`(G0 噪声)、`staged`(待人工裁决)、`blood`(已确认演化事件)。会话结束时,维护流水线自动跑:衰减、校准、阶段推断、DNA 压缩、视图重新生成。

继续读:
- [集成总览](./docs/diagrams/03-integration-overview.png) —— 谁跟谁说话
- [TrustRouter 决策流](./docs/diagrams/06-trust-router-flow.png) —— 每个信号要走的判断树

---

## 文档导航

所有详细文档为英文。中文设计原稿见 `docs/internal/`(仓库本地)。

| 文档(英文) | 何时读 |
|-----|--------|
| [PHILOSOPHY.md](./docs/PHILOSOPHY.md) | 想了解 "为什么":认知稀缺、为什么 ADR 不够 |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 想了解 "怎么实现":四层结构、信号流、6 步流水线 |
| [QUICK_START.md](./docs/QUICK_START.md) | 想 5 分钟跑起来 |
| [SCHEMA.md](./docs/SCHEMA.md) | 想看 `.cairn/` 下每个 YAML 的字段级参考 |
| [GLOSSARY.md](./docs/GLOSSARY.md) | 看到某个术语想查定义 |
| [EXAMPLES.md](./docs/EXAMPLES.md) | 想看真实的 `.cairn/` 在小型 / 中型 / 维护期项目里长什么样 |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | 哪里不对劲 |
| [RECOVERY.md](./docs/RECOVERY.md) | 文件损坏或 session 中途崩了 |
| [PERFORMANCE.md](./docs/PERFORMANCE.md) | 想看基准数据和 SLO 方法 |
| [STABILITY.md](./docs/STABILITY.md) | 想知道哪些字段是 Stable / Experimental / Internal |
| [MIGRATION.md](./docs/MIGRATION.md) | 升级版本要看差异 |

---

## CLI

```
cairn init [--empty]              初始化 .cairn/ 脚手架
cairn status                      认知状态快照
cairn doctor                      一致性检查 + 低引力档案自动复活
cairn doctor --fix                隔离损坏的 yaml 文件
cairn doctor --recover            清理未完成的 session checkpoint
cairn doctor --metrics            .cairn/ 健康指标(blood/DNA/staged/上次 session)
cairn review                      列出待审 staged 条目
cairn audit                       治理审计日志
cairn dna show | list | accept <id> | reject <id> <reason>
cairn skeleton show
cairn blood list | show <id> | archive <id> | resurrect <id> | trauma <id>
cairn stage confirm | list | accept <id> | reject <id> <reason>
cairn migrate                     stamp cairn_version,执行待迁移
```

完整命令:`cairn --help`。

---

## 参与开发

- Issue / PR:https://github.com/zzf2333/Cairn
- 引擎层开发规则:[CLAUDE.md](./CLAUDE.md)
- 发布检查表:[docs/RELEASE_READINESS.md](./docs/RELEASE_READINESS.md)

---

## License

MIT
