# Dogfood Findings

> Cairn 自身使用 Cairn 过程中发现的问题。每周末过一遍 `.cairn/blood/` 和 `.cairn/dna/staged/`,把不符合预期的现象列在这里 + 对应做回归测试。

---

## 模板

```markdown
## YYYY-MM-DD — 标题

**症状**:
**期望行为**:
**实际行为**:
**根因**(如已知):
**修复**(如已做):
**回归测试**(文件路径):
```

---

## Findings

### 2026-05-17 — Dogfood 启动

**症状**:Cairn 仓库尚未启用自身的 `.cairn/`。
**期望行为**:`cairn init` 后,Cairn 的开发会话开始产生 blood / staged。
**实际行为**:N/A — 启动时间点。
**根因**:N/A
**修复**:启动 30 天观察窗口,每周过一次。
**回归测试**:N/A

---

## 启动指南

```bash
cd /path/to/Cairn
node cli/dist/cli/index.js init   # 在本仓库根创建 .cairn/
git add .cairn/
git commit -m "chore: enable dogfood"
```

然后在每个 Claude Code / Codex 会话开始时,确保 cairn CLI 已安装并可用。

### 30 天检视清单

- [ ] 至少 20 条真实 blood event
- [ ] 至少 1 个 DNA trait 候选走完人工裁决流程(emerged 或 rejected)
- [ ] 至少 3 次 `cairn doctor --metrics` 输出快照
- [ ] 任何反直觉行为写入本文件 + 对应回归测试
- [ ] 性能数据更新到 `docs/PERFORMANCE.md`
