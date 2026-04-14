#!/usr/bin/env bash
# cairn stage — Manage staged history entries
#
# Subcommands:
#   review    Interactively review staged entries: accept / edit / skip / quit
#
# Accept moves the staged file to .cairn/history/.
# Edit invokes $EDITOR (falls back to vi).
# Skip leaves the entry in staged/.
# Quit stops without processing remaining entries.
#
# Compatible with bash 3.2+ (macOS system bash).

# -----------------------------------------------------------------------------
# Highlight [TODO] in a line by wrapping with color codes (if color available).
# -----------------------------------------------------------------------------
_stage_highlight_todo() {
    if [ -n "$C_YELLOW" ]; then
        sed "s/\[TODO\]/${C_YELLOW}[TODO]${C_RESET}/g"
    else
        cat
    fi
}

# -----------------------------------------------------------------------------
# Extract cairn-analyze meta-comment values from a staged file.
# Sets _STAGE_META_CONFIDENCE and _STAGE_META_SOURCE.
# -----------------------------------------------------------------------------
_stage_extract_meta() {
    local file="$1"
    _STAGE_META_CONFIDENCE=""
    _STAGE_META_SOURCE=""
    _STAGE_META_IS_ANALYZE=false

    if grep -q '^# cairn-analyze:' "$file" 2>/dev/null; then
        _STAGE_META_IS_ANALYZE=true
        _STAGE_META_CONFIDENCE="$(grep '^# confidence:' "$file" 2>/dev/null \
            | head -1 | sed 's/^# confidence: *//')"
        _STAGE_META_SOURCE="$(grep '^# source:' "$file" 2>/dev/null \
            | head -1 | sed 's/^# source: *//')"
    fi
}

# -----------------------------------------------------------------------------
# Write a copy of the staged file with all cairn-analyze meta-comment lines
# stripped (lines starting with "# cairn-analyze:", "# confidence:", "# source:").
# Used when accepting an analyze-sourced entry into history/.
# -----------------------------------------------------------------------------
_stage_strip_meta() {
    local src_file="$1"
    local dst_file="$2"
    grep -v '^# cairn-analyze:\|^# confidence:\|^# source:' "$src_file" > "$dst_file"
}

# -----------------------------------------------------------------------------
# Review loop: process each staged entry interactively.
# -----------------------------------------------------------------------------
_stage_review() {
    local root
    root="$(require_cairn_root)"
    local cairn_dir="$root/.cairn"
    local history_dir="$cairn_dir/history"

    # Collect staged files
    local staged_files=()
    while IFS= read -r f; do
        [ -z "$f" ] && continue
        staged_files+=("$f")
    done < <(find_staged_files "$cairn_dir")

    local total=${#staged_files[@]}

    if [ "$total" -eq 0 ]; then
        echo ""
        echo -e "  $(msg_stage_no_entries)"
        echo -e "  ${C_DIM}$(msg_stage_no_entries_hint)${C_RESET}"
        echo ""
        return 0
    fi

    local accepted=0 skipped=0 edited=0
    local idx=0

    while [ "$idx" -lt "$total" ]; do
        local staged_file="${staged_files[$idx]}"
        local fname
        fname="$(basename "$staged_file")"

        # Extract analyze metadata (sets _STAGE_META_* globals)
        _stage_extract_meta "$staged_file"

        # Display entry header
        echo ""
        echo -e "${C_BOLD}$(msg_stage_entry_header "$(( idx + 1 ))" "$total" "$fname")${C_RESET}"

        # Show analyze confidence/source if present
        if [ "$_STAGE_META_IS_ANALYZE" = "true" ]; then
            local conf_color="$C_DIM"
            case "$_STAGE_META_CONFIDENCE" in
                high)   conf_color="$C_GREEN" ;;
                medium) conf_color="$C_YELLOW" ;;
                low)    conf_color="$C_DIM" ;;
            esac
            echo -e "${conf_color}$(msg_stage_analyze_meta \
                "$_STAGE_META_CONFIDENCE" "$_STAGE_META_SOURCE")${C_RESET}"
        fi

        echo ""
        # Show file content (skip meta-comment lines for display) with [TODO] highlighted
        grep -v '^# cairn-analyze:\|^# confidence:\|^# source:' "$staged_file" \
            | _stage_highlight_todo
        echo ""

        # Warn if [TODO] fields present
        local has_todo=false
        if grep -qF '[TODO]' "$staged_file" 2>/dev/null; then
            has_todo=true
            echo -e "  ${C_YELLOW}$(msg_stage_has_todo)${C_RESET}"
            echo ""
        fi

        # Warn if low confidence analyze entry
        if [ "$_STAGE_META_IS_ANALYZE" = "true" ] && [ "$_STAGE_META_CONFIDENCE" = "low" ]; then
            echo -e "  ${C_YELLOW}$(msg_stage_low_confidence_warn)${C_RESET}"
            echo ""
        fi

        # Prompt
        msg_stage_prompt
        local choice=""
        read -r choice

        case "$choice" in
            a|A|accept)
                # If has [TODO], confirm
                if [ "$has_todo" = true ]; then
                    msg_stage_accept_confirm
                    local confirm=""
                    read -r confirm
                    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
                        echo -e "  ${C_DIM}$(msg_stage_skipped)${C_RESET}"
                        skipped=$(( skipped + 1 ))
                        idx=$(( idx + 1 ))
                        continue
                    fi
                fi

                # Safety check: no collision in history/
                local history_target="$history_dir/$fname"
                if [ -f "$history_target" ]; then
                    echo -e "  ${C_RED}error:${C_RESET} $(msg_stage_conflict "$fname")" >&2
                    skipped=$(( skipped + 1 ))
                    idx=$(( idx + 1 ))
                    continue
                fi

                mkdir -p "$history_dir"

                # If this is an analyze-sourced entry, strip meta-comments before moving
                if [ "$_STAGE_META_IS_ANALYZE" = "true" ]; then
                    _stage_strip_meta "$staged_file" "$history_target"
                    rm "$staged_file"
                else
                    mv "$staged_file" "$history_target"
                fi

                echo ""
                echo -e "  ${C_GREEN}$(msg_stage_accepted "$fname")${C_RESET}"

                # Show next-step hint for cairn sync
                local domain_val=""
                domain_val="$(grep "^domain:" "$history_target" 2>/dev/null | head -1 \
                    | sed 's/^domain: //' | tr -d '[:space:]' || true)"
                if [ -n "$domain_val" ] && [ "$domain_val" != "[TODO]" ]; then
                    echo -e "  ${C_DIM}$(msg_stage_accepted_next "$domain_val")${C_RESET}"
                fi

                accepted=$(( accepted + 1 ))
                idx=$(( idx + 1 ))
                ;;

            e|E|edit)
                # Open in editor, then re-show (don't advance idx)
                local editor_cmd="${EDITOR:-vi}"
                "$editor_cmd" "$staged_file"
                echo ""
                echo -e "  ${C_DIM}$(msg_stage_edit_hint)${C_RESET}"
                edited=$(( edited + 1 ))
                # Don't advance idx — re-show the entry after edit
                ;;

            s|S|skip)
                echo -e "  ${C_DIM}$(msg_stage_skipped)${C_RESET}"
                skipped=$(( skipped + 1 ))
                idx=$(( idx + 1 ))
                ;;

            q|Q|quit)
                break
                ;;

            *)
                # Re-show prompt without advancing
                ;;
        esac
    done

    echo ""
    echo -e "  $(msg_stage_summary "$accepted" "$skipped" "$edited")"
    echo ""
}

# -----------------------------------------------------------------------------
# Main command — dispatch subverbs
# -----------------------------------------------------------------------------
cmd_stage() {
    local subverb="${1:-}"
    shift 2>/dev/null || true

    case "$subverb" in
        review)
            _stage_review "$@"
            ;;
        ""|help|--help|-h)
            echo ""
            echo -e "  ${C_BOLD}$(msg_stage_help)${C_RESET}"
            echo ""
            ;;
        *)
            echo -e "${C_RED}error:${C_RESET} $(msg_stage_unknown_sub "$subverb")" >&2
            exit 1
            ;;
    esac
}
