# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言规范

- 与用户的对话使用**中文**
- 代码、注释、commit message、所有对外发布的文档（`spec/`、`skills/`、`examples/`、`README.md`）使用**英文**

## 项目性质

Cairn 是一个**开源规范协议项目**，不是可运行的应用。当前处于 Phase 1（协议层），仓库内容以 Markdown 规范文档、示例文件和 Shell 脚本为主，没有需要编译的代码。

## 当前开发阶段

**Phase 1（协议层）和 Phase 2（CLI）均已完成。** 仓库结构：

```
cairn/
├── README.md
├── spec/
│   ├── FORMAT.md               # 三层完整格式规范（权威参考文档）
│   ├── DESIGN.md               # 设计决策文档（英文对外版）
│   ├── vs-adr.md               # Cairn vs ADR 对比
│   └── adoption-guide.md       # Init + Reactive 采用指南
├── skills/
│   ├── claude-code/SKILL.md
│   ├── cursor.mdc
│   ├── cline.md
│   ├── windsurf.md
│   └── copilot-instructions.md
├── examples/
│   └── saas-18mo/
│       └── .cairn/
│           ├── output.md
│           ├── domains/        # api-layer.md, auth.md, state-management.md（含 frontmatter）
│           └── history/        # 4 个事件文件（2023-03 至 2024-09）
├── scripts/
│   └── cairn-init.sh           # 交互式初始化脚本（Bash，单文件自包含）
├── cli/
│   ├── cairn                   # CLI 主入口（Phase 2）
│   └── cmd/
│       ├── init.sh             # cairn init
│       ├── status.sh           # cairn status（stale detection）
│       ├── log.sh              # cairn log（记录 history 条目）
│       └── sync.sh             # cairn sync（生成 AI prompt）
├── tests/
│   └── *.sh                    # 测试套件（577 个断言）
└── docs/
    └── design.md               # 中文内部工作草稿（保留不动）
```

Phase 3（MCP Server）尚未开始。

## 核心架构：三层记忆系统

每个使用 Cairn 的项目在根目录放一个 `.cairn/` 目录：

| 层 | 文件 | 注入时机 | Token 约束 |
|---|---|---|---|
| 第一层 | `.cairn/output.md` | 每次会话永远注入 | target 500，hard limit 800 |
| 第二层 | `.cairn/domains/*.md` | 规划/方案设计时按域注入 | 每个 200–400 |
| 第三层 | `.cairn/history/*.md` | AI 精确查询时 | 不限 |

**三个关键概念**，编写规范文档时必须严格区分：

- **no-go**：方向性排除，AI 不提这个方向（写在 output.md + domains/）
- **accepted debt**：代码里已存在的已知问题，AI 不去修它（必须有 `revisit_when`，写在 output.md + history/ + domains/）
- **known pitfalls**：操作层面的陷阱，AI 工作时规避（仅写在 domains/，无 revisit_when）

## 工具兼容策略

Cairn 的**数据层**（`.cairn/` 目录）完全工具无关，跟着项目仓库走。**行为层**（Skill 适配文件）对每个工具单独维护，保证语义等价：

| 工具 | 适配文件位置 |
|---|---|
| Claude Code | `.claude/skills/cairn/SKILL.md` |
| Cursor | `.cursor/rules/cairn.mdc` |
| Windsurf | `.windsurfrules`（追加） |
| Cline / Roo Code | `.clinerules`（追加） |
| GitHub Copilot | `.github/copilot-instructions.md`（追加） |

## 写作规则（规范文档）

在编写 `spec/` 下的任何文档时：

1. **Cairn 是约束系统，不是文档系统**——每条信息必须能改变 AI 的建议，不能改变建议的不写
2. **output.md 只写约束，不写原因**——括号里只是提示词，完整原因进 domains/ 和 history/
3. **domain 文件覆盖式更新**，不追加——原始事件永远在 history/，domain 只保留当前有效上下文
4. **history/ 条目的 `rejected` 字段是最关键字段**——被否决的方案是 AI 最容易重复提出的东西

## 关键文档

- `docs/design.md`：中文原始设计文档，内部工作草稿，保留不动
- `spec/FORMAT.md`：三层格式规范，是所有 spec 文档、示例、脚本的权威依据
- `spec/DESIGN.md`：英文对外设计文档，解释"为什么"，不重复格式细节
