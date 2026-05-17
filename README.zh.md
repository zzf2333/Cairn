[English](README.md) | 中文

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>软件项目不是一堆代码。它是一个路径依赖的认知生命体。</strong></p>

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
> 项目最初的中文设计稿与架构思想保留在仓库本地的 `docs/internal/*.zh.md`,作为英文文档的 source-of-intent。

---

## Cairn 在做什么

代码越来越便宜(因为 AI 能写),真正稀缺的就变成了 **长期稳定的工程认知** —— 团队过去的判断、教训、踩过的坑。没有这个,AI 会一次又一次推荐六个月前刚刚被拒绝的方案;事故级别的决策会因为没人记得而被重新讨论;同一道墙会被撞穿两次。

Cairn 抵抗这种 "认知坍塌"。它把项目看作一个有 **骨骼**(skeleton 域结构)、**血液**(blood 演化事件)、**DNA**(emerged 项目人格)、**毛细血管**(capillaries 域细节)、**引力**(gravity 决策权重)、**治理**(governance 人工裁决梯子)的活体。宿主 AI 是过客;Cairn 是留下来的那个。

---

## 文档:作为一个完整论证来读

完整文档入口:[`docs/0-enter.md`](./docs/0-enter.md)。文档分为六卷,推荐按顺序读一遍:

| 卷 | 内容 |
|----|------|
| **[i. 起源](./docs/i-origin/)** | 为什么存在 —— 从代码稀缺到认知稀缺的转变 |
| **[ii. 解剖](./docs/ii-anatomy/)** | 器官 —— 骨骼 / 血液 / DNA / 毛细血管 / 引力 / 治理 |
| **[iii. 生命](./docs/iii-life/)** | 生命周期 —— 捕获、衰减、复活、压缩、创伤 |
| **[iv. 自反](./docs/iv-self/)** | 自检 —— TrustRouter / 校准 / 安全阀 |
| **[v. 介入](./docs/v-intervene/)** | 怎么用 —— 安装 / AI 协议 / 维护 |
| **[vi. 坐标](./docs/vi-coordinates/)** | 参考 —— schema / glossary / stability / performance / migration |

如果只有十分钟,先读 [`0-enter.md`](./docs/0-enter.md),再读 [`i-origin/cognitive-collapse.md`](./docs/i-origin/cognitive-collapse.md)。

---

## 当前支持的 AI 平台

| 宿主 | 协议文件 | 状态 |
|------|----------|------|
| **Claude Code** | [`skills/claude-code/SKILL.md`](./skills/claude-code/SKILL.md) | 一线 |
| **Codex** | [`skills/codex.md`](./skills/codex.md) | 一线 |

其他 MCP 兼容宿主(Cline、Windsurf、Cursor、Copilot、Gemini CLI、OpenCode)在 1.x 路线图上。0.4.1 把它们的 adapter 移除,集中精力让两个支持平台到位 —— 等到每个新平台都能通过和 Claude Code / Codex 同样严格的反向回归测试,再加回来。

---

## 5 分钟安装

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

随后把对应的协议文件追加到项目的 `CLAUDE.md` / `AGENTS.md`。

完整步骤:[`docs/v-intervene/enter.md`](./docs/v-intervene/enter.md)。

---

## 工作原理(一张图)

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="工作原理" width="880"/></p>

三种信号来源 —— git 提交、对话轮次、代码与认知漂移 —— 都经过 **TrustRouter** 这一个中央闸门,落到三个目的地之一:`dropped`(G0 噪声)、`staged`(待人工裁决)、`blood`(已确认)。会话结束时,维护流水线自动跑:衰减、校准、阶段推断、DNA 压缩、视图重新生成。

继续看:[集成总览](./docs/diagrams/03-integration-overview.png)、[TrustRouter 决策流](./docs/diagrams/06-trust-router-flow.png)。

---

## CLI

```
cairn init [--empty]              初始化 .cairn/ 脚手架
cairn status                      认知状态快照
cairn doctor                      一致性 + 低引力档案自动复活
cairn doctor --fix                隔离损坏的 yaml 文件
cairn doctor --recover            清理未完成的 session checkpoint
cairn doctor --metrics            .cairn/ 健康指标
cairn review                      列出待审 staged 条目
cairn audit                       治理审计日志
cairn dna show | list | accept <id> | reject <id> <reason> | reevaluate
cairn skeleton show
cairn blood list | show <id> | archive <id> | resurrect <id> | trauma <id>
cairn stage confirm | list | accept <id> | reject <id> <reason>
cairn migrate                     stamp cairn_version,执行待迁移
```

完整命令:`cairn --help`。

---

## 参与开发

- Issue / PR:https://github.com/zzf2333/Cairn
- 引擎层开发规则:[`CLAUDE.md`](./CLAUDE.md)
- 发布检查表(贡献者向、仓库本地):见 `docs/internal/`

---

## License

MIT
