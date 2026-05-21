[English](README.md) | 中文

<div align="center">

<img src="docs/diagrams/logo.png" width="120" alt="Cairn" />

<h1>Cairn</h1>

<p><strong>软件项目不是一堆代码。它是一个路径依赖的认知生命体。</strong></p>

<p>Cairn 是让这个生命体的认知跨越 AI 会话保持鲜活的认知运行时协议 — 以 CLI + Skill 协议的形式交付，AI 遵循其行为契约。</p>

<p>
  <a href="https://github.com/zzf2333/Cairn/stargazers"><img src="https://img.shields.io/github/stars/zzf2333/Cairn?style=flat-square&color=f59e0b" alt="GitHub Stars"/></a>
  <a href="https://www.npmjs.com/package/cairn-mcp-server"><img src="https://img.shields.io/npm/v/cairn-mcp-server?style=flat-square&label=npm&color=2563eb" alt="npm version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-16a34a?style=flat-square" alt="License MIT"/></a>
  <img src="https://img.shields.io/badge/node-18%2B-6b7280?style=flat-square" alt="Node 18+"/>
</p>

</div>

---

> **本文档是中文总览。所有详细设计文档以英文为权威版本。**
> 项目最初的中文设计稿与架构思想保留在仓库本地 `docs/internal/*.zh.md`,作为英文文档的 source-of-intent。

---

代码越来越便宜(AI 在写),真正稀缺的是 **长期稳定的工程认知** —— 团队过去的判断、教训、踩过的坑。没有这个,AI 会一次又一次推荐六个月前刚被拒绝的方案;事故级别的决策因为没人记得而被重新讨论;同一道墙被撞穿两次。

Cairn 抵抗这种 "认知坍塌"。它把项目看作一个有 **骨骼**(skeleton 域结构)、**血液**(blood 演化事件)、**DNA**(emerged 项目人格)、**毛细血管**(capillaries 域细节)、**引力**(gravity 决策权重)、**治理**(governance 人工裁决梯子)的活体。宿主 AI 是过客;Cairn 是留下来的那个。

---

## Cairn 给 AI 的两层能力

Cairn 通过两层机制驱动 AI 的工程认知：

**Skill 运行时协议** — 作为原生 skill 安装的行为规则（Claude Code 通过 `npx skills add zzf2333/Cairn`），定义何时执行每个命令、如何处理约束、何时可以跳步。

**CLI 运行时** — 协议调用的命令。AI 在会话中以 shell 命令方式执行：

| 命令 | 何时执行 | 干什么 |
|------|---------|--------|
| `cairn context` | 任务开始（session guard） | 创建 session，激活约束，检测 stale session |
| `cairn plan` | 做设计 / 架构工作前 | 拉取历史约束 + DNA 指引 |
| `cairn signal` | 检测到决策 / 拒绝 / 约束时 | 经 TrustRouter 路由 |
| `cairn observe` | git commit 前 | 从近期工作中提取并路由候选信号 |
| `cairn session-end` | 会话结束 | 扫 git → 衰减 → 校准 → 阶段推断 → DNA 压缩 |
| `cairn session-recover` | 检测到 stale session 时 | 对中断的 session 运行 session-end 管道 |

**每次会话必走**：`cairn context`（开始）+ `cairn session-end`（结束）。`cairn context` 充当 session guard — 追踪活跃 session 状态机并检测中断 session。

<details>
<summary><strong>进阶：MCP 模式</strong></summary>

MCP 工具（`cairn_context`、`cairn_plan` 等）与 CLI 命令一一对应。添加到 `.claude/mcp.json`：

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-mcp-server" }
  }
}
```

MCP 模式为支持 Model Context Protocol 的 AI 运行时提供工具级集成。协议和行为与 Skill + CLI 模式完全一致。

</details>

---

## 工作原理(一张图)

<p align="center"><img src="docs/diagrams/04-how-it-works.png" alt="工作原理" width="880"/></p>

三种信号来源 —— git 提交、对话轮次、代码与认知漂移 —— 都经过 **TrustRouter** 这一个中央闸门,落到三个目的地之一:`dropped`(G0 噪声)、`staged`(待人工裁决)、`blood`(已确认)。会话结束时,维护流水线自动跑:衰减、校准、阶段推断、DNA 压缩、视图重生成。

<p align="center"><img src="docs/diagrams/02-three-layer-architecture.png" alt="三层架构" width="880"/></p>

继续看:[集成总览](./docs/diagrams/03-integration-overview.png) · [TrustRouter 决策流](./docs/diagrams/06-trust-router-flow.png)。

---

## 快速开始 — Claude Code

```bash
# 1. 安装 CLI（提供 `cairn` 命令）
npm install -g cairn-mcp-server

# 2. 安装协议 skill
npx skills add zzf2333/Cairn
```

然后告诉 Claude Code：

> 初始化 Cairn

AI 会分析你的项目，提出初始认知供你审核，确认后写入。全程约 2 分钟。

<details>
<summary><strong>可选：MCP 模式（支持 MCP 的运行时）</strong></summary>

如果你的 AI 运行时原生支持 MCP，可以额外添加到 `.claude/mcp.json`：

```json
{
  "mcpServers": {
    "cairn": { "command": "cairn-mcp-server" }
  }
}
```

MCP 工具与 CLI 命令一一对应。上面的 Skill + CLI 方式是推荐默认路径。

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
npm install -g cairn-mcp-server
cairn skill show codex >> AGENTS.md
```

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.cairn]
command = "cairn-mcp-server"
```

重启 Codex，然后说：`Initialize Cairn for this project`

</details>

完整安装步骤（含验证）：[`docs/v-intervene/enter.md`](./docs/v-intervene/enter.md)

---

## 一次会话的流向

```
cairn context  →  [实际工作]  →  cairn signal (×N)  →  cairn session-end
session guard      AI 写码        检测到决策时         维护流水线
(+ stale 检测)                                     cairn session-recover
                                                      (上次中断时)
```

AI 自己跑的四种典型流:

- **新任务** —— `cairn context` 激活约束 → AI 写码 → 通过 `cairn signal` 标决策 → `cairn session-end` 压缩。
- **Stale 恢复** —— `cairn context` 检测到未关闭 session → `cairn session-recover` 跑维护管道 → 新 session 干净开始。
- **设计评审** —— `cairn plan` 浮出历史尝试 → AI 只提没试过的路径。
- **人工裁决** —— `cairn review`(你看)→ `cairn stage accept` / `cairn stage reject` → blood 更新。

---

## `.cairn/` 里到底有什么

Cairn 写的是普通 YAML —— 你能读、能 diff、能 git track。一切都不出本机。

| 文件 | 内容 |
|------|------|
| `.cairn/config.yaml` + `state.yaml` | 认知模式、版本、上次 session checkpoint |
| `.cairn/skeleton/` | 域结构(路径、负责人) |
| `.cairn/blood/` | 已确认的演化事件 —— 决策、拒绝、tradeoff |
| `.cairn/dna/` | 涌现出的项目特质(如 `simplicity_bias`) |
| `.cairn/staged/` | 待你裁决的候选 |
| `.cairn/views/output.md` | 给人读的自动摘要 —— 想看一眼就看这个 |

**不写**:源码内容、token、凭证、`.cairn/` 之外的任何东西。
**建议**:把 `.cairn/` 提交进 git。它是项目记忆的一部分。

---

## CLI

**运行时命令**（AI / 脚本调用，均支持 `--json`）：

| 命令 | 何时用 | 干什么 |
|------|--------|--------|
| `cairn context [--task <t>]` | 任务开始 | 创建 session，激活约束，检测 stale session |
| `cairn plan --task <t>` | 架构工作前 | 浮出历史约束 + DNA 指引 |
| `cairn signal --type <t> --what <w>` | 决策 / 拒绝时 | 经 TrustRouter 路由 |
| `cairn observe --summary <s>` | git commit 前 | 提取并路由候选信号 |
| `cairn session-end --summary <s>` | 会话结束 | 扫 git → 衰减 → 校准 → 阶段 → DNA 压缩 |
| `cairn session-recover` | stale session 检测后 | 对中断 session 运行 session-end 管道 |

**管理命令**：

| 命令 | 何时用 | 干什么 |
|------|--------|--------|
| `cairn init [--empty]` | 可选 —— 预创建脚手架 | 生成 `.cairn/` 目录 |
| `cairn status` | 快速看一眼 | 认知状态快照 |
| `cairn doctor [--fix\|--recover\|--metrics]` | 感觉不对劲 | 一致性、自动复活、修复 |
| `cairn review` | 看待审队列 | 列出待裁决条目 |
| `cairn audit` | 治理审计 | 显示审计日志 |
| `cairn dna show \| list \| accept \| reject \| reevaluate` | DNA 特质管理 | 查看或裁决特质 |
| `cairn skeleton show` | 域结构检查 | 打印骨架树 |
| `cairn blood list \| show \| archive \| resurrect \| trauma` | 事件级操作 | 管理单条演化事件 |
| `cairn stage confirm \| list \| accept \| reject` | 事件裁决 | 处理 staged 队列 |
| `cairn skill show [platform]` | 协议预览 | 输出组装后的协议到 stdout |
| `cairn migrate` | 升级后 | 打 cairn_version、执行待迁移 |

完整命令:`cairn --help`。

---

## 六卷文档

完整文档入口:[`docs/0-enter.md`](./docs/0-enter.md)。六卷,推荐第一次按顺序读完。

| 卷 | 内容 | 适合谁 |
|----|------|--------|
| **[i. 起源](./docs/i-origin/)** | 为什么存在 | 想先看哲学(10 分钟) |
| **[ii. 解剖](./docs/ii-anatomy/)** | 器官 —— 骨骼 / 血液 / DNA / 毛细血管 / 引力 / 治理 | 想看架构地图(20 分钟) |
| **[iii. 生命](./docs/iii-life/)** | 生命周期 —— 捕获、衰减、复活、压缩、创伤 | 关心认知如何老化(15 分钟) |
| **[iv. 自反](./docs/iv-self/)** | 自检 —— TrustRouter / 校准 / 安全阀 | 想知道它怎么校准自己(10 分钟) |
| **[v. 介入](./docs/v-intervene/)** | 安装 / AI 协议 / 维护 | 只想用起来(5 分钟) |
| **[vi. 坐标](./docs/vi-coordinates/)** | schema / glossary / stability / performance / migration | 用到了再查 |

**三条阅读路径**:
- **哲学派** → `0-enter` → `i. 起源` → `ii. 解剖`
- **工程派** → `0-enter` → `ii. 解剖` → `vi. 坐标`
- **操作派** → `0-enter` → `v. 介入` → 上面的 CLI 表

如果只有十分钟,先读 [`0-enter.md`](./docs/0-enter.md),再读 [`i-origin/cognitive-collapse.md`](./docs/i-origin/cognitive-collapse.md)。

---

## 为什么做 Cairn

我一次又一次看到 AI 提议项目其实早就试过并拒绝过的方案 —— 有时是三个月前的决定,有时是上周的。AI 没有错,是项目没有可以递给它的记忆。

Cairn 就是那一层"记得"。

---

## 参与开发

- Issue / PR:https://github.com/zzf2333/Cairn
- 协议：[`SKILL.md`](./SKILL.md)
- 发布检查表(贡献者向、仓库本地):见 `docs/internal/`

---

## License

MIT
