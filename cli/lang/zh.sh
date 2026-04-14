#!/usr/bin/env bash
# Cairn CLI — 中文字符串
# 与 en.sh 完全对应，所有 UI 文本为中文。
# 格式契约字段名（type:, domain: 等）、章节名、枚举值保持英文不变。
# Compatible with bash 3.2+ (macOS system bash).

# ── errors ────────────────────────────────────────────────────────────────────
msg_err_no_cairn()        { echo "当前目录及其所有父目录均未找到 .cairn/ 目录。"; }
msg_err_run_init()        { echo "  运行 cairn init 以在当前项目中初始化 Cairn。"; }
msg_err_unknown_cmd()     { echo "未知命令 '${1}'"; }
msg_err_run_help()        { echo "  运行 cairn help 查看用法。"; }
msg_err_unknown_flag()    { echo "未知选项 '${1}'"; }
msg_err_invalid_type()    { echo "无效的类型 '${1}'"; }
msg_err_valid_types()     { echo "  有效类型：decision, rejection, transition, debt, experiment"; }
msg_err_no_domain_idx()   { echo "索引 ${1} 处没有对应的域"; }
msg_err_domain_required() { echo "域（domain）为必填项"; }
msg_err_invalid_date()    { echo "日期格式无效 '${1}' — 期望格式为 YYYY-MM"; }
msg_err_summary_required(){ echo "摘要（summary）为必填项"; }
msg_err_rejected_required(){ echo "rejected 字段是必填项（最关键字段）"; }
msg_err_reason_required() { echo "原因（reason）为必填项"; }
msg_err_init_not_found()  { echo "未找到 cairn-init.sh，路径：${1}"; }
msg_err_ensure_repo()     { echo "  请确保完整的 Cairn 仓库可访问。"; }
msg_err_sync_specify()    { echo "请指定域名称或使用 --stale"; }
msg_err_unexpected_arg()  { echo "意外的参数 '${1}'"; }
msg_err_flag_conflict()   { echo "标志 ${1} 不能与 ${2} 同时使用"; }

# ── warnings ──────────────────────────────────────────────────────────────────
msg_warn_domain_not_locked()   { echo "'${1}' 不在已锁定的域列表中。"; }
msg_warn_locked_domains()      { echo "  已锁定的域：${1}"; }
msg_warn_continue_prompt()     { printf "  仍要继续？(yes/no): "; }
msg_warn_file_exists()         { echo "文件已存在：${1}"; }
msg_warn_unique_summary()      { echo "  请使用不同的 --summary 以生成唯一文件名。"; }
msg_warn_no_history()          { echo "域 '${1}' 没有找到历史记录条目"; }
msg_warn_record_first()        { echo "  请先使用 cairn log 记录一些决策。"; }
msg_warn_copy_unavailable()    { echo "--copy 需要 pbcopy (macOS) 或 xclip (Linux)"; }

# ── status labels ─────────────────────────────────────────────────────────────
msg_status_stage_unknown()     { echo "（未知）"; }
msg_status_no_domains()        { echo "未配置"; }
msg_status_active()            { echo "${1} 个活跃"; }
msg_status_not_created()       { echo "${1} 个尚未创建"; }
msg_status_active_and_not()    { echo "${1} 个活跃，${2} 个尚未创建"; }
msg_status_no_domains_hint()   { echo ".cairn/output.md hooks 章节中未配置任何域。"; }
msg_status_not_yet_created()   { echo "尚未创建"; }
msg_status_no_updated_date()   { echo "frontmatter 中无 updated 日期"; }
msg_status_up_to_date()        { echo "已是最新"; }
msg_status_last_updated()      { echo "最后更新 ${1}"; }
msg_status_new_since()         { echo "此后新增 ${1} $(msg_plural_history_entry "${1}")"; }
msg_status_run_sync()          { echo "运行：cairn sync ${1}"; }
msg_status_history_total()     { echo "历史记录：共 ${1} $(msg_plural_entry "${1}")"; }

# ── singular/plural helpers（中文不区分复数）────────────────────────────────
msg_plural_entry()         { echo "条"; }
msg_plural_history_entry() { echo "条历史记录"; }

# ── log interactive prompts ───────────────────────────────────────────────────
msg_log_type_header()          { echo "── type ──"; }
msg_log_type_decision()        { echo "decision    — 做出了技术选型"; }
msg_log_type_rejection()       { echo "rejection   — 某个方向被排除"; }
msg_log_type_transition()      { echo "transition  — 方案从 A 切换到 B"; }
msg_log_type_debt()            { echo "debt        — 接受或解决了技术债务"; }
msg_log_type_experiment()      { echo "experiment  — 探索性尝试已结束"; }
msg_log_type_prompt()          { printf "  条目类型（1-5 或类型名称）: "; }
msg_log_domain_header()        { echo "── domain ──"; }
msg_log_domain_prompt()        { printf "  域（名称或编号）: "; }
msg_log_date_prompt()          { printf "  决策日期 [%s]（YYYY-MM）: " "${1}"; }
msg_log_summary_prompt()       { printf "  摘要（一句话描述发生了什么）: "; }
msg_log_rejected_header()      { echo "── rejected ──（最关键字段）"; }
msg_log_rejected_hint()        { echo "  考虑过哪些替代方案但未选择？"; }
msg_log_rejected_label()       { echo "rejected:"; }
msg_log_reason_header()        { echo "── reason ──"; }
msg_log_reason_hint()          { echo "  为何选择此路径？"; }
msg_log_reason_label()         { echo "reason:"; }
msg_log_revisit_hint()         { echo "  revisit_when: 重新评估条件（可选，直接回车跳过）"; }
msg_log_revisit_prompt()       { printf "  revisit_when: "; }
msg_log_multiline_end()        { echo "（空行结束输入）"; }
msg_log_success()              { echo "已创建 ${1}"; }
msg_log_next_steps_header()    { echo "  后续步骤："; }
msg_log_next_status()          { echo "  · 运行 cairn status 检查是否有需要更新的域文件"; }
msg_log_next_sync()            { echo "  · 运行 cairn sync ${1} 生成更新的域文件"; }

# ── log --quick 模式 ──────────────────────────────────────────────────────────
msg_log_quick_header()         { echo "── 快速捕获（4 个字段 → staged/）──"; }
msg_log_quick_rejected_prompt(){ printf "  被否决的替代方案（一行）："; }
msg_log_quick_saved()          { echo "已保存到 ${1}"; }
msg_log_quick_todo_list()      { echo "  标记为 [TODO] 的字段：${1}"; }
msg_log_quick_next_step()      { echo "  · 运行 cairn stage review 补全并提升到 history/"; }
msg_err_file_exists_staged()   { echo "暂存条目已存在：${1}"; }
msg_err_file_exists_history()  { echo "同名历史条目已存在：${1}"; }

# ── sync UI messages ──────────────────────────────────────────────────────────
msg_sync_dry_run_header()      { echo "演习模式：cairn sync ${1}"; }
msg_sync_domain_exists()       { echo "域文件：已存在（更新于：${1}）"; }
msg_sync_domain_missing()      { echo "域文件：尚未创建 — 提示词将指示 AI 从头创建"; }
msg_sync_history_count()       { echo "历史条目数：${1}"; }
msg_sync_no_history_note()     { echo "注意：未找到历史条目 — 无内容可同步"; }
msg_sync_run_full()            { echo "运行 cairn sync ${1} 以生成完整提示词。"; }
msg_sync_no_stale()            { echo "未发现需要更新的域 — 所有域文件已是最新。"; }
msg_sync_verify()              { echo "运行 cairn status 验证。"; }
msg_sync_copied_pbcopy()       { echo "提示词已复制到剪贴板（pbcopy）"; }
msg_sync_copied_xclip()        { echo "提示词已复制到剪贴板（xclip）"; }
msg_sync_paste_hint()          { echo "  将其粘贴到您的 AI 工具中以生成更新的域文件。"; }
msg_sync_usage_domain()        { echo "    cairn sync <domain>     为指定域生成提示词"; }
msg_sync_usage_stale()         { echo "    cairn sync --stale      为所有需要更新的域生成提示词"; }
msg_sync_usage_dry_run()       { echo "    cairn sync <domain> --dry-run   仅显示摘要，不生成提示词"; }
msg_sync_no_history_domain()   { echo "域 '${1}' 未找到历史记录条目"; }
msg_sync_usage_hooks()         { echo "    cairn sync --hooks      从所有域文件 frontmatter 重新生成 ## hooks 章节"; }
msg_sync_hooks_paste_hint()    { echo "将上面内容粘贴到 .cairn/output.md 的 ## hooks 章节下，然后运行：cairn doctor"; }
msg_sync_hooks_empty()         { echo ".cairn/domains/ 中没有找到域文件 — 无内容可生成"; }

# ── help text ─────────────────────────────────────────────────────────────────
msg_help_tagline()             { echo "cairn — AI 路径依赖约束系统"; }
msg_help_usage_label()         { echo "用法："; }
msg_help_usage_line()          { echo "  cairn <命令> [参数]"; }
msg_help_commands_label()      { echo "命令："; }
msg_help_cmd_init()            { echo "交互式初始化当前项目的 .cairn/ 目录"; }
msg_help_cmd_status()          { echo "显示三层摘要及需要更新的域文件警告"; }
msg_help_cmd_log()             { echo "记录一条历史条目"; }
msg_help_cmd_sync()            { echo "生成 AI 提示词以根据历史更新域文件"; }
msg_help_cmd_doctor()          { echo "对 .cairn/ 结构进行健康检查（纯规则，无需 LLM）"; }
msg_help_cmd_stage()           { echo "管理暂存历史条目（审核 / 接受 / 跳过）"; }
msg_help_cmd_analyze()         { echo "分析 git 历史，生成暂存候选条目"; }
msg_help_cmd_version()         { echo "打印版本号"; }
msg_help_cmd_help()            { echo "打印此帮助信息"; }
msg_help_examples_label()      { echo "示例："; }
msg_help_spec_hint()           { echo "完整格式规范请参阅 spec/FORMAT.md。"; }

# ── sync AI prompt template ───────────────────────────────────────────────────
# Arguments: $1=domain $2=current_file_section $3=history_content $4=latest_date
tpl_sync_prompt() {
    local domain="$1"
    local current_file_section="$2"
    local history_content="$3"
    local latest_date="$4"

    cat <<PROMPT
你正在根据累积的历史条目更新一个 Cairn 域文件。
Cairn 是一个 AI 路径依赖约束系统。域文件提供预压缩的设计上下文，
在 AI 处理相关任务时注入使用。

${current_file_section}

## History entries for domain: ${domain} (chronological)
${history_content}
## 你的任务

使用以下**精确结构**为 \`${domain}\` 生成更新的域文件：

\`\`\`markdown
---
domain: ${domain}
hooks: ["keyword1", "keyword2", "..."]
updated: ${latest_date}
status: active
---

# ${domain}

## current design

[1–3 句话：当前设计状态、正在使用的主要选型、任何未解决的边界问题]

## trajectory

[按时间顺序。每个事件一行。格式：YYYY-MM <描述> → <变更原因（如有）>]

## rejected paths

- <选项>: <一句话说明拒绝原因>
  Re-evaluate when: <重新考虑的条件>

## known pitfalls

- <名称>: <触发条件> / <为何发生> / <绝对不要做什么>

## open questions

- <尚未解决的设计问题>
\`\`\`

## 规则

1. 覆盖整个文件 — 不要追加到现有内容
2. 文件总长度控制在 200–400 token 以内
3. 每一行都必须能改变 AI 的建议 — 如果删掉一行不影响 AI 建议，就删掉它
4. 历史条目中的 \`rejected\` 字段是最关键的内容 — 将所有被拒绝的替代方案都包含在 "rejected paths" 中
5. "known pitfalls" 是操作层面的陷阱，不是已接受的技术债务或方向性排除
6. 将 frontmatter 中的 \`updated:\` 设置为最新历史条目的 \`decision_date\`：${latest_date}
7. 如果域仍在演进，选择 \`status: active\`；如果已稳定，选择 \`status: stable\`
8. 所有内容使用与该域现有历史条目相同的语言撰写。章节标题和 frontmatter 字段名保持英文。
9. \`current design\`、\`rejected paths\` 和 \`known pitfalls\` 中的每条陈述都必须能追溯到具体的历史条目。你可以在行前加上来源文件名（例如 \`[2024-03_state-mgmt.md]\`）。禁止发明历史条目中不存在的结论。
10. 如果历史条目中没有与某条 \`rejected paths\` 对应的事件，删掉该条目。rejected paths 是对历史的压缩——不是推测。

完成后，将输出保存到：.cairn/domains/${domain}.md
然后运行：cairn status
PROMPT
}

# ── sync domain file section builders ────────────────────────────────────────
# $1=domain — returns the "current domain file" section header when file exists
tpl_sync_domain_exists_header() { echo "## Current domain file (.cairn/domains/${1}.md)"; }
# Returns the section when domain file does not exist yet
tpl_sync_domain_missing_section() {
    echo "## Current domain file"
    echo ""
    echo "该域文件尚不存在。请从头创建。"
}

# ── init script strings ───────────────────────────────────────────────────────
msg_init_title()               { echo "Cairn — AI 路径依赖约束系统"; }
msg_init_subtitle()            { echo "本脚本将在当前目录创建 .cairn/ 三层结构。"; }
msg_init_current_dir()         { echo "当前目录：${1}"; }
msg_init_exists_warning()      { echo ".cairn/ 目录已存在。"; }
msg_init_overwrite_prompt()    { printf "是否覆盖并重新初始化？（输入 yes 确认，其他任意键退出）："; }
msg_init_cancelled()           { echo "已取消，未做任何修改。"; }
msg_init_step_analyze()        { echo "分析 git 历史（可选）"; }
msg_init_analyze_detected()    { echo "检测到 git 仓库：${1} 个提交（首次提交 ${2}）"; }
msg_init_analyze_offer()       { printf "  分析 git 历史以预填候选条目？[Y/n]："; }
msg_init_analyze_running()     { echo "正在运行 git 分析..."; }
msg_init_analyze_done()        { echo "分析完成 — 使用以下命令审核候选条目：cairn stage review"; }
msg_init_analyze_skipped()     { echo "已跳过 git 分析。"; }
msg_init_analyze_no_git()      { echo "未检测到 git 仓库 — 跳过自动分析。"; }
msg_init_step_domains()        { echo "选择 Domain 列表"; }
msg_init_domains_intro()       { echo "以下是 11 个标准域，请输入编号（逗号分隔，如 1,2,4,5,9）："; }
msg_init_domains_custom()      { echo "也可直接输入自定义域名（kebab-case，空格或逗号分隔）："; }
msg_init_domains_prompt()      { printf "请选择（推荐选 3-7 个）："; }
msg_init_domain_out_of_range() { echo "  编号 ${1} 超出范围（1-11），已忽略"; }
msg_init_domain_invalid_name() { echo "  域名 '${1}' 格式无效（需为 kebab-case），已忽略"; }
msg_init_no_domains_selected() { echo "未选择任何域，请至少选择一个。"; }
msg_init_domains_selected()    { echo "已选择 ${1} 个域："; }
msg_init_step_output()         { echo "填写 output.md"; }
msg_init_stage_intro()         { echo "当前项目所处的阶段和决策模式"; }
msg_init_phase_prompt()        { printf "  phase（阶段名 + 起始时间，如 early-growth (2024-09+)）："; }
msg_init_mode_prompt()         { printf "  mode（优先级顺序，用 > 分隔）："; }
msg_init_team_prompt()         { printf "  team（团队规模和约束，如 2, no-ops）："; }
msg_init_reject_if_intro()     { echo "  reject-if：拒绝条件（如 migration > 1 week）。直接回车可跳过。"; }
msg_init_reject_if_prompt()    { printf "  reject-if："; }
msg_init_nogo_intro()          { echo "列出 AI 绝对不能建议的技术方向（每条一行，直接回车结束）"; }
msg_init_nogo_hint()           { echo "  提示：这里可以暂时留空，遇到 AI 犯错时再补"; }
msg_init_nogo_prompt()         { printf "  禁区方向（回车结束）："; }
msg_init_stack_intro()         { echo "记录当前技术选型……"; }
msg_init_stack_hint()          { echo "  直接回车结束"; }
msg_init_stack_prompt()        { printf "  技术栈条目（如 state: Zustand）："; }
msg_init_debt_intro()          { echo "记录已知技术债（格式：DEBT-KEY: 描述 [revisit_when: 条件]）"; }
msg_init_debt_hint1()          { echo "  用 accepted debt 告诉 AI 不要试图修复已知问题"; }
msg_init_debt_hint2()          { echo "  revisit_when：重新评估的条件（如 team > 5）"; }
msg_init_debt_hint3()          { echo "  直接回车结束"; }
msg_init_debt_prompt()         { printf "  技术债条目（回车结束）："; }
msg_init_output_created()      { echo "已生成 .cairn/output.md"; }
msg_init_step_history()        { echo "初始化 history/"; }
msg_init_history_created_dir() { echo "已创建 .cairn/history/ 目录"; }
msg_init_history_created_tpl() { echo "已创建 .cairn/history/_TEMPLATE.md（7 字段模板）"; }
msg_init_step_domains_dir()    { echo "初始化 domains/"; }
msg_init_domains_dir_note()    { echo ".cairn/domains/（空目录）"; }
msg_init_domains_dir_hint1()   { echo "  Domain 文件由 AI 生成（cairn sync）或手动创建"; }
msg_init_domains_dir_hint2()   { echo "  用于积累每个域的路径依赖约束"; }
msg_init_domains_dir_hint3()   { echo "  触发：output.md 的 hooks 节引用各域"; }
msg_init_domains_dir_hint4()   { echo "  更新：积累足够历史条目后运行 cairn sync <domain>"; }
msg_init_domains_dir_hint5()   { echo "  格式：frontmatter + 5 节（current design / trajectory / rejected paths / known pitfalls / open questions）"; }
msg_init_step_skills()         { echo "安装 Skill 适配文件"; }
msg_init_skills_intro()        { echo "请选择您使用的 AI 工具（多选，输入编号逗号分隔，如 1,2）："; }
msg_init_skills_skip()         { printf "  直接回车跳过此步骤："; }
msg_init_skills_skipped()      { echo "已跳过 Skill 安装"; }
msg_init_skills_unknown()      { echo "  未知选项 '${1}'，已忽略"; }
msg_init_written()             { echo "  已写入：${1}"; }
msg_init_appended()            { echo "  已追加到：${1}"; }
msg_init_agents_skipped()      { echo "  AGENTS.md 已写入（Codex/OpenCode 共用），跳过重复写入"; }
msg_init_done_title()          { echo "初始化完成"; }
msg_init_done_created()        { echo "已创建的文件："; }
msg_init_done_structure()      { echo "目录结构："; }
msg_init_layer1_desc()         { echo "  Layer 1：.cairn/output.md       — 全局约束，每次会话注入"; }
msg_init_layer2_desc()         { echo "  Layer 2：.cairn/domains/*.md    — 域上下文，规划时按需注入"; }
msg_init_layer3_desc()         { echo "  Layer 3：.cairn/history/*.md    — 决策历史，AI 精确查询"; }
msg_init_next_steps()          { echo "后续步骤："; }
msg_init_next1()               { echo "  1. 在 AI 工具中安装 Skill 适配文件（如果上一步跳过了）"; }
msg_init_next2()               { echo "  2. 每次 AI 会话开始时，Skill 会自动读取 .cairn/output.md"; }
msg_init_next3()               { echo "  3. 遇到架构决策时使用 'cairn log' 实时记录"; }
msg_init_next4()               { echo "  4. 积累足够决策后运行 'cairn sync <domain>' 更新域文件"; }

# ── doctor 健康检查 ───────────────────────────────────────────────────────────
msg_doctor_section_output()    { echo "output.md"; }
msg_doctor_section_domains()   { echo "domains"; }
msg_doctor_section_hooks()     { echo "hooks"; }
msg_doctor_section_staged()    { echo "staged"; }
msg_doctor_tokens_ok()         { echo "tokens: ≈${1}（目标 500 / 硬上限 800）"; }
msg_doctor_tokens_warn()       { echo "tokens: ≈${1} — 接近硬上限（目标 500 / 硬上限 800）"; }
msg_doctor_tokens_err()        { echo "tokens: ≈${1} — 超过硬上限 800，请压缩 output.md"; }
msg_doctor_nogo_unsupported()  { echo "no-go \"${1}\" 没有对应的 history 条目支撑"; }
msg_doctor_domain_ok()         { echo "${1}  ${2}，更新于 ${3}"; }
msg_doctor_domain_stale()      { echo "${1}  已过期：${2} 以来新增 ${3} $(msg_plural_history_entry "${3}") — 运行：cairn sync ${1}"; }
msg_doctor_domain_no_updated() { echo "${1}  frontmatter 中无 updated 日期"; }
msg_doctor_domain_not_created(){ echo "${1}  尚未创建"; }
msg_doctor_hooks_output_only() { echo "\"${1}\" 出现在 output.md hooks 中，但未出现在任何域的 hooks[]"; }
msg_doctor_hooks_domain_only() { echo "\"${1}\" 出现在域 ${2} 的 hooks[] 中，但未出现在 output.md hooks 章节"; }
msg_doctor_hooks_run_sync()    { echo "运行：cairn sync --hooks 重新生成 hooks 章节"; }
msg_doctor_staged_empty()      { echo "暂存队列为空，无待审核条目"; }
msg_doctor_staged_todo()       { echo "${1} 条暂存条目含 [TODO] 字段 — 运行：cairn stage review"; }
msg_doctor_staged_stale()      { echo "${1} 条暂存条目滞留超 14 天 — 请审核或丢弃"; }
msg_doctor_summary_ok()        { echo "未发现问题"; }
msg_doctor_summary_issues()    { echo "${1} 条警告/错误"; }
msg_plural_warn_error()        { echo "条警告/错误"; }
msg_doctor_output_missing()    { echo "未找到 output.md — 请运行 cairn init"; }

# ── stage review ──────────────────────────────────────────────────────────────
msg_stage_no_entries()         { echo ".cairn/staged/ 中没有暂存条目"; }
msg_stage_no_entries_hint()    { echo "  使用 'cairn log --quick' 或 cairn_propose MCP 工具创建暂存条目。"; }
msg_stage_entry_header()       { echo "[${1}/${2}] ${3}"; }
msg_stage_has_todo()           { echo "⚠  该条目存在 [TODO] 字段 — 建议补全后再接受"; }
msg_stage_prompt()             { printf "  (a)接受  (e)编辑  (s)跳过  (q)退出："; }
msg_stage_accept_confirm()     { printf "  含 [TODO] 字段，仍要接受？[y/N]："; }
msg_stage_accepted()           { echo "✓  已接受 → history/${1}"; }
msg_stage_accepted_next()      { echo "  · 运行 cairn sync ${1} 更新域文件"; }
msg_stage_conflict()           { echo "冲突：history/${1} 已存在 — 请手动重命名暂存文件"; }
msg_stage_skipped()            { echo "·  已跳过"; }
msg_stage_edit_hint()          { echo "  （编辑后重新显示条目）"; }
msg_stage_summary()            { echo "已接受 ${1} / 已跳过 ${2} / 已编辑 ${3}"; }
msg_stage_help()               { echo "用法：cairn stage review"; }
msg_stage_unknown_sub()        { echo "未知子命令 '${1}' — 请尝试：cairn stage review"; }

# ── history template ──────────────────────────────────────────────────────────
tpl_history_template() {
    cat <<'EOF'
# History Entry Template
# 复制此文件并按 YYYY-MM_<short-slug>.md 格式命名，然后填写以下字段。
# 示例文件名：2024-03_state-mgmt-to-zustand.md

type: <decision | rejection | transition | debt | experiment>
domain: <domain key — must match one of the locked domains>
decision_date: <YYYY-MM>
recorded_date: <YYYY-MM>
summary: <one sentence — what happened>
rejected: <what alternatives were considered and not chosen — MOST CRITICAL FIELD>
reason: <why this path was taken>
revisit_when: <condition under which this decision should be reconsidered>
EOF
}

# ── analyze 命令 ──────────────────────────────────────────────────────────────
msg_analyze_title()              { echo "Cairn Analyze — git 历史扫描"; }
msg_analyze_no_git()             { echo "当前目录不是 git 仓库 — cairn analyze 需要 git 历史"; }
msg_analyze_no_commits()         { echo "仓库中没有找到提交记录"; }
msg_analyze_no_cairn_warning()   { echo "未找到 .cairn/ 目录 — 请先运行 cairn init 初始化 Cairn"; }
msg_analyze_scanning()           { echo "正在扫描 git 历史..."; }
msg_analyze_git_info()           { echo "git 仓库：${1} 个提交，首次提交于 ${2}"; }
msg_analyze_dep_files_found()    { echo "找到依赖文件：${1}"; }
msg_analyze_no_dep_files()       { echo "未找到受支持的依赖文件（package.json / go.mod / requirements.txt / pyproject.toml / Cargo.toml）"; }
msg_analyze_phase_reverts()      { echo "revert 提交：找到 ${1} 个"; }
msg_analyze_phase_dep()          { echo "依赖移除：找到 ${1} 个"; }
msg_analyze_phase_keywords()     { echo "关键词匹配提交：找到 ${1} 个"; }
msg_analyze_phase_todos()        { echo "含 TODO/FIXME 文件：找到 ${1} 个"; }
msg_analyze_dry_run_banner()     { echo "[dry-run] 候选条目不写入 staged/"; }
msg_analyze_candidate_written()  { echo "  ✓ ${1}  [${2}]"; }
msg_analyze_summary_header()     { echo "已生成候选条目："; }
msg_analyze_summary_high()       { echo "  ● 高置信度   : ${1}  （revert、确认依赖移除）"; }
msg_analyze_summary_medium()     { echo "  ● 中置信度   : ${1}  （关键词匹配提交）"; }
msg_analyze_summary_low()        { echo "  ● 低置信度   : ${1}  （TODO/FIXME 密度）"; }
msg_analyze_summary_total()      { echo "  共 ${1} 条候选已写入 .cairn/staged/"; }
msg_analyze_dry_run_total()      { echo "  共 ${1} 条候选（dry-run 模式，未写入文件）"; }
msg_analyze_next_review()        { echo "下一步：运行 'cairn stage review' 审核并接受候选条目"; }
msg_analyze_next_noop()          { echo "未生成候选条目 — git 历史中可能未检测到可记录的事件。"; }
msg_analyze_stack_header()       { echo "检测到的技术栈（来自当前依赖文件）："; }
msg_analyze_stack_entry()        { echo "  · ${1}"; }
msg_analyze_stack_hint()         { echo "  → 将以上内容添加到 .cairn/output.md 的 stack 章节"; }
msg_analyze_limit_applied()      { echo "  （已限制：显示前 ${1} 条候选 — 使用 --limit 调整）"; }
msg_analyze_since_applied()      { echo "  （仅包含 ${1} 之后的提交）"; }
msg_analyze_skip_no_git()        { echo "  （跳过 git 分析 — 当前目录不是 git 仓库）"; }
msg_analyze_dep_removed()        { echo "移除了 ${1}（${2}）— ${3}"; }
msg_analyze_revert_found()       { echo "revert：${1}（${2}）"; }
msg_analyze_keyword_found()      { echo "关键词提交：${1}（${2}）"; }
msg_analyze_todo_file()          { echo "TODO/FIXME 位于 ${1}（${2} 处）"; }
msg_analyze_help()               { cat <<'HELP'
用法：cairn analyze [选项]

扫描 git 历史，生成暂存的历史条目候选，供用户审核。

选项：
  --dry-run          仅打印候选，不写入 staged/
  --since YYYY-MM-DD 只包含此日期之后的提交
  --limit N          候选最大数量（默认：30）
  --only TYPE,...    只生成指定类型：revert,dep,keyword,todo

候选置信度：
  high（高）  — revert 提交和确认的依赖移除（有 diff 证据）
  medium（中）— 关键词匹配的提交信息（migrate、replace、drop、refactor）
  low（低）   — 源文件中的 TODO/FIXME 密度

运行后：cairn stage review
HELP
}

# stage 元数据展示（analyze 生成的条目）
msg_stage_analyze_meta()        { echo "  [置信度：${1} | 来源：${2}]"; }
msg_stage_low_confidence_warn() { echo "⚠  低置信度 — 请在接受前核实此候选条目"; }
msg_stage_meta_stripped()       { true; }  # 接受时静默剥离 analyze 元注释
