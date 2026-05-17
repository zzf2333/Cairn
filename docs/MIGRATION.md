# Migration Guide

> 升级路径速查。每个版本只列与上一版的差异。
>
> 通用流程:升级 npm 包 → 在项目根运行 `cairn migrate` → `cairn status` 验证 `cairn_version` 正确。

---

## 0.3.x → 0.4.0

**无破坏性变更。** `cairn migrate` 只会:

1. 给 `.cairn/state.yaml` 添加 `cairn_version: "0.4.0"` 字段
2. 不改任何已有数据

### 新增能力(可选启用)

| 能力 | 默认 | 启用方式 |
|------|------|----------|
| 工具调用结构化日志 | 开启 | `config.yaml` 中设 `logging.enabled: false` 关闭 |
| `cairn doctor --fix` 损坏自愈 | 手动触发 | `cairn doctor --fix` |
| `cairn doctor --recover` session 恢复 | 手动触发 | 见 [`RECOVERY.md`](./RECOVERY.md) |
| `cairn doctor --metrics` 健康指标 | 手动触发 | `cairn doctor --metrics` |
| `cairn_init_status` 输出 `warnings` 数组 | 自动 | 工具直接返回 |

### 升级步骤

```bash
# 1. 升级包
npm install -g cairn-mcp-server@0.4.0

# 2. 在项目根运行迁移
cd your-project
cairn migrate

# 3. 验证
cairn status
# 应看到 cairn_version: 0.4.0,无 warnings
```

### 回滚

0.4.0 的 state.yaml 在 0.3.x 下能被读取(`cairn_version` 字段会被忽略),但 `session_in_progress` 字段如果存在,0.3.x 会忽略 → 不影响运行,只是丢失 checkpoint 信息。建议:

```bash
# 回滚前先清掉 0.4.0 引入的字段
cairn doctor --recover    # 清掉任何未完成 session
# 然后降级
npm install -g cairn-mcp-server@0.3.0
```

---

## 版本检测行为

`cairn_init_status` 在以下情况会发出 `warnings`:

| 场景 | warning |
|------|---------|
| `.cairn/` 存在但 `state.yaml` 没 `cairn_version` | `cairn_version_missing` — 跑 `cairn migrate` 修复 |
| `state.yaml` 的版本低于运行时 | `cairn_version_older` — 跑 `cairn migrate` 应用迁移 |
| `state.yaml` 的版本高于运行时 | `cairn_version_newer` — 升级运行时,不要降级数据 |
| `state.yaml` 中有 `session_in_progress` | `incomplete_session` — 跑 `cairn doctor --recover` |

---

## 1.0 之前的承诺

0.x 系列遵循 best-effort 兼容,**不强制走 SemVer**。但每次破坏会在 CHANGELOG 显眼标注,且配套 `cairn migrate` 的自动迁移逻辑。

1.0 之后参见 [`STABILITY.md`](./STABILITY.md)。
