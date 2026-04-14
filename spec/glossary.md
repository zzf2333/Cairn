# Cairn Glossary / 术语表

Bilingual reference for core Cairn concepts. All Chinese translations in `.zh.md` documents must follow this table.

| English | 中文 | Notes |
|---------|------|-------|
| path-dependency | 路径依赖 | Core concept: past decisions constrain future choices |
| constraint system | 约束系统 | What Cairn is |
| no-go | 禁区方向 | Technical directions AI must never suggest; first occurrence should note the English term in parentheses |
| accepted debt | 已接受的技术债 | Known issues intentionally left in place, with `revisit_when` |
| known pitfalls | 已知陷阱 | Operational traps to avoid; no `revisit_when` |
| three-layer architecture | 三层架构 | output.md / domains/ / history/ |
| Layer 1 / output.md | 第一层 / 全局约束 | Always-on global constraints |
| Layer 2 / domains/ | 第二层 / 域上下文 | Per-domain design context, injected on demand |
| Layer 3 / history/ | 第三层 / 决策历史 | Raw decision events, queried on demand |
| hooks | 关键词触发（hooks） | Keywords that trigger domain file injection |
| domain files | 域文件 | Per-domain constraint files in `.cairn/domains/` |
| history entries | 历史条目 | Decision records in `.cairn/history/` |
| skill adapter | Skill 适配文件 | Per-tool behavior instructions |
| stale domain | 需更新的域文件 | Domain file not updated after recent history entries |
| reactive operation | 响应式操作 | Maintaining `.cairn/` in response to events, not on a schedule |
| slug | 文件名标识符 | ASCII short identifier in history filenames |
| current design | 当前设计 | Active state of a domain |
| trajectory | 发展轨迹 | Chronological list of design changes in a domain file |
| rejected paths | 被拒路径 | Directions evaluated and excluded, recorded in domain files |
| open questions | 开放问题 | Unresolved design decisions affecting a domain |
| init | 初始化 | One-time historical inventory when adopting Cairn |
| injection timing | 注入时机 | When each layer is read by the AI |
| token budget | Token 预算 | Size limit for each layer |
| frontmatter | 前置元数据 | YAML header block in domain files |
| staging area | 暂存区 | `.cairn/staged/` — where `cairn_propose` writes before human review |
| human-in-the-loop | 人工审核 | Principle that AI proposes, humans approve |
