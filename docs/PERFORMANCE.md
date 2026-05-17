# Performance Benchmarks

> 测量方法:`npm run bench` 跑 `tests/performance/benchmark.test.ts`,在 vitest 隔离 tmpdir 中真实创建 N 个 blood event,然后跑 20 次 `cairn_context` activate 测 p50/p99,跑一次完整 `cairn_session_end`。
>
> 测试机:Apple Silicon,Node 22。规模 1k 以上数据反映了真实 IO 与 yaml parse 成本。

---

## 0.4.0 基准

| 规模 (blood events) | activate p50 | activate p99 | session_end |
|---------------------|--------------|--------------|-------------|
| 100                 |    ~4ms      |    ~5ms      |   ~125ms    |
| 1,000               |   ~11ms      |   ~15ms      |   ~115ms    |

### SLO

| 操作 | 规模 | 阈值 | 状态 |
|------|------|------|------|
| `cairn_context` activate | ≤ 1,000 | p99 ≤ 500ms | ✅ (~15ms, 33× 余裕) |
| `cairn_session_end` 全流水线 | ≤ 1,000 | ≤ 5,000ms | ✅ (~115ms, 43× 余裕) |

### 关键优化(0.3 → 0.4)

| 优化 | 来源 | 影响 |
|------|------|------|
| `BloodStore` in-memory cache | `src/stores/blood-store.ts` | 1k 规模 activate p99 从 1715ms → 14.8ms(**~115× 提速**) |
| `recordActivationBatch` 单写 | `src/stores/state-store.ts` + activation engine | 消除每次 activate 时 N 次 state.yaml IO |
| `atomicWriteFile` write+rename | `src/utils/atomic-write.ts` | 并发安全,无 perf 退化 |

cache 在 `BloodStore.save / remove` 时 invalidate。多个工具调用之间共享同一 ctx → 同一 BloodStore 实例 → cache 起作用。

---

## 10k 规模(暂未纳入 SLO)

实测 setup 阶段(逐个 `bloodStore.save` 10k 文件)需要 ~6 分钟,这是 Node fs.writeFile 自身的 IO 极限,不是 Cairn 逻辑。

加 cache 后,**单次 activate 在 10k 规模下预计 ~150ms**(基于 1k → 11ms 的线性外推,cache hit 时主要成本是 in-memory 过滤),但因为 setup 太慢,vitest 默认 timeout 阻挡正式纳入 SLO。

后续如果要正式承诺 10k SLO:
- 选项 1:写一次性 setup script(并行 mkdir+fs.write,绕过 BloodStore.save)
- 选项 2:实测一份"自然增长到 10k"的真实数据 dogfood 样本
- 选项 3:把 yaml 写入改为批量(单文件 multiple events),牺牲 git diff 可读性

1.0 之前在 dogfood 真实积累到 ≥ 1,000 event 之前不需要预先承诺 10k SLO。

---

## 更新基准

```bash
cd mcp
npm run bench
```

输出会在 console 打印一份表格,把当前测试机的数据回填到本文档。

性能退步(任一规模 p99 > SLO)会让 `npm run bench` 测试 fail。

---

## 不在范围

- 内存占用(目前 BloodStore cache 持有全部 blood events,1k 量级约 5MB,10k 约 50MB — 可接受)
- 启动冷启动(`createContext` 初始化 stores/engines)— 单进程长期运行,非热点
- 多进程并发(目前 Cairn 假设单 MCP server 进程)
