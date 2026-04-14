#!/usr/bin/env bash
# cairn sync — Generate an AI prompt to update a domain file from history
#
# Phase 2 scope: generates a structured prompt for the user to paste into
# their AI tool (Claude Code, Cursor, ChatGPT, etc.). Does not call any API.
#
# Usage:
#   cairn sync <domain>          Generate prompt for a specific domain
#   cairn sync --stale           Generate prompts for all stale domains
#   cairn sync <domain> --dry-run  Show what would be included, not the full prompt
#   cairn sync <domain> --copy   Copy prompt to clipboard (pbcopy/xclip)
#
# Compatible with bash 3.2+ (macOS system bash).

# -----------------------------------------------------------------------------
# Generate the sync prompt for a single domain.
# Prints to stdout.
# -----------------------------------------------------------------------------
_sync_generate_prompt() {
    local domain="$1"
    local domains_dir="$2"
    local history_dir="$3"

    local domain_file="$domains_dir/${domain}.md"

    # ---- Collect history entries for this domain (sorted by filename = date) ----
    local history_entries=""
    local entry_count=0
    local latest_date=""

    if [ -d "$history_dir" ]; then
        while IFS= read -r hist_file; do
            [ -f "$hist_file" ] || continue
            local hbase
            hbase="$(basename "$hist_file")"
            [ "$hbase" = "_TEMPLATE.md" ] && continue

            local hdomain hrdate
            hdomain="$(grep "^domain:" "$hist_file" 2>/dev/null | head -1 | sed 's/^domain: //' | tr -d '[:space:]' || true)"
            [ "$hdomain" = "$domain" ] || continue

            hrdate="$(grep "^decision_date:" "$hist_file" 2>/dev/null | head -1 | sed 's/^decision_date: //' | tr -d '[:space:]' || true)"

            entry_count=$(( entry_count + 1 ))
            if [ -z "$latest_date" ] || [[ "$hrdate" > "$latest_date" ]]; then
                latest_date="$hrdate"
            fi

            history_entries="${history_entries}
### ${hbase}
$(cat "$hist_file")
"
        done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
    fi

    if [ "$entry_count" -eq 0 ]; then
        echo -e "${C_YELLOW}warning:${C_RESET} $(msg_warn_no_history "$domain")" >&2
        echo -e "  $(msg_warn_record_first)" >&2
        return 1
    fi

    local current_file_section
    if [ -f "$domain_file" ]; then
        current_file_section="$(tpl_sync_domain_exists_header "$domain")

$(cat "$domain_file")"
    else
        current_file_section="$(tpl_sync_domain_missing_section)"
    fi

    # ---- Output the prompt ----
    tpl_sync_prompt "$domain" "$current_file_section" "$history_entries" "${latest_date:-$(date +%Y-%m)}"
}

# -----------------------------------------------------------------------------
# Dry-run: show what would be included without generating the full prompt.
# -----------------------------------------------------------------------------
_sync_dry_run() {
    local domain="$1"
    local domains_dir="$2"
    local history_dir="$3"

    local domain_file="$domains_dir/${domain}.md"

    echo ""
    echo -e "  ${C_BOLD}$(msg_sync_dry_run_header "$domain")${C_RESET}"
    echo ""

    if [ -f "$domain_file" ]; then
        local domain_updated=""
        domain_updated="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^updated:" | head -1 | sed 's/^updated: //' | tr -d '[:space:]' || true)"
        echo -e "  ${C_GREEN}$(msg_sync_domain_exists "${domain_updated:-unknown}")${C_RESET}"
    else
        echo -e "  ${C_YELLOW}$(msg_sync_domain_missing)${C_RESET}"
    fi

    local entry_count=0
    local entry_list=""
    if [ -d "$history_dir" ]; then
        while IFS= read -r hist_file; do
            [ -f "$hist_file" ] || continue
            local hbase
            hbase="$(basename "$hist_file")"
            [ "$hbase" = "_TEMPLATE.md" ] && continue

            local hdomain
            hdomain="$(grep "^domain:" "$hist_file" 2>/dev/null | head -1 | sed 's/^domain: //' | tr -d '[:space:]' || true)"
            [ "$hdomain" = "$domain" ] || continue

            entry_count=$(( entry_count + 1 ))
            entry_list="${entry_list}  · ${hbase}\n"
        done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
    fi

    echo -e "  ${C_GREEN}$(msg_sync_history_count "$entry_count")${C_RESET}"
    if [ -n "$entry_list" ]; then
        echo -e "${C_DIM}${entry_list}${C_RESET}"
    fi

    if [ "$entry_count" -eq 0 ]; then
        echo -e "  ${C_YELLOW}$(msg_sync_no_history_note)${C_RESET}"
    else
        echo -e "  ${C_DIM}$(msg_sync_run_full "$domain")${C_RESET}"
    fi
    echo ""
}

# -----------------------------------------------------------------------------
# Get all stale domains (same logic as cairn status).
# Prints one domain name per line.
# -----------------------------------------------------------------------------
_sync_stale_domains() {
    local output_md="$1"
    local domains_dir="$2"
    local history_dir="$3"

    local locked_domains=""
    if [ -f "$output_md" ]; then
        locked_domains="$(grep -oE '→ read domains/[a-z][a-z0-9-]+\.md first' "$output_md" \
            | sed 's/→ read domains\///;s/\.md first//' || true)"
    fi

    while IFS= read -r d; do
        [ -z "$d" ] && continue
        local domain_file="$domains_dir/${d}.md"
        [ -f "$domain_file" ] || continue

        local domain_updated=""
        domain_updated="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^updated:" | head -1 | sed 's/^updated: //' | tr -d '[:space:]' || true)"
        [ -n "$domain_updated" ] || continue

        if [ -d "$history_dir" ]; then
            while IFS= read -r hist_file; do
                local hbase
                hbase="$(basename "$hist_file")"
                [ "$hbase" = "_TEMPLATE.md" ] && continue

                local hdomain hrdate
                hdomain="$(grep "^domain:" "$hist_file" 2>/dev/null | head -1 | sed 's/^domain: //' | tr -d '[:space:]' || true)"
                hrdate="$(grep "^recorded_date:" "$hist_file" 2>/dev/null | head -1 | sed 's/^recorded_date: //' | tr -d '[:space:]' || true)"

                [ "$hdomain" = "$d" ] || continue
                [ -n "$hrdate" ] || continue

                if [[ "$hrdate" > "$domain_updated" ]]; then
                    echo "$d"
                    break
                fi
            done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
        fi
    done <<< "$locked_domains"
}

# -----------------------------------------------------------------------------
# Main command
# -----------------------------------------------------------------------------
cmd_sync() {
    local root
    root="$(require_cairn_root)"

    local cairn_dir="$root/.cairn"
    local output_md="$cairn_dir/output.md"
    local domains_dir="$cairn_dir/domains"
    local history_dir="$cairn_dir/history"

    # ---- Parse arguments ----
    local target_domain=""
    local flag_stale=false
    local flag_dry_run=false
    local flag_copy=false

    while [ $# -gt 0 ]; do
        case "$1" in
            --stale)    flag_stale=true;   shift ;;
            --dry-run)  flag_dry_run=true; shift ;;
            --copy)     flag_copy=true;    shift ;;
            --*)
                echo -e "${C_RED}error:${C_RESET} $(msg_err_unknown_flag "$1")" >&2
                exit 1
                ;;
            *)
                if [ -z "$target_domain" ]; then
                    target_domain="$1"
                else
                    echo -e "${C_RED}error:${C_RESET} $(msg_err_unexpected_arg "$1")" >&2
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # ---- Validate arguments ----
    if [ -z "$target_domain" ] && [ "$flag_stale" = false ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_sync_specify)" >&2
        echo ""
        echo -e "  Usage:"
        echo -e "$(msg_sync_usage_domain)"
        echo -e "$(msg_sync_usage_stale)"
        echo -e "$(msg_sync_usage_dry_run)"
        echo ""
        exit 1
    fi

    # ---- Collect target domains ----
    local target_domains=""
    if [ "$flag_stale" = true ]; then
        target_domains="$(_sync_stale_domains "$output_md" "$domains_dir" "$history_dir")"
        if [ -z "$target_domains" ]; then
            echo ""
            echo -e "  ${C_GREEN}✓${C_RESET} $(msg_sync_no_stale)"
            echo -e "  ${C_DIM}$(msg_sync_verify)${C_RESET}"
            echo ""
            return 0
        fi
    else
        target_domains="$target_domain"
    fi

    # ---- Process each target domain ----
    local prompt_output=""
    local prompt_failed=false
    while IFS= read -r d; do
        [ -z "$d" ] && continue

        if [ "$flag_dry_run" = true ]; then
            _sync_dry_run "$d" "$domains_dir" "$history_dir"
        else
            local domain_prompt=""
            if ! domain_prompt="$(_sync_generate_prompt "$d" "$domains_dir" "$history_dir")"; then
                prompt_failed=true
                continue
            fi
            prompt_output="${prompt_output}${domain_prompt}"

            # Add separator between multiple domains
            if [ "$(echo "$target_domains" | wc -l | tr -d ' ')" -gt 1 ]; then
                prompt_output="${prompt_output}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"
            fi
        fi
    done <<< "$target_domains"

    # ---- Exit non-zero if prompt generation failed (e.g. no history entries) ----
    if [ "$prompt_failed" = true ] && [ -z "$prompt_output" ]; then
        exit 1
    fi

    # ---- Output prompt ----
    if [ "$flag_dry_run" = false ] && [ -n "$prompt_output" ]; then
        if [ "$flag_copy" = true ]; then
            # Try pbcopy (macOS) or xclip (Linux)
            if command -v pbcopy >/dev/null 2>&1; then
                echo "$prompt_output" | pbcopy
                echo ""
                echo -e "  ${C_GREEN}✓${C_RESET} $(msg_sync_copied_pbcopy)"
                echo -e "$(msg_sync_paste_hint)"
                echo ""
            elif command -v xclip >/dev/null 2>&1; then
                echo "$prompt_output" | xclip -selection clipboard
                echo ""
                echo -e "  ${C_GREEN}✓${C_RESET} $(msg_sync_copied_xclip)"
                echo -e "$(msg_sync_paste_hint)"
                echo ""
            else
                echo -e "${C_YELLOW}warning:${C_RESET} $(msg_warn_copy_unavailable)" >&2
                echo ""
                echo "$prompt_output"
            fi
        else
            echo "$prompt_output"
        fi
    fi
}
