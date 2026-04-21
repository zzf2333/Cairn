#!/usr/bin/env bash
# cairn stage — Manage staged history entries
#
# Subcommands:
#   review    Interactively review staged entries: accept / edit / skip / quit
#
# Accept routes each candidate based on its filename prefix (v0.0.8+):
#   history-candidate_*        → .cairn/history/   (strip prefix)
#   domain-update-candidate_*  → open $EDITOR on target domains/*.md
#   output-update-candidate_*  → open $EDITOR on .cairn/output.md
#   audit-candidate_*          → .cairn/audits/    (strip prefix)
#   <no prefix>                → .cairn/history/   (legacy behavior)
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
# Detect candidate kind from filename prefix (v0.0.8+).
# Outputs: history | domain-update | output-update | audit | legacy
# -----------------------------------------------------------------------------
_stage_detect_kind() {
    local fname="$1"
    case "$fname" in
        history-candidate_*)       echo "history" ;;
        domain-update-candidate_*) echo "domain-update" ;;
        output-update-candidate_*) echo "output-update" ;;
        audit-candidate_*)         echo "audit" ;;
        *)                         echo "legacy" ;;
    esac
}

# -----------------------------------------------------------------------------
# Extract target domain from a domain-update-candidate file.
# Checks # target-domain: meta-comment first, then domain: field.
# -----------------------------------------------------------------------------
_stage_extract_candidate_domain() {
    local file="$1"
    local td
    td="$(grep '^# target-domain:' "$file" 2>/dev/null | head -1 \
        | sed 's/^# target-domain: *//' | tr -d '[:space:]' || true)"
    if [ -z "$td" ]; then
        td="$(grep '^domain:' "$file" 2>/dev/null | head -1 \
            | sed 's/^domain: *//' | tr -d '[:space:]' || true)"
    fi
    echo "$td"
}

# -----------------------------------------------------------------------------
# Extract cairn-analyze or cairn-reflect meta-comment values from a staged file.
# Sets _STAGE_META_CONFIDENCE and _STAGE_META_SOURCE.
# -----------------------------------------------------------------------------
_stage_extract_meta() {
    local file="$1"
    _STAGE_META_CONFIDENCE=""
    _STAGE_META_SOURCE=""
    _STAGE_META_IS_ANALYZE=false

    if grep -qE '^# cairn-(analyze|reflect):' "$file" 2>/dev/null; then
        _STAGE_META_IS_ANALYZE=true
        _STAGE_META_CONFIDENCE="$(grep '^# confidence:' "$file" 2>/dev/null \
            | head -1 | sed 's/^# confidence: *//' || true)"
        _STAGE_META_SOURCE="$(grep '^# source:' "$file" 2>/dev/null \
            | head -1 | sed 's/^# source: *//' || true)"
    fi
}

# -----------------------------------------------------------------------------
# Write a copy of the staged file with all tool meta-comment lines stripped.
# Covers both cairn-analyze and cairn-reflect meta-comment headers.
# Used when accepting any tool-generated entry.
# -----------------------------------------------------------------------------
_stage_strip_meta() {
    local src_file="$1"
    local dst_file="$2"
    grep -v '^# cairn-analyze:\|^# cairn-reflect:\|^# confidence:\|^# source:\|^# layer:\|^# kind:\|^# target-domain:' \
        "$src_file" > "$dst_file"
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

        # Detect candidate kind (v0.0.8+)
        local kind
        kind="$(_stage_detect_kind "$fname")"

        # Extract analyze/reflect metadata (sets _STAGE_META_* globals)
        _stage_extract_meta "$staged_file"

        # Display entry header
        echo ""
        echo -e "${C_BOLD}$(msg_stage_entry_header "$(( idx + 1 ))" "$total" "$fname")${C_RESET}"

        # Show candidate kind routing hint
        case "$kind" in
            history)       echo -e "  ${C_DIM}$(msg_stage_kind_history)${C_RESET}" ;;
            domain-update) echo -e "  ${C_CYAN}$(msg_stage_kind_domain)${C_RESET}" ;;
            output-update) echo -e "  ${C_YELLOW}$(msg_stage_kind_output)${C_RESET}" ;;
            audit)         echo -e "  ${C_CYAN}$(msg_stage_kind_audit)${C_RESET}" ;;
            legacy)        echo -e "  ${C_DIM}$(msg_stage_kind_legacy)${C_RESET}" ;;
        esac

        # Show analyze/reflect confidence/source if present
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
        # Show file content (skip all tool meta-comment lines) with [TODO] highlighted
        grep -v '^# cairn-analyze:\|^# cairn-reflect:\|^# confidence:\|^# source:\|^# layer:\|^# kind:\|^# target-domain:' \
            "$staged_file" | _stage_highlight_todo
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

                # Dispatch by candidate kind
                case "$kind" in
                    history|legacy)
                        local hist_target_name="$fname"
                        case "$fname" in
                            history-candidate_*) hist_target_name="${fname#history-candidate_}" ;;
                        esac
                        local history_target="$history_dir/$hist_target_name"
                        if [ -f "$history_target" ]; then
                            echo -e "  ${C_RED}error:${C_RESET} $(msg_stage_conflict "$hist_target_name")" >&2
                            skipped=$(( skipped + 1 ))
                            idx=$(( idx + 1 ))
                            continue
                        fi
                        mkdir -p "$history_dir"
                        _stage_strip_meta "$staged_file" "$history_target"
                        rm "$staged_file"
                        echo ""
                        echo -e "  ${C_GREEN}$(msg_stage_accepted "$hist_target_name")${C_RESET}"
                        local domain_val=""
                        domain_val="$(grep "^domain:" "$history_target" 2>/dev/null | head -1 \
                            | sed 's/^domain: //' | tr -d '[:space:]' || true)"
                        if [ -n "$domain_val" ] && [ "$domain_val" != "[TODO]" ]; then
                            echo -e "  ${C_DIM}$(msg_stage_accepted_next "$domain_val")${C_RESET}"
                        fi
                        ;;

                    audit)
                        local audit_target_name="$fname"
                        case "$fname" in
                            audit-candidate_*) audit_target_name="${fname#audit-candidate_}" ;;
                        esac
                        local audits_dir="$cairn_dir/audits"
                        local audit_target="$audits_dir/$audit_target_name"
                        if [ -f "$audit_target" ]; then
                            echo -e "  ${C_RED}error:${C_RESET} $(msg_stage_conflict "$audit_target_name")" >&2
                            skipped=$(( skipped + 1 ))
                            idx=$(( idx + 1 ))
                            continue
                        fi
                        mkdir -p "$audits_dir"
                        _stage_strip_meta "$staged_file" "$audit_target"
                        rm "$staged_file"
                        echo ""
                        echo -e "  ${C_GREEN}$(msg_stage_accepted_audit "$audit_target_name")${C_RESET}"
                        ;;

                    domain-update)
                        local target_domain=""
                        target_domain="$(_stage_extract_candidate_domain "$staged_file")"
                        if [ -z "$target_domain" ]; then
                            echo -e "  ${C_RED}error:${C_RESET} no target domain found — skipping" >&2
                            skipped=$(( skipped + 1 ))
                            idx=$(( idx + 1 ))
                            continue
                        fi
                        local domain_target="$cairn_dir/domains/${target_domain}.md"
                        local editor_cmd="${EDITOR:-vi}"
                        echo ""
                        echo -e "  ${C_CYAN}$(msg_stage_open_editor_domain "$target_domain")${C_RESET}"
                        "$editor_cmd" "$domain_target"
                        rm "$staged_file"
                        echo -e "  ${C_GREEN}✓  merged — staged file removed${C_RESET}"
                        ;;

                    output-update)
                        local output_target="$cairn_dir/output.md"
                        local editor_cmd="${EDITOR:-vi}"
                        echo ""
                        echo -e "  ${C_YELLOW}$(msg_stage_open_editor_output)${C_RESET}"
                        "$editor_cmd" "$output_target"
                        rm "$staged_file"
                        echo -e "  ${C_GREEN}✓  merged — staged file removed${C_RESET}"
                        ;;
                esac

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
