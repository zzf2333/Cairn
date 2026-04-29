# Cairn — 版本路线图

> 历史路线图 + 当前方向说明。v0.0.12 起，Cairn 已从 staging/reflect/audit CLI 工作流收缩为 AI-direct file protocol：CLI 只保留初始化、自检、版本与帮助；AI 直接维护 `.cairn/`。

---

## 当前方向（v0.0.12+）

- CLI 小表面：`cairn init`、`cairn doctor`、`cairn version`、`cairn help`
- 记忆维护：AI 根据 `.cairn/SKILL.md` 直接写 `history/`、覆盖更新 `domains/`、必要时更新 `output.md`
- MCP 当前工具：`cairn_output`、`cairn_domain`、`cairn_query`、`cairn_write_history`、`cairn_doctor`、`cairn_match`
- 旧 staging/reflect/analyze/audit 流程仅作为历史记录和迁移背景，不再作为当前使用指南

### v0.0.15 — 协议一致性 / 信任修复

**目标：让文档、CLI 提示、MCP README、规范与真实实现保持一致。**

- 修复 MCP README 中旧 `cairn_propose` / `cairn_sync_domain` 工具说明
- 修复 `doctor` 和 MCP 工具返回中的旧命令建议
- 同步中文采用指南与格式规范到 v0.0.12+ 的 AI-direct 模型
- 增加公开文档反回归测试，防止旧工作流重新进入当前指南

### v0.1.0 — Verifiable Onboarding

**目标：让首次接入路径可测试、可证明，而不是只靠文档承诺。**

- 新增 fresh project E2E：`git init` → `cairn init` → guide block / `.cairn/SKILL.md` 生成 → `cairn doctor` 通过
- 扩展英文公开文档契约测试，确保 README、MCP README、adoption guide、examples README 与当前 CLI/MCP surface 一致
- 增强 `cairn doctor --json` schema 测试，覆盖 clean、stale、missing guide、v0.0.11 residue、write-back warn
- 同步版本号到 `0.1.0`，并让 `scripts/sync-version.sh` 覆盖 doctor JSON 版本字段

---

## 已交付确认

### v0.0.1（2026-04-13）已完成
- 三层格式规范（spec/FORMAT.md）
- 设计文档、ADR 对比、采用指南
- 8 个工具 Skill 适配（Claude Code / Cursor / Cline / Windsurf / Copilot / Codex CLI / Gemini CLI / OpenCode）
- 交互式初始化脚本（cairn-init.sh）
- CLI 4 个命令：init / status / log / sync
- MCP Server 6 个工具 + 2 个资源
- Shell 测试（577 assertions）+ Vitest 测试（100+ assertions）
- SaaS-18mo 完整示例

### v0.0.2（2026-04-14）已完成
- 中文语言支持（CAIRN_LANG 环境变量，自动检测）
- i18n 函数层（lang/en.sh + lang/zh.sh）
- 所有 8 个 Skill 适配器加入语言连续性规则
- 中文平行文档（README / FORMAT / DESIGN / adoption-guide / vs-adr / mcp）
- 双语词汇表（spec/glossary.md）
- 翻译贡献指南（TRANSLATIONS.md）
- 中文示例项目（examples/saas-18mo-zh/）
- MCP cairn_sync_domain 语言连续性规则

### v0.0.3（2026-04-14）已完成
- `cairn log --quick`：4 字段最小捕获模式，写入 staged/，reason/revisit_when 填 `[TODO]`
- `cairn doctor`：纯规则健康检查（token 预算、no-go 史料、hooks 漂移、stale 域、staged [TODO]）
- `cairn stage review`：交互式审核循环（accept/edit/skip/quit），安全护栏：[TODO] 需二次确认
- 第二示例项目：`examples/api-service-2yr/`（9 条历史、2 条 debt、stale rate-limiting 演示场景）
- 中文镜像：`examples/api-service-2yr-zh/`（双语 hooks、英文字段键、中文正文）
- 共享函数：`compute_domain_stale`、`count_tokens_approx`、`find_staged_files` 抽入 cli/cairn
- 测试套件扩展至 887 assertions（新增 310 个，含 3 个新测试文件）
- i18n 双份同步，各 201 个函数

### v0.0.4（2026-04-14）已完成
- `cairn sync --hooks`：重新扫描所有 domain Frontmatter hooks[] 聚合生成 ## hooks 章节，打印到 stdout（不自动改写 output.md），支持 --copy
- domain Frontmatter 新增 `related: [domain-name]` 字段（BFS 1 跳、上限 2、循环防御）
- MCP `cairn_match` 升级：新增 `files?` 参数（文件路径双重匹配）、三级置信度（high/medium/low）、related domain advisory、1200 token 预算提示
- 新增 `mcp/src/related.ts`（resolveRelated）、`mcp/src/tokens.ts`（approxTokens + extractSection）
- `cairn doctor` hooks 漂移检测时追加 "run: cairn sync --hooks" 修复建议
- sync prompt 新增规则 9、10：内容必须可追溯到 history 条目，禁止 rejected paths 推测
- `extract_domain_hooks` 提升为 CLI 共享函数
- 测试套件扩展至 902 assertions（Bash +15）/ 125 assertions（TS +25，4 个新测试文件）

---

## 北极星指标

三个长期追踪指标，贯穿整条路线：

**① 维护摩擦**
- 新项目初始化时间（目标：< 20 分钟）
- 首条 history 记录时间（目标：< 10 分钟）
- 用户审核一次 staged 条目的平均时间（目标：< 2 分钟/条）

**② 约束有效性**
- 被 Cairn 阻止的重复错误建议数（越多越好）
- domain 命中后用户满意度（目标：> 70%）
- no-go 命中率（命中时建议被修正的比例）

**③ 自治程度**
- 自动生成草稿占比（v0.1.0 目标：> 50%）
- 自动草稿接受率（目标：> 60%）
- 需要人工纠偏的比例（v1.0.0 目标：< 10%）

---

## 自治能力演进路径

```
v0.0.x   Human-authored     人工写，AI 读，验证三层结构成立
v0.1.x   Human-reviewed     AI 起草，人审核，闭环学习期
v0.2.x   Human-exception    AI 默认维护，人处理异常，低干预自治期
v1.0.0   Near-autonomous    AI 近自治，人只做治理抽查
```

---

## v0.0.3 — 不容易死

**目标：降低维护门槛，让 Cairn 三个月后仍然活着。**

### cairn log --quick

最小记录模式。只要求四个字段，先抓事实结构后补，自动进入 `staged/`。

```bash
$ cairn log --quick

domain (tab-complete): api-layer
type [decision/rejection/transition/debt/experiment]: rejection
one-line summary: evaluated tRPC, integration cost too high
rejected alternative: tRPC

→ saved to .cairn/staged/2026-04-15_api-layer-rejection.md
  fields marked [TODO]: rejected_reason, revisit_when
→ run 'cairn stage review' to complete
```

其余字段全部标记为 `[TODO]` 占位，后补。

### cairn doctor

健康度诊断命令。纯规则检查，不依赖 LLM，可脚本实现。

```bash
$ cairn doctor

output.md
  ✓  tokens: 487 (target 500 / hard limit 800)
  ⚠  no-go "tRPC" has no supporting history entry
  ⚠  hooks "graphql" not found in any domain hooks[] field

domains
  ✓  auth.md            stable, updated 2024-07
  ⚠  api-layer.md       stale: 3 new history entries since 2024-03
  ✓  state-management   stable, updated 2024-03

staged
  ⚠  2 entries with [TODO] fields pending completion
  ⚠  1 entry older than 14 days — consider review or discard
```

检查项（规则型，不依赖 LLM）：
- output.md token 是否超 hard limit 800
- no-go 条目是否有对应 history 支撑
- domain 文件是否 stale（updated 早于最新 history 超 30 天）
- hooks 关键词是否与 domain Frontmatter hooks[] 一致
- staged/ 里的 [TODO] 字段和滞留时间

### cairn stage review

处理 staged/ 队列，逐条 accept / edit / skip。accept 后从 staged/ 移入 history/，并提示是否需要更新 output.md 或对应 domain。

### 第二个示例项目

`examples/api-service-2yr/`，项目形态不同于 saas-18mo：
- 更多 rejection 类型条目（否决比选择更多）
- debt 条目有完整 revisit_when
- 至少一次 stage transition（阶段切换）
- 演示 cairn doctor 发现 stale domain 的真实场景

### 成功标准
- 新用户 10 分钟内能记第一条 history（北极星①）
- doctor 能发现最常见的三种腐烂问题
- staged 队列让"记了但没整理"有容身之处

---

## v0.0.4 — 更准（2026-04-14）已完成

**目标：让 AI 更稳定地在正确时刻读到正确约束。**

### hooks 机制增强

- output.md 的 hooks 列表自动从各 domain Frontmatter `hooks[]` 字段聚合生成
- `cairn doctor` 新增：output.md hooks 与各 domain hooks[] 是否漂移
- `cairn sync --hooks`：重新扫描所有 domain Frontmatter，更新 output.md hooks 章节

### 跨 domain 组合注入

- domain Frontmatter 新增 `related: [domain-name]` 字段
- MCP `cairn_match` 升级：返回主 domain + 相关 domain 列表
- 组合注入 token 上限：output.md + 最多 2 个 domain（约 1200 token）
- 超出上限时：主 domain 完整注入，相关 domain 只注入 trajectory 摘要

### MCP 匹配逻辑优化

- hooks 命中 + 文件路径双重匹配（编辑的文件路径往往比关键词更准）
- 置信度分级：high / medium / low
- hooks 命中但文件路径不相关时：降级为可选注入而非强制注入

### sync 提示词收敛

- 强调"压缩已有历史，不发明新结论"
- 要求标注内容来源于哪条 history 条目
- 禁止在 rejected paths 里写 history 没有对应事件的内容

### 成功标准
- 相同请求在不同工具里的 domain 命中结果更一致
- 组合注入总 token ≤ 1200（北极星①）
- cairn doctor 能检测 hooks 漂移

---

### v0.0.5（2026-04-14）已完成
- `cairn analyze`：新增独立命令，扫描 git 历史，分 4 阶段生成分置信度候选
  - Phase 1：检测 revert 提交 → experiment 候选（high）、依赖文件增删 → rejection 候选（high）、关键词提交 → transition 候选（medium）、TODO/FIXME 密度 → debt 候选（low）
  - Phase 2：候选写入 `.cairn/staged/`，头部注入 `# cairn-analyze: v0.0.5` / `# confidence:` / `# source:` 元注释
  - Phase 3：汇总输出（各置信度计数）+ 检测当前技术栈建议
  - 支持 `--dry-run` / `--since YYYY-MM-DD` / `--limit N` / `--only TYPE,...` 四个 flags
  - 零硬依赖：有 jq 用 jq 解析 package.json，否则 grep/sed 回退
  - 支持 5 类依赖生态：package.json / go.mod / requirements.txt / pyproject.toml / Cargo.toml
- `cairn stage review` 增强：识别 analyze 元注释、展示置信度和来源、accept 时自动剥离元注释
- `cairn init` 增强（step0）：检测 `.git/` 时提示运行 analyze，在 step4 后执行分析
- `cairn analyze --help` 完整帮助文本
- i18n 双份同步（en/zh），新增 `msg_analyze_*`、`msg_stage_analyze_meta` 等约 50 条函数
- 测试套件扩展：新增 `tests/test_cli_analyze.sh`（~60 assertions），扩展 `test_cli_stage.sh`（+4 suites）、`test_cli_dispatch.sh`（+1 assertion）

---

## v0.0.5 — 自动冷启动

**目标：用 git log 分析生成 cairn init 初稿，把用户从"回忆历史"变成"确认和补充"。**

这个版本做的不是简单的"从 git 初始化"，而是：git 历史采集 + AI 初稿生成 + 分置信度审核 + 从回忆模式转向确认模式。

### cairn init 重构

```
阶段 1：git log 分析（自动）
├── 读取全量 git log 和 diff
├── 分析 package.json / requirements.txt / go.mod 等依赖变更
├── 识别：revert 提交、短暂出现又消失的依赖、大规模文件替换
└── 识别：TODO/FIXME 注释密度高的区域（技术债候选）

阶段 2：AI 生成初稿（自动）
├── output.md
│   ├── stage：从 commit 历史推算项目年龄和阶段
│   ├── stack：读当前依赖文件生成活跃方案表
│   ├── no-go：从 revert / 短暂依赖提取候选（标注来源 commit）
│   └── debt：从 TODO/FIXME 提取候选（标注文件位置）
├── history/ 候选条目
│   ├── revert 提交 → experiment 类型
│   ├── 依赖替换 → transition 类型
│   └── 短暂依赖消失 → rejection 类型
└── domains/ 初稿
    └── 根据 history 候选识别 domain，生成 trajectory 章节

阶段 3：分置信度审核（人工）
├── 高置信度（直接从 revert/大规模替换提取）→ 建议接受
├── 中置信度（从提交信息关键词推断）→ 建议审核
└── 低置信度（从注释、文件名推断）→ 建议手动补充

阶段 4：字段补充引导（人工）
├── rejected 原因：git 能告诉你发生了什么，不能告诉你为什么
├── revisit_when：必须用户判断
└── 已接受的技术债：git 里几乎没有这类信号
```

### git log 分析的现实局限

| | 能否提取 |
|---|---|
| 发生了什么（事件类型）| ✓ |
| 被替换的方案名 | ✓ |
| 否决原因 | ✗（用户补充）|
| 主动接受的技术债 | ✗（用户补充）|
| 提交信息质量差时的准确率 | 低 |

### 成功标准
- 有 commit 历史的项目，cairn init 能生成 70% 以上有效内容
- 用户审核时间 < 20 分钟（原手填 30 分钟）（北极星①）
- [TODO] 占位清晰可见，不会被遗漏

---

## v0.0.6 — 基础设施化

**前提：v0.0.5 的 git init 与 staged 审核流已经稳定，才推进 canonical schema。**
**schema 定太早，自动采集流程一变迁移成本会增加。**

**目标：让 Cairn 从"协议 + 脚本"变成更稳的工程底座。**

### canonical schema（分层推进）

**第一步：只做 history schema**

```json
{
  "$schema": "https://cairn.dev/schema/history/v1.json",
  "type": "rejection",
  "domain": "api-layer",
  "decision_date": "2023-09",
  "recorded_date": "2024-01",
  "rejected": "tRPC",
  "revisit_when": "team > 5 or REST clients fully migrated"
}
```

Frontmatter 字段与 schema 对应，CLI 解析从脆弱文本解析升级为 schema 校验。

**后置：domain / output schema**

等 history 层稳定后再推进，不急着一次性 schema 化全部三层。

### 迁移工具

```bash
cairn migrate --from 0.0.4 --to 0.0.6
```

schema 版本化，为未来 domain taxonomy 重构提供迁移接口。

### richer MCP API

- `cairn_query` 支持按 type / date_range / revisit_when_status 过滤
- `cairn_propose` 支持批量提交多条候选
- `cairn_diff` 新增：对比 staged 和 history 的差异

### 轻量 inspect 能力

```bash
cairn inspect

Global:   12 no-go | 3 debt | 8 pitfalls
Domains:  api-layer (stable) | auth (stable) | state-management (stale)
History:  24 entries | 2023-01 → 2026-04
Staged:   3 pending

Most cited: api-layer (14×/30d)
Never cited: monitoring (0× — consider removing)
```

### 成功标准
- 旧仓库升级成本低（迁移工具覆盖 v0.0.1 以来所有格式）
- 工具层不再依赖脆弱文本解析
- MCP query 支持结构化过滤

---

## v0.1.0 — 半自动沉淀

**阶段定位：进入 Human-reviewed 期**
**目标：减少人工写初稿的负担，AI 起草成为主流程。**

### Trust Policy（信任策略）

从这个版本开始，明确定义各类操作的人工介入级别。作为配置文件存在，用户可按项目调整阈值：

```yaml
# .cairn/trust-policy.yml

never_auto_write:
  - output_no_go_add        # output.md 的 no-go 新增
  - output_no_go_modify     # output.md 的 no-go 修改
  - output_stage_change     # output.md 的 stage 变更
  - output_major_change     # output.md 的任何重大修改

review_required:
  - domain_trajectory_rewrite   # domain trajectory 的改写
  - debt_revisit_change         # debt revisit_when 条件变更
  - cross_domain_constraint     # 跨 domain 的约束变更

can_auto_stage:
  - rejection_candidate         # 来源明确的否决候选
  - experiment_log              # 结果明确的实验记录
  - low_scope_transition        # 不影响全局约束的小范围变更

can_auto_accept_later:
  - verified_revert             # 可验证来源的 revert 事件（v0.5.0 实现）
  - verified_replace            # 可验证来源的依赖替换事件
```

### 从对话记录生成候选

**只对"明确涉及项目约束"的对话做候选提取，不对所有会话默认提取。**

触发提取的信号（符合其中一条才提取）：
- 用户否定 AI 的方案并给出原因
- 用户明确说"之前试过 / 不做 / 以后再说"
- 用户明确指出已有 stack / stage / debt / no-go
- 会话里出现持续性约束（而不是一次性任务细节）

不触发提取的情况：
- 普通实现讨论
- 一次性 workaround 建议
- 本周资源限制的临时安排
- 无明确原因的偏好表述

```bash
$ cairn propose review

[1/2] From session 2026-04-15 14:23
Signal: user rejected AI suggestion with explicit reason

AI suggested: migrate to tRPC for type safety
You said: "we tried this, integration cost too high"

Suggested entry (type: rejection, domain: api-layer):
  rejected: tRPC
  reason: integration cost too high with existing REST clients
  revisit_when: [TODO — please specify]

(a)ccept  (e)dit  (s)kip:
```

### staged workflow 完善

- `cairn stage list`：查看所有待处理草稿
- `cairn stage review`：逐条处理
- `cairn stage purge --older-than 30d`：清理长期未处理的草稿
- staged/ 状态机：`pending` → `auto-confirmed` / `rejected`

### 用户反馈收集机制

**必须在这个版本开始收集数据，为 v0.2.0 的 before/after 证明做准备：**
- 记录哪些建议被禁区阻止（命中统计）
- 记录 domain 文件被读取的频率（使用热度）
- 可选：用户填写"Cairn 帮我避免了哪次重复错误"

### 多人协作约定

在 adoption-guide.md 明确：
- `history/`：任何人可追加（append-only）
- `domains/`：每个 domain 有 owner，PR review 才能修改
- `output.md`：团队共同决策才能修改

### 日语支持（第三语言）

- `cli/lang/ja.sh` + 日语平行文档 + 日语示例项目

### 成功标准
- 用户写 history 时间比 v0.0.2 减少 50%（北极星①）
- 自动草稿接受率 > 60%（北极星③）
- 有至少 3 个用户提供真实使用反馈

---

## v0.2.0 — 真实团队可持续

**阶段定位：Human-reviewed 成熟期**
**目标：证明 Cairn 不是概念工具，能在真实团队里长期跑。**

### before/after 证据

基于 v0.1.0 收集的数据整理：
- AI 建议中被禁区阻止的方向分布
- domain 上下文注入后建议质量的用户评估
- 重复错误减少的真实案例（匿名）

### doctor 语义检查（advisory only）

在 v0.0.3 规则型检查基础上，加入 LLM 辅助语义审计：

```bash
$ cairn doctor --semantic

Semantic audit (advisory only — warnings, no auto-rewrite):
  ⚠  output.md no-go "tRPC" phrasing overlaps with debt "REST migration"
     → possible intent: same constraint described twice
     → suggestion: consolidate or clarify distinction
  ⚠  api-layer.md known-pitfall "rate limiting" looks like accepted debt
     → possible misclassification
```

**硬性限制：**
- advisory only，不自动修复
- 不默认阻断任何操作
- 永远不自动改写正式层文件
- 多语言场景下结果仅供参考（语义推断受表述风格影响）

### 多项目案例

- 至少覆盖 3 类项目形态：SaaS / API 服务 / 工具库
- 重点展示：老项目接入 vs 从零开始的差异

### 成功标准
- 有 before/after 可量化证据（北极星②）
- 至少 2 个团队（非独立开发者）完成试点
- doctor 语义检查误报率 < 10%

---

## v0.5.0 — 低干预自治

**阶段定位：进入 Human-exception-only 期**
**目标：大多数更新不需要人逐条审核。**

### 置信度分层自动写入（两级缓冲）

**不直接写入 history/，分两级缓冲：**

```
级别 A：auto-staged（自动进入 staged/auto-confirmed/）
  ├── 来源明确的 revert 提交
  ├── 可验证的依赖替换事件
  └── 用户明确表述的否决（signal 明确）
  可追踪，可回滚，仍在缓冲区

级别 B：提升到 history/（满足额外条件后）
  ├── 来源明确
  ├── 类型明确
  ├── 非全局约束（不影响 output/no-go）
  └── 未与既有条目冲突
  满足全部条件才正式入库
```

history/ 自动写入可以有，但不是第一步默认动作。早期先让自动化积累可靠样本。

### Trust Policy 执行层

v0.1.0 定义了 Trust Policy 结构，v0.5.0 将其变成可执行的运行时配置，各条目按 Trust Policy 路由到对应处理流程。

### why graph 基础数据结构

每条约束可追溯来源 history 事件、约束类型（team-capacity / business / technical）、revisit_when 是否已满足。v0.5.0 只建数据结构，不做 UI。

### 约束冲突检测

- output.md no-go 与某 domain open questions 是否矛盾
- debt 的 revisit_when 条件是否已满足
- 同一 domain 下多条 rejection 是否互相排斥

### Git 工作流集成（基础）

- PR merge 后自动运行 cairn doctor
- PR 引入新依赖时提示更新 output.md stack
- 可选：PR review 中标注"此建议与某条 no-go 冲突"

### 成功标准
- 70% 的 history 条目不需要人工起草（北极星③）
- auto-confirmed → history 的提升准确率 > 90%
- 回滚功能正常运作

---

## v1.0.0 — 可持续证明成立

**阶段定位：Near-autonomous 验证**
**目标：Cairn 作为"AI 自动维护的项目路径依赖约束层"被证明是成立的。**

### 近自治的四个判断标准

1. 有人愿意长期维护：Cairn 仓库本身维护者不觉得这是负担
2. AI 能稳定命中：domain 命中率稳定，误匹配少
3. 仓库不快速腐烂：stale domain < 20%，no-go 有历史支撑率 > 90%
4. 升级不破坏旧项目：schema 迁移工具覆盖所有历史版本

### 人类角色的最终形态

| 原来（Human-authored）| 现在（Near-autonomous）|
|---|---|
| 写 history 条目 | 设置信任边界 |
| 更新 domain 文件 | 审核高风险事件 |
| 同步 output.md | 定期 cairn doctor 抽查 |
| 手动触发 sync | 回滚错误约束 |
| — | 调整自治阈值 |

### 交付物

- 稳定的三层协议（不再有 breaking change）
- 稳定的 CLI 命令面（4 个核心命令语义固定）
- 稳定的 MCP API（6 个工具向后兼容）
- 多项目长期案例（6 个月以上持续使用的真实案例）
- 官方推荐工作流：单人项目 / 小团队 / 高历史包袱项目
- 明确的边界定义：Cairn 是什么，不是什么

### 成功标准（北极星指标全部达成）
- 北极星①：初始化 < 20 分钟，staged 审核 < 2 分钟/条
- 北极星②：domain 命中满意度 > 70%，有可量化的重复错误减少证据
- 北极星③：自动草稿占比 > 70%，需要人工纠偏 < 10%

---

## 版本节奏总览

| 版本 | 别名 | 核心交付 | 自治阶段 |
|---|---|---|---|
| v0.0.1 ✓ | 协议存在 | 三层规范 + Skill + CLI + MCP | Human-authored |
| v0.0.2 ✓ | 多语言 | i18n + 中文文档 + 语言连续性 | Human-authored |
| v0.0.3 | 不容易死 | quick capture + doctor + stage review | Human-authored |
| v0.0.4 ✓ | 更准 | hooks 增强 + 跨 domain 注入 + MCP 优化 | Human-authored |
| v0.0.5 ✓ | 自动冷启动 | cairn analyze + 置信度候选 + init 集成 | Human-authored → reviewed |
| v0.0.6 | 基础设施化 | history schema + inspect + 迁移工具 | Human-reviewed |
| v0.1.0 | 半自动沉淀 | 对话分析 + Trust Policy + staged workflow | Human-reviewed |
| v0.2.0 | 团队可持续 | before/after 证据 + doctor 语义检查 | Human-reviewed |
| v0.5.0 | 低干预自治 | 两级自动写入 + Trust Policy 执行 + Git 集成 | Human-exception-only |
| v1.0.0 | 可持续证明 | 稳定协议 + 长期案例 + 官方工作流 | Near-autonomous |

---

## 刻意不做的事

**不做 SaaS 化。** file-based、repo-local、无服务依赖是 Cairn 最强的优势。产品化放在 v1.0 之后按需决定。

**不做更复杂的理论层。** output / domain / history / no-go / debt / pitfalls 已经够表达大多数真实问题。不再发明新层级或新约束类型。

**不急着扩工具适配。** 8 个工具已经覆盖主流。在命中率和维护成本没打下来之前，继续铺更多平台只会放大维护面。

**语义检索推迟到 v0.5.0 之后。** embedding + rerank 需要运行时依赖，破坏 file-based 气质。Frontmatter hooks + MCP 精准匹配在 v0.0.4 之后已经足够。

**doctor 语义检查永远不自动修复正式层。** advisory only，误报会严重损伤用户信任，多语言场景下尤其敏感。
