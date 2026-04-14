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
