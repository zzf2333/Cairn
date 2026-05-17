# Recovery Guide

> `.cairn/` 是 git-tracked YAML 数据库。文件级损坏、未完成 session、孤儿引用都有受支持的恢复路径。

---

## 诊断:`cairn doctor --metrics`

任何怀疑数据有问题时先跑:

```bash
cairn doctor --metrics
```

输出健康快照:

```
.cairn health:
  cairn_version:       0.4.0
  blood events:        47 (44 active, 3 archived, 2 trauma)
  DNA identity:        emerged
  DNA traits:          2 (1 medium, 1 high)
  DNA reevaluation:    off
  DNA staged candid.:  0
  staged backlog:      3
  last session_end:    2 days ago
  stage:               maturity (confidence 0.84, advisory)
```

异常信号:
- `session_in_progress: YES` → 上一次 session_end 中断,跑 `cairn doctor --recover`
- `staged backlog` 持续上涨 → AI 没在调 `cairn_review_decision`
- `DNA reevaluation: ACTIVE` → 安全阀触发,traits 暂停影响,看 `cairn doctor` 输出

---

## 场景 1:损坏的 yaml 文件

**症状**:`cairn status` 报 `YAMLParseError`,或者 MCP server 启动失败。

**修复**:

```bash
cairn doctor --fix
```

行为:
- 扫描 `.cairn/blood/`、`.cairn/staged/`、`.cairn/skeleton/`、`.cairn/dna/staged/` 下所有 yaml
- 把无法 parse 的文件移到 `.cairn/quarantine/<timestamp>/`
- 报告 orphan_skeleton_ref(blood 引用了不存在的 skeleton domain),不自动删除 — 手动决定是补 skeleton 还是删 blood

`.cairn/quarantine/` 不会被 ViewsEngine / 任何 engine 读取,只是把坏数据从主路径上挪开。需要的话可以手动检查并恢复。

**例**:
```
=== Scanning for corruption ===
Scanned 47 yaml files, found 1 corruption(s).
  [yaml_parse_failure] /path/.cairn/blood/evo_abc.yaml
    YAMLParseError: Implicit map keys need to be on a single line at line 12

=== Quarantining ===
Moved 1 file(s) to quarantine:
  /path/.cairn/quarantine/2026-05-17T08-12-34-567Z/evo_abc.yaml
```

---

## 场景 2:未完成的 session_end

**症状**:`cairn doctor --metrics` 显示 `session_in_progress: YES`,或者 `cairn_init_status` 工具输出 `incomplete_session` 警告。

`cairn_session_end` 在每步骤之间写 checkpoint(`init` → `git_scan_done` → `decay_done` → `calibration_done` → `stage_done` → `compression_done`),完成后清掉。如果中途崩了,checkpoint 会留下。

**修复**:

```bash
cairn doctor --recover
```

行为:
- 清掉 `state.yaml` 的 `session_in_progress` 字段
- 不重做已完成的步骤(decay / calibration 等已经写到 blood / staged 的数据保留)

**注意**:被打断的步骤之后的副作用没跑(比如崩在 `decay_done`,calibration / stage / compression / views regen 都没跑)。修复之后建议重新跑一次 `cairn_session_end` 让流水线完整执行一遍 — 流水线对幂等性容忍(decay 重复执行不会重新标已 stale 的事件)。

---

## 场景 3:并发写入冲突

**症状**:理论上几乎不会发生 — 所有 store 写入用 `write+rename` 原子,POSIX 保证 rename 是原子的。两个会话同时写同一个文件,最后一个赢,但**绝不会**留下半写状态。

**验证**:
```bash
# 跑 stores 的原子写并发测试
npx vitest run tests/stores/atomic-write.test.ts
```

如果真的出现可疑情况(比如 yaml 末尾缺失字段),走场景 1 的 `doctor --fix` 流程。

---

## 场景 4:DNA reevaluation 触发后想退出

**症状**:`cairn doctor` 输出 `DNA Reevaluation Mode ACTIVE`,所有 DNA traits 不再影响 routing。

`reevaluation_mode` 是安全阀,在 calibration 检测到 traits 与近期信号严重不符时自动触发。它不是错误,是设计。

**退出方式**:
1. 看 `cairn dna show` 找出哪些 traits 引发了 drift
2. 决定是把这些 traits 重新评估(降 confidence 或改 level),还是直接 reject
3. 满意后跑 `cairn dna reevaluate` 切回 normal 模式

---

## 场景 5:`.cairn/` 整个被误删

**症状**:`cairn status` 报 `not_initialized`。

**修复**:
- 如果有 git 记录:`git checkout HEAD -- .cairn/`(`.cairn/` 是 git-tracked 的,这是最干净的恢复方式)
- 如果没有 git 记录:`cairn init` 重新初始化,丢失历史认知数据。AI 第一次 `cairn_context` 时会推断出大部分约束,但 trauma 标记和 DNA 状态会丢失

教训:**.cairn/ 必须 git-tracked**,这是项目认知的存档,不是 cache。

---

## 不在恢复范围

- 历史 `views/*.md` 损坏 — 直接重生成:`cairn status` 会自动触发
- `governance/audit.yaml` 单行损坏 — 不影响功能,可以手动编辑修复
- `sessions/*.yaml` 损坏 — 历史只读,损坏不影响新 session

---

## 引用

- 损坏检测实现:[`src/engines/recovery-engine.ts`](../mcp/src/engines/recovery-engine.ts)
- 原子写实现:[`src/utils/atomic-write.ts`](../mcp/src/utils/atomic-write.ts)
- session checkpoint:`state.session_in_progress` 字段,参见 [`STABILITY.md`](./STABILITY.md)
