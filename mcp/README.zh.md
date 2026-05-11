English | [中文](README.zh.md)

# Cairn MCP Server

一个 [MCP（Model Context Protocol）](https://modelcontextprotocol.io) 服务器，为 AI 工具
提供对 Cairn 动态记忆引擎的类型化访问——信号捕获、信任路由记忆和约束视图。

## 为什么需要 MCP Server

v2 Cairn 是一个动态记忆引擎：项目信号从 Git 历史和 AI 对话中自动捕获，经过 Trust Router
（L0–L3）路由，整合为结构化记忆。MCP Server 是主要接口——AI 工具调用类型化工具，而非读取
原始文件。

不支持 MCP 的工具可通过 `views/` 目录获取只读降级访问（见[降级模式](#降级模式)）。

## 工具列表

六个 MCP 工具，四个稳定版，两个实验版：

### 稳定版

| 工具 | 描述 | 是否写入记忆？ |
|------|------|-------------|
| `cairn_context` | 获取项目约束。返回：阶段建议、no-go 列表、相关域、活跃债务、警告。 | 否（只读） |
| `cairn_signal` | 报告对话中的项目信号：用户否决、决策、约束、历史引用、债务接受。经 Trust Router 路由。 | 间接（经 Trust Router） |
| `cairn_session_end` | 会话结束处理：批量处理 L1 信号、创建会话记录、重新生成视图。 | 间接（经 Trust Router） |
| `cairn_status` | 系统状态：记忆数、待审数、信号数、冲突、过期域、阶段建议。 | 否（只读） |

### 实验版

| 工具 | 描述 | 是否写入记忆？ |
|------|------|-------------|
| `cairn_plan` | 历史感知规划框架。返回任务的历史约束和推荐方向。 | 否（只读） |
| `cairn_doctor` | 健康诊断：token 预算检查、孤立 no-go、过期域、冲突、待审积压。 | 否（只读） |

### 输入 Schema

**`cairn_context`**
```json
{
    "task": "string（可选）— 当前任务描述",
    "files": "string[]（可选）— 正在处理的文件"
}
```

**`cairn_signal`**
```json
{
    "type": "enum — user-rejection | user-constraint | historical-reference | decision | debt-acceptance | ...",
    "domain": "string（可选）— 受影响的域",
    "details": {
        "what": "string — 发生了什么",
        "reason": "string（可选）— 为什么",
        "rejected_alternatives": "string[]（可选）",
        "revisit_when": "string[]（可选）"
    },
    "evidence": {
        "user_said": "string（可选）",
        "files": "string[]（可选）",
        "commit": "string（可选）"
    }
}
```

**`cairn_session_end`**
```json
{
    "summary": "string — 会话摘要",
    "changed_domains": "string[]（可选）",
    "decisions_made": "string[]（可选）",
    "unresolved": "string[]（可选）"
}
```

**`cairn_plan`**
```json
{
    "task": "string — 要规划的任务"
}
```

`cairn_status` 和 `cairn_doctor` 无需输入参数。

## 推荐工作流程

```
会话开始：
  cairn_context({ task: "重构认证模块" })
  → 返回约束：no-go 列表、相关域、活跃债务

工作过程中：
  cairn_signal({ type: "user-rejection", domain: "auth", details: { what: "OAuth2 PKCE", reason: "团队规模太小，太复杂" } })
  → Trust Router 路由：L1 候选 / L2 待审 / L3 自动写入

  cairn_signal({ type: "decision", domain: "api-layer", details: { what: "继续使用 REST", rejected_alternatives: ["GraphQL"] } })
  → 根据信任策略路由

设计任务前：
  cairn_plan({ task: "重新设计通知系统" })
  → 返回历史约束和推荐方向

会话结束：
  cairn_session_end({ summary: "重构认证，拒绝 OAuth2 PKCE", changed_domains: ["auth"] })
  → 批量处理信号，重新生成视图，创建会话记录

诊断（任何时候）：
  cairn_status()
  cairn_doctor()
```

## 安装

### 从 npm 安装（推荐）

```bash
npm install -g cairn-mcp-server
```

### 从源码安装

```bash
cd mcp/
npm install
npm run build
```

需要 Node.js 18+。

### 配置

#### Claude Code

添加到 `~/.claude/mcp.json`（全局）或 `.claude/mcp.json`（项目）：

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

源码方式：
```json
{
    "mcpServers": {
        "cairn": {
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"]
        }
    }
}
```

#### Cursor

添加到项目中的 `.cursor/mcp.json`：

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

#### Claude Desktop

添加到 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）：

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server"
        }
    }
}
```

### 项目根目录检测

服务器按以下顺序解析 `.cairn/` 目录：

1. `CAIRN_ROOT` 环境变量（如需固定到特定项目，在 MCP 配置中设置）
2. 从 `process.cwd()` 向上遍历直到找到 `.cairn/`

如果两者都找不到 `.cairn/` 目录，所有工具调用返回可操作的错误信息。

要将服务器固定到特定项目：

```json
{
    "mcpServers": {
        "cairn": {
            "command": "cairn-mcp-server",
            "env": {
                "CAIRN_ROOT": "/path/to/your/project"
            }
        }
    }
}
```

## CLI

同一个包提供 `cairn` CLI 用于初始化和维护：

| 命令 | 描述 |
|------|------|
| `cairn init` | 交互式项目初始化（创建 `.cairn/` 目录结构、配置和状态） |
| `cairn status` | 系统状态概览（记忆数、待审数、阶段、冲突） |
| `cairn review` | 审核待审条目：接受 / 编辑 / 跳过 / 删除 |
| `cairn doctor` | 健康诊断 |
| `cairn stage confirm` | 确认阶段建议为正式状态 |
| `cairn memory show <id>` | 查看单条记忆 |
| `cairn memory archive <id>` | 归档一条记忆 |

## 降级模式

不支持 MCP 的 AI 工具可通过 `views/` 获取只读访问：

- `views/output.md` — 全局约束（格式兼容 v1 `output.md`）
- `views/domains/*.md` — 按域摘要
- `views/stage.md` — 阶段建议详情

Views 在记忆变更时自动重新生成，始终是最后已知状态的一致快照。

非 MCP 工具的 Skill 适配文件直接读取 `views/`。参见 `skills/` 目录中的各适配文件。

## 开发

```bash
npm run test          # 运行测试
npm run test:watch    # 监视模式
npm run build         # 编译 TypeScript
npm run dev           # 直接运行服务器（使用 tsx，无需构建）
```

## 架构

```
mcp/src/
├── index.ts              # MCP stdio 入口
├── cli.ts                # CLI 入口
├── server.ts             # McpServer 工厂：注册 6 个工具
├── paths.ts              # .cairn/ 根目录检测 + 路径解析
├── tokens.ts             # Token 计数工具
├── errors.ts             # 类型化错误码
├── schemas/              # 所有数据类型的 Zod schemas
│   ├── memory-entry.ts   # MemoryEntry（decision, rejection, transition, debt, experiment）
│   ├── signal.ts         # Signal（10 种信号类型，L0-L3 路由）
│   ├── staged-entry.ts   # StagedEntry（待人工审核）
│   ├── config.ts         # Config（domains, trust_policy）
│   ├── stage-snapshot.ts # StageSnapshot（exploration/growth/maturity/maintenance）
│   └── session-record.ts # SessionRecord
├── stores/               # YAML 文件读写层
│   ├── memory-store.ts   # memory/*.yaml 增删改查
│   ├── signal-store.ts   # signals/*.yaml 增删改查
│   ├── staged-store.ts   # staged/*.yaml 增删改查 + 接受/拒绝
│   └── state-store.ts    # state.yaml 读写
├── engines/              # 核心处理引擎
│   ├── views-engine.ts   # 从 memory 生成 views/（token 预算感知）
│   ├── trust-router.ts   # L0-L3 信号路由 + 硬规则
│   ├── git-ear.ts        # Git 历史信号检测
│   ├── stage-engine.ts   # 项目阶段推断（规则版）
│   └── memory-engine.ts  # 记忆健康检查 + 冲突检测
├── tools/                # MCP 工具实现
│   ├── cairn-context.ts
│   ├── cairn-signal.ts
│   ├── cairn-session-end.ts
│   ├── cairn-status.ts
│   ├── cairn-plan.ts
│   └── cairn-doctor.ts
└── cli/                  # CLI 子命令
    ├── init.ts
    ├── status.ts
    ├── review.ts
    ├── doctor.ts
    ├── stage.ts
    └── memory.ts
```
