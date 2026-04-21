# Cairn — 设计文档 Cairn

> 状态：三层架构确定，待格式规范细化

---

## 零、命名立意

**Cairn**，登山者沿途堆起的石标。

在没有 GPS 的年代，登山者每走过一段路，就在险要处堆起一个石堆，标记这条路走得通，那条路有危险，此处应该转向。后来者不需要重新探索每一条岔路，只需要沿着石标前行——前人的判断已经积累在那里了。

这正是 Cairn 对 AI 编程助手的作用。

AI 每次进入一个项目，都像第一次踏上这片山地的攀登者——聪明，有能力，但对这条路走过什么弯路、哪个方向试过走不通、此处应该转向一无所知。Cairn 把项目积累的判断结构化地堆在路边：这个技术方向已经试过，行不通；这个模块有已知陷阱，小心绕过；现在处于冲刺阶段，不是大改的时机。

AI 不是被替代，而是有了前人留下的路标，可以在历史约束下做出真正对齐项目现实的建议，而不是在想象中工作。

每一条 rejection 记录，是一块石头。每一个 known pitfall，是一块石头。每一次阶段切换，是一块石头。石标越完整，后来者——无论是新加入的人类开发者，还是每次会话都重新开始的 AI——偏离的可能性就越小。

```
cairn init
cairn log
cairn status
cairn sync
```

---

## 一、核心定位

### Cairn 是什么

Cairn 是一个**项目路径依赖约束系统**。

软件项目的每一个架构决策，都被过去所有决策的历史、已建立的技术栈、已接受的权衡所约束。这种约束关系叫做**路径依赖（path dependency）**。AI 编程工具无法感知路径依赖——每次会话都像第一天入职的开发者，反复提出已被否决的方向，在已知走不通的路上浪费时间。

Cairn 的职责：把项目的路径依赖结构化地传达给 AI，让 AI 在历史约束下工作，而不是在想象中工作。

### 设计原则

**Cairn 是约束系统，不是文档系统。** 每一条信息都必须能改变 AI 的建议。不能改变建议的信息，不写。

**Cairn 不是 ADR。** ADR 写给人类看，Cairn 写给 AI 用。同一件事从两个目的记录，内容截然不同。两者可以并存，不互相替代。

**工具无关性。** 数据层（`.cairn/` 目录）完全工具无关，数据跟着项目走。行为层（各工具 Skill 适配文件）只保证语义等价，不承诺执行完全一致。

---

## 二、三层记忆架构

```
.cairn/
├── output.md          ← 第一层：全局约束，永远注入
├── domains/           ← 第二层：域级设计上下文，规划时按需注入
│   ├── api-layer.md
│   ├── auth.md
│   ├── state-management.md
│   └── database.md
└── history/           ← 第三层：原始事件记录，精确查询用
    ├── 2023-03_state-mgmt-transition.md
    ├── 2023-09_trpc-experiment-rejection.md
    └── 2024-01_auth-debt-accepted.md
```

| 层            | 内容                                                 | 注入时机                  | 规模目标                    |
| ------------- | ---------------------------------------------------- | ------------------------- | --------------------------- |
| output.md     | 全局约束：阶段、禁区、检索钩子、活跃方案、技术债     | 每次会话，永远注入        | target 500 / hard limit 800 |
| domains/\*.md | 域级设计上下文：演进轨迹、已踩坑、当前约束、开放问题 | 规划/方案设计时，按域注入 | 每个 200–400 token          |
| history/      | 原始决策事件，含完整原因和双时间戳                   | AI 精确查询时             | 不限规模                    |

---

## 三、第一层：output.md（全局约束层）

**永远注入，每次会话开始自动读取。token 约束：target 500，hard limit 800。**

output.md 是约束清单，不是文档。只放约束，不放解释。原因和细节统统进 `domains/` 和 `history/`。

### 格式规范

```markdown
## stage

phase: early-growth (2024-09+)
mode: stability > speed > elegance
team: 2, no-ops
reject-if: migration > 1 week

## no-go

- tRPC (REST integration cost, see domains/api-layer.md)
- Redux (boilerplate overhead at team-2)
- kubernetes (no ops capacity)
- microservices (no B2B product)

## hooks

# 关键词来自各 domain 文件 Frontmatter 的 hooks 字段，此处汇总为 AI 可读索引

# Phase 3 MCP Server 直接读 Frontmatter，不依赖此处文本

planning / designing / suggesting for:

- api / endpoint / tRPC / GraphQL → read domains/api-layer.md first
- auth / login / JWT / session → read domains/auth.md first
- state / store / Zustand → read domains/state-management.md first
- db / migration / ORM → read domains/database.md first

## stack

state: Zustand
api: REST
db: PostgreSQL
auth: JWT + Refresh
deploy: Railway

## debt

AUTH-COUPLING: accepted | fix when team>4 or MAU>100k | no refactor now
WS-CONCURRENCY: accepted | CDN migration resolves | no polling fallback
```

### 写作规则

**① 只写约束，不写原因。** `- tRPC (REST integration cost)` 括号只是提示词，完整原因在 `domains/api-layer.md` 和 `history/` 里。

**② 用结构代替散文。** `key: value` 和短列表，不用完整句子。

**③ 每一行必须改变 AI 的建议。** 写完一行问：去掉这行 AI 的建议会不同吗？不会就删。

**④ token 约束：target 500，hard limit 800。** 超过 800 说明有内容应该移入 `domains/` 或 `history/`，不应常驻。500–800 之间是可接受的，说明项目有一定历史积累。低于 500 是理想状态。

---

## 四、第二层：domains/\*.md（域级设计上下文层）

**规划和方案设计时，按域注入。每个文件 200–400 token。**

这是 output.md 和 history/ 之间的关键中间层：

- 比 output.md 细——包含该域完整的演进轨迹、已踩坑、当前设计约束
- 比 history/ 轻——预压缩过的有效上下文，不是原始事件流
- AI 做方案设计时读这一层，不是读一行简短的禁区，也不是翻阅所有原始记录

### 触发时机

当 AI 判断用户的请求属于以下类型时，读对应 domain 文件再回答：

- 规划一个功能的实现方案
- 讨论技术选型
- 设计模块架构
- 评估迁移方案

output.md 的 hooks 章节负责声明具体的触发关键词和对应域。

### 文件格式

```markdown
---
domain: [domain-name]
hooks: ["关键词1", "关键词2", "关键词3"]
updated: [YYYY-MM]
status: [active | stable | stale]
---

# [domain-name]

## current design

[当前的设计状态，一到三句话。包括主要约束和尚未解决的边界。]

## trajectory

[演进时间线，一行一个节点]
[YYYY-MM] 初始状态
[YYYY-MM] 变更 → 原因一句话
[YYYY-MM] 当前状态

## rejected paths

- [方案名]：[否决原因，一句话]
  重要提示：[AI 再提这个方向时需要满足什么条件才值得考虑]
- [方案名]：[否决原因]

## known pitfalls

- [坑的名称]：[触发条件] / [为什么发生] / [不要用什么方式解决]

## open questions

- [尚未决策的问题，影响该域未来设计方向的]
```

**Frontmatter 字段说明：**

- `hooks`：触发读取该 domain 文件的关键词列表。output.md 的检索钩子章节直接引用这些词，Phase 3 MCP Server 用它做精准匹配，不需要 AI 自己判断。
- `updated`：最后更新时间，用于 stale detection。
- `status`：`active`（频繁变动）、`stable`（稳定）、`stale`（可能已过期，需要 sync）。

### 示例：domains/api-layer.md

```markdown
---
domain: api-layer
hooks: ["api", "endpoint", "tRPC", "graphql", "REST", "OpenAPI"]
updated: 2024-03
status: stable
---

# api-layer

## current design

REST + OpenAPI。无 GraphQL，无 tRPC。所有 endpoint 遵循 /v1/ 前缀，
但版本策略尚未正式定义。错误格式部分不统一，新 endpoint 需遵循
{ code, message, data } 结构。

## trajectory

2023-01 Express 裸路由，无校验
2023-05 引入 Zod 做请求校验
2023-09 试用 tRPC（回退，集成成本过高）
2024-03 引入 OpenAPI 文档生成，当前状态

## rejected paths

- tRPC：2023-09 试用两周，现有 REST 客户端改造代价过高，回退
  重要提示：再提 tRPC 前必须说明现有客户端的迁移方案
- GraphQL：未正式评估，当前团队规模和数据复杂度不需要
  重要提示：等前端需要跨多资源聚合查询时再评估

## known pitfalls

- rate limiting 尚未实现：添加时不要破坏现有客户端的重试逻辑（有指数退避）
- 文件上传：鉴权方式尚未定义，不要用现有 JWT 方案直接套用
- 错误格式不统一：部分旧 endpoint 返回 { error: string }，迁移时注意兼容

## open questions

- v2 版本策略未决定（URL 版本 vs Header 版本），影响所有新 API 设计
- 文件上传 endpoint 的鉴权方式未设计
```

### domain 文件的生命周期

**创建时机：** 一个域积累了 2–3 条 history/ 原始条目后，由 AI 从原始条目生成初稿，人工确认后存入 `domains/`。不要一开始就手写，等有足够历史再生成。

**更新方式：** 覆盖式更新（不是追加）。原始事件永远在 `history/` 里，domain 文件只保留当前有效的设计上下文。每次重要变更后，AI 提议更新，人工确认。

**维护成本：** 每个域只有一个文件，内容随项目演进被替换而不是累积。文件不会越来越长。

---

## 五、第三层：history/（原始事件层）

**AI 精确查询时按需读取，规模不限。**

history/ 存储所有原始决策事件。它是 Cairn 的原始数据库，为 `domains/*.md` 提供素材，为 AI 的精确查询提供完整原因。

### 5 种条目类型

| 类型         | 含义                           |
| ------------ | ------------------------------ |
| `decision`   | 做了一个技术选择               |
| `rejection`  | 否决了一个方向（不伴随新选择） |
| `transition` | 方案从 A 变 B                  |
| `debt`       | 技术债的接受或偿还             |
| `experiment` | 实验性尝试的结论（成功或失败） |

### 条目格式

```markdown
---
type: [decision | rejection | transition | debt | experiment]
domain: [来自项目 domain 列表]
decision_date: [YYYY-MM]
recorded_date: [YYYY-MM]
rejected: [否决的替代方案及原因，一句话]
revisit_when: [什么情况下需要重新评估]
---

[正文：完整的散文式解释——决策背景、评估过程、权衡细节。
这里不限长度，是给人类和 AI 精确查询时读的完整记录。]
```

**设计说明：** 核心元数据锁在 Frontmatter，机器解析不依赖 AI 从正文提取结构化字段，避免幻觉。正文留给完整叙述，人类可读，AI 精确查询时读。`summary` 字段移除——Frontmatter 的 `rejected` 和 `type` 组合已经足够机器快速索引，完整 summary 由正文第一行承担。

### 必须写入历史层的事件

| 事件           | 写 history/            | 同时更新                                      |
| -------------- | ---------------------- | --------------------------------------------- |
| 技术方案变更   | transition             | output.md 活跃方案 + domains/\*.md            |
| 实验失败回退   | experiment + rejection | output.md 禁区（视情况）+ domains/\*.md       |
| 主动接受技术债 | debt-accepted          | output.md 技术债清单 + domains/\*.md          |
| 技术债被修复   | debt-resolved          | output.md 技术债清单                          |
| 项目进入新阶段 | transition             | output.md 阶段描述                            |
| 否决某个方向   | rejection              | output.md 禁区（高频错误方向）+ domains/\*.md |

---

## 六、三个核心概念的区别：no-go / accepted debt / known pitfalls

这三个概念在日常使用中容易混淆，但它们对 AI 的约束方式完全不同，必须明确区分。

---

### no-go（禁区）

**定义：** AI 不应该提出的技术方向。这个方向已经被评估过，在战略或技术层面被明确排除。

**AI 看到 no-go 时的行为：** 不提这个方向。如果用户主动问，先说明为什么这个方向被排除了，再讨论是否有足够的理由重新评估。

**写在哪里：** output.md 的 `## no-go` 章节（全局禁区）；域文件 `domains/*.md` 的 `rejected paths` 章节（域级禁区）。

**典型例子：**

```
no-go:
- tRPC：已验证集成成本过高，现有 REST 客户端改造代价不值当
- Kubernetes：团队无运维能力，当前规模不需要
```

**关键特征：** no-go 是一个**方向性排除**。它说的是"这条路不走"，原因是已经评估过或试过，在当前条件下明确不合适。它通常指向一个技术选项（tRPC、Redux、微服务），而不是一个具体的代码问题。

---

### accepted debt（已接受的技术债）

**定义：** 代码库里已经存在的、已知有问题的实现，团队主动选择暂时接受，不立即修复。

**AI 看到 accepted debt 时的行为：** 不要试图"修复"这个已接受的问题。如果任务涉及这个区域，在这个约束下工作，不要把修复债务当作顺手的"改进"。当 `revisit_when` 条件满足时，才是重新讨论的时机。

**写在哪里：** output.md 的 `## debt` 章节（摘要）；history/ 的 `debt-accepted` 类型条目（完整原因）；域文件 `domains/*.md` 的 `known pitfalls` 章节（操作层面的注意事项）。

**典型例子：**

```
debt:
AUTH-COUPLING: accepted | revisit_when: team>4 or MAU>100k | no refactor now
```

**关键特征：** accepted debt 是一个**存在于代码里的问题**，不是一个方向排除。它说的是"这里有缺陷，我们知道，我们选择现在不修"。它有明确的 `revisit_when` 条件，条件满足时应该重新讨论。

---

### known pitfalls（已知坑位）

**定义：** 在某个域工作时会触发的陷阱，通常是副作用、隐性约束、或容易被忽视的兼容性问题。它不是团队主动接受的问题，而是"在这里工作必须注意的事情"。

**AI 看到 known pitfalls 时的行为：** 在涉及该域的工作中主动考虑这些陷阱，在建议或实现中规避触发条件，不要用被标注为"禁止"的 workaround 方案。

**写在哪里：** 域文件 `domains/*.md` 的 `known pitfalls` 章节。不写在 output.md（太细节），不写在 history/（不是事件，是持续存在的陷阱）。

**典型例子：**

```markdown
## known pitfalls

- rate limiting 尚未实现：添加时不要破坏现有客户端的重试逻辑（有指数退避）
- 错误格式不统一：部分旧 endpoint 返回 { error: string }，迁移时注意兼容
```

**关键特征：** known pitfalls 是**操作层面的警告**，不是方向排除，也不是需要修复的债务。它说的是"做这件事时小心这里"。通常描述的是触发条件和应该避免的做法，而不是一个需要决策的问题。

---

### 三者对比

|                    | no-go                    | accepted debt                   | known pitfalls   |
| ------------------ | ------------------------ | ------------------------------- | ---------------- |
| 本质               | 方向性排除               | 已存在的已知问题                | 操作层面的陷阱   |
| AI 的反应          | 不提这个方向             | 不去修它，在约束下工作          | 工作时主动规避   |
| 有 revisit_when 吗 | 可选（条件成熟可重评估） | 必须有                          | 无（持续警告）   |
| 存在于代码里吗     | 否（是评估结论）         | 是（缺陷存在）                  | 是（副作用存在） |
| 写在哪里           | output.md + domains/     | output.md + history/ + domains/ | domains/ 专属    |

---

### 一个容易混淆的场景

**场景：** WebSocket 多标签并发有 bug，但不修。

- **如果判断为 accepted debt：** 在 output.md 的 debt 章节写 `WS-CONCURRENCY: accepted | revisit_when: CDN migration | no polling fallback`。AI 不去修这个 bug，也不建议 polling 替代方案。

- **如果同时有 known pitfall：** 在 `domains/api-layer.md` 的 known pitfalls 写"多标签并发下 WebSocket 会出现连接数限制，新功能设计时不要依赖 WebSocket 的强一致性保证"。AI 在设计涉及实时功能时，会在建议里主动考虑这个约束。

两者可以同时存在，指向同一个问题，但发挥不同的约束作用。

---

## 七、Domain 命名规范

### 结构

```
[稳定域 key] / [可选 scope]

state-management          # 顶级域
api-layer/user-service    # 需要区分子域时
database/primary          # 区分主库和缓存
```

### 标准域清单（init 时选取）

```
state-management    前端状态管理
api-layer           API 设计与通信
database            数据存储
auth                认证与授权
frontend-framework  前端框架
testing             测试策略
deployment          部署与基础设施
monitoring          监控与告警
architecture        整体架构模式
performance         性能优化方向
security            安全策略
```

规则：kebab-case；init 时锁定项目 domain 列表；AI 写条目不能自创新 domain。

---

## 八、完整闭环

### Init 阶段（一次性历史盘点）

```
cairn init 做的事：
1. 引导选择适用的 domain 列表
2. 填写 output.md：
   - 当前阶段与推理模式
   - 已知禁区（可以是空的）
   - 检索钩子（基于选定的 domain 列表自动生成框架）
   - 活跃方案表
   - 已接受的技术债
3. 生成空的 history/ 目录和条目模板
4. 生成空的 domains/ 目录
5. 为各工具生成 Skill 适配文件

目标：30 分钟，建立够用但不完整的初始状态
原则：宁可不完整，不要填假的
```

`domains/` 目录在 init 时是空的，这完全正常。domain 文件在有足够 history/ 条目后再生成。

### Reactive 演进阶段（长期运转）

**核心原则：不主动维护，等 AI 犯错再记录。**

```
触发 Cairn 更新的 5 个事件：

A. AI 提了一个你已经否决过的方向
   → 把否决原因写进 history/（rejection）
   → 考虑是否加进 output.md 禁区
   → 更新对应 domains/*.md

B. 你做了一个重要技术决策
   → AI 起草条目，你确认后写进 history/（decision 或 transition）
   → 如果影响活跃方案表，同步更新 output.md
   → 更新对应 domains/*.md

C. 你试了某个方向但放弃了
   → 记录实验结论（experiment），重点记录"为什么放弃"
   → 更新对应 domains/*.md 的 rejected paths
   → 这是最有价值的历史——走不通的路

D. 你主动接受了一个已知缺陷
   → 记录接受原因和修复触发条件（debt-accepted）
   → 加入 output.md 技术债清单
   → 更新对应 domains/*.md 的 known pitfalls

E. 项目进入新阶段
   → 更新 output.md 阶段描述和推理模式
   → 写一条 transition 类型历史记录标记旧阶段结束
```

### 完整运转流程

```
会话开始
  └→ AI 读取 output.md（全局约束，永远注入）
  └→ 建立推理约束框架

用户在做规划 / 讨论方案 / 设计架构
  └→ hooks 触发：识别涉及的域
  └→ 读取对应 domains/*.md（域级设计上下文）
  └→ AI 现在有：全局约束 + 该域演进轨迹 + 已踩坑 + 开放问题
  └→ 在完整上下文下给出方案建议

执行过程中需要精确查询某个决策
  └→ AI 查询 history/ 原始条目

执行完成（Reactive 演进触发）
  └→ AI 判断是否发生了值得记录的事件
  └→ AI 起草条目（含 type / domain / 双时间戳 / rejected / reason / condition）
  └→ 人工确认 → 写入 history/
  └→ AI 提议更新 domains/*.md（覆盖式）→ 人工确认
  └→ 判断是否需要更新 output.md

形成正向循环：历史越完整，domain 上下文越准确，方案建议越对
```

---

## 九、各层对 AI 的信息密度

以 API 层的一次方案讨论为例，AI 获得的信息是：

```
output.md（永远注入）：
  → no-go 里一行：- tRPC (REST integration cost)
  → hooks 里一行：api / tRPC → read domains/api-layer.md first

domains/api-layer.md（规划时注入）：
  → 演进轨迹：Express → Zod → tRPC 回退 → 当前 REST+OpenAPI
  → rejected paths：tRPC 回退原因 + 再提时的条件
  → known pitfalls：rate limiting / 文件上传鉴权 / 错误格式不统一
  → open questions：v2 版本策略未决

history/（精确查询时）：
  → 2023-09_trpc-experiment-rejection.md：完整的实验过程和回退原因
```

三层组合，AI 做 API 层方案设计时的上下文质量，和一个在项目里工作了 18 个月的人类开发者基本对等。

---

## 十、工具兼容策略

`.Cairn/` 数据目录完全工具无关。每个工具有一个薄薄的 Skill 适配文件，行为逻辑一致，只有文件格式和位置不同。

| 工具             | 适配文件位置                              |
| ---------------- | ----------------------------------------- |
| Claude Code      | `.claude/CLAUDE.md`（追加）               |
| Cursor           | `.cursor/rules/cairn.mdc`                 |
| Windsurf         | `.windsurfrules`（追加）                  |
| Cline / Roo Code | `.clinerules`（追加）                     |
| GitHub Copilot   | `.github/copilot-instructions.md`（追加） |

Skill 文件描述三层机制：永远读 output.md；规划时触发 domains/；精确查询时用 history/。

---

## 十一、分阶段实现

### Phase 1：协议层（当前目标）

交付物：GitHub 仓库

- 格式规范（output.md / domains/\*.md / history/ 三层完整定义）
- 各工具 Skill 适配文件
- 真实项目示例（运转 18 个月以上，三层都有内容）
- `init.sh` 初始化脚本（Bash，交互式）

**成功标准：**

1. 禁区生效：output.md 禁区里的方向，AI 下次不再提
2. 域上下文生效：规划时读 domains/ 后，AI 的建议能反映该域的演进历史和已踩坑
3. 历史检索生效：history/ 里有 rejection 记录，AI 能引用具体原因
4. 外部可用：3 人以上按文档独立完成 `cairn init`，无需额外解释

### Phase 2：CLI 工具

```
cairn init      # 交互式初始化
cairn status    # 查看当前三层摘要 + stale 警告
cairn log       # 手动补录 history/ 条目
cairn sync      # AI 辅助：从 history/ 更新 domains/（AI 生成，人工确认）
```

**`cairn status` 包含 Stale Detection：**

扫描每个 domain 文件 Frontmatter 的 `updated` 字段，对比该 domain 下 history/ 条目的最新 `recorded_date`，自动识别可能已过期的域：

```
$ cairn status

stage:   early-growth (2024-09+)
domains: 4 active

⚠  api-layer   last updated 2024-03 · 3 new history entries since
               run: cairn sync api-layer

✓  auth        up to date (2024-07)
✓  database    up to date (2024-01)
✓  state-management  up to date (2024-03)

history: 12 entries total
```

不需要后台 daemon，`cairn status` 是命令触发的一次性扫描。stale 判断规则：domain 文件的 `updated` 早于该 domain 最新 history 条目的 `recorded_date`，且时间差超过阈值（默认 30 天）。

### Phase 3：MCP Server

```
cairn_output()               # 读取 output.md
cairn_domain(name)           # 读取指定 domain 文件
cairn_query(domain, type?)   # 精确检索 history/ 条目
cairn_propose(entry)         # AI 起草，写入草稿区
cairn_sync_domain(name)      # 从 history/ 重新生成 domain 文件
```

**MCP Server 直接读取 domain 文件的 Frontmatter `hooks` 字段**做意图匹配——用户输入包含 hooks 关键词时，自动调用 `cairn_domain()` 注入对应域上下文，不依赖 AI 自主判断是否需要读取。这是 Frontmatter 引入后最核心的工程收益：机器解析精准，不经过 AI 的语义推断，触发可靠性从行为层升级到工具层。

---

## 十二、仓库结构

```
cairn/
├── README.md
├── spec/
│   ├── FORMAT.md               # 三层完整格式规范
│   ├── DESIGN.md               # 设计决策文档
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
│           ├── domains/
│           │   ├── api-layer.md
│           │   ├── auth.md
│           │   └── state-management.md
│           └── history/
│               ├── 2023-03_state-mgmt-transition.md
│               ├── 2023-09_trpc-experiment-rejection.md
│               ├── 2024-01_auth-debt-accepted.md
│               └── 2024-09_growth-stage-transition.md
├── scripts/
│   └── cairn-init.sh
└── cli/
```

---

## 十三、待决策问题

Cairn 已无开放的架构问题。三层结构确定，格式确定，采用模式确定。

下一步是进入格式规范细化阶段，产出 `spec/FORMAT.md` 的完整内容。

---

## 十四、一句话定位

Cairn 把项目的路径依赖分三层传达给 AI：全局约束常驻注入，域级设计上下文在规划时注入，原始决策事件在精确查询时注入——让 AI 在每个层次上都能做出历史感知的建议，而不是在想象中工作。
