English | [中文](README.zh.md)

# Cairn

**AI 原生工程认知运行时。** Cairn 让项目的推理历史跨越 AI 会话保持鲜活 — 决策、拒绝、约束和权衡被捕获、经信任路由，并作为主动认知被执行。

## 快速开始

```bash
# 1. 安装 CLI（提供 `cairn` 命令）
npm install -g cairn-rt

# 2. 安装协议 skill（Claude Code）
npx skills add zzf2333/Cairn
```

然后告诉你的 AI 工具：

> 初始化 Cairn

## 工作原理

Cairn 通过两层机制工作：

**Skill 运行时协议** — 作为原生 skill 安装的行为规则。协议定义何时执行每个命令、如何处理约束、何时可以跳步。

**CLI 运行时** — 协议调用的命令：

| 命令 | 何时执行 | 干什么 |
|------|---------|--------|
| `cairn context` | 任务开始（session guard） | 创建 session，激活约束，检测 stale session |
| `cairn plan` | 架构工作前 | 浮出历史约束 + DNA 指引 |
| `cairn signal` | 决策 / 拒绝 / 约束时 | 经 TrustRouter 路由 |
| `cairn observe` | git commit 前 | 提取并路由候选信号 |
| `cairn session-end` | 会话结束 | 扫 git → 衰减 → 校准 → 阶段推断 → DNA 压缩 |
| `cairn session-recover` | 检测到 stale session 时 | 对中断 session 运行 session-end 管道 |

**每次会话必走**：`cairn context`（开始）+ `cairn session-end`（结束）。

## CLI

**运行时命令**（AI / 脚本调用，均支持 `--json`）：

| 命令 | 干什么 |
|------|--------|
| `cairn context [--task <t>]` | 创建 session，激活约束 |
| `cairn plan --task <t>` | 浮出历史约束 + DNA 指引 |
| `cairn signal --type <t> --what <w>` | 经 TrustRouter 路由 |
| `cairn observe --summary <s>` | 提取并路由候选信号 |
| `cairn session-end --summary <s>` | 扫 git → 衰减 → 校准 → 阶段 → DNA 压缩 |
| `cairn session-recover` | 对中断 session 运行 session-end 管道 |

**管理命令**：

| 命令 | 干什么 |
|------|--------|
| `cairn init [--empty]` | 初始化 `.cairn/` 脚手架 |
| `cairn status` | 认知状态快照 |
| `cairn doctor [--fix\|--recover\|--metrics]` | 一致性检查、修复 |
| `cairn review` | 列出待审 staged 条目 |
| `cairn audit` | 治理审计日志 |
| `cairn dna show \| list \| accept \| reject \| reevaluate` | DNA 特质管理 |
| `cairn skeleton show` | 域结构 |
| `cairn blood list \| show \| archive \| resurrect \| trauma` | 事件管理 |
| `cairn stage confirm \| list \| accept \| reject` | 事件裁决 |
| `cairn skill show [platform]` | 输出组装后的协议 |
| `cairn migrate` | 升级后执行待迁移 |

完整命令：`cairn --help`。

## 配置

### 各平台设置

<details>
<summary><strong>Claude Code</strong></summary>

```bash
npm install -g cairn-rt
npx skills add zzf2333/Cairn
```

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
npm install -g cairn-rt
cairn skill show codex >> AGENTS.md
```

</details>

<details>
<summary><strong>Cursor</strong></summary>

```bash
npm install -g cairn-rt
cairn skill show cursor >> .cursorrules
```

</details>

### 项目根目录检测

运行时按以下顺序解析 `.cairn/` 目录：

1. `CAIRN_ROOT` 环境变量
2. 从 `process.cwd()` 向上遍历直到找到 `.cairn/`

要固定到特定项目，在 shell 环境中设置 `CAIRN_ROOT`。

## 开发

```bash
npm run test          # 运行测试
npm run test:watch    # 监视模式
npm run build         # 编译 TypeScript
npm run dev           # 直接运行（tsx，无需构建）
```

## 许可证

MIT — [github.com/zzf2333/Cairn](https://github.com/zzf2333/Cairn)
