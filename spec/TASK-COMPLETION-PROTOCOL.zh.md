English | [中文](TASK-COMPLETION-PROTOCOL.zh.md)

# Cairn 任务完成协议

> 状态：基于 MCP 的信号捕获取代手动反射块。
> 与 [spec/FORMAT.md](FORMAT.zh.md)（数据 schema）和
> `skills/claude-code/SKILL.md`（操作协议）配合使用。

---

## 任务完成行为

### 工作过程中

AI 在检测到约束相关事件时调用 `cairn_signal()`：

| 事件 | signal_type |
|------|-------------|
| 用户带理由拒绝建议 | `user-rejection` |
| 用户提及过去的尝试 | `historical-reference` |
| 用户声明业务或技术约束 | `user-constraint` |
| 做出重要技术决策 | `decision` |
| 发现并接受技术债 | `debt-acceptance` |

每个信号经过 Trust Router 路由：

- **L0** — 噪声或重复，丢弃
- **L1** — 保存到 `signals/` 等待积累
- **L2** — 保存到 `staged/` 等待人工审核
- **L3** — 直接写入 `memory/`，视图重新生成

无需手动文件操作。AI 收到路由结果后继续工作。

### 会话结束时

AI 调用 `cairn_session_end()`，传入：

- `summary` — 完成了什么
- `changed_domains` — 涉及的域
- `decisions_made` — 确定的决策
- `unresolved` — 未解决的问题

触发：
1. L1 信号批量处理（积累检查 → 可能升级为 L2）
2. 在 `.cairn/sessions/` 创建会话记录
3. 从当前记忆状态重新生成视图

---

## AI 不做的事

- **不** 直接写入 `.cairn/` 文件（memory、signals、staged、views）
- **不** 输出 "Cairn reflection" 块
- **不** 手动跟踪事件计数
- **不** 更新 `output.md` 或域文件 — Views Engine 负责处理
- **不** 决定信任等级 — Trust Router 负责路由

---

## 降级模式（无 MCP）

如果 MCP 工具不可用，AI 无法捕获信号。会话在没有记忆更新的情况下继续。`views/`
保持为最后生成的快照，可直接读取用于获取约束。

MCP 可用后信号捕获恢复。不会丢失数据 — `views/` 准确反映最后已知状态。

---

## 与其他规范的关系

- **[spec/FORMAT.md](FORMAT.zh.md)** — 所有 `.cairn/` 数据文件的 schema 参考
- **[spec/DESIGN.md](DESIGN.zh.md)** — Trust Router 和双耳架构的设计理念
- **[spec/adoption-guide.md](adoption-guide.zh.md)** — 安装和日常使用指南
- **`skills/claude-code/SKILL.md`** — AI 遵循的操作协议
