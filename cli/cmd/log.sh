#!/usr/bin/env bash
# cairn log — Record a history entry
#
# Two modes:
#   Interactive: guided prompts for all 8 fields
#   Flag mode:   cairn log --type TYPE --domain DOMAIN --summary TEXT [...]
#
# Produces a bare key-value file at .cairn/history/YYYY-MM_<slug>.md
# matching the format defined in spec/FORMAT.md.
#
# Compatible with bash 3.2+ (macOS system bash).

# -----------------------------------------------------------------------------
# Slugify: convert a string to kebab-case for use in filenames.
# Max 40 characters. Only lowercase alphanum and hyphens.
# -----------------------------------------------------------------------------
_log_slugify() {
    echo "$1" \
        | tr '[:upper:]' '[:lower:]' \
        | tr -cs 'a-z0-9' '-' \
        | sed 's/^-//;s/-$//' \
        | cut -c1-40 \
        | sed 's/-$//'
}

# -----------------------------------------------------------------------------
# Read a multi-line value interactively (end with empty line).
# Prints the result with continuation lines indented by 2 spaces.
# -----------------------------------------------------------------------------
_log_read_multiline() {
    local prompt_text="$1"
    local result=""
    local first=true
    echo -e "  ${C_BOLD}${prompt_text}${C_RESET} ${C_DIM}$(msg_log_multiline_end)${C_RESET}"
    while IFS= read -r line; do
        [ -z "$line" ] && break
        if [ "$first" = true ]; then
            result="$line"
            first=false
        else
            result="${result}"$'\n'"  ${line}"
        fi
    done
    printf "%s" "$result"
}

# -----------------------------------------------------------------------------
# Main command
# -----------------------------------------------------------------------------
cmd_log() {
    local root
    root="$(require_cairn_root)"

    local cairn_dir="$root/.cairn"
    local output_md="$cairn_dir/output.md"
    local history_dir="$cairn_dir/history"

    # ---- Parse locked domain list ----
    local locked_domains=""
    if [ -f "$output_md" ]; then
        locked_domains="$(grep -oE '→ read domains/[a-z][a-z0-9-]+\.md first' "$output_md" \
            | sed 's/→ read domains\///;s/\.md first//' || true)"
    fi

    # ---- Parse flags ----
    local flag_type="" flag_domain="" flag_date="" flag_summary=""
    local flag_rejected="" flag_reason="" flag_revisit=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --type)       flag_type="$2";     shift 2 ;;
            --domain)     flag_domain="$2";   shift 2 ;;
            --date)       flag_date="$2";     shift 2 ;;
            --summary)    flag_summary="$2";  shift 2 ;;
            --rejected)   flag_rejected="$2"; shift 2 ;;
            --reason)     flag_reason="$2";   shift 2 ;;
            --revisit-when) flag_revisit="$2"; shift 2 ;;
            *)
                echo -e "${C_RED}error:${C_RESET} $(msg_err_unknown_flag "$1")" >&2
                echo -e "$(msg_err_run_help)" >&2
                exit 1
                ;;
        esac
    done

    # Determine mode: flag mode if any flags provided, else interactive
    local flag_mode=false
    if [ -n "$flag_type" ] || [ -n "$flag_domain" ] || [ -n "$flag_summary" ] \
        || [ -n "$flag_rejected" ] || [ -n "$flag_reason" ]; then
        flag_mode=true
    fi

    local current_month
    current_month="$(date +%Y-%m)"

    # ---- Collect fields ----

    # type
    local entry_type=""
    if [ -n "$flag_type" ]; then
        entry_type="$flag_type"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_log_type_header)${C_RESET}"
        echo ""
        echo -e "    ${C_DIM}1)${C_RESET} $(msg_log_type_decision)"
        echo -e "    ${C_DIM}2)${C_RESET} $(msg_log_type_rejection)"
        echo -e "    ${C_DIM}3)${C_RESET} $(msg_log_type_transition)"
        echo -e "    ${C_DIM}4)${C_RESET} $(msg_log_type_debt)"
        echo -e "    ${C_DIM}5)${C_RESET} $(msg_log_type_experiment)"
        echo ""
        msg_log_type_prompt
        read -r type_input
        case "$type_input" in
            1|decision)   entry_type="decision" ;;
            2|rejection)  entry_type="rejection" ;;
            3|transition) entry_type="transition" ;;
            4|debt)       entry_type="debt" ;;
            5|experiment) entry_type="experiment" ;;
            *) entry_type="$type_input" ;;
        esac
    fi

    # Validate type
    case "$entry_type" in
        decision|rejection|transition|debt|experiment) ;;
        *)
            echo -e "${C_RED}error:${C_RESET} $(msg_err_invalid_type "$entry_type")" >&2
            echo -e "$(msg_err_valid_types)" >&2
            exit 1
            ;;
    esac

    # domain
    local entry_domain=""
    if [ -n "$flag_domain" ]; then
        entry_domain="$flag_domain"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_log_domain_header)${C_RESET}"
        if [ -n "$locked_domains" ]; then
            echo ""
            local idx=1
            while IFS= read -r d; do
                [ -z "$d" ] && continue
                echo -e "    ${C_DIM}${idx})${C_RESET} $d"
                idx=$(( idx + 1 ))
            done <<< "$locked_domains"
            echo ""
        fi
        msg_log_domain_prompt
        read -r domain_input
        # If numeric input, map to domain name
        if echo "$domain_input" | grep -qE '^[0-9]+$'; then
            local didx=1
            while IFS= read -r d; do
                [ -z "$d" ] && continue
                if [ "$didx" -eq "$domain_input" ]; then
                    entry_domain="$d"
                    break
                fi
                didx=$(( didx + 1 ))
            done <<< "$locked_domains"
            if [ -z "$entry_domain" ]; then
                echo -e "${C_RED}error:${C_RESET} $(msg_err_no_domain_idx "$domain_input")" >&2
                exit 1
            fi
        else
            entry_domain="$domain_input"
        fi
    fi

    # Validate domain against locked list (warn if not in list, but allow)
    if [ -n "$locked_domains" ] && ! echo "$locked_domains" | grep -qx "$entry_domain"; then
        echo -e "${C_YELLOW}warning:${C_RESET} $(msg_warn_domain_not_locked "$entry_domain")" >&2
        echo -e "$(msg_warn_locked_domains "$(echo "$locked_domains" | tr '\n' ' ')")" >&2
        if [ "$flag_mode" = false ]; then
            echo -ne "${C_BOLD}$(msg_warn_continue_prompt)${C_RESET}"
            read -r confirm
            [ "$confirm" != "yes" ] && exit 0
        else
            exit 1
        fi
    fi

    if [ -z "$entry_domain" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_domain_required)" >&2
        exit 1
    fi

    # decision_date
    local entry_date="$current_month"
    if [ -n "$flag_date" ]; then
        entry_date="$flag_date"
    elif [ "$flag_mode" = false ]; then
        echo ""
        msg_log_date_prompt "$current_month"
        read -r date_input
        [ -n "$date_input" ] && entry_date="$date_input"
    fi

    # Validate YYYY-MM format
    if ! echo "$entry_date" | grep -qE '^[0-9]{4}-[0-9]{2}$'; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_invalid_date "$entry_date")" >&2
        exit 1
    fi

    # summary
    local entry_summary=""
    if [ -n "$flag_summary" ]; then
        entry_summary="$flag_summary"
    elif [ "$flag_mode" = false ]; then
        echo ""
        msg_log_summary_prompt
        read -r entry_summary
    fi

    if [ -z "$entry_summary" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_summary_required)" >&2
        exit 1
    fi

    # rejected (MOST CRITICAL FIELD)
    local entry_rejected=""
    if [ -n "$flag_rejected" ]; then
        entry_rejected="$flag_rejected"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_log_rejected_header)${C_RESET}"
        echo -e "  ${C_DIM}$(msg_log_rejected_hint)${C_RESET}"
        entry_rejected="$(_log_read_multiline "$(msg_log_rejected_label)")"
    fi

    if [ -z "$entry_rejected" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_rejected_required)" >&2
        exit 1
    fi

    # reason
    local entry_reason=""
    if [ -n "$flag_reason" ]; then
        entry_reason="$flag_reason"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_log_reason_header)${C_RESET}"
        echo -e "  ${C_DIM}$(msg_log_reason_hint)${C_RESET}"
        entry_reason="$(_log_read_multiline "$(msg_log_reason_label)")"
    fi

    if [ -z "$entry_reason" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_err_reason_required)" >&2
        exit 1
    fi

    # revisit_when (optional)
    local entry_revisit=""
    if [ -n "$flag_revisit" ]; then
        entry_revisit="$flag_revisit"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_DIM}$(msg_log_revisit_hint)${C_RESET}"
        msg_log_revisit_prompt
        read -r entry_revisit
    fi

    # ---- Generate filename ----
    local slug
    slug="$(_log_slugify "$entry_summary")"
    local filename="${entry_date}_${slug}.md"
    local output_file="$history_dir/$filename"

    # Avoid overwriting existing file
    if [ -f "$output_file" ]; then
        echo -e "${C_YELLOW}warning:${C_RESET} $(msg_warn_file_exists "$output_file")" >&2
        echo -e "$(msg_warn_unique_summary)" >&2
        exit 1
    fi

    # ---- Write history entry ----
    mkdir -p "$history_dir"

    {
        echo "type: ${entry_type}"
        echo "domain: ${entry_domain}"
        echo "decision_date: ${entry_date}"
        echo "recorded_date: ${current_month}"
        echo "summary: ${entry_summary}"
        # Multi-line values: first line is inline, continuation lines get 2-space indent
        local first_line rest
        first_line="$(echo "$entry_rejected" | head -1)"
        rest="$(echo "$entry_rejected" | tail -n +2)"
        printf "rejected: %s\n" "$first_line"
        if [ -n "$rest" ]; then
            while IFS= read -r rline; do
                printf "  %s\n" "$rline"
            done <<< "$rest"
        fi

        first_line="$(echo "$entry_reason" | head -1)"
        rest="$(echo "$entry_reason" | tail -n +2)"
        printf "reason: %s\n" "$first_line"
        if [ -n "$rest" ]; then
            while IFS= read -r rline; do
                printf "  %s\n" "$rline"
            done <<< "$rest"
        fi

        if [ -n "$entry_revisit" ]; then
            echo "revisit_when: ${entry_revisit}"
        else
            echo "revisit_when: "
        fi
    } > "$output_file"

    # ---- Success message ----
    echo ""
    echo -e "  ${C_GREEN}✓${C_RESET} $(msg_log_success "$output_file")"
    echo ""
    echo -e "  ${C_DIM}$(msg_log_next_steps_header)${C_RESET}"
    echo -e "$(msg_log_next_status)"
    if [ -f "$cairn_dir/domains/${entry_domain}.md" ]; then
        echo -e "$(msg_log_next_sync "$entry_domain")"
    fi
    echo ""
}
