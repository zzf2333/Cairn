# Stability Contract

> 在 1.0 之前,所有契约都是 best-effort 但已经划线。**1.0 之后,本文档列出的 Stable 区段进入 SemVer 保护:破坏性变更必须 major bump,且承诺至少 6 个月不破坏。**

---

## Stable(SemVer 保护)

### MCP 工具签名

工具名 + 参数 schema + 返回结构是公开契约,工具消费者(Claude Code / Codex / 其他 MCP host)依赖它们。

| 工具 | 状态 |
|------|------|
| `cairn_init_status` | Stable |
| `cairn_init_commit` | Stable(`dry_run` 参数已加,后续只增不改) |
| `cairn_context` | Stable(返回字段只增不减) |
| `cairn_signal` | Stable |
| `cairn_session_end` | Stable(`decay` / `calibration` 输出字段只增不减) |
| `cairn_skeleton` / `cairn_skeleton_set` | Stable |
| `cairn_blood_list` / `cairn_blood_get` | Stable |
| `cairn_review_staged` / `cairn_review_decision` | Stable |
| `cairn_doctor` | Stable |
| `cairn_audit` | Stable |
| `cairn_dna_status` | Stable |
| `cairn_dna_review` | Stable |

### .cairn/ 顶层目录结构

```
.cairn/
├── config.yaml          ← Stable
├── state.yaml           ← Stable(字段只增,见下)
├── skeleton/            ← Stable
├── blood/               ← Stable
├── staged/              ← Stable
├── domains/             ← Stable
├── dna/identity.yaml    ← Stable
├── governance/          ← Stable
└── views/               ← Internal(可重生成,见下)
```

### config.yaml 字段

```yaml
project_name: string
domains: string[]
cognitive_mode: lightweight | standard | institutional
logging: { enabled: bool, retention_days: int }  # 0.4.0+
```

### state.yaml 字段

```yaml
cairn_version: string         # 0.4.0+, semver
initialization_status: not_initialized | partial | complete
last_session: { commit, ended_at }
stage: { phase, confidence, status, evidence, guidance, last_updated }
activation_log: { recent_hits }
session_in_progress?: { started_at, step }  # 0.4.0+
```

### CLI 子命令名与基本语义

`cairn init / status / doctor / review / audit / dna / skeleton / blood / stage / migrate` — 名字稳定,新增子命令属于增量,不算破坏。

---

## Experimental(可能在 1.x 内变更)

可能调整,但变更会在 CHANGELOG 显眼标注。

- **DNA trait 名集合**:目前只支持 `simplicity_bias` / `infra_aggressiveness`。后续可能新增、调整级别(low/medium/high)语义
- **Decay / Resurrection 阈值常量**:`constants.ts` 中的 `RESURRECTION_THRESHOLD`、`COGNITIVE_MODE_PARAMS.decayStaleDays` 等 — 长周期 dogfood 数据可能驱动调整
- **Governance policy 格式**:`governance/policy.yaml` 当前结构,可能扩展更细的 per-tool 配额
- **Calibration signal_type 集合**:`no_go_violation / skeleton_drift / debt_resolution / dna_drift` — 可能新增

---

## Internal(不承诺)

可以任意变更,不视为破坏:

- `.cairn/views/` 输出 markdown 格式 — 由 ViewsEngine 自动生成,使用者应消费工具输出而不是文件
- `.cairn/sessions/<session_id>.yaml` 内部字段
- `.cairn/staged/<id>.yaml` 中的 `routing_reason` 文本
- `.cairn/governance/audit.yaml` 条目格式
- 工具调用日志 `.cairn/logs/tools-YYYY-MM-DD.jsonl` 字段
- TrustRouter 的中间路由路径
- 任何 `src/` 下的内部 API(Store / Engine 类签名)

---

## 1.0 之后的承诺

- **6 个月不破坏 Stable**:Stable 区段任何破坏性变更必须 major bump,且发布前至少 6 个月公告
- **migrate 命令**:`.cairn/` schema 任何破坏性变更必须配套 `cairn migrate` 的自动迁移脚本
- **deprecation 窗口**:工具签名变更前必须经过 ≥1 minor 版本的 deprecation 警告

---

## 不在保护范围

- skill adapter 文件内容(`skills/codex.md` / `skills/claude-code/SKILL.md` 等)— 这些是协议提示,迭代频率较高
- 测试 fixture / scenarios — 实验性质
- 任何 CLAUDE.md / 内部设计文档