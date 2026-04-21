#!/usr/bin/env bash
# cairn doctor — Health check for .cairn/ structure
#
# Performs rule-based checks (no LLM required):
#   - output.md token budget (target 500 / hard limit 800)
#   - no-go entries without supporting history
#   - hooks drift between output.md and domain frontmatter hooks[]
#   - stale domains (recorded_date newer than domain updated)
#   - staged entries with [TODO] fields
#   - staged entries older than 14 days
#
# Exit code: 0 = no issues; 1 = warnings or errors found.
#
# Compatible with bash 3.2+ (macOS system bash).

# -----------------------------------------------------------------------------
# Get file modification time as Unix timestamp.
# Handles macOS (stat -f %m) and Linux (stat -c %Y).
# -----------------------------------------------------------------------------
_doctor_mtime() {
    local file="$1"
    if stat -f %m "$file" >/dev/null 2>&1; then
        stat -f %m "$file"
    else
        stat -c %Y "$file"
    fi
}

# -----------------------------------------------------------------------------
# Extract keywords for a specific domain from output.md hooks section.
# Finds the line containing "domains/<name>.md" and extracts the slash-separated
# keywords from before the → arrow. Outputs one keyword per line (original case).
# Usage: _doctor_output_domain_hooks <output_md> <domain_name>
# -----------------------------------------------------------------------------
_doctor_output_domain_hooks() {
    local output_md="$1"
    local domain="$2"
    # Find the hooks line for this domain (both old and new format)
    local hooks_line=""
    hooks_line="$(awk '/^## hooks/{found=1; next} /^## [a-z]/{found=0} found{print}' "$output_md" \
        | grep -E "domains/${domain}\.md" | head -1)"
    [ -z "$hooks_line" ] && return 0
    # Extract keywords: everything before the → arrow, split by / and trim
    local before_arrow=""
    before_arrow="$(echo "$hooks_line" | sed 's/→.*//' | sed 's/^[[:space:]]*-[[:space:]]*//')"
    echo "$before_arrow" | tr '/' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
        | grep -E '^[^ ]' \
        | sort -u
}

# -----------------------------------------------------------------------------
# Parse hooks[] from a single domain frontmatter (YAML flow-style array).
# Outputs one keyword per line (original case).
# Delegates to shared extract_domain_hooks() defined in cli/cairn.
# -----------------------------------------------------------------------------
_doctor_domain_hooks() {
    local domain_file="$1"
    extract_domain_hooks "$domain_file"
}

# -----------------------------------------------------------------------------
# Compare output.md ## stack entries against dep files in the project root.
# Called from _doctor_check_output; prints results inline.
# -----------------------------------------------------------------------------
_doctor_check_stack_drift() {
    local output_md="$1"
    local project_root="$2"

    local stack_lines
    stack_lines="$(awk '/^## stack/{found=1; next} /^## [a-z]/{found=0} found && /^[a-zA-Z]/{print}' \
        "$output_md" | grep -E '^[a-zA-Z].*:' || true)"
    [ -z "$stack_lines" ] && return 0

    local all_deps=""
    local found_dep_file=false
    for dep_file in package.json go.mod requirements.txt pyproject.toml Cargo.toml; do
        [ -f "$project_root/$dep_file" ] || continue
        found_dep_file=true
        case "$dep_file" in
            package.json)
                all_deps="${all_deps}
$(grep -oE '"[a-zA-Z@][a-zA-Z0-9@/_.-]+"' "$project_root/$dep_file" 2>/dev/null \
    | tr -d '"' | sort -u || true)"
                ;;
            go.mod)
                all_deps="${all_deps}
$(awk '/^require \(/{b=1;next}/^\)/{b=0} b&&/^\t/{print $1}
       /^require [^ (]/{print $2}' "$project_root/$dep_file" 2>/dev/null || true)"
                ;;
            requirements.txt)
                all_deps="${all_deps}
$(grep -v '^#\|^-\|^$' "$project_root/$dep_file" 2>/dev/null \
    | sed 's/[>=<!].*//' | sed 's/[[:space:]].*$//' | grep -E '^[a-zA-Z]' || true)"
                ;;
            Cargo.toml)
                all_deps="${all_deps}
$(awk '/^\[dependencies\]/{s=1;next}/^\[dev-dependencies\]/{s=1;next}
   /^\[/{s=0} s&&/^[a-z]/{gsub(/[[:space:]]*=.*/,"");print}' \
   "$project_root/$dep_file" 2>/dev/null || true)"
                ;;
        esac
    done

    if [ "$found_dep_file" = false ]; then
        echo -e "  ${C_DIM}$(msg_doctor_stack_no_deps)${C_RESET}"
        return 0
    fi

    local found_drift=false
    while IFS= read -r entry; do
        [ -z "$entry" ] && continue
        local layer tech tech_lower
        layer="${entry%%:*}"
        tech="${entry#*: }"
        layer="$(echo "$layer" | tr -d '[:space:]')"
        tech="$(echo "$tech" | tr -d '[:space:]')"
        [ -z "$tech" ] && continue
        tech_lower="$(echo "$tech" | tr '[:upper:]' '[:lower:]')"
        if ! echo "$all_deps" | grep -qi "$tech_lower" 2>/dev/null; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_stack_drift "$layer" "$tech")"
            _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            found_drift=true
        fi
    done <<< "$stack_lines"

    if [ "$found_drift" = false ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_stack_ok)"
    fi
}

# -----------------------------------------------------------------------------
# Check output.md section
# -----------------------------------------------------------------------------
_doctor_check_output() {
    local cairn_dir="$1"
    local output_md="$cairn_dir/output.md"

    echo ""
    echo -e "${C_BOLD}$(msg_doctor_section_output)${C_RESET}"

    if [ ! -f "$output_md" ]; then
        echo -e "  ${C_RED}✗${C_RESET}  $(msg_doctor_output_missing)"
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        return 0
    fi

    # Token budget
    local tokens
    tokens="$(count_tokens_approx "$output_md")"
    if [ "$tokens" -gt 800 ]; then
        echo -e "  ${C_RED}✗${C_RESET}  $(msg_doctor_tokens_err "$tokens")"
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
    elif [ "$tokens" -gt 499 ]; then
        echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_tokens_warn "$tokens")"
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
    else
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_tokens_ok "$tokens")"
    fi

    # no-go entries without supporting history
    local history_dir="$cairn_dir/history"
    local nogo_section=""
    nogo_section="$(awk '/^## no-go/{found=1; next} /^## [a-z]/{found=0} found{print}' "$output_md")"

    if [ -n "$nogo_section" ]; then
        while IFS= read -r line; do
            # Match bullet lines: "- keyword (reason)" or "- keyword — reason"
            local raw_keyword=""
            raw_keyword="$(echo "$line" | grep -oE '^- [^(—]+' | sed 's/^- //' | sed 's/[[:space:]]*$//' || true)"
            [ -z "$raw_keyword" ] && continue

            # Extract first meaningful word(s) for matching — use the first token
            local keyword
            keyword="$(echo "$raw_keyword" | awk '{print $1}')"
            [ -z "$keyword" ] && continue

            # Search history rejected: fields for this keyword (case-insensitive)
            local found_in_history=false
            if [ -d "$history_dir" ]; then
                if grep -qiF "$keyword" "$history_dir"/*.md 2>/dev/null; then
                    found_in_history=true
                fi
            fi

            if [ "$found_in_history" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_nogo_unsupported "$raw_keyword")"
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            fi
        done <<< "$nogo_section"
    fi

    # Stack drift: compare ## stack entries against project dep files
    echo ""
    echo -e "  ${C_DIM}$(msg_doctor_stack_section)${C_RESET}"
    _doctor_check_stack_drift "$output_md" "$(dirname "$cairn_dir")"
}

# -----------------------------------------------------------------------------
# Check domains section
# -----------------------------------------------------------------------------
_doctor_check_domains() {
    local cairn_dir="$1"
    local output_md="$cairn_dir/output.md"

    echo ""
    echo -e "${C_BOLD}$(msg_doctor_section_domains)${C_RESET}"

    if [ ! -f "$output_md" ]; then
        return 0
    fi

    local locked_domains=""
    locked_domains="$(parse_domain_list < "$output_md" || true)"

    if [ -z "$locked_domains" ]; then
        echo -e "  ${C_DIM}$(msg_status_no_domains_hint)${C_RESET}"
        return 0
    fi

    while IFS= read -r d; do
        [ -z "$d" ] && continue
        local domain_file="$cairn_dir/domains/${d}.md"

        if [ ! -f "$domain_file" ]; then
            printf "  ${C_DIM}·${C_RESET}  $(msg_doctor_domain_not_created "$d")\n"
            continue
        fi

        # Read domain frontmatter updated field
        local domain_updated=""
        domain_updated="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^updated:" | head -1 | sed 's/^updated: //' | tr -d '[:space:]' || true)"
        local domain_status=""
        domain_status="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^status:" | head -1 | sed 's/^status: //' | tr -d '[:space:]' || true)"

        if [ -z "$domain_updated" ]; then
            printf "  ${C_DIM}?${C_RESET}  $(msg_doctor_domain_no_updated "$d")\n"
            continue
        fi

        local result
        result="$(compute_domain_stale "$cairn_dir" "$d")"
        local stale_status new_entries
        stale_status="$(echo "$result" | cut -d'|' -f1)"
        new_entries="$(echo "$result" | cut -d'|' -f4)"

        if [ "$stale_status" = "stale" ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_domain_stale "$d" "$new_entries" "$domain_updated")"
            _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        else
            local display_status="${domain_status:-active}"
            printf "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_domain_ok "$d" "$display_status" "$domain_updated")\n"
        fi
    done <<< "$locked_domains"
}

# -----------------------------------------------------------------------------
# Check hooks drift between output.md and domain frontmatter.
# Per-domain: compares keywords in output.md hooks line vs domain's hooks[].
# Only checks locked domains that have an existing domain file.
# -----------------------------------------------------------------------------
_doctor_check_hooks() {
    local cairn_dir="$1"
    local output_md="$cairn_dir/output.md"

    echo ""
    echo -e "${C_BOLD}$(msg_doctor_section_hooks)${C_RESET}"

    if [ ! -f "$output_md" ]; then
        return 0
    fi

    local locked_domains=""
    locked_domains="$(parse_domain_list < "$output_md" || true)"

    if [ -z "$locked_domains" ]; then
        echo -e "  ${C_DIM}$(msg_status_no_domains_hint)${C_RESET}"
        return 0
    fi

    local found_issue=false

    while IFS= read -r d; do
        [ -z "$d" ] && continue
        local domain_file="$cairn_dir/domains/${d}.md"
        [ -f "$domain_file" ] || continue

        # Get keywords from output.md hooks line for this domain
        local out_kw_file dm_kw_file
        out_kw_file="$(mktemp)"
        dm_kw_file="$(mktemp)"

        _doctor_output_domain_hooks "$output_md" "$d" \
            | tr '[:upper:]' '[:lower:]' > "$out_kw_file"
        _doctor_domain_hooks "$domain_file" \
            | tr '[:upper:]' '[:lower:]' > "$dm_kw_file"

        # Keywords in output.md for this domain but not in domain's hooks[]
        while IFS= read -r kw; do
            [ -z "$kw" ] && continue
            if ! grep -qx "$kw" "$dm_kw_file" 2>/dev/null; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_hooks_output_only "$kw")"
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
                found_issue=true
            fi
        done < "$out_kw_file"

        # Keywords in domain's hooks[] but not in output.md for this domain
        while IFS= read -r kw; do
            [ -z "$kw" ] && continue
            if ! grep -qx "$kw" "$out_kw_file" 2>/dev/null; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_hooks_domain_only "$kw" "$d")"
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
                found_issue=true
            fi
        done < "$dm_kw_file"

        rm -f "$out_kw_file" "$dm_kw_file"
    done <<< "$locked_domains"

    if [ "$found_issue" = true ]; then
        echo -e "  ${C_DIM}  → $(msg_doctor_hooks_run_sync)${C_RESET}"
    fi

    if [ "$found_issue" = false ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_status_up_to_date)"
    fi
}

# -----------------------------------------------------------------------------
# Check staged/ directory
# -----------------------------------------------------------------------------
_doctor_check_staged() {
    local cairn_dir="$1"
    local staged_dir="$cairn_dir/staged"

    echo ""
    echo -e "${C_BOLD}$(msg_doctor_section_staged)${C_RESET}"

    local staged_files=()
    while IFS= read -r f; do
        [ -z "$f" ] && continue
        staged_files+=("$f")
    done < <(find_staged_files "$cairn_dir")

    local total=${#staged_files[@]}

    if [ "$total" -eq 0 ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_staged_empty)"
        return 0
    fi

    # Count entries with [TODO] fields
    local todo_count=0
    local stale_count=0
    local now
    now="$(date +%s)"
    local fourteen_days=$(( 14 * 86400 ))

    for f in "${staged_files[@]}"; do
        if grep -qF '[TODO]' "$f" 2>/dev/null; then
            todo_count=$(( todo_count + 1 ))
        fi
        local mtime
        mtime="$(_doctor_mtime "$f")"
        local age=$(( now - mtime ))
        if [ "$age" -gt "$fourteen_days" ]; then
            stale_count=$(( stale_count + 1 ))
        fi
    done

    if [ "$todo_count" -gt 0 ]; then
        echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_staged_todo "$todo_count")"
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
    fi

    if [ "$stale_count" -gt 0 ]; then
        echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_staged_stale "$stale_count")"
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
    fi

    if [ "$todo_count" -eq 0 ] && [ "$stale_count" -eq 0 ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  ${total} staged $(msg_plural_entry "$total") pending review"
    fi
}

# -----------------------------------------------------------------------------
# Check audits/ directory: stale open/partial audits and transitions without audits.
# -----------------------------------------------------------------------------
_doctor_check_audits() {
    local cairn_dir="$1"
    local audits_dir="$cairn_dir/audits"
    local history_dir="$cairn_dir/history"

    echo ""
    echo -e "${C_BOLD}$(msg_doctor_section_audits)${C_RESET}"

    local now
    now="$(date +%s)"
    local sixty_days=$(( 60 * 86400 ))
    local found_issue=false

    # Stale audits: status open or partial, older than 60 days
    if [ -d "$audits_dir" ]; then
        while IFS= read -r audit_file; do
            [ -z "$audit_file" ] && continue
            local astatus
            astatus="$(grep -m1 '^status:' "$audit_file" 2>/dev/null \
                | sed 's/^status:[[:space:]]*//' | tr -d '[:space:]' || echo 'unknown')"
            case "$astatus" in
                open|partial)
                    local mtime age age_days aname
                    mtime="$(_doctor_mtime "$audit_file")"
                    age=$(( now - mtime ))
                    age_days=$(( age / 86400 ))
                    if [ "$age" -gt "$sixty_days" ]; then
                        aname="$(basename "$audit_file" .md)"
                        echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_audit_stale "$aname" "$age_days")"
                        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
                        found_issue=true
                    fi
                    ;;
            esac
        done < <(find "$audits_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
    fi

    # Missing audit: transition history entries with no corresponding audit domain
    if [ -d "$history_dir" ]; then
        while IFS= read -r hist_file; do
            [ -z "$hist_file" ] && continue
            local htype
            htype="$(grep -m1 '^type:' "$hist_file" 2>/dev/null \
                | sed 's/^type:[[:space:]]*//' | tr -d '[:space:]' || true)"
            [ "$htype" = "transition" ] || continue

            local hdomain hsummary
            hdomain="$(grep -m1 '^domain:' "$hist_file" 2>/dev/null \
                | sed 's/^domain:[[:space:]]*//' | tr -d '[:space:]' || true)"
            hsummary="$(grep -m1 '^summary:' "$hist_file" 2>/dev/null \
                | sed 's/^summary:[[:space:]]*//' || true)"
            [ -z "$hdomain" ] && continue

            local has_audit=false
            if [ -d "$audits_dir" ]; then
                while IFS= read -r af; do
                    [ -z "$af" ] && continue
                    if grep -q "^domain:[[:space:]]*${hdomain}" "$af" 2>/dev/null; then
                        has_audit=true
                        break
                    fi
                done < <(find "$audits_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null)
            fi

            if [ "$has_audit" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_audit_missing "$hdomain" "$hsummary")"
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
                found_issue=true
            fi
        done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
    fi

    if [ "$found_issue" = false ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_audit_ok)"
    fi
}

# -----------------------------------------------------------------------------
# Main command
# -----------------------------------------------------------------------------
cmd_doctor() {
    local root
    root="$(require_cairn_root)"

    local cairn_dir="$root/.cairn"

    # Counter for warnings/errors
    _DOCTOR_FAIL=0

    _doctor_check_output "$cairn_dir"
    _doctor_check_domains "$cairn_dir"
    _doctor_check_hooks "$cairn_dir"
    _doctor_check_staged "$cairn_dir"
    _doctor_check_audits "$cairn_dir"

    echo ""
    if [ "$_DOCTOR_FAIL" -eq 0 ]; then
        echo -e "  ${C_GREEN}$(msg_doctor_summary_ok)${C_RESET}"
    else
        echo -e "  ${C_YELLOW}$(msg_doctor_summary_issues "$_DOCTOR_FAIL")${C_RESET}"
    fi
    echo ""

    [ "$_DOCTOR_FAIL" -eq 0 ] || exit 1
}
