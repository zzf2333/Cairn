#!/usr/bin/env bash
# cairn install-global — Inject Cairn memory protocol into global AI config files
#
# Usage:
#   cairn install-global [--uninstall] [--dry-run] [--yes]
#
# Adds (or removes) a short Cairn Memory Protocol block to the user's global
# AI tool config files. This provides a second enforcement layer: even if a
# project's skill file is not loaded, the global config reminds the AI to run
# the reflection gate whenever .cairn/ is present.
#
# Supported global config paths:
#   Claude Code  : ~/.claude/CLAUDE.md
#   Codex CLI    : ~/.codex/AGENTS.md
#   Gemini CLI   : ~/GEMINI.md
#
# Cursor, Windsurf, Cline store global rules inside IDE/app storage and cannot
# be reliably modified via shell — install their project-level skill files instead.
#
# Compatible with bash 3.2+ (macOS system bash).

# ── Protocol block content ────────────────────────────────────────────────────

_GLOBAL_PROTOCOL_CONTENT='## Cairn Memory Protocol

When working in a project that contains a `.cairn/` directory, you MUST:

1. Read `.cairn/output.md` before responding to any request.
2. After completing a task, run the reflection gate defined in the project
   skill file (e.g. `.claude/skills/cairn/SKILL.md`).
3. End your response with exactly one of:
   `cairn-reflection: no-op`
   `cairn-reflection: candidates-created — run cairn stage review`
   `cairn-reflection: audit-required — run cairn stage review then cairn audit start`

Omitting step 3 is a protocol violation regardless of whether the project
skill file was loaded.'

_MARKER_START='<!-- cairn:global-protocol:start -->'
_MARKER_END='<!-- cairn:global-protocol:end -->'

# ── Check if block already present ───────────────────────────────────────────
_global_block_present() {
    local file="$1"
    [ -f "$file" ] && grep -qF "$_MARKER_START" "$file" 2>/dev/null
}

# ── Inject block into a file (idempotent) ─────────────────────────────────────
_global_inject() {
    local file="$1"
    local dir
    dir="$(dirname "$file")"

    if _global_block_present "$file"; then
        echo -e "  ${C_DIM}already installed: $file${C_RESET}"
        return 0
    fi

    [ "$DRY_RUN" = "true" ] && { echo -e "  ${C_DIM}[dry-run] would inject: $file${C_RESET}"; return 0; }

    mkdir -p "$dir"

    # Append a blank line separator if file is non-empty and doesn't end with newline
    if [ -s "$file" ]; then
        printf '\n\n' >> "$file"
    fi

    {
        echo "$_MARKER_START"
        echo "$_GLOBAL_PROTOCOL_CONTENT"
        echo "$_MARKER_END"
    } >> "$file"

    echo -e "  ${C_GREEN}✓${C_RESET} injected: $file"
}

# ── Remove block from a file ──────────────────────────────────────────────────
_global_remove() {
    local file="$1"

    if ! _global_block_present "$file"; then
        echo -e "  ${C_DIM}not installed: $file${C_RESET}"
        return 0
    fi

    [ "$DRY_RUN" = "true" ] && { echo -e "  ${C_DIM}[dry-run] would remove from: $file${C_RESET}"; return 0; }

    local tmp
    tmp="$(mktemp)"

    # Remove everything between (and including) the markers
    awk "
        /^<!-- cairn:global-protocol:start -->/ { skip=1; next }
        /^<!-- cairn:global-protocol:end -->/ { skip=0; next }
        !skip { print }
    " "$file" > "$tmp"

    # Strip trailing blank lines left by the removal
    awk 'NF{found=1} found{print}' RS='' ORS='\n\n' "$tmp" > "$file" || cp "$tmp" "$file"
    rm -f "$tmp"

    echo -e "  ${C_GREEN}✓${C_RESET} removed from: $file"
}

# ── Prompt helper ─────────────────────────────────────────────────────────────
_confirm() {
    local prompt="$1"
    [ "$YES" = "true" ] && return 0
    printf "  %s [y/N] " "$prompt"
    local ans
    read -r ans
    [ "$ans" = "y" ] || [ "$ans" = "Y" ]
}

# ── Main command ──────────────────────────────────────────────────────────────
cmd_install_global() {
    local UNINSTALL=false
    DRY_RUN=false
    YES=false

    while [ $# -gt 0 ]; do
        case "$1" in
            --uninstall)  UNINSTALL=true; shift ;;
            --dry-run)    DRY_RUN=true;   shift ;;
            --yes|-y)     YES=true;        shift ;;
            --help|-h)
                echo ""
                echo "Usage: cairn install-global [--uninstall] [--dry-run] [--yes]"
                echo ""
                echo "  Inject the Cairn Memory Protocol block into global AI config files."
                echo "  --uninstall   Remove the block instead of injecting it."
                echo "  --dry-run     Show what would be done without making changes."
                echo "  --yes         Skip confirmation prompts."
                echo ""
                echo "  Supported:"
                echo "    Claude Code  ~/.claude/CLAUDE.md"
                echo "    Codex CLI    ~/.codex/AGENTS.md"
                echo "    Gemini CLI   ~/GEMINI.md"
                echo ""
                echo "  Not supported (IDE-managed, no accessible global config file):"
                echo "    Cursor, Windsurf, Cline — install project skill files instead."
                echo ""
                return 0
                ;;
            *)
                echo -e "${C_RED}error:${C_RESET} unknown flag: $1" >&2
                exit 1
                ;;
        esac
    done

    echo ""
    echo -e "${C_BOLD}${C_BLUE}Cairn — Global Protocol Installation${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
    echo ""

    if [ "$UNINSTALL" = "true" ]; then
        echo -e "  ${C_YELLOW}Mode: uninstall (remove Cairn global protocol blocks)${C_RESET}"
    else
        echo -e "  ${C_CYAN}Mode: install (inject Cairn global protocol blocks)${C_RESET}"
    fi

    if [ "$DRY_RUN" = "true" ]; then
        echo -e "  ${C_DIM}Dry-run: no files will be modified.${C_RESET}"
    fi

    echo ""
    echo -e "  ${C_DIM}This adds a short 'Cairn Memory Protocol' block to your global AI"
    echo -e "  config files. The block activates whenever you work in a project with"
    echo -e "  a .cairn/ directory, ensuring the reflection gate runs even if the"
    echo -e "  project-level skill file is not loaded.${C_RESET}"
    echo ""

    local action
    [ "$UNINSTALL" = "true" ] && action="Remove from" || action="Inject into"

    # ── Claude Code ──
    local claude_config="$HOME/.claude/CLAUDE.md"
    echo -e "  ${C_BOLD}Claude Code${C_RESET} → $claude_config"
    if _confirm "$action this file?"; then
        if [ "$UNINSTALL" = "true" ]; then
            _global_remove "$claude_config"
        else
            _global_inject "$claude_config"
        fi
    else
        echo -e "  ${C_DIM}skipped${C_RESET}"
    fi
    echo ""

    # ── Codex CLI ──
    local codex_config="$HOME/.codex/AGENTS.md"
    echo -e "  ${C_BOLD}Codex CLI${C_RESET} → $codex_config"
    if _confirm "$action this file?"; then
        if [ "$UNINSTALL" = "true" ]; then
            _global_remove "$codex_config"
        else
            _global_inject "$codex_config"
        fi
    else
        echo -e "  ${C_DIM}skipped${C_RESET}"
    fi
    echo ""

    # ── Gemini CLI ──
    local gemini_config="$HOME/GEMINI.md"
    echo -e "  ${C_BOLD}Gemini CLI${C_RESET} → $gemini_config"
    if _confirm "$action this file?"; then
        if [ "$UNINSTALL" = "true" ]; then
            _global_remove "$gemini_config"
        else
            _global_inject "$gemini_config"
        fi
    else
        echo -e "  ${C_DIM}skipped${C_RESET}"
    fi
    echo ""

    # ── Unsupported tools notice ──
    echo -e "  ${C_DIM}Note: Cursor, Windsurf, and Cline store global rules inside IDE"
    echo -e "  application storage and cannot be modified via shell script. For"
    echo -e "  these tools, install the project-level skill file (cairn init) and"
    echo -e "  manually add the protocol to their global rules settings.${C_RESET}"
    echo ""

    if [ "$DRY_RUN" = "false" ] && [ "$UNINSTALL" = "false" ]; then
        echo -e "  ${C_GREEN}Done.${C_RESET} The global protocol is now active for supported tools."
        echo -e "  ${C_DIM}To remove: cairn install-global --uninstall${C_RESET}"
    elif [ "$DRY_RUN" = "false" ] && [ "$UNINSTALL" = "true" ]; then
        echo -e "  ${C_GREEN}Done.${C_RESET} Global protocol blocks removed."
    fi
    echo ""
}
