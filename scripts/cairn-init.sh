#!/usr/bin/env bash
# =============================================================================
# cairn-init.sh — Cairn interactive initialization script
#
# Usage:
#   chmod +x cairn-init.sh
#   ./cairn-init.sh [--refresh-skills] [--global] [--upgrade]
#
# Creates the .cairn/ three-layer structure in the current directory,
# copies .cairn/SKILL.md (the operating protocol), and installs AI tool
# guide blocks.
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

# ── cairn root & shared lib ────────────────────────────────────────────────────
_CAIRN_ROOT="$(cd "$_INIT_SCRIPT_DIR/.." && pwd)"
_CAIRN_LIB_DIR="$_CAIRN_ROOT/cli/lib"

if [ -f "$_CAIRN_LIB_DIR/skill-block.sh" ]; then
    source "$_CAIRN_LIB_DIR/skill-block.sh"
else
    echo "error: required lib not found: $_CAIRN_LIB_DIR/skill-block.sh" >&2
    exit 1
fi

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
_INIT_SKILLS_ONLY=false
AGENTS_MD_WRITTEN=0

# ---- preset domain keyword mapping ----

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
        *)                  echo "$domain" ;;
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

    local std_domains=(
        ""
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

    local normalized
    normalized=$(echo "$domain_input" | tr ',' ' ')

    for token in $normalized; do
        token=$(echo "$token" | tr -d '[:space:]')
        [ -z "$token" ] && continue

        if echo "$token" | grep -qE '^[0-9]+$'; then
            local idx="$token"
            if [ "$idx" -ge 1 ] && [ "$idx" -le 11 ]; then
                SELECTED_DOMAINS+=("${std_domains[$idx]}")
            else
                print_warn "$(msg_init_domain_out_of_range "$idx")"
            fi
        else
            if echo "$token" | grep -qE '^[a-z][a-z0-9-]*$'; then
                SELECTED_DOMAINS+=("$token")
            else
                print_warn "$(msg_init_domain_invalid_name "$token")"
            fi
        fi
    done

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
# Step 3.5: Copy SKILL.md (operating protocol) into .cairn/
# ============================================================================

step3_5_init_skill() {
    local skill_src="$_CAIRN_ROOT/skills/claude-code/SKILL.md"
    local skill_dst=".cairn/SKILL.md"

    if [ ! -f "$skill_src" ]; then
        print_warn "Skill source not found: $skill_src — .cairn/SKILL.md not created"
        return 0
    fi

    mkdir -p ".cairn"

    if [ -f "$skill_dst" ] && cmp -s "$skill_src" "$skill_dst"; then
        print_info "$(msg_init_skill_unchanged "$skill_dst")"
    else
        cp "$skill_src" "$skill_dst"
        CREATED_FILES+=("$skill_dst")
        print_ok "$(msg_init_written "$skill_dst")"
    fi
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
}

# ============================================================================
# Step 5: Install AI tool guide blocks
# ============================================================================

# 12-line guide block injected into AI tool config files.
# Points the AI to .cairn/SKILL.md for the full operating protocol.
_SKILL_GUIDE_BLOCK=$(cat << 'GUIDE_EOF'
## Cairn (path-dependent constraint memory)

If this project contains `.cairn/`:

1. Read `.cairn/output.md` at session start to load the constraint frame.
2. Read `.cairn/SKILL.md` for the full operating protocol — when to load
   domains, when to read history, and when to write history/domain/output
   updates yourself using your file tools.
3. There is no CLI ceremony. You maintain the memory directly with
   Write/Edit. End your response with `cairn: recorded <N> event(s): ...`
   or `cairn: no event recorded` so the user can verify and git-review.
GUIDE_EOF
)

# Install or refresh the guide block for a single tool token (1–8).
# Uses managed-block upsert: appended | refreshed | unchanged.
install_one_skill() {
    local token="$1"
    case "$token" in
        1)
            local target_file=".claude/CLAUDE.md"
            # Detect old v0.0.9 skill location and offer removal
            if [ -d ".claude/skills/cairn" ]; then
                echo ""
                print_warn "$(msg_install_skill_old_detected)"
                msg_install_skill_old_remove
                local ans
                read -r ans || ans="N"
                case "${ans:-N}" in
                    [Yy]*)
                        rm -rf ".claude/skills/cairn"
                        print_ok "$(msg_install_skill_old_removed)"
                        ;;
                    *)
                        print_info "$(msg_install_skill_old_kept)"
                        ;;
                esac
            fi
            local result
            result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
            case "$result" in
                appended)  CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_skill_refreshed "$target_file")" ;;
                unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
            esac
            ;;
        2)
            local target_dir=".cursor/rules"
            local target_file="${target_dir}/cairn.mdc"
            mkdir -p "$target_dir"
            {
                echo "---"
                echo "description: Cairn path-dependency constraint system"
                echo "globs:"
                echo "alwaysApply: true"
                echo "---"
                echo ""
                echo "$_SKILL_GUIDE_BLOCK"
            } > "$target_file"
            CREATED_FILES+=("$target_file")
            print_ok "$(msg_init_written "$target_file")"
            ;;
        3)
            local target_file=".clinerules"
            local result
            result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
            case "$result" in
                appended|refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
            esac
            ;;
        4)
            local target_file=".windsurfrules"
            local result
            result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
            case "$result" in
                appended|refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
            esac
            ;;
        5)
            local target_dir=".github"
            local target_file="${target_dir}/copilot-instructions.md"
            mkdir -p "$target_dir"
            local result
            result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
            case "$result" in
                appended|refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
            esac
            ;;
        6)
            local target_file="AGENTS.md"
            if [ "$AGENTS_MD_WRITTEN" -eq 0 ]; then
                local result
                result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
                case "$result" in
                    appended|refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                    unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
                esac
                AGENTS_MD_WRITTEN=1
            else
                print_info "$(msg_init_agents_skipped)"
            fi
            ;;
        7)
            local target_file="GEMINI.md"
            local result
            result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
            case "$result" in
                appended|refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
            esac
            ;;
        8)
            local target_file="AGENTS.md"
            if [ "$AGENTS_MD_WRITTEN" -eq 0 ]; then
                local result
                result="$(_skill_block_upsert "$target_file" "<!-- cairn:start -->" "<!-- cairn:end -->" "$_SKILL_GUIDE_BLOCK")"
                case "$result" in
                    appended|refreshed) CREATED_FILES+=("$target_file"); print_ok "$(msg_init_appended "$target_file")" ;;
                    unchanged) print_info "$(msg_init_skill_unchanged "$target_file")" ;;
                esac
                AGENTS_MD_WRITTEN=1
            else
                print_info "$(msg_init_agents_skipped)"
            fi
            ;;
        *)
            print_warn "$(msg_init_skills_unknown "$token")"
            ;;
    esac
}

# Inject guide block into global AI config files (~/.claude/CLAUDE.md, etc.)
install_global_skills() {
    echo ""
    print_step "G" "$(msg_init_step_global)"
    echo ""

    local files=(
        "$HOME/.claude/CLAUDE.md"
        "$HOME/.codex/AGENTS.md"
        "$HOME/GEMINI.md"
    )

    for target in "${files[@]}"; do
        local result
        result="$(_skill_block_upsert "$target" "<!-- cairn:global-start -->" "<!-- cairn:global-end -->" "$_SKILL_GUIDE_BLOCK")"
        case "$result" in
            appended)  print_ok "$(msg_init_appended "$target")" ;;
            refreshed) print_ok "$(msg_init_skill_refreshed "$target")" ;;
            unchanged) print_info "$(msg_init_skill_unchanged "$target")" ;;
        esac
    done
}

step5_install_skills() {
    print_step "5" "$(msg_init_step_skills)"

    echo ""
    echo -e "  $(msg_init_skills_intro)"
    echo ""
    echo -e "    ${C_DIM}1)${C_RESET} ${C_BOLD}Claude Code${C_RESET}     (.claude/CLAUDE.md, managed block)"
    echo -e "    ${C_DIM}2)${C_RESET} ${C_BOLD}Cursor${C_RESET}          (.cursor/rules/cairn.mdc)"
    echo -e "    ${C_DIM}3)${C_RESET} ${C_BOLD}Cline/Roo Code${C_RESET}  (.clinerules, managed block)"
    echo -e "    ${C_DIM}4)${C_RESET} ${C_BOLD}Windsurf${C_RESET}        (.windsurfrules, managed block)"
    echo -e "    ${C_DIM}5)${C_RESET} ${C_BOLD}GitHub Copilot${C_RESET}  (.github/copilot-instructions.md, managed block)"
    echo -e "    ${C_DIM}6)${C_RESET} ${C_BOLD}Codex CLI${C_RESET}       (AGENTS.md, managed block)"
    echo -e "    ${C_DIM}7)${C_RESET} ${C_BOLD}Gemini CLI${C_RESET}      (GEMINI.md, managed block)"
    echo -e "    ${C_DIM}8)${C_RESET} ${C_BOLD}OpenCode${C_RESET}        (AGENTS.md, managed block, shared with Codex)"
    echo ""
    msg_init_skills_skip
    read -r tool_input

    if [ -z "$tool_input" ]; then
        print_info "$(msg_init_skills_skipped)"
        return
    fi

    local normalized
    normalized=$(echo "$tool_input" | tr ',' ' ')

    AGENTS_MD_WRITTEN=0
    for token in $normalized; do
        token=$(echo "$token" | tr -d '[:space:]')
        [ -z "$token" ] && continue
        install_one_skill "$token"
    done
}

# ============================================================================
# v0.0.11 Residue Check (--upgrade mode)
# ============================================================================

step_check_v0011_residue() {
    echo ""
    print_step "U" "$(msg_init_step_upgrade)"
    echo ""

    local cairn_dir=".cairn"
    local found_any=false

    if [ -d "$cairn_dir/staged" ]; then
        local count
        count="$(find "$cairn_dir/staged" -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')"
        if [ "$count" -gt 0 ]; then
            found_any=true
            print_warn "v0.0.11 residue: $cairn_dir/staged/ has $count candidate(s)"
            print_info "Review, then: git mv .cairn/staged/*.md .cairn/history/ (or delete them)"
        fi
    fi

    if [ -d "$cairn_dir/audits" ]; then
        local count
        count="$(find "$cairn_dir/audits" -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')"
        if [ "$count" -gt 0 ]; then
            found_any=true
            print_warn "v0.0.11 residue: $cairn_dir/audits/ has $count file(s)"
            print_info "Consider merging audit findings into domains/*.md known pitfalls, then delete"
        fi
    fi

    if [ -d "$cairn_dir/reflections" ]; then
        local count
        count="$(find "$cairn_dir/reflections" -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')"
        if [ "$count" -gt 0 ]; then
            found_any=true
            print_warn "v0.0.11 residue: $cairn_dir/reflections/ has $count file(s)"
            print_info "These are v0.0.11 reflect logs; safe to keep or delete"
        fi
    fi

    if [ "$found_any" = false ]; then
        print_ok "No v0.0.11 residue detected"
    fi
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    echo ""
    if [ "$_INIT_SKILLS_ONLY" = "true" ]; then
        print_header "$(msg_init_skills_only_title)"
    else
        print_header "$(msg_init_done_title)"
    fi

    echo ""
    echo -e "  ${C_BOLD}$(msg_init_done_created)${C_RESET}"
    for f in "${CREATED_FILES[@]}"; do
        echo -e "    ${C_GREEN}·${C_RESET} $f"
    done

    if [ "$_INIT_SKILLS_ONLY" = "false" ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_init_done_structure)${C_RESET}"
        echo -e "    ${C_DIM}.cairn/${C_RESET}"
        echo -e "$(msg_init_layer1_desc)"
        echo -e "$(msg_init_layer2_desc)"
        echo -e "$(msg_init_layer3_desc)"
        echo -e "    ${C_DIM}.cairn/SKILL.md  — AI operating protocol (read by AI, not humans)${C_RESET}"

        echo ""
        echo -e "  ${C_BOLD}$(msg_init_next_steps)${C_RESET}"
        echo ""
        echo -e "$(msg_init_next1)"
        echo -e "$(msg_init_next2)"
        echo -e "$(msg_init_next3)"
        echo -e "$(msg_init_next4)"
    fi

    echo ""
    echo -e "  ${C_DIM}$(msg_init_global_tip)${C_RESET}"
    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    local _REFRESH_SKILLS=false
    local _GLOBAL=false
    local _UPGRADE=false

    while [ $# -gt 0 ]; do
        case "$1" in
            --refresh-skills) _REFRESH_SKILLS=true; shift ;;
            --global)         _GLOBAL=true; _REFRESH_SKILLS=true; shift ;;
            --upgrade)        _UPGRADE=true; _REFRESH_SKILLS=true; shift ;;
            --help|-h)
                echo ""
                echo "Usage: cairn init [--refresh-skills] [--global] [--upgrade]"
                echo ""
                echo "  --refresh-skills   Refresh .cairn/SKILL.md and AI tool guide blocks only"
                echo "                     (does not modify output.md / domains/ / history/)"
                echo "  --global           Also install guide block in global AI config files"
                echo "                     (~/.claude/CLAUDE.md, ~/.codex/AGENTS.md, ~/GEMINI.md)"
                echo "  --upgrade          Check for v0.0.11 residue (staged/audits/reflections)"
                echo "                     and refresh skills; implies --refresh-skills"
                echo ""
                return 0
                ;;
            *)
                print_error "$(msg_err_unknown_flag "$1")"
                exit 1
                ;;
        esac
    done

    # ── Refresh / Upgrade mode (non-interactive, requires existing .cairn/) ───
    if [ "$_REFRESH_SKILLS" = "true" ] || [ "$_UPGRADE" = "true" ]; then
        if [ ! -d ".cairn" ]; then
            print_error "$(msg_err_no_cairn)"
            echo -e "$(msg_err_run_init)" >&2
            exit 1
        fi

        print_header "$(msg_init_title)"

        if [ "$_UPGRADE" = "true" ]; then
            step_check_v0011_residue
        fi

        step3_5_init_skill

        _INIT_SKILLS_ONLY=true
        step5_install_skills

        if [ "$_GLOBAL" = "true" ]; then
            install_global_skills
        fi

        print_summary
        return 0
    fi

    # ── Full interactive init ─────────────────────────────────────────────────
    print_header "$(msg_init_title)"
    echo ""
    echo -e "  ${C_DIM}$(msg_init_subtitle)${C_RESET}"
    echo -e "  ${C_DIM}$(msg_init_current_dir "$(pwd)")${C_RESET}"

    if [ -d ".cairn" ]; then
        echo ""
        print_warn "$(msg_init_exists_warning)"
        echo ""
        echo -e "  $(msg_init_existing_opts)"
        echo -e "$(msg_init_existing_opt1)"
        echo -e "$(msg_init_existing_opt2)"
        echo -e "$(msg_init_existing_opt3)"
        echo ""
        msg_init_existing_choose
        local existing_choice
        read -r existing_choice
        case "${existing_choice:-3}" in
            1)
                ;;
            2)
                _INIT_SKILLS_ONLY=true
                step3_5_init_skill
                step5_install_skills
                print_summary
                return 0
                ;;
            *)
                echo ""
                print_info "$(msg_init_cancelled)"
                exit 0
                ;;
        esac
    fi

    step1_select_domains
    step2_create_output_md
    step3_init_history
    step3_5_init_skill
    step4_init_domains
    step5_install_skills

    if [ "$_GLOBAL" = "true" ]; then
        install_global_skills
    fi

    print_summary
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    main "$@"
fi
