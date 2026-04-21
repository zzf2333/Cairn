#!/usr/bin/env bash
# Cairn CLI — English strings
# One function per message. Callers: source this file, then call msg_*() or tpl_*().
# Compatible with bash 3.2+ (macOS system bash).

# ── errors ────────────────────────────────────────────────────────────────────
msg_err_no_cairn()        { echo "no .cairn/ directory found in this directory or any parent."; }
msg_err_run_init()        { echo "  Run cairn init to initialize Cairn in the current project."; }
msg_err_unknown_cmd()     { echo "unknown command '${1}'"; }
msg_err_run_help()        { echo "  Run cairn help for usage."; }
msg_err_unknown_flag()    { echo "unknown flag '${1}'"; }
msg_err_invalid_type()    { echo "invalid type '${1}'"; }
msg_err_valid_types()     { echo "  Valid types: decision, rejection, transition, debt, experiment"; }
msg_err_no_domain_idx()   { echo "no domain at index ${1}"; }
msg_err_domain_required() { echo "domain is required"; }
msg_err_invalid_date()    { echo "invalid date format '${1}' — expected YYYY-MM"; }
msg_err_summary_required(){ echo "summary is required"; }
msg_err_rejected_required(){ echo "rejected field is required (most critical field)"; }
msg_err_reason_required() { echo "reason is required"; }
msg_err_init_not_found()  { echo "cairn-init.sh not found at: ${1}"; }
msg_err_ensure_repo()     { echo "  Ensure the full Cairn repository is available."; }
msg_err_sync_specify()    { echo "specify a domain name or use --stale"; }
msg_err_unexpected_arg()  { echo "unexpected argument '${1}'"; }
msg_err_flag_conflict()   { echo "flag ${1} cannot be combined with ${2}"; }

# ── warnings ──────────────────────────────────────────────────────────────────
msg_warn_domain_not_locked()   { echo "'${1}' is not in the locked domain list."; }
msg_warn_locked_domains()      { echo "  Locked domains: ${1}"; }
msg_warn_continue_prompt()     { printf "  Continue anyway? (yes/no): "; }
msg_warn_file_exists()         { echo "file already exists: ${1}"; }
msg_warn_unique_summary()      { echo "  Use a different --summary to generate a unique filename."; }
msg_warn_no_history()          { echo "no history entries found for domain '${1}'"; }
msg_warn_record_first()        { echo "  Record some decisions first with cairn log."; }
msg_warn_copy_unavailable()    { echo "--copy requires pbcopy (macOS) or xclip (Linux)"; }

# ── status labels ─────────────────────────────────────────────────────────────
msg_status_stage_unknown()     { echo "(unknown)"; }
msg_status_no_domains()        { echo "none configured"; }
msg_status_active()            { echo "${1} active"; }
msg_status_not_created()       { echo "${1} not created"; }
msg_status_active_and_not()    { echo "${1} active, ${2} not created"; }
msg_status_no_domains_hint()   { echo "No domains configured in .cairn/output.md hooks section."; }
msg_status_not_yet_created()   { echo "not yet created"; }
msg_status_no_updated_date()   { echo "no updated date in frontmatter"; }
msg_status_up_to_date()        { echo "up to date"; }
msg_status_last_updated()      { echo "last updated ${1}"; }
msg_status_new_since()         { echo "${1} new $(msg_plural_history_entry "${1}") since"; }
msg_status_run_sync()          { echo "run: cairn sync ${1}"; }
msg_status_history_total()     { echo "history: ${1} $(msg_plural_entry "${1}") total"; }

# ── singular/plural helpers ───────────────────────────────────────────────────
msg_plural_entry()         { [ "${1}" -eq 1 ] && echo "entry"         || echo "entries"; }
msg_plural_history_entry() { [ "${1}" -eq 1 ] && echo "history entry" || echo "history entries"; }

# ── log interactive prompts ───────────────────────────────────────────────────
msg_log_type_header()          { echo "── type ──"; }
msg_log_type_decision()        { echo "decision    — a technology choice was made"; }
msg_log_type_rejection()       { echo "rejection   — a direction was excluded"; }
msg_log_type_transition()      { echo "transition  — approach changed from A to B"; }
msg_log_type_debt()            { echo "debt        — technical debt accepted or resolved"; }
msg_log_type_experiment()      { echo "experiment  — exploratory attempt concluded"; }
msg_log_type_prompt()          { printf "  Entry type (1-5 or name): "; }
msg_log_domain_header()        { echo "── domain ──"; }
msg_log_domain_prompt()        { printf "  Domain (name or number): "; }
msg_log_date_prompt()          { printf "  Decision date [%s] (YYYY-MM): " "${1}"; }
msg_log_summary_prompt()       { printf "  Summary (one sentence — what happened): "; }
msg_log_rejected_header()      { echo "── rejected ── (most critical field)"; }
msg_log_rejected_hint()        { echo "  What alternatives were considered and not chosen?"; }
msg_log_rejected_label()       { echo "rejected:"; }
msg_log_reason_header()        { echo "── reason ──"; }
msg_log_reason_hint()          { echo "  Why was this path taken?"; }
msg_log_reason_label()         { echo "reason:"; }
msg_log_revisit_hint()         { echo "  revisit_when: condition for re-evaluation (optional, press Enter to skip)"; }
msg_log_revisit_prompt()       { printf "  revisit_when: "; }
msg_log_multiline_end()        { echo "(end with empty line)"; }
msg_log_success()              { echo "Created ${1}"; }
msg_log_next_steps_header()    { echo "  Next steps:"; }
msg_log_next_status()          { echo "  · Run cairn status to check for stale domain files"; }
msg_log_next_sync()            { echo "  · Run cairn sync ${1} to generate an updated domain file"; }

# ── log --quick mode ──────────────────────────────────────────────────────────
msg_log_quick_header()         { echo "── quick capture (4 fields → staged/) ──"; }
msg_log_quick_rejected_prompt(){ printf "  Rejected alternative (one line): "; }
msg_log_quick_saved()          { echo "Saved to ${1}"; }
msg_log_quick_todo_list()      { echo "  Fields marked [TODO]: ${1}"; }
msg_log_quick_next_step()      { echo "  · Run cairn stage review to complete and promote to history/"; }
msg_err_file_exists_staged()   { echo "staged entry already exists: ${1}"; }
msg_err_file_exists_history()  { echo "history entry with this filename already exists: ${1}"; }

# ── sync UI messages ──────────────────────────────────────────────────────────
msg_sync_dry_run_header()      { echo "Dry run: cairn sync ${1}"; }
msg_sync_domain_exists()       { echo "Domain file: exists (updated: ${1})"; }
msg_sync_domain_missing()      { echo "Domain file: not yet created — prompt will instruct AI to create it"; }
msg_sync_history_count()       { echo "History entries: ${1}"; }
msg_sync_no_history_note()     { echo "Note: no history entries found — nothing to sync"; }
msg_sync_run_full()            { echo "Run cairn sync ${1} to generate the full prompt."; }
msg_sync_no_stale()            { echo "No stale domains found — all domain files are up to date."; }
msg_sync_verify()              { echo "Run cairn status to verify."; }
msg_sync_copied_pbcopy()       { echo "Prompt copied to clipboard (pbcopy)"; }
msg_sync_copied_xclip()        { echo "Prompt copied to clipboard (xclip)"; }
msg_sync_paste_hint()          { echo "  Paste it into your AI tool to generate the updated domain file."; }
msg_sync_usage_domain()        { echo "    cairn sync <domain>     Generate prompt for a specific domain"; }
msg_sync_usage_stale()         { echo "    cairn sync --stale      Generate prompts for all stale domains"; }
msg_sync_usage_dry_run()       { echo "    cairn sync <domain> --dry-run   Show summary without generating prompt"; }
msg_sync_no_history_domain()   { echo "no history entries found for domain '${1}'"; }
msg_sync_usage_hooks()         { echo "    cairn sync --hooks      Regenerate the ## hooks section from all domain frontmatter"; }
msg_sync_hooks_paste_hint()    { echo "Paste this under '## hooks' in .cairn/output.md, then run: cairn doctor"; }
msg_sync_hooks_empty()         { echo "No domain files found in .cairn/domains/ — nothing to generate"; }

# ── help text ─────────────────────────────────────────────────────────────────
msg_help_tagline()             { echo "cairn — AI path-dependency constraint system"; }
msg_help_usage_label()         { echo "Usage:"; }
msg_help_usage_line()          { echo "  cairn <command> [arguments]"; }
msg_help_commands_label()      { echo "Commands:"; }
msg_help_cmd_init()            { echo "Interactively initialize .cairn/ in the current project"; }
msg_help_cmd_status()          { echo "Show three-layer summary and stale domain warnings"; }
msg_help_cmd_log()             { echo "Record a history entry"; }
msg_help_cmd_sync()            { echo "Generate an AI prompt to update a domain file from history"; }
msg_help_cmd_version()         { echo "Print version"; }
msg_help_cmd_help()            { echo "Print this help message"; }
msg_help_cmd_doctor()          { echo "Run health checks on the .cairn/ structure (rules-only, no LLM)"; }
msg_help_cmd_stage()           { echo "Manage staged history entries (review / accept / skip)"; }
msg_help_cmd_analyze()         { echo "Analyze git history to generate staged candidates"; }
msg_help_cmd_reflect()         { echo "Reflect on recent work and generate staged update candidates"; }
msg_help_cmd_audit()           { echo "Track migration cleanup: start an audit or scan for residue"; }
msg_help_examples_label()      { echo "Examples:"; }
msg_help_spec_hint()           { echo "See spec/FORMAT.md for the full Cairn format specification."; }

# ── sync AI prompt template ───────────────────────────────────────────────────
# Arguments: $1=domain $2=current_file_section $3=history_content $4=latest_date
tpl_sync_prompt() {
    local domain="$1"
    local current_file_section="$2"
    local history_content="$3"
    local latest_date="$4"

    cat <<PROMPT
You are updating a Cairn domain file based on accumulated history entries.
Cairn is an AI path-dependency constraint system. Domain files provide
pre-compressed design context that is injected when the AI works on related tasks.

${current_file_section}

## History entries for domain: ${domain} (chronological)
${history_content}
## Your task

Generate an updated domain file for \`${domain}\` using EXACTLY this structure:

\`\`\`markdown
---
domain: ${domain}
hooks: ["keyword1", "keyword2", "..."]
updated: ${latest_date}
status: active
---

# ${domain}

## current design

[1–3 sentences: current design state, primary choice in use, any unresolved boundary]

## trajectory

[Chronological. One line per event. Format: YYYY-MM <description> → <reason if changed>]

## rejected paths

- <option>: <rejection reason, one sentence>
  Re-evaluate when: <condition for reconsideration>

## known pitfalls

- <name>: <trigger> / <why it happens> / <what NOT to do>

## open questions

- <unresolved design question>
\`\`\`

## Rules

1. OVERWRITE the entire file — do not append to the existing content
2. Keep the total file length within 200–400 tokens
3. Every line MUST change AI behavior — if removing a line wouldn't change AI suggestions, delete it
4. The \`rejected\` fields in history entries are the most critical content — include ALL rejected alternatives in "rejected paths"
5. "known pitfalls" are operational traps, NOT accepted debts or direction exclusions
6. Set \`updated:\` in frontmatter to the latest history entry's \`decision_date\`: ${latest_date}
7. Choose \`status: active\` if the domain is still evolving, \`status: stable\` if settled
8. Write all content in the same language as the existing history entries for this domain. Keep section headers and frontmatter field names in English regardless.
9. Every statement in \`current design\`, \`rejected paths\`, and \`known pitfalls\` MUST trace back to a specific history entry. You MAY prefix lines with the source filename (e.g. \`[2024-03_state-mgmt.md]\`). Do NOT invent conclusions absent from the provided history.
10. If history contains no event matching a \`rejected paths\` bullet, delete the bullet. Rejected paths compress history — they do not speculate.

When done, save the output to: .cairn/domains/${domain}.md
Then run: cairn status
PROMPT
}

# ── sync domain file section builders ────────────────────────────────────────
# $1=domain — returns the "current domain file" section header when file exists
tpl_sync_domain_exists_header() { echo "## Current domain file (.cairn/domains/${1}.md)"; }
# Returns the section when domain file does not exist yet
tpl_sync_domain_missing_section() {
    echo "## Current domain file"
    echo ""
    echo "This domain file does not exist yet. Create it from scratch."
}

# ── init script strings ───────────────────────────────────────────────────────
msg_init_title()               { echo "Cairn — AI path-dependency constraint system"; }
msg_init_subtitle()            { echo "This script creates the .cairn/ three-layer structure in your current directory."; }
msg_init_current_dir()         { echo "Current directory: ${1}"; }
msg_init_exists_warning()      { echo ".cairn/ directory already exists."; }
msg_init_overwrite_prompt()    { printf "Overwrite and re-initialize? (type yes to confirm, any other key exits): "; }
msg_init_cancelled()           { echo "Cancelled — no changes made."; }
msg_init_step_analyze()        { echo "Analyze git history (optional)"; }
msg_init_analyze_detected()    { echo "Detected git repository: ${1} commits (first commit ${2})"; }
msg_init_analyze_offer()       { printf "  Analyze git history to pre-fill candidates? [Y/n]: "; }
msg_init_analyze_running()     { echo "Running git analysis..."; }
msg_init_analyze_done()        { echo "Analysis complete — review candidates with: cairn stage review"; }
msg_init_analyze_skipped()     { echo "Git analysis skipped."; }
msg_init_analyze_no_git()      { echo "No git repository detected — skipping automatic analysis."; }
msg_init_step_domains()        { echo "Select domain list"; }
msg_init_domains_intro()       { echo "The following 11 standard domains are available. Enter numbers (comma-separated, e.g. 1,2,4,5,9):"; }
msg_init_domains_custom()      { echo "Or enter custom domain names (kebab-case, space or comma separated):"; }
msg_init_domains_prompt()      { printf "Select (recommend 3-7): "; }
msg_init_domain_out_of_range() { echo "  Index ${1} out of range (1-11), skipped"; }
msg_init_domain_invalid_name() { echo "  Domain '${1}' is invalid (must be kebab-case), skipped"; }
msg_init_no_domains_selected() { echo "No domains selected. Please select at least one."; }
msg_init_domains_selected()    { echo "Selected ${1} domain(s):"; }
msg_init_step_output()         { echo "Fill in output.md"; }
msg_init_stage_intro()         { echo "Current project stage and decision-making mode"; }
msg_init_phase_prompt()        { printf "  phase (stage + start date, e.g. early-growth (2024-09+)): "; }
msg_init_mode_prompt()         { printf "  mode (priority order, separated by >): "; }
msg_init_team_prompt()         { printf "  team (size and constraints, e.g. 2, no-ops): "; }
msg_init_reject_if_intro()     { echo "  reject-if: rejection threshold (e.g. migration > 1 week). Press Enter to skip."; }
msg_init_reject_if_prompt()    { printf "  reject-if: "; }
msg_init_nogo_intro()          { echo "List technical directions AI must never suggest (one per line, empty line to finish)"; }
msg_init_nogo_hint()           { echo "  Tip: leave blank for now, add entries when AI makes mistakes"; }
msg_init_nogo_prompt()         { printf "  no-go (empty line to finish): "; }
msg_init_stack_intro()         { echo "Record current technology choices..."; }
msg_init_stack_hint()          { echo "  Press Enter to finish"; }
msg_init_stack_prompt()        { printf "  stack entry (e.g. state: Zustand): "; }
msg_init_debt_intro()          { echo "Record known technical debt (format: DEBT-KEY: description [revisit_when: condition])"; }
msg_init_debt_hint1()          { echo "  Use accepted debt to tell AI to stop trying to fix known issues"; }
msg_init_debt_hint2()          { echo "  revisit_when: condition under which to revisit (e.g. team > 5)"; }
msg_init_debt_hint3()          { echo "  Press Enter to finish"; }
msg_init_debt_prompt()         { printf "  debt entry (empty line to finish): "; }
msg_init_output_created()      { echo "Generated .cairn/output.md"; }
msg_init_step_history()        { echo "Initialize history/"; }
msg_init_history_created_dir() { echo "Created .cairn/history/ directory"; }
msg_init_history_created_tpl() { echo "Created .cairn/history/_TEMPLATE.md (7-field template)"; }
msg_init_step_domains_dir()    { echo "Initialize domains/"; }
msg_init_domains_dir_note()    { echo ".cairn/domains/ (empty directory)"; }
msg_init_domains_dir_hint1()   { echo "  Domain files are generated by AI (cairn sync) or created manually"; }
msg_init_domains_dir_hint2()   { echo "  They accumulate path-dependency constraints for each domain"; }
msg_init_domains_dir_hint3()   { echo "  Trigger: hooks section in output.md references each domain"; }
msg_init_domains_dir_hint4()   { echo "  Update: run cairn sync <domain> when history entries accumulate"; }
msg_init_domains_dir_hint5()   { echo "  Format: frontmatter + 5 sections (current design / trajectory / rejected paths / known pitfalls / open questions)"; }
msg_init_step_skills()         { echo "Install Skill adapter files"; }
msg_init_skills_intro()        { echo "Select the AI tools you use (multi-select, comma-separated numbers, e.g. 1,2):"; }
msg_init_skills_skip()         { printf "  Press Enter to skip: "; }
msg_init_skills_skipped()      { echo "Skill installation skipped"; }
msg_init_skills_unknown()      { echo "  Unknown option '${1}', skipped"; }
msg_init_written()             { echo "  Written: ${1}"; }
msg_init_appended()            { echo "  Appended to: ${1}"; }
msg_init_agents_skipped()      { echo "  AGENTS.md already written (shared by Codex/OpenCode), skipping duplicate"; }
msg_init_done_title()          { echo "Initialization complete"; }
msg_init_done_created()        { echo "Files created:"; }
msg_init_done_structure()      { echo "Directory structure:"; }
msg_init_layer1_desc()         { echo "  Layer 1: .cairn/output.md       — global constraints, injected every session"; }
msg_init_layer2_desc()         { echo "  Layer 2: .cairn/domains/*.md    — domain context, injected during planning"; }
msg_init_layer3_desc()         { echo "  Layer 3: .cairn/history/*.md    — decision history, queried precisely"; }
msg_init_next_steps()          { echo "Next Steps:"; }
msg_init_next1()               { echo "  1. Install the Skill adapter in your AI tool (if you skipped it above)"; }
msg_init_next2()               { echo "  2. At the start of each AI session, the Skill auto-reads .cairn/output.md"; }
msg_init_next3()               { echo "  3. Use 'cairn log' to record architectural decisions as they happen"; }
msg_init_next4()               { echo "  4. When enough decisions accumulate, run 'cairn sync <domain>' to update domain files"; }

# ── doctor health checks ──────────────────────────────────────────────────────
msg_doctor_section_output()    { echo "output.md"; }
msg_doctor_section_domains()   { echo "domains"; }
msg_doctor_section_hooks()     { echo "hooks"; }
msg_doctor_section_staged()    { echo "staged"; }
msg_doctor_tokens_ok()         { echo "tokens: ≈${1} (target 500 / hard limit 800)"; }
msg_doctor_tokens_warn()       { echo "tokens: ≈${1} — approaching hard limit (target 500 / hard 800)"; }
msg_doctor_tokens_err()        { echo "tokens: ≈${1} — over hard limit 800, compress output.md"; }
msg_doctor_nogo_unsupported()  { echo "no-go \"${1}\" has no supporting history entry"; }
msg_doctor_domain_ok()         { echo "${1}  ${2}, updated ${3}"; }
msg_doctor_domain_stale()      { echo "${1}  stale: ${2} new $(msg_plural_history_entry "${2}") since ${3} — run: cairn sync ${1}"; }
msg_doctor_domain_no_updated() { echo "${1}  no updated date in frontmatter"; }
msg_doctor_domain_not_created(){ echo "${1}  not yet created"; }
msg_doctor_hooks_output_only() { echo "\"${1}\" appears in output.md hooks but not in any domain's hooks[]"; }
msg_doctor_hooks_domain_only() { echo "\"${1}\" appears in domain ${2} hooks[] but not in output.md hooks section"; }
msg_doctor_hooks_run_sync()    { echo "run: cairn sync --hooks to regenerate the hooks section"; }
msg_doctor_staged_empty()      { echo "no entries pending review"; }
msg_doctor_staged_todo()       { echo "${1} staged $(msg_plural_entry "${1}") with [TODO] fields — run: cairn stage review"; }
msg_doctor_staged_stale()      { echo "${1} staged $(msg_plural_entry "${1}") older than 14 days — consider review or discard"; }
msg_doctor_summary_ok()        { echo "no issues found"; }
msg_doctor_summary_issues()    { echo "${1} $(msg_plural_warn_error "${1}")"; }
msg_plural_warn_error()        { [ "${1}" -eq 1 ] && echo "warning/error" || echo "warnings/errors"; }
msg_doctor_output_missing()    { echo "output.md not found — run cairn init"; }

# ── stage review ──────────────────────────────────────────────────────────────
msg_stage_no_entries()         { echo "no staged entries found in .cairn/staged/"; }
msg_stage_no_entries_hint()    { echo "  Use 'cairn log --quick' or the cairn_propose MCP tool to create staged entries."; }
msg_stage_entry_header()       { echo "[${1}/${2}] ${3}"; }
msg_stage_has_todo()           { echo "⚠  this entry has [TODO] fields — complete them before accepting"; }
msg_stage_prompt()             { printf "  (a)ccept  (e)dit  (s)kip  (q)uit: "; }
msg_stage_accept_confirm()     { printf "  accept with [TODO] fields anyway? [y/N]: "; }
msg_stage_accepted()           { echo "✓  accepted → history/${1}"; }
msg_stage_accepted_next()      { echo "  · Run cairn sync ${1} to update the domain file"; }
msg_stage_conflict()           { echo "conflict: history/${1} already exists — rename the staged file manually"; }
msg_stage_skipped()            { echo "·  skipped"; }
msg_stage_edit_hint()          { echo "  (re-showing entry after edit)"; }
msg_stage_summary()            { echo "${1} accepted / ${2} skipped / ${3} edited"; }
msg_stage_help()               { echo "Usage: cairn stage review"; }
msg_stage_unknown_sub()        { echo "unknown subcommand '${1}' — try: cairn stage review"; }

# ── history template ──────────────────────────────────────────────────────────
tpl_history_template() {
    cat <<'EOF'
# History Entry Template
# Copy this file and name it YYYY-MM_<short-slug>.md, then fill in the fields below.
# Example filename: 2024-03_state-mgmt-to-zustand.md

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

# ── analyze command ───────────────────────────────────────────────────────────
msg_analyze_title()              { echo "Cairn Analyze — three-layer cold start"; }
msg_analyze_no_git()             { echo "not a git repository — cairn analyze requires git history"; }
msg_analyze_no_commits()         { echo "no commits found in repository"; }
msg_analyze_no_cairn_warning()   { echo "no .cairn/ directory found — run cairn init first to set up Cairn"; }
msg_analyze_scanning()           { echo "Scanning git history..."; }
msg_analyze_git_info()           { echo "git repository: ${1} commits, first commit ${2}"; }
msg_analyze_dep_files_found()    { echo "dependency files found: ${1}"; }
msg_analyze_no_dep_files()       { echo "no supported dependency files found (package.json / go.mod / requirements.txt / pyproject.toml / Cargo.toml)"; }
msg_analyze_phase_reverts()      { echo "reverts: ${1} found"; }
msg_analyze_phase_dep()          { echo "dependency removals: ${1} found"; }
msg_analyze_phase_keywords()     { echo "keyword-matched commits: ${1} found"; }
msg_analyze_phase_todos()        { echo "TODO/FIXME files: ${1} found"; }
msg_analyze_dry_run_banner()     { echo "[dry-run] candidates not written to staged/"; }
msg_analyze_candidate_written()  { echo "  ✓ ${1}  [${2}]"; }
msg_analyze_summary_header()     { echo "Generated candidates:"; }
msg_analyze_summary_high()       { echo "  ● high confidence   : ${1}  (reverts, confirmed dep removals)"; }
msg_analyze_summary_medium()     { echo "  ● medium confidence : ${1}  (keyword-matched commits)"; }
msg_analyze_summary_low()        { echo "  ● low confidence    : ${1}  (TODO/FIXME density)"; }
msg_analyze_summary_total()      { echo "  total: ${1} candidate(s) written to .cairn/staged/"; }
msg_analyze_dry_run_total()      { echo "  total: ${1} candidate(s) would be written (dry-run, nothing saved)"; }
msg_analyze_next_review()        { echo "Next: run 'cairn stage review' to review and accept candidates"; }
msg_analyze_next_noop()          { echo "No candidates generated — git history may not contain detectable events."; }
msg_analyze_stack_header()       { echo "Detected stack (from current dependency files):"; }
msg_analyze_stack_entry()        { echo "  · ${1}"; }
msg_analyze_stack_hint()         { echo "  → see .cairn/output.md.draft for full stack section"; }
msg_analyze_limit_applied()      { echo "  (limit: showing top ${1} candidates — use --limit to adjust)"; }
msg_analyze_since_applied()      { echo "  (filtering commits since ${1})"; }
msg_analyze_skip_no_git()        { echo "  (skipping git analysis — not a git repository)"; }
msg_analyze_dep_removed()        { echo "removed ${1} (${2}) — ${3}"; }
msg_analyze_revert_found()       { echo "revert: ${1}  (${2})"; }
msg_analyze_keyword_found()      { echo "keyword commit: ${1}  (${2})"; }
msg_analyze_todo_file()          { echo "TODO/FIXME in ${1} (${2} occurrences)"; }

# ── analyze layers ─────────────────────────────────────────────────────────────
msg_analyze_layer1_header()           { echo "Layer 1 — Current Reality"; }
msg_analyze_layer1_scanning()         { echo "Scanning project structure, stack, and infra..."; }
msg_analyze_layer1_dir_structure()    { echo "  dir structure   : ${1}"; }
msg_analyze_layer1_infra()            { echo "  infra           : ${1}"; }
msg_analyze_layer1_inferred_domains() { echo "  inferred domains: ${1}"; }
msg_analyze_layer1_no_stack()         { echo "  (no dependency files — stack section will be empty in draft)"; }
msg_analyze_layer1_draft_written()    { echo "  ✓ .cairn/output.md.draft written — review and merge into output.md"; }
msg_analyze_layer1_draft_hint()       { echo "    diff .cairn/output.md .cairn/output.md.draft"; }

msg_analyze_layer2_header()           { echo "Layer 2 — Explicit Intent"; }
msg_analyze_layer2_scanning()         { echo "Scanning intent documents (README, architecture docs, ADRs)..."; }
msg_analyze_layer2_docs_found()       { echo "  intent docs found: ${1}"; }
msg_analyze_layer2_no_docs()          { echo "  no intent documents found (README.md / ARCHITECTURE.md / ADR files)"; }
msg_analyze_layer2_signals_found()    { echo "  no-go signals extracted: ${1}"; }
msg_analyze_layer2_candidate_written(){ echo "  ✓ ${1}  [intent / low]"; }

msg_analyze_layer3_header()           { echo "Layer 3 — Historical Events"; }

msg_analyze_help()               { cat <<'HELP'
Usage: cairn analyze [options]

Scan project structure, intent documents, and git history to generate
.cairn/output.md.draft (Layer 1) and staged history entry candidates (Layers 2–3).

Layers:
  1 — Current Reality  : stack, dir structure, infra  → .cairn/output.md.draft
  2 — Explicit Intent  : README, architecture, ADRs   → staged candidates (low confidence)
  3 — Historical Events: git reverts, dep removals    → staged candidates (high/medium/low)

Options:
  --dry-run          Skip writing staged/ candidates (draft is always written)
  --since YYYY-MM-DD Only include commits after this date (Layer 3 only)
  --limit N          Maximum number of candidates to generate (default: 30)
  --only TYPE,...    Run specific layers or sub-types:
                       layer1, layer2, layer3
                       revert, dep, keyword, todo  (Layer 3 sub-types)

Candidate confidence levels:
  high   — reverts and confirmed dependency removals (diff evidence)
  medium — keyword-matched commit messages (migrate, replace, drop, refactor)
  low    — TODO/FIXME density or intent document extraction

After running: cairn stage review
HELP
}

# stage metadata display (for analyze-sourced entries)
msg_stage_analyze_meta()        { echo "  [confidence: ${1} | source: ${2}]"; }
msg_stage_low_confidence_warn() { echo "⚠  low confidence — please verify this candidate before accepting"; }
msg_stage_meta_stripped()       { true; }  # silent strip of analyze meta on accept

# stage candidate-kind dispatch hints (v0.0.8)
msg_stage_kind_history()        { echo "  [history-candidate] → will move to .cairn/history/ on accept"; }
msg_stage_kind_domain()         { echo "  [domain-update-candidate] → will open \$EDITOR on target domain file on accept"; }
msg_stage_kind_output()         { echo "  [output-update-candidate] → will open \$EDITOR on .cairn/output.md on accept"; }
msg_stage_kind_audit()          { echo "  [audit-candidate] → will move to .cairn/audits/ on accept"; }
msg_stage_kind_legacy()         { echo "  [history-candidate (legacy)] → will move to .cairn/history/ on accept"; }
msg_stage_accepted_audit()      { echo "✓  accepted → audits/${1}"; }
msg_stage_open_editor_domain()  { echo "  Opening \$EDITOR on .cairn/domains/${1}.md — paste or merge the candidate content"; }
msg_stage_open_editor_output()  { echo "  Opening \$EDITOR on .cairn/output.md — paste or merge the candidate content"; }
msg_stage_editor_fallback()     { echo "  \$EDITOR not set — candidate left in staged/ for manual review"; }
msg_stage_audits_dir_created()  { echo "  Created .cairn/audits/"; }

# ── reflect command ───────────────────────────────────────────────────────────
msg_reflect_title()             { echo "Cairn Reflect — post-task write-back"; }
msg_reflect_no_git()            { echo "not a git repository — cairn reflect requires git history"; }
msg_reflect_no_cairn_warning()  { echo "no .cairn/ directory found — run cairn init first to set up Cairn"; }
msg_reflect_no_commits()        { echo "no commits found in the specified range"; }
msg_reflect_scanning()          { echo "Scanning recent changes..."; }
msg_reflect_git_range()         { echo "commit range: ${1}"; }
msg_reflect_diff_mode()         { echo "mode: staged diff (git diff --staged + unstaged)"; }
msg_reflect_since_mode()        { echo "mode: commits since ${1}"; }
msg_reflect_commit_mode()       { echo "mode: commits since ${1}"; }
msg_reflect_commits_found()     { echo "commits in range: ${1}"; }
msg_reflect_phase_reverts()     { echo "  reverts: ${1} found"; }
msg_reflect_phase_migrations()  { echo "  migration-keyword commits: ${1} found"; }
msg_reflect_phase_domains()     { echo "  domain-touching commits: ${1} found"; }
msg_reflect_phase_stack()       { echo "  stack drift signals: ${1} found"; }
msg_reflect_candidate_written() { echo "  ✓ ${1}  [${2}]"; }
msg_reflect_summary_header()    { echo "Generated candidates:"; }
msg_reflect_summary_history()   { echo "  ● history-candidate     : ${1}"; }
msg_reflect_summary_domain()    { echo "  ● domain-update-candidate: ${1}"; }
msg_reflect_summary_output()    { echo "  ● output-update-candidate: ${1}"; }
msg_reflect_summary_audit()     { echo "  ● audit-candidate        : ${1}"; }
msg_reflect_summary_total()     { echo "  total: ${1} candidate(s) written to .cairn/staged/"; }
msg_reflect_dry_run_total()     { echo "  total: ${1} candidate(s) would be written (dry-run, nothing saved)"; }
msg_reflect_next_review()       { echo "Next: run 'cairn stage review' to review and accept candidates"; }
msg_reflect_next_noop()         { echo "No candidates generated — no significant changes detected in range."; }
msg_reflect_dry_run_banner()    { echo "[dry-run] candidates not written to staged/"; }
msg_reflect_range_mode()        { echo "mode: commit range ${1}"; }

# ── reflect result classification (v0.0.9) ─────────────────────────────────────
msg_reflect_result_label()      { echo "Reflection result:"; }
msg_reflect_result_noop()       { echo "  ✓ no-op — no Cairn updates needed for this task"; }
msg_reflect_result_candidates() { echo "  ● candidates-created — ${1} candidate(s) written; run cairn stage review"; }
msg_reflect_result_audit()      { echo "  ⚠ audit-required — migration pattern detected; run cairn stage review then cairn audit start"; }
msg_reflect_record_written()    { echo "  Reflection record: .cairn/reflections/${1}"; }
msg_reflect_record_note()       { echo "  (record written — reflection trace available for cairn doctor)"; }

msg_reflect_help()              { cat <<'HELP'
Usage: cairn reflect [options]

Analyze recent work and produce structured staged update candidates
across all four candidate kinds: history, domain-update, output-update, audit.

Always emits an explicit reflection result: no-op | candidates-created | audit-required.
A task is not truly complete until cairn reflect has run.

Options:
  --from-diff               Reflect on currently staged and unstaged changes (git diff)
  --since REF               Reflect on commits since REF (e.g. HEAD~3, a SHA, a branch)
  --from-commit SHA         Reflect on commits starting from SHA (inclusive)
  --from-range SHA1..SHA2   Reflect on an explicit commit range
  --dry-run                 Preview candidates without writing to staged/

Candidate kinds generated:
  history-candidate_       — detected reverts and migration events
  domain-update-candidate_ — domains whose files were modified in this range
  output-update-candidate_ — stack drift between output.md and current deps
  audit-candidate_         — migration commits that may need cleanup tracking

Reflection results:
  no-op              — no signals detected; still records that reflection ran
  candidates-created — staged candidates written; run cairn stage review
  audit-required     — migration detected; run cairn stage review + cairn audit start

After running: cairn stage review
HELP
}

# ── audit command ─────────────────────────────────────────────────────────────
msg_audit_title()               { echo "Cairn Audit — migration cleanup tracking"; }
msg_audit_no_cairn_warning()    { echo "no .cairn/ directory found — run cairn init first to set up Cairn"; }
msg_audit_start_header()        { echo "Creating audit file for domain '${1}'..."; }
msg_audit_start_written()       { echo "✓  Created .cairn/audits/${1}"; }
msg_audit_start_hint()          { echo "  Edit the file to add expected removals, then run: cairn audit scan ${2}"; }
msg_audit_start_conflict()      { echo "conflict: .cairn/audits/${1} already exists — rename or delete first"; }
msg_audit_start_domain_warn()   { echo "warning: domain '${1}' is not in the locked domain list (proceeding anyway)"; }
msg_audit_scan_header()         { echo "Cairn Audit Scan — residue detection"; }
msg_audit_scan_scanning()       { echo "Scanning for residue..."; }
msg_audit_scan_domain_filter()  { echo "Filtering to domain: ${1}"; }
msg_audit_scan_no_audits()      { echo "No audit files found in .cairn/audits/ — run: cairn audit start <domain> --trigger \"...\""; }
msg_audit_scan_file()           { echo "  Audit: ${1}  (${2})"; }
msg_audit_scan_rejected_kw()    { echo "    checking rejected-paths keywords from domains/${1}.md..."; }
msg_audit_scan_hit()            { echo "    ${C_YELLOW}⚠${C_RESET}  ${1}: pattern '${2}' matched in ${3}"; }
msg_audit_scan_no_hits()        { echo "    ${C_GREEN}✓${C_RESET}  no residue found for this audit"; }
msg_audit_scan_summary()        { echo "Scan complete: ${1} residue match(es) found across ${2} audit file(s)"; }
msg_audit_scan_hint()           { echo "  Update .cairn/audits/ files with findings, then run: cairn doctor"; }
msg_audit_missing_trigger()     { echo "error: --trigger is required — use: cairn audit start <domain> --trigger \"<change>\""; }
msg_audit_missing_domain()      { echo "error: domain name required — use: cairn audit start <domain> --trigger \"<change>\""; }
msg_audit_unknown_sub()         { echo "unknown subcommand '${1}' — try: cairn audit start | cairn audit scan"; }

msg_audit_help()                { cat <<'HELP'
Usage: cairn audit <subcommand> [options]

Track migration cleanup obligations explicitly.

Subcommands:
  start <domain> --trigger "<change>"
      Create a new .cairn/audits/YYYY-MM_<domain>-<slug>.md audit file.
      Run this after a migration to record expected cleanup.

  scan [<domain>]
      Detect residue: scan source files for patterns from rejected paths
      and check for removed dependencies still referenced in code.
      Optional: filter to one domain.

Examples:
  cairn audit start state-management --trigger "migrated from Redux to Zustand"
  cairn audit scan
  cairn audit scan state-management
HELP
}

# ── doctor audit checks (v0.0.8) ──────────────────────────────────────────────
msg_doctor_section_audits()     { echo "── Audits"; }
msg_doctor_audit_ok()           { echo "no audit issues"; }
msg_doctor_audit_missing()      { echo "transition '${1}' (${2}) has no corresponding audit file — consider: cairn audit start"; }
msg_doctor_audit_stale()        { echo "audit '${1}' has status: partial and is ${2} days old — may need follow-up"; }
msg_doctor_audit_complete()     { echo "✓  ${1} complete"; }
msg_doctor_stack_section()      { echo "── Stack drift"; }
msg_doctor_stack_ok()           { echo "stack entries match current dependency files"; }
msg_doctor_stack_drift()        { echo "stack entry '${1}: ${2}' not found in current dependency files — may be stale"; }
msg_doctor_stack_no_deps()      { echo "(no dependency files found — skipping stack drift check)"; }

# ── doctor reflection checks (v0.0.9) ─────────────────────────────────────────
msg_doctor_section_reflections()    { echo "── Reflections"; }
msg_doctor_reflect_ok()             { echo "reflection records present for recent changes"; }
msg_doctor_reflect_none_yet()       { echo "(no reflections/ directory found — run cairn reflect after significant tasks)"; }
msg_doctor_reflect_missing_large()  { echo "large recent change (${1} files in last commit) but no reflection record in last 7 days"; }
msg_doctor_reflect_missing_migration() { echo "migration-like commit detected ('${1}') but no reflection record found"; }
msg_doctor_reflect_suggest()        { echo "  Suggested action: run cairn reflect --since HEAD~${1}"; }
