#!/usr/bin/env bash
# cairn install-skill — Install Cairn skill files into the current project
#
# Usage:
#   cairn install-skill [tool...] [--help]
#
# Without arguments: shows an interactive 8-tool menu (same as cairn init step 5).
# With arguments: installs directly for the specified tool(s).
#
# Supported tool names:
#   claude-code | claude    → .claude/CLAUDE.md (append)
#   cursor                  → .cursor/rules/cairn.mdc
#   cline | roo-code        → .clinerules (append)
#   windsurf                → .windsurfrules (append)
#   copilot                 → .github/copilot-instructions.md (append)
#   codex                   → AGENTS.md (append)
#   gemini                  → GEMINI.md (append)
#   opencode                → AGENTS.md (append, shared with Codex)
#
# Safe to run on projects that already have skill files installed — idempotent.
# When claude-code is selected and .claude/skills/cairn/ exists, prompts to
# remove the old v0.0.9 skill location.

_install_skill_help() {
    echo ""
    echo "Usage: cairn install-skill [tool...] [--help]"
    echo ""
    echo "  Install Cairn skill adapter files into the current project."
    echo "  Run without arguments for an interactive menu."
    echo ""
    echo "  Supported tools:"
    echo "    claude-code | claude    .claude/CLAUDE.md"
    echo "    cursor                  .cursor/rules/cairn.mdc"
    echo "    cline | roo-code        .clinerules"
    echo "    windsurf                .windsurfrules"
    echo "    copilot                 .github/copilot-instructions.md"
    echo "    codex                   AGENTS.md"
    echo "    gemini                  GEMINI.md"
    echo "    opencode                AGENTS.md (shared with codex)"
    echo ""
    echo "  Examples:"
    echo "    cairn install-skill"
    echo "    cairn install-skill claude-code"
    echo "    cairn install-skill claude-code cursor"
    echo ""
    echo "  Tip: run 'cairn install-global' to also enable the global protocol."
    echo ""
}

# Map a tool name string to a numeric token (1–8) matching cairn-init.sh.
_tool_name_to_token() {
    case "$1" in
        1|claude-code|claude) echo "1" ;;
        2|cursor)             echo "2" ;;
        3|cline|roo-code|roocode) echo "3" ;;
        4|windsurf)           echo "4" ;;
        5|copilot|github-copilot) echo "5" ;;
        6|codex)              echo "6" ;;
        7|gemini)             echo "7" ;;
        8|opencode|open-code) echo "8" ;;
        *) echo "" ;;
    esac
}

cmd_install_skill() {
    # Require a .cairn/ project directory
    local project_root
    if ! project_root="$(find_cairn_root)"; then
        echo -e "${C_RED}error:${C_RESET} $(msg_install_skill_no_cairn)" >&2
        exit 1
    fi

    # Source cairn-init.sh as a library (source guard ensures main() does not run)
    local _init_script
    _init_script="$(cd "$CAIRN_CLI_DIR/.." && pwd)/scripts/cairn-init.sh"
    # shellcheck source=../../scripts/cairn-init.sh
    source "$_init_script"

    # Reset state that cairn-init.sh initialises at source time
    CREATED_FILES=()
    AGENTS_MD_WRITTEN=0
    _INSTALL_TIP_TOKENS=()

    # Parse arguments
    local -a tokens=()
    local interactive=false

    if [ $# -eq 0 ]; then
        interactive=true
    else
        while [ $# -gt 0 ]; do
            case "$1" in
                --help|-h)
                    _install_skill_help
                    return 0
                    ;;
                -*)
                    echo -e "${C_RED}error:${C_RESET} unknown flag: $1" >&2
                    echo "Run 'cairn install-skill --help' for usage." >&2
                    exit 1
                    ;;
                *)
                    local tok
                    tok="$(_tool_name_to_token "$1")"
                    if [ -z "$tok" ]; then
                        echo -e "${C_RED}error:${C_RESET} $(msg_install_skill_unknown "$1")" >&2
                        exit 1
                    fi
                    tokens+=("$tok")
                    ;;
            esac
            shift
        done
    fi

    echo ""
    echo -e "${C_BOLD}${C_BLUE}$(msg_install_skill_title)${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
    echo ""

    if [ "$interactive" = true ]; then
        echo -e "  $(msg_install_skill_intro)"
        echo ""
        echo -e "    ${C_DIM}1)${C_RESET} ${C_BOLD}Claude Code${C_RESET}     (.claude/CLAUDE.md, append)"
        echo -e "    ${C_DIM}2)${C_RESET} ${C_BOLD}Cursor${C_RESET}          (.cursor/rules/cairn.mdc)"
        echo -e "    ${C_DIM}3)${C_RESET} ${C_BOLD}Cline/Roo Code${C_RESET}  (.clinerules, append)"
        echo -e "    ${C_DIM}4)${C_RESET} ${C_BOLD}Windsurf${C_RESET}        (.windsurfrules, append)"
        echo -e "    ${C_DIM}5)${C_RESET} ${C_BOLD}GitHub Copilot${C_RESET}  (.github/copilot-instructions.md, append)"
        echo -e "    ${C_DIM}6)${C_RESET} ${C_BOLD}Codex CLI${C_RESET}       (AGENTS.md, append)"
        echo -e "    ${C_DIM}7)${C_RESET} ${C_BOLD}Gemini CLI${C_RESET}      (GEMINI.md, append)"
        echo -e "    ${C_DIM}8)${C_RESET} ${C_BOLD}OpenCode${C_RESET}        (AGENTS.md, append, shared with Codex)"
        echo ""
        printf "  Press Enter to cancel: "
        local tool_input
        read -r tool_input

        if [ -z "$tool_input" ]; then
            print_info "$(msg_install_skill_cancel)"
            echo ""
            return 0
        fi

        local normalized
        normalized=$(echo "$tool_input" | tr ',' ' ')
        for raw_tok in $normalized; do
            raw_tok=$(echo "$raw_tok" | tr -d '[:space:]')
            [ -z "$raw_tok" ] && continue
            local resolved
            resolved="$(_tool_name_to_token "$raw_tok")"
            if [ -z "$resolved" ]; then
                print_warn "$(msg_init_skills_unknown "$raw_tok")"
            else
                tokens+=("$resolved")
            fi
        done
    fi

    if [ ${#tokens[@]} -eq 0 ]; then
        print_info "$(msg_install_skill_cancel)"
        echo ""
        return 0
    fi

    # Install each selected tool
    for tok in "${tokens[@]}"; do
        install_one_skill "$tok"
    done

    # Summary
    if [ ${#CREATED_FILES[@]} -gt 0 ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_install_skill_files_updated)${C_RESET}"
        for f in "${CREATED_FILES[@]}"; do
            echo -e "    ${C_GREEN}·${C_RESET} $f"
        done
    fi

    _maybe_print_global_tip "${_INSTALL_TIP_TOKENS[@]+"${_INSTALL_TIP_TOKENS[@]}"}"
    echo ""
}
