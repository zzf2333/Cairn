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
    echo -e "  ${C_BOLD}${prompt_text}${C_RESET} ${C_DIM}(end with empty line)${C_RESET}"
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
                echo -e "${C_RED}error:${C_RESET} unknown flag '$1'" >&2
                echo -e "  Run ${C_BOLD}cairn help${C_RESET} for usage." >&2
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
        echo -e "  ${C_BOLD}── type ──${C_RESET}"
        echo ""
        echo -e "    ${C_DIM}1)${C_RESET} decision    — a technology choice was made"
        echo -e "    ${C_DIM}2)${C_RESET} rejection   — a direction was excluded"
        echo -e "    ${C_DIM}3)${C_RESET} transition  — approach changed from A to B"
        echo -e "    ${C_DIM}4)${C_RESET} debt        — technical debt accepted or resolved"
        echo -e "    ${C_DIM}5)${C_RESET} experiment  — exploratory attempt concluded"
        echo ""
        echo -ne "  ${C_BOLD}Entry type (1-5 or name):${C_RESET} "
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
            echo -e "${C_RED}error:${C_RESET} invalid type '${entry_type}'" >&2
            echo -e "  Valid types: decision, rejection, transition, debt, experiment" >&2
            exit 1
            ;;
    esac

    # domain
    local entry_domain=""
    if [ -n "$flag_domain" ]; then
        entry_domain="$flag_domain"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}── domain ──${C_RESET}"
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
        echo -ne "  ${C_BOLD}Domain (name or number):${C_RESET} "
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
                echo -e "${C_RED}error:${C_RESET} no domain at index ${domain_input}" >&2
                exit 1
            fi
        else
            entry_domain="$domain_input"
        fi
    fi

    # Validate domain against locked list (warn if not in list, but allow)
    if [ -n "$locked_domains" ] && ! echo "$locked_domains" | grep -qx "$entry_domain"; then
        echo -e "${C_YELLOW}warning:${C_RESET} '${entry_domain}' is not in the locked domain list." >&2
        echo -e "  Locked domains: $(echo "$locked_domains" | tr '\n' ' ')" >&2
        if [ "$flag_mode" = false ]; then
            echo -ne "  ${C_BOLD}Continue anyway? (yes/no):${C_RESET} "
            read -r confirm
            [ "$confirm" != "yes" ] && exit 0
        else
            exit 1
        fi
    fi

    if [ -z "$entry_domain" ]; then
        echo -e "${C_RED}error:${C_RESET} domain is required" >&2
        exit 1
    fi

    # decision_date
    local entry_date="$current_month"
    if [ -n "$flag_date" ]; then
        entry_date="$flag_date"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -ne "  ${C_BOLD}Decision date${C_RESET} ${C_DIM}[${current_month}]${C_RESET} (YYYY-MM): "
        read -r date_input
        [ -n "$date_input" ] && entry_date="$date_input"
    fi

    # Validate YYYY-MM format
    if ! echo "$entry_date" | grep -qE '^[0-9]{4}-[0-9]{2}$'; then
        echo -e "${C_RED}error:${C_RESET} invalid date format '${entry_date}' — expected YYYY-MM" >&2
        exit 1
    fi

    # summary
    local entry_summary=""
    if [ -n "$flag_summary" ]; then
        entry_summary="$flag_summary"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -ne "  ${C_BOLD}Summary${C_RESET} (one sentence — what happened): "
        read -r entry_summary
    fi

    if [ -z "$entry_summary" ]; then
        echo -e "${C_RED}error:${C_RESET} summary is required" >&2
        exit 1
    fi

    # rejected (MOST CRITICAL FIELD)
    local entry_rejected=""
    if [ -n "$flag_rejected" ]; then
        entry_rejected="$flag_rejected"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}── rejected ──${C_RESET} ${C_YELLOW}(most critical field)${C_RESET}"
        echo -e "  ${C_DIM}What alternatives were considered and not chosen?${C_RESET}"
        entry_rejected="$(_log_read_multiline "rejected:")"
    fi

    if [ -z "$entry_rejected" ]; then
        echo -e "${C_RED}error:${C_RESET} rejected field is required (most critical field)" >&2
        exit 1
    fi

    # reason
    local entry_reason=""
    if [ -n "$flag_reason" ]; then
        entry_reason="$flag_reason"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_BOLD}── reason ──${C_RESET}"
        echo -e "  ${C_DIM}Why was this path taken?${C_RESET}"
        entry_reason="$(_log_read_multiline "reason:")"
    fi

    if [ -z "$entry_reason" ]; then
        echo -e "${C_RED}error:${C_RESET} reason is required" >&2
        exit 1
    fi

    # revisit_when (optional)
    local entry_revisit=""
    if [ -n "$flag_revisit" ]; then
        entry_revisit="$flag_revisit"
    elif [ "$flag_mode" = false ]; then
        echo ""
        echo -e "  ${C_DIM}revisit_when: condition for re-evaluation (optional, press Enter to skip)${C_RESET}"
        echo -ne "  ${C_BOLD}revisit_when:${C_RESET} "
        read -r entry_revisit
    fi

    # ---- Generate filename ----
    local slug
    slug="$(_log_slugify "$entry_summary")"
    local filename="${entry_date}_${slug}.md"
    local output_file="$history_dir/$filename"

    # Avoid overwriting existing file
    if [ -f "$output_file" ]; then
        echo -e "${C_YELLOW}warning:${C_RESET} file already exists: $output_file" >&2
        echo -e "  Use a different --summary to generate a unique filename." >&2
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
    echo -e "  ${C_GREEN}✓${C_RESET} Created ${C_BOLD}${output_file}${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}Next steps:${C_RESET}"
    echo -e "  · Run ${C_BOLD}cairn status${C_RESET} to check for stale domain files"
    if [ -f "$cairn_dir/domains/${entry_domain}.md" ]; then
        echo -e "  · Run ${C_BOLD}cairn sync ${entry_domain}${C_RESET} to generate an updated domain file"
    fi
    echo ""
}
