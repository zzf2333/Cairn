[English](adoption-guide.md) | 中文

# Cairn 采用指南

Cairn 是一个动态记忆引擎。TypeScript CLI 负责自动初始化，
MCP Server 负责信号捕获、路由、整合。

本指南分两个阶段：

1. **安装与初始化** — 每台机器 + 每个项目各一次
2. **日常使用** — 完全自动，由 AI 工具调用驱动

---

## 阶段一：安装与初始化

### 第 1 步：安装

**从 npm 安装（推荐）：**

```bash
npm install -g cairn-mcp-server
```

**从源码安装：**

```bash
git clone https://github.com/zzf2333/Cairn
cd Cairn/mcp && npm install && npm run build
```

需要 Node.js 18+。

### 第 2 步：初始化项目

```bash
cd my-project
cairn init
```

交互式流程：

1. **项目名称** — 用于配置和视图的标识符
2. **项目开始日期** — Stage Advisory Engine 用来推断项目年龄
3. **域选择** — 从 11 个标准域中选择，也可添加 `kebab-case` 自定义域
4. **Git 历史扫描** — 检测 revert、依赖变更、大规模文件移动等候选信号
5. **目录生成** — 创建完整的 `.cairn/` 结构

初始化后，项目目录结构：

```
.cairn/
├── config.yaml          # 项目配置（域、信任策略）
├── state.yaml           # Server 运行状态
├── signals/             # L1 候选信号池
├── staged/              # L2 待人工审核条目
├── memory/              # 正式记忆（源数据）
├── views/               # 自动生成的 AI 可消费视图
│   ├── output.md        # 全局约束快照
│   ├── stage.md         # 阶段判断详情
│   └── domains/         # 各域摘要
└── sessions/            # 会话审计记录
```

### 11 个标准域

| 键 | 领域 |
|----|------|
| `state-management` | 前端状态管理 |
| `api-layer` | API 设计与通信 |
| `database` | 数据存储 |
| `auth` | 认证与授权 |
| `frontend-framework` | 前端框架 |
| `testing` | 测试策略 |
| `deployment` | 部署与基础设施 |
| `monitoring` | 监控与告警 |
| `architecture` | 整体架构模式 |
| `performance` | 性能优化 |
| `security` | 安全策略 |

可添加 `kebab-case` 格式的自定义域（如 `payments`、`data-pipeline`、`ml-inference`）。
域列表锁定在 `config.yaml` 后即为规范集合——AI 捕获信号时使用这些键。

**选择建议：**

- 早期项目（独立开发者、产品市场契合前）：`api-layer`、`database`、`auth`、`deployment`
- 全栈团队（2-5 人）：加上 `state-management`、`frontend-framework`、`testing`
- 拿不定主意时选少一些，随时可以扩展。

### 第 3 步：配置 MCP

MCP 是支持它的 AI 工具的主集成路径。将 Cairn Server 添加到工具的 MCP 配置中。

**Claude Code** — `~/.claude/mcp.json`（全局）或 `.claude/mcp.json`（项目级）：

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

**Cursor** — `.cursor/mcp.json`：

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
    "mcpServers": {
        "cairn": { "command": "cairn-mcp-server" }
    }
}
```

**从源码安装时** — 使用构建后的入口：

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

Server 通过从 `process.cwd()` 向上查找定位 `.cairn/`，也可通过 `CAIRN_ROOT`
环境变量指定。

### 第 4 步：验证

```bash
cairn status    # 系统状态概览
cairn doctor    # 健康诊断
```

`cairn doctor` 检查配置完整性、记忆一致性、视图新鲜度，并报告冲突或过期条目。

---

## 阶段二：日常使用

初始化和 MCP 配置完成后，日常操作完全自动。无需手动编辑文件，无需 CLI 仪式。

### 工作流

```
AI 打开项目
  → MCP Server 启动（stdio，每个项目独立实例）
  → Git 耳朵扫描上次会话以来的提交
  → 加载 memory 和 state

AI 调用 cairn_context()
  → 返回：阶段建议、no-go 列表、相关域、活跃技术债、警告
  → AI 在这些约束下工作

AI 工作中调用 cairn_signal()
  → 捕获约束相关事件（见下方信号类型表）
  → Trust Router 路由每个信号：L0 丢弃 / L1 候选 / L2 待审 / L3 自动写入

AI 调用 cairn_session_end()
  → 批量处理累积的信号
  → 从 memory 重新生成 views

AI 关闭项目 → Server 退出
```

### MCP 工具

| 工具 | 用途 | 写入 memory？ |
|------|------|-------------|
| `cairn_context` | 工作前获取约束 | 否（只读） |
| `cairn_signal` | 捕获决策/否决/约束 | 间接（经 Trust Router） |
| `cairn_session_end` | 会话结束批量处理 | 间接（经 Trust Router） |
| `cairn_status` | 系统状态概览 | 否（只读） |
| `cairn_plan` | 历史感知规划框架 | 否（只读，experimental） |
| `cairn_doctor` | 健康诊断 | 否（只读，experimental） |

### 信号类型

AI 在检测到约束相关事件时调用 `cairn_signal()`：

| 事件 | signal_type |
|------|-------------|
| 用户带理由拒绝建议 | `user-rejection` |
| 用户提及过去的尝试 | `historical-reference` |
| 用户声明业务或技术约束 | `user-constraint` |
| 做出重要技术决策 | `decision` |
| 发现并接受技术债 | `debt-acceptance` |
| 检测到 Git revert | `revert` |
| 依赖从 manifest 中移除 | `dependency-removed` |
| 依赖被替代方案替换 | `dependency-replaced` |
| 大规模文件移动（>10 个文件） | `large-refactor` |
| 提交频率 / 项目年龄数据 | `stage-signal` |

### AI 不做的事

- **不** 直接写入 `.cairn/` 文件（memory、signals、staged、views）
- **不** 输出 "Cairn reflection" 块
- **不** 手动跟踪事件计数
- **不** 更新 `output.md` 或域文件 — Views Engine 负责处理
- **不** 决定信任等级 — Trust Router 负责路由

### Trust Router：信号如何变成记忆

所有信号必须经过 Trust Router，没有任何信号可以绕过。

| 级别 | 名称 | 去向 | 行为 |
|------|------|------|------|
| L0 | Drop | 丢弃 | 噪音、重复、低置信度 |
| L1 | Candidate | `signals/` | 积累到阈值后升级为 L2 |
| L2 | Staged | `staged/` | 等待人工通过 `cairn review` 审核 |
| L3 | Auto-write | `memory/` | 满足严格条件，自动写入 |

**硬规则（不可覆盖）：**

- 新增全局 no-go → 永远 L2
- 阶段变更 → 永远 L2
- 全局 scope 的 behavior_effect → 永远 L2
- `config.yaml` 中 `never_auto` 列表里的条目 → 永远 L2

### 定期审查

```bash
cairn review    # 逐条审核 staged 条目：accept / edit / skip / delete
cairn doctor    # 健康检查：过期域、冲突、孤立 no-go
```

`cairn review` 是唯一的人工参与步骤。有 staged 条目时运行即可。
接受的条目移入 `memory/` 并触发视图重新生成。

---

## 不支持 MCP 的 AI 工具（降级路径）

对于不支持 MCP 的工具，Cairn 提供 skill adapter 文件，直接读取 `views/` 目录。
Views 是标准 Markdown 格式。

| 工具 | adapter 安装位置 |
|------|-----------------|
| Cline / Roo Code | `.clinerules`（追加） |
| Windsurf | `.windsurfrules`（追加） |
| GitHub Copilot | `.github/copilot-instructions.md`（追加） |
| Codex CLI | `AGENTS.md`（追加） |
| Gemini CLI | `GEMINI.md`（追加） |
| OpenCode | `AGENTS.md`（追加） |

**MCP 工具 vs. 降级 adapter：**

| 能力 | MCP（主路径） | Skill adapter（降级） |
|------|-------------|---------------------|
| 读取约束 | `cairn_context()` — 按任务过滤 | 读取整个 `views/output.md` |
| 捕获信号 | `cairn_signal()` — 自动路由 | 不可用 |
| 会话生命周期 | `cairn_session_end()` — 批量处理 | 不可用 |
| 诊断 | `cairn_doctor()` — 结构化结果 | `cairn doctor` CLI |

降级路径提供对最新视图快照的只读访问。信号捕获和记忆演化需要 MCP。

---

## 架构概览

### Memory / Views 分离

Cairn 严格分离源数据和 AI 可消费视图：

**`memory/`** 是源数据。每条记忆是结构化 YAML 文件，包含完整的来源追溯、置信度、
behavior_effect 声明。人类审核 memory。

**`views/`** 是自动生成的投影。`output.md`、`domains/*.md`、`stage.md` 全部从
memory 聚合生成，memory 变更时自动重新生成。AI 消费 views。

这种分离意味着：
- 编辑 memory 后变更自动传播到 views
- views 随时可从 memory 重新生成
- Git diff 能分辨事实变更（memory）和投影变更（views）

### 双耳信号捕获

Cairn 从两个来源捕获信号：

**Git 耳朵**（启动时扫描）：revert、依赖变更、大规模文件移动、提交频率、
新贡献者。提供"发生了什么"。

**对话耳朵**（实时 MCP）：用户否决、历史引用、约束、决策、技术债接受。
提供"为什么"。

两只耳朵都产生信号，都不直接写 memory。Trust Router 决定什么成为记忆。

### Stage Advisory Engine

从多维信号推断项目阶段（exploration / growth / maturity / maintenance）：
项目年龄、提交趋势、依赖变更率、新文件占比。

- 只输出 advisory——不产生硬约束，除非人工确认
- confidence < 0.5 → 不生成任何约束
- 阶段变更 → 永远 L2（需人工审核）

---

## CLI 参考

| 命令 | 说明 |
|------|------|
| `cairn init` | 交互式项目初始化 |
| `cairn status` | 系统状态（memory 计数、staged 计数、阶段、冲突） |
| `cairn review` | 审核 staged 条目（accept / edit / skip / delete） |
| `cairn doctor` | 健康诊断 |
| `cairn stage confirm` | 确认阶段判断（advisory → confirmed） |
| `cairn memory show <id>` | 查看单条 memory |
| `cairn memory archive <id>` | 归档一条 memory |

---

## 常见问题排查

**`cairn doctor` 报告域过期：**
过期域有新 memory 条目但尚未反映到 views。
运行 `cairn_session_end()` 或触发视图重新生成。

**Staged 积压增长：**
运行 `cairn review` 处理待审条目。未审核的 staged 条目不影响 AI 行为——
它们在等待人工确认。

**MCP Server 未连接：**
1. 验证安装：`which cairn-mcp-server` 或 `node /path/to/dist/index.js`
2. 检查 MCP 配置文件位置是否匹配你的 AI 工具
3. 确保项目中存在 `.cairn/`（没有就运行 `cairn init`）

**Memory 中存在冲突：**
`cairn doctor` 报告同一域内 behavior_effect 冲突。
用 `cairn memory show <id>` 查看冲突条目，归档或编辑过时的那条。
