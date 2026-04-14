English | [中文](README.zh.md)

# Cairn MCP Server

一个 [MCP（Model Context Protocol）](https://modelcontextprotocol.io) 服务器，提供对 Cairn 三层记忆系统（`.cairn/` 目录）的结构化工具访问。

## 为什么需要 MCP Server

MCP Server 将 Cairn 域注入的精度从行为层（AI 读取 Skill 文件并推断何时加载上下文）升级到工具层（机器精确地将关键词与域前置元数据的 `hooks` 字段匹配）。这消除了每个 AI 工具手动处理原始文件注入的需要。

## 工具列表

| 工具 | 描述 |
|------|------|
| `cairn_output` | 读取 `.cairn/output.md`——第一层全局约束（stage、no-go、hooks、stack、debt） |
| `cairn_domain` | 读取 `.cairn/domains/<name>.md`——第二层域上下文 |
| `cairn_query` | 搜索 `.cairn/history/`——第三层原始决策事件，支持域/类型过滤 |
| `cairn_propose` | 将历史条目草稿写入 `.cairn/staged/` 供人工审核 |
| `cairn_sync_domain` | 生成上下文以从历史记录重新生成域文件 |
| `cairn_match` | 将关键词与域 `hooks` 匹配，实现精确意图检测 |

## Resources（资源）

| URI | 描述 |
|-----|------|
| `cairn://output` | 静态读取 `output.md` |
| `cairn://domain/{name}` | 模板读取任意域文件 |

## 安装

### 从源码安装

```bash
cd mcp/
npm install
npm run build
```

### 配置

#### Claude Code

添加到 `~/.claude/settings.json`（全局）或 `.claude/settings.json`（项目）：

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
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"]
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
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"]
        }
    }
}
```

### 项目根目录检测

服务器按以下顺序解析 `.cairn/` 目录：

1. `CAIRN_ROOT` 环境变量（如需固定到特定项目，在 MCP 配置中设置）
2. 从 `process.cwd()` 向上遍历直到找到 `.cairn/`

如果两者都找不到 `.cairn/` 目录，所有工具调用都会返回可操作的错误信息。

要将服务器固定到特定项目：

```json
{
    "mcpServers": {
        "cairn": {
            "command": "node",
            "args": ["/path/to/cairn/mcp/dist/index.js"],
            "env": {
                "CAIRN_ROOT": "/path/to/your/project"
            }
        }
    }
}
```

## 推荐 AI 工作流程

```
# 在每次会话开始时：
cairn_output()

# 当用户请求涉及某个域时：
cairn_match(["api", "endpoint", "design"])
→ 返回："api-layer (matched: api, endpoint)"

cairn_domain("api-layer")
→ 返回包含被拒路径和已知陷阱的完整域上下文

# 当你需要完整的历史细节时：
cairn_query(domain="api-layer", type="rejection")

# 当你想提议记录一个决策时：
cairn_propose(type="rejection", domain="api-layer", ...)
→ 写入 .cairn/staged/ 供人工审核

# 当域文件需要更新时：
cairn_sync_domain("api-layer")
→ 返回用于重新生成域文件的上下文
```

## `cairn_propose` 暂存工作流程

`cairn_propose` 工具写入 `.cairn/staged/` 而不是直接写入 `.cairn/history/`。这执行了人工审核原则——AI 提议，人类批准。

```bash
# 查看暂存的条目
cat .cairn/staged/2024-03_rejected-graphql.md

# 批准：移动到正式历史记录
mv .cairn/staged/2024-03_rejected-graphql.md .cairn/history/

# 或丢弃
rm .cairn/staged/2024-03_rejected-graphql.md
```

## 开发

```bash
npm run test          # 运行测试
npm run test:watch    # 监视模式
npm run build         # 编译 TypeScript
npm run dev           # 直接运行服务器（使用 tsx，无需构建）
```

## 架构

```
mcp/
├── src/
│   ├── index.ts              # stdio 入口点
│   ├── server.ts             # McpServer 工厂：注册所有工具和资源
│   ├── paths.ts              # .cairn/ 根目录检测
│   ├── hooks.ts              # 用于 cairn_match 的前置元数据 hooks 索引
│   ├── staging.ts            # cairn_propose 的暂存区逻辑
│   ├── errors.ts             # 类型化错误码
│   ├── parsers/
│   │   ├── frontmatter.ts    # YAML 前置元数据提取（域文件）
│   │   ├── output.ts         # output.md 章节解析器
│   │   ├── domain.ts         # 域文件解析器
│   │   └── history.ts        # 历史文件解析器（裸 key:value 格式）
│   └── tools/
│       ├── cairn-output.ts
│       ├── cairn-domain.ts
│       ├── cairn-query.ts
│       ├── cairn-propose.ts
│       ├── cairn-sync-domain.ts
│       └── cairn-match.ts
└── tests/
    ├── fixtures/.cairn/      # 来自 examples/saas-18mo/ 的真实示例数据
    ├── parsers/
    └── tools/
```
