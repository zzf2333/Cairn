#!/usr/bin/env bash
# =============================================================================
# cairn-init.sh — Cairn interactive initialization script
#
# Usage:
#   chmod +x cairn-init.sh
#   ./cairn-init.sh
#
# Creates the .cairn/ three-layer structure in the current directory,
# and installs AI tool Skill adapter files.
# =============================================================================

set -euo pipefail

# ---- color support detection ----

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && tput colors >/dev/null 2>&1 && [ "$(tput colors)" -ge 8 ]; then
    C_RESET="\033[0m"
    C_BOLD="\033[1m"
    C_GREEN="\033[0;32m"
    C_YELLOW="\033[0;33m"
    C_BLUE="\033[0;34m"
    C_CYAN="\033[0;36m"
    C_DIM="\033[2m"
    C_RED="\033[0;31m"
else
    C_RESET=""
    C_BOLD=""
    C_GREEN=""
    C_YELLOW=""
    C_BLUE=""
    C_CYAN=""
    C_DIM=""
    C_RED=""
fi

# ── language loader ────────────────────────────────────────────────────────────
_init_src="${BASH_SOURCE[0]}"
while [ -L "$_init_src" ]; do
    _init_dir="$(cd -P "$(dirname "$_init_src")" && pwd)"
    _init_src="$(readlink "$_init_src")"
    [[ "$_init_src" != /* ]] && _init_src="$_init_dir/$_init_src"
done
_INIT_SCRIPT_DIR="$(cd -P "$(dirname "$_init_src")" && pwd)"
unset _init_src _init_dir
_CAIRN_LANG_DIR="$_INIT_SCRIPT_DIR/../cli/lang"
_CAIRN_LANG_RAW="${CAIRN_LANG:-${LANG%%_*}}"
case "$_CAIRN_LANG_RAW" in
    zh*) source "$_CAIRN_LANG_DIR/zh.sh" ;;
    *)   source "$_CAIRN_LANG_DIR/en.sh" ;;
esac

# ---- utility functions ----

print_header() {
    echo ""
    echo -e "${C_BOLD}${C_BLUE}$1${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
}

print_step() {
    echo ""
    echo -e "${C_BOLD}${C_CYAN}▶ Step $1: $2${C_RESET}"
}

print_ok() {
    echo -e "  ${C_GREEN}✓${C_RESET} $1"
}

print_info() {
    echo -e "  ${C_YELLOW}ℹ${C_RESET} $1"
}

print_warn() {
    echo -e "  ${C_YELLOW}⚠${C_RESET} $1"
}

print_error() {
    echo -e "  ${C_RED}✗${C_RESET} $1" >&2
}

prompt() {
    # usage: prompt "prompt text" [default]
    local msg="$1"
    local default="${2:-}"
    if [ -n "$default" ]; then
        echo -ne "  ${C_BOLD}${msg}${C_RESET} ${C_DIM}[${default}]${C_RESET} "
    else
        echo -ne "  ${C_BOLD}${msg}${C_RESET} "
    fi
}

# global state
SELECTED_DOMAINS=()
CREATED_FILES=()

# ---- preset domain keyword mapping ----

# returns keyword string for a domain (/ separated)
get_domain_keywords() {
    local domain="$1"
    case "$domain" in
        state-management)   echo "state / store / Zustand / Redux / context" ;;
        api-layer)          echo "api / endpoint / tRPC / GraphQL / REST / OpenAPI" ;;
        database)           echo "db / database / migration / ORM / schema" ;;
        auth)               echo "auth / login / JWT / session / token / OAuth" ;;
        frontend-framework) echo "component / render / SSR / hydration / framework" ;;
        testing)            echo "test / spec / coverage / mock / fixture" ;;
        deployment)         echo "deploy / CI / CD / Docker / container / infra" ;;
        monitoring)         echo "log / metric / alert / trace / observability" ;;
        architecture)       echo "architecture / pattern / module / service / layer" ;;
        performance)        echo "performance / latency / cache / optimize / bundle" ;;
        security)           echo "security / XSS / CSRF / injection / vulnerability" ;;
        *)                  echo "$domain" ;;  # custom domain: use domain name itself as keyword
    esac
}

# ============================================================================
# Step 1: Select domain list
# ============================================================================

step1_select_domains() {
    print_step "1" "$(msg_init_step_domains)"

    echo ""
    echo -e "  $(msg_init_domains_intro)"
    echo -e "  $(msg_init_domains_custom)"
    echo ""
    echo -e "    ${C_DIM} 1)${C_RESET} ${C_BOLD}state-management${C_RESET}    Frontend state management"
    echo -e "    ${C_DIM} 2)${C_RESET} ${C_BOLD}api-layer${C_RESET}           API design and communication"
    echo -e "    ${C_DIM} 3)${C_RESET} ${C_BOLD}database${C_RESET}            Data storage"
    echo -e "    ${C_DIM} 4)${C_RESET} ${C_BOLD}auth${C_RESET}                Authentication and authorization"
    echo -e "    ${C_DIM} 5)${C_RESET} ${C_BOLD}frontend-framework${C_RESET}  Frontend framework"
    echo -e "    ${C_DIM} 6)${C_RESET} ${C_BOLD}testing${C_RESET}             Testing strategy"
    echo -e "    ${C_DIM} 7)${C_RESET} ${C_BOLD}deployment${C_RESET}          Deployment and infrastructure"
    echo -e "    ${C_DIM} 8)${C_RESET} ${C_BOLD}monitoring${C_RESET}          Monitoring and alerting"
    echo -e "    ${C_DIM} 9)${C_RESET} ${C_BOLD}architecture${C_RESET}        Overall architecture patterns"
    echo -e "    ${C_DIM}10)${C_RESET} ${C_BOLD}performance${C_RESET}         Performance optimization"
    echo -e "    ${C_DIM}11)${C_RESET} ${C_BOLD}security${C_RESET}            Security strategy"
    echo ""

    msg_init_domains_prompt
    read -r domain_input

    # standard domain names array (indexed from 1)
    local std_domains=(
        ""  # placeholder so numbering starts at 1
        "state-management"
        "api-layer"
        "database"
        "auth"
        "frontend-framework"
        "testing"
        "deployment"
        "monitoring"
        "architecture"
        "performance"
        "security"
    )

    SELECTED_DOMAINS=()

    # replace commas with spaces, then split by space
    local normalized
    normalized=$(echo "$domain_input" | tr ',' ' ')

    for token in $normalized; do
        token=$(echo "$token" | tr -d '[:space:]')
        [ -z "$token" ] && continue

        # check if purely numeric
        if echo "$token" | grep -qE '^[0-9]+$'; then
            local idx="$token"
            if [ "$idx" -ge 1 ] && [ "$idx" -le 11 ]; then
                SELECTED_DOMAINS+=("${std_domains[$idx]}")
            else
                print_warn "$(msg_init_domain_out_of_range "$idx")"
            fi
        else
            # custom domain name: validate format
            if echo "$token" | grep -qE '^[a-z][a-z0-9-]*$'; then
                SELECTED_DOMAINS+=("$token")
            else
                print_warn "$(msg_init_domain_invalid_name "$token")"
            fi
        fi
    done

    # deduplicate (POSIX-compatible, no bash 4 associative arrays needed)
    local unique_domains=()
    for d in "${SELECTED_DOMAINS[@]}"; do
        local found=0
        for u in "${unique_domains[@]+"${unique_domains[@]}"}"; do
            if [ "$u" = "$d" ]; then
                found=1
                break
            fi
        done
        [ "$found" -eq 0 ] && unique_domains+=("$d")
    done
    SELECTED_DOMAINS=("${unique_domains[@]}")

    if [ ${#SELECTED_DOMAINS[@]} -eq 0 ]; then
        print_error "$(msg_init_no_domains_selected)"
        exit 1
    fi

    echo ""
    print_ok "$(msg_init_domains_selected "${#SELECTED_DOMAINS[@]}")"
    for d in "${SELECTED_DOMAINS[@]}"; do
        echo -e "    ${C_GREEN}·${C_RESET} $d"
    done
}

# ============================================================================
# Step 2: Fill in output.md
# ============================================================================

step2_create_output_md() {
    print_step "2" "$(msg_init_step_output)"

    # ---- stage section ----
    echo ""
    echo -e "  ${C_BOLD}── stage ──${C_RESET}"
    print_info "$(msg_init_stage_intro)"
    echo ""

    msg_init_phase_prompt
    read -r stage_phase
    [ -z "$stage_phase" ] && stage_phase="unnamed-phase ($(date +%Y-%m)+)"

    echo ""
    echo -e "    ${C_DIM}e.g. stability > speed > elegance${C_RESET}"
    echo -e "    ${C_DIM}e.g. speed > quality > cost${C_RESET}"
    echo -e "    ${C_DIM}e.g. correctness > performance > elegance${C_RESET}"
    msg_init_mode_prompt
    read -r stage_mode
    [ -z "$stage_mode" ] && stage_mode="stability > speed > elegance"

    echo ""
    msg_init_team_prompt
    read -r stage_team
    [ -z "$stage_team" ] && stage_team=""

    echo ""
    print_info "$(msg_init_reject_if_intro)"
    msg_init_reject_if_prompt
    read -r stage_reject_if

    # ---- no-go section ----
    echo ""
    echo -e "  ${C_BOLD}── no-go ──${C_RESET}"
    print_info "$(msg_init_nogo_intro)"
    print_info "$(msg_init_nogo_hint)"
    echo ""

    local nogo_lines=()
    while true; do
        msg_init_nogo_prompt
        read -r nogo_item
        [ -z "$nogo_item" ] && break
        nogo_lines+=("$nogo_item")
    done

    # ---- hooks section (auto-generated) ----
    # no user input needed — generated from SELECTED_DOMAINS

    # ---- stack section ----
    echo ""
    echo -e "  ${C_BOLD}── stack ──${C_RESET}"
    print_info "$(msg_init_stack_intro)"
    print_info "$(msg_init_stack_hint)"
    echo ""

    local stack_lines=()
    while true; do
        msg_init_stack_prompt
        read -r stack_item
        [ -z "$stack_item" ] && break
        stack_lines+=("$stack_item")
    done

    # ---- debt section ----
    echo ""
    echo -e "  ${C_BOLD}── debt ──${C_RESET}"
    print_info "$(msg_init_debt_intro)"
    print_info "$(msg_init_debt_hint1)"
    print_info "$(msg_init_debt_hint2)"
    print_info "$(msg_init_debt_hint3)"
    echo ""

    local debt_lines=()
    while true; do
        msg_init_debt_prompt
        read -r debt_item
        [ -z "$debt_item" ] && break
        debt_lines+=("$debt_item")
    done

    # ---- generate output.md ----
    mkdir -p .cairn

    {
        echo "## stage"
        echo ""
        echo "phase: ${stage_phase}"
        echo "mode: ${stage_mode}"
        if [ -n "$stage_team" ]; then
            echo "team: ${stage_team}"
        fi
        if [ -n "$stage_reject_if" ]; then
            echo "reject-if: ${stage_reject_if}"
        fi
        echo ""
        echo "## no-go"
        echo ""
        if [ ${#nogo_lines[@]} -gt 0 ]; then
            for item in "${nogo_lines[@]}"; do
                echo "- ${item}"
            done
        fi
        echo ""
        echo "## hooks"
        echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        for domain in "${SELECTED_DOMAINS[@]}"; do
            local kw
            kw=$(get_domain_keywords "$domain")
            echo "- ${kw} → domains/${domain}.md"
        done
        echo ""
        echo "## stack"
        echo ""
        if [ ${#stack_lines[@]} -gt 0 ]; then
            for item in "${stack_lines[@]}"; do
                echo "${item}"
            done
        fi
        echo ""
        echo "## debt"
        echo ""
        if [ ${#debt_lines[@]} -gt 0 ]; then
            for item in "${debt_lines[@]}"; do
                echo "${item}"
            done
        fi
        echo ""
        echo "## open questions"
        echo ""
    } > .cairn/output.md

    CREATED_FILES+=(".cairn/output.md")
    print_ok "$(msg_init_output_created)"
}

# ============================================================================
# Step 3: Initialize history/
# ============================================================================

step3_init_history() {
    print_step "3" "$(msg_init_step_history)"

    mkdir -p .cairn/history

    tpl_history_template > .cairn/history/_TEMPLATE.md

    CREATED_FILES+=(".cairn/history/_TEMPLATE.md")
    print_ok "$(msg_init_history_created_dir)"
    print_ok "$(msg_init_history_created_tpl)"
}

# ============================================================================
# Step 4: Initialize domains/
# ============================================================================

step4_init_domains() {
    print_step "4" "$(msg_init_step_domains_dir)"

    mkdir -p .cairn/domains
    CREATED_FILES+=("$(msg_init_domains_dir_note)")

    print_info "$(msg_init_domains_dir_hint1)"
    print_info "$(msg_init_domains_dir_hint2)"
    print_info "$(msg_init_domains_dir_hint3)"
    print_info "$(msg_init_domains_dir_hint4)"
    print_info "$(msg_init_domains_dir_hint5)"
}

# ============================================================================
# Step 5: Install Skill adapter files
# ============================================================================

# ---- Skill content heredocs ----

SKILL_CLAUDE_CODE=$(cat << 'SKILL_EOF'
Read `.cairn/output.md` at session start, then read domain files on planning tasks, and draft history entries when decisions are made.

---

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves planning, technology selection, module architecture, or migration evaluation, check `output.md`'s `## hooks` section for matching keywords and read the corresponding `domains/*.md` file before responding.

**Example:** if the user asks about API design and `output.md` has `api / endpoint → domains/api-layer.md`, read `.cairn/domains/api-layer.md` before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the corresponding file in `.cairn/history/`. File names follow the pattern `YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

**`no-go` entries** — Do not suggest these directions. If asked directly, explain why it was excluded before offering alternatives.

**`debt` entries** — Do not attempt to fix accepted debts. Work within the constraint. Only reopen when the `revisit_when` condition is met.

**`known pitfalls` in `domains/*.md`** — Actively avoid triggering the conditions listed.

---

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred (decision, rejection, transition, debt, experiment). If yes:

1. Draft a `history/` entry with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `domains/*.md` if needed (full overwrite, not append).
SKILL_EOF
)

SKILL_CURSOR=$(cat << 'SKILL_EOF'
---
description: Cairn path-dependency constraint system — read .cairn/ files to respect project decisions
globs:
alwaysApply: true
---

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

---

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

When the user's request involves planning, technology selection, module architecture, or migration evaluation, check `output.md`'s `## hooks` section for matching keywords and read the corresponding `domains/*.md` file before responding.

**Example:** if the user asks about API design and `output.md` has `api / endpoint → domains/api-layer.md`, read `.cairn/domains/api-layer.md` before answering.

---

## ON PRECISE HISTORICAL QUERIES

When the user asks about the full reasoning behind a specific past decision, read the corresponding file in `.cairn/history/`. File names follow the pattern `YYYY-MM_<short-slug>.md`.

---

## CONSTRAINT PROCESSING

**`no-go` entries** — Do not suggest these directions. If asked directly, explain why it was excluded before offering alternatives.

**`debt` entries** — Do not attempt to fix accepted debts. Work within the constraint. Only reopen when the `revisit_when` condition is met.

**`known pitfalls` in `domains/*.md`** — Actively avoid triggering the conditions listed.

---

## REACTIVE EVOLUTION

After completing a task, evaluate whether a recordable event occurred (decision, rejection, transition, debt, experiment). If yes:

1. Draft a `history/` entry with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`.
2. Propose it to the user for confirmation before writing.
3. Once confirmed, write to `.cairn/history/YYYY-MM_<short-slug>.md`.
4. Propose updating the corresponding `domains/*.md` if needed (full overwrite, not append).
SKILL_EOF
)

SKILL_GENERIC=$(cat << 'SKILL_EOF'

# Cairn — AI Path-Dependency Constraint System

## SESSION START

Read `.cairn/output.md` before any response. It defines:
- `## stage` — project phase and decision mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keywords that trigger domain file reads
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT fix

## PLANNING / DESIGN TASKS

Match user request keywords against `## hooks` in `output.md`. If matched, read the corresponding `domains/*.md` file before responding.

## HISTORICAL QUERIES

For past decision details, read `.cairn/history/YYYY-MM_<short-slug>.md`.

## CONSTRAINTS

- `no-go`: never suggest; explain exclusion if asked directly
- `debt`: never fix; work within the constraint
- `known pitfalls` in domains/: actively avoid trigger conditions

## REACTIVE EVOLUTION

After tasks, assess if a history entry is warranted (decision / rejection / transition / debt / experiment). If yes, draft it with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`. Propose to user before writing.
SKILL_EOF
)

# AGENTS.md content (shared by Codex CLI and OpenCode, written to AGENTS.md)
SKILL_AGENTS=$(cat << 'SKILL_EOF'

# Cairn — AI Path-Dependency Constraint System

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

Match user request keywords against `## hooks` in `output.md`. If matched, read the corresponding `domains/*.md` file before responding.

## ON PRECISE HISTORICAL QUERIES

For past decision details, read `.cairn/history/YYYY-MM_<short-slug>.md`.

## CONSTRAINT PROCESSING

- `no-go`: never suggest; explain exclusion if asked directly
- `debt`: never fix; work within the constraint
- `known pitfalls` in domains/: actively avoid trigger conditions

## REACTIVE EVOLUTION

After tasks, assess if a history entry is warranted (decision / rejection / transition / debt / experiment). If yes, draft it with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`. Propose to user before writing.
SKILL_EOF
)

# GEMINI.md content (Gemini CLI)
SKILL_GEMINI=$(cat << 'SKILL_EOF'

# Cairn — AI Path-Dependency Constraint System

## ON SESSION START

Read `.cairn/output.md` before responding to any request. Use it to establish the constraint framework for the entire session:

- `## stage` — current project phase and decision-making mode
- `## no-go` — directions you MUST NOT suggest
- `## hooks` — keyword-to-domain mappings for when to load deeper context
- `## stack` — active technology choices
- `## debt` — accepted debts you MUST NOT attempt to fix

## ON PLANNING / DESIGN / ARCHITECTURE TASKS

Match user request keywords against `## hooks` in `output.md`. If matched, read the corresponding `domains/*.md` file before responding.

## ON PRECISE HISTORICAL QUERIES

For past decision details, read `.cairn/history/YYYY-MM_<short-slug>.md`.

## CONSTRAINT PROCESSING

- `no-go`: never suggest; explain exclusion if asked directly
- `debt`: never fix; work within the constraint
- `known pitfalls` in domains/: actively avoid trigger conditions

## REACTIVE EVOLUTION

After tasks, assess if a history entry is warranted (decision / rejection / transition / debt / experiment). If yes, draft it with fields: `type`, `domain`, `decision_date`, `recorded_date`, `summary`, `rejected`, `reason`, `revisit_when`. Propose to user before writing.
SKILL_EOF
)

# flag to track whether AGENTS.md has been written (avoid duplicate writes when both Codex and OpenCode are selected)
AGENTS_MD_WRITTEN=0

step5_install_skills() {
    print_step "5" "$(msg_init_step_skills)"

    echo ""
    echo -e "  $(msg_init_skills_intro)"
    echo ""
    echo -e "    ${C_DIM}1)${C_RESET} ${C_BOLD}Claude Code${C_RESET}     (.claude/skills/cairn/SKILL.md)"
    echo -e "    ${C_DIM}2)${C_RESET} ${C_BOLD}Cursor${C_RESET}          (.cursor/rules/cairn.mdc)"
    echo -e "    ${C_DIM}3)${C_RESET} ${C_BOLD}Cline/Roo Code${C_RESET}  (.clinerules, append)"
    echo -e "    ${C_DIM}4)${C_RESET} ${C_BOLD}Windsurf${C_RESET}        (.windsurfrules, append)"
    echo -e "    ${C_DIM}5)${C_RESET} ${C_BOLD}GitHub Copilot${C_RESET}  (.github/copilot-instructions.md, append)"
    echo -e "    ${C_DIM}6)${C_RESET} ${C_BOLD}Codex CLI${C_RESET}       (AGENTS.md, append)"
    echo -e "    ${C_DIM}7)${C_RESET} ${C_BOLD}Gemini CLI${C_RESET}      (GEMINI.md, append)"
    echo -e "    ${C_DIM}8)${C_RESET} ${C_BOLD}OpenCode${C_RESET}        (AGENTS.md, append, shared with Codex)"
    echo ""
    msg_init_skills_skip
    read -r tool_input

    if [ -z "$tool_input" ]; then
        print_info "$(msg_init_skills_skipped)"
        return
    fi

    local normalized
    normalized=$(echo "$tool_input" | tr ',' ' ')

    for token in $normalized; do
        token=$(echo "$token" | tr -d '[:space:]')
        [ -z "$token" ] && continue

        case "$token" in
            1)
                local target_dir=".claude/skills/cairn"
                local target_file="${target_dir}/SKILL.md"
                mkdir -p "$target_dir"
                echo "$SKILL_CLAUDE_CODE" > "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "$(msg_init_written "$target_file")"
                ;;
            2)
                local target_dir=".cursor/rules"
                local target_file="${target_dir}/cairn.mdc"
                mkdir -p "$target_dir"
                echo "$SKILL_CURSOR" > "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "$(msg_init_written "$target_file")"
                ;;
            3)
                local target_file=".clinerules"
                echo "$SKILL_GENERIC" >> "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "$(msg_init_appended "$target_file")"
                ;;
            4)
                local target_file=".windsurfrules"
                echo "$SKILL_GENERIC" >> "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "$(msg_init_appended "$target_file")"
                ;;
            5)
                local target_dir=".github"
                local target_file="${target_dir}/copilot-instructions.md"
                mkdir -p "$target_dir"
                echo "$SKILL_GENERIC" >> "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "$(msg_init_appended "$target_file")"
                ;;
            6)
                # Codex CLI — AGENTS.md
                local target_file="AGENTS.md"
                if [ "$AGENTS_MD_WRITTEN" -eq 0 ]; then
                    echo "$SKILL_AGENTS" >> "$target_file"
                    AGENTS_MD_WRITTEN=1
                    CREATED_FILES+=("$target_file")
                    print_ok "$(msg_init_appended "$target_file")"
                else
                    print_info "$(msg_init_agents_skipped)"
                fi
                ;;
            7)
                # Gemini CLI — GEMINI.md
                local target_file="GEMINI.md"
                echo "$SKILL_GEMINI" >> "$target_file"
                CREATED_FILES+=("$target_file")
                print_ok "$(msg_init_appended "$target_file")"
                ;;
            8)
                # OpenCode — AGENTS.md (shared with Codex)
                local target_file="AGENTS.md"
                if [ "$AGENTS_MD_WRITTEN" -eq 0 ]; then
                    echo "$SKILL_AGENTS" >> "$target_file"
                    AGENTS_MD_WRITTEN=1
                    CREATED_FILES+=("$target_file")
                    print_ok "$(msg_init_appended "$target_file")"
                else
                    print_info "$(msg_init_agents_skipped)"
                fi
                ;;
            *)
                print_warn "$(msg_init_skills_unknown "$token")"
                ;;
        esac
    done
}

# ============================================================================
# Step 0: Offer git analysis (optional, runs after .cairn/ is created)
# ============================================================================

# Stored preference from the pre-init prompt
_INIT_RUN_ANALYZE=false

step0_offer_git_analysis() {
    print_step "0" "$(msg_init_step_analyze)"
    echo ""

    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        print_info "$(msg_init_analyze_no_git)"
        return 0
    fi

    local commit_count first_date
    commit_count="$(git rev-list --count HEAD 2>/dev/null || echo "0")"
    first_date="$(git log --format='%ai' --reverse 2>/dev/null | head -1 | cut -c1-7)"

    if [ "$commit_count" -eq 0 ]; then
        print_info "$(msg_init_analyze_no_git)"
        return 0
    fi

    print_info "$(msg_init_analyze_detected "$commit_count" "${first_date:-unknown}")"
    echo ""
    msg_init_analyze_offer
    local ans
    read -r ans
    case "${ans:-Y}" in
        [Nn]*) print_info "$(msg_init_analyze_skipped)" ;;
        *)     _INIT_RUN_ANALYZE=true ;;
    esac
}

# Called after .cairn/ directories are created (step3+).
step0_run_analysis_if_requested() {
    [ "$_INIT_RUN_ANALYZE" != "true" ] && return 0

    echo ""
    print_info "$(msg_init_analyze_running)"

    local cairn_bin="$_INIT_SCRIPT_DIR/../cli/cairn"
    if [ -f "$cairn_bin" ]; then
        # Run analyze with stdout visible to user; ignore exit code (non-fatal)
        bash "$cairn_bin" analyze 2>&1 || true
    fi

    echo ""
    print_ok "$(msg_init_analyze_done)"
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    echo ""
    print_header "$(msg_init_done_title)"

    echo ""
    echo -e "  ${C_BOLD}$(msg_init_done_created)${C_RESET}"
    for f in "${CREATED_FILES[@]}"; do
        echo -e "    ${C_GREEN}·${C_RESET} $f"
    done

    echo ""
    echo -e "  ${C_BOLD}$(msg_init_done_structure)${C_RESET}"
    echo -e "    ${C_DIM}.cairn/${C_RESET}"
    echo -e "$(msg_init_layer1_desc)"
    echo -e "$(msg_init_layer2_desc)"
    echo -e "$(msg_init_layer3_desc)"

    echo ""
    echo -e "  ${C_BOLD}$(msg_init_next_steps)${C_RESET}"
    echo ""
    echo -e "$(msg_init_next1)"
    echo -e "$(msg_init_next2)"
    echo -e "$(msg_init_next3)"
    echo -e "$(msg_init_next4)"
    if [ "$_INIT_RUN_ANALYZE" = "true" ]; then
        echo -e "  5. Run 'cairn stage review' to review the git-analysis candidates"
    fi
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    print_header "$(msg_init_title)"
    echo ""
    echo -e "  ${C_DIM}$(msg_init_subtitle)${C_RESET}"
    echo -e "  ${C_DIM}$(msg_init_current_dir "$(pwd)")${C_RESET}"

    # check if .cairn/ already exists
    if [ -d ".cairn" ]; then
        echo ""
        print_warn "$(msg_init_exists_warning)"
        msg_init_overwrite_prompt
        read -r confirm
        if [ "$confirm" != "yes" ]; then
            echo ""
            print_info "$(msg_init_cancelled)"
            exit 0
        fi
    fi

    step0_offer_git_analysis
    step1_select_domains
    step2_create_output_md
    step3_init_history
    step4_init_domains
    step0_run_analysis_if_requested
    step5_install_skills
    print_summary
}

main "$@"
