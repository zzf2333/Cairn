# Troubleshooting

> 症状 → 诊断 → 修复。从最常见到最深的顺序。

---

## 1. AI 不调 `cairn_context`,直接给建议

**症状**:你能看到工具列表里有 `cairn_context`,但模型不主动用。

**诊断**:
- 确认对应平台的 SKILL/skill adapter 文件正确加载(`skills/codex.md` 或 `skills/claude-code/SKILL.md`)
- 确认 protocol 文本里"BEFORE every response"的提示存在
- 跑一次 `cairn doctor --metrics`,看 `last session_end` 是否过期

**修复**:
- 对 Codex:把 `<!-- cairn:start --> ... <!-- cairn:end -->` 段添加到 `~/.codex/AGENTS.md` 或项目级 `AGENTS.md`
- 对 Claude Code:确认项目根有 `.claude/CLAUDE.md` 引用 `skills/claude-code/SKILL.md`
- 重启 host(Codex CLI / Claude Code)让 protocol 重新加载

---

## 2. `staged/` 越堆越多,AI 不在 review

**症状**:`cairn doctor --metrics` 显示 `staged backlog: 47`,数字一直上涨。

**诊断**:
- AI 调用 `cairn_session_end` 后是否 surface 了 staged 数量?
- 看 `cairn_init_status` 输出有没有 `incomplete_session` warning

**修复**:
- 手动跑 `cairn review` 列出所有 staged,然后用 CLI 或者跟 AI 说"请用 cairn_stage_list 处理待审条目"
- 长期方案:确保每次 session 结尾让 AI 处理 staged

---

## 3. DNA 反复 emerge 然后又 drift

**症状**:`cairn doctor` 频繁报 `entered_reevaluation`,DNA trait 出现 → drift → reset 循环。

**诊断**:
- 跑 `cairn dna show` 看 trait 的 `evidence_count` 和 `drift_warning_count`
- 比对 `evidence_count` 是否真足够(≥ 5 for lightweight, ≥ 3 for standard)
- 看 calibration signals 里 `dna_drift` 数量

**根因**:项目实际在演化(原本简洁,后来需要复杂基础设施),但 DNA 还在用早期的 trait。

**修复**:
- 跑 `cairn dna reevaluate` 切回 normal,逐个 trait 重判
- 或者 reject 已过时的 trait,让新数据自然涌现新 trait

---

## 4. `cairn_context` 总返回空的 constraints/no_go

**症状**:即使 blood 里有相关 G3 事件,AI 拿到的 `no_go` 是空数组。

**诊断**:
- 跑 `cairn doctor --metrics`,看 `blood events: N active`
- 在 `cairn_context` 调用时传 `task` 参数,确保和 skeleton 节点的 `causal_keywords` 有词重叠
- 看 skeleton 配置:`cairn skeleton` 列出所有节点

**根因**:ActivationEngine 是基于 task → skeleton → 域过滤的因果检索。如果 task keyword 没匹配到任何 skeleton 节点,就不展开到 blood。

**修复**:
- 给 skeleton 节点加更多 `causal_keywords`,覆盖你项目的真实词汇
- 重启 MCP server 让 cache 失效

---

## 5. 阈值不合适(decay 太激进/太慢)

**症状**:重要事件提前被 archive,或者陈旧事件永远不退场。

**诊断**:
- `cairn doctor --metrics` 看 `archived events: N`
- 看 `config.yaml` 的 `cognitive_mode`(lightweight / standard / institutional)
- 不同 mode 的 decay 窗口在 `mcp/src/constants.ts` 的 `COGNITIVE_MODE_PARAMS`

**修复**:
- 短期项目(side project)用 `lightweight`,decay 30/60 天
- 主力项目用 `standard`(默认),90/120 天
- 企业级 / 合规项目用 `institutional`,180/240 天

切换 mode:编辑 `.cairn/config.yaml` 的 `cognitive_mode` 字段。

---

## 6. Trauma 标记后,合理的相关建议也被拒

**症状**:某个 trauma 事件标了 MongoDB,现在连"在 unrelated 模块用 MongoDB 的子模块功能"都被 challenge 拦截。

**诊断**:
- `cairn blood show <id>` 查 trauma 事件
- 看 `trauma.sensitivity_multiplier` 数值(默认 1.5,可手调)
- 看 `trauma.domain` 是否过宽

**修复**:
- 编辑该 blood 文件,缩小 trauma scope:从 `domain: data-layer` 改为 `domain: orders-storage`
- 或者把 `sensitivity_multiplier` 从 1.5 降到 1.2

注意:不要随意把 trauma 改 `is_trauma: false`,这就是 trauma 机制的设计意图 — **scar tissue 不是 preference**。

---

## 7. `cairn_session_end` 中途崩溃

**症状**:`cairn doctor --metrics` 显示 `session_in_progress: YES`。

**修复**:见 [`RECOVERY.md`](./RECOVERY.md) 场景 2。

---

## 8. 损坏的 yaml 文件让 MCP server 启不来

**症状**:Codex / Claude Code 报 `cairn` 工具不可用,或 MCP 启动失败。

**修复**:
```bash
cairn doctor --fix
```

详见 [`RECOVERY.md`](./RECOVERY.md) 场景 1。

---

## 9. 性能慢(activate 或 session_end 超过预期)

**症状**:`cairn_context` 响应时长 ≥ 1s,session_end ≥ 10s。

**诊断**:
- 跑 `npm run bench` 在你的硬件上的基准
- 对照 [`PERFORMANCE.md`](./PERFORMANCE.md) 看是否在 SLO 范围内

**根因**:
- BloodStore cache 失效频繁(每次 save 都 invalidate)— 如果 AI 每次 activate 都伴随 signal/save,cache 命中率会低
- yaml parse 在大规模下是瓶颈

**修复**:
- 0.4 已加 cache,1k 规模应在 p99 ≤ 50ms
- 如果远超,看 `.cairn/blood/` 文件总数,可能有大量 archived 没清

---

## 10. 跨项目共享 / 多个 .cairn/

**症状**:在 monorepo 中,子项目想各自维护 .cairn/。

**修复**:
- 给每个子项目设置环境变量 `CAIRN_ROOT=/path/to/subproject`
- 或者 MCP 配置里用 `env = { CAIRN_ROOT = "..." }`(见 README "MCP Configuration")

---

## 找不到答案?

1. 跑 `cairn doctor --metrics` 把输出贴到 issue
2. 跑 `cairn doctor` 看一致性 violations
3. 检查 `.cairn/logs/tools-YYYY-MM-DD.jsonl` 最近的失败工具调用
4. 提 issue:https://github.com/zzf2333/Cairn/issues
