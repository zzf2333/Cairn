#!/usr/bin/env bash
# cairn doctor — Health check for .cairn/ structure
#
# Performs rule-based checks (no LLM required):
#   - output.md token budget (target 500 / hard limit 800)
#   - no-go entries without supporting history
#   - hooks drift between output.md and domain frontmatter hooks[]
#   - stale domains (recorded_date newer than domain updated)
#   - Cairn guide block presence and format in .claude/CLAUDE.md
#   - .cairn/SKILL.md presence and canonical consistency
#   - v0.0.11 residue directories (staged/, audits/, reflections/)
#
# Options:
#   --json   Emit JSON instead of human-readable output (for AI parsing)
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
    local hooks_line=""
    hooks_line="$(awk '/^## hooks/{found=1; next} /^## [a-z]/{found=0} found{print}' "$output_md" \
        | grep -E "domains/${domain}\.md" | head -1)"
    [ -z "$hooks_line" ] && return 0
    local before_arrow=""
    before_arrow="$(echo "$hooks_line" | sed 's/→.*//' | sed 's/^[[:space:]]*-[[:space:]]*//')"
    echo "$before_arrow" | tr '/' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
        | grep -E '^[^ ]' \
        | sort -u
}

_doctor_domain_hooks() {
    local domain_file="$1"
    extract_domain_hooks "$domain_file"
}

# -----------------------------------------------------------------------------
# Compare output.md ## stack entries against dep files in the project root.
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
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_DIM}$(msg_doctor_stack_no_deps)${C_RESET}"
        fi
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
            if [ "$_DOCTOR_JSON" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_stack_drift "$layer" "$tech")"
            fi
            _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            found_drift=true
        fi
    done <<< "$stack_lines"

    if [ "$found_drift" = false ] && [ "$_DOCTOR_JSON" = false ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_stack_ok)"
    fi
}

# -----------------------------------------------------------------------------
# Check output.md section
# -----------------------------------------------------------------------------
_doctor_check_output() {
    local cairn_dir="$1"
    local output_md="$cairn_dir/output.md"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_output)${C_RESET}"
    fi

    if [ ! -f "$output_md" ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_RED}✗${C_RESET}  $(msg_doctor_output_missing)"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        _DOCTOR_JSON_OUTPUT_STATUS="missing"
        return 0
    fi

    local tokens
    tokens="$(count_tokens_approx "$output_md")"
    _DOCTOR_JSON_OUTPUT_TOKENS="$tokens"

    if [ "$tokens" -gt 800 ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_RED}✗${C_RESET}  $(msg_doctor_tokens_err "$tokens")"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        _DOCTOR_JSON_OUTPUT_STATUS="over_limit"
    elif [ "$tokens" -gt 499 ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_tokens_warn "$tokens")"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        _DOCTOR_JSON_OUTPUT_STATUS="warn"
    else
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_tokens_ok "$tokens")"
        fi
        _DOCTOR_JSON_OUTPUT_STATUS="ok"
    fi

    # no-go entries without supporting history
    local history_dir="$cairn_dir/history"
    local nogo_section=""
    nogo_section="$(awk '/^## no-go/{found=1; next} /^## [a-z]/{found=0} found{print}' "$output_md")"

    if [ -n "$nogo_section" ]; then
        while IFS= read -r line; do
            local raw_keyword=""
            raw_keyword="$(echo "$line" | grep -oE '^- [^(—]+' | sed 's/^- //' | sed 's/[[:space:]]*$//' || true)"
            [ -z "$raw_keyword" ] && continue
            local keyword
            keyword="$(echo "$raw_keyword" | awk '{print $1}')"
            [ -z "$keyword" ] && continue

            local found_in_history=false
            if [ -d "$history_dir" ]; then
                if grep -qiF "$keyword" "$history_dir"/*.md 2>/dev/null; then
                    found_in_history=true
                fi
            fi

            if [ "$found_in_history" = false ]; then
                if [ "$_DOCTOR_JSON" = false ]; then
                    echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_nogo_unsupported "$raw_keyword")"
                fi
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            fi
        done <<< "$nogo_section"
    fi

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "  ${C_DIM}$(msg_doctor_stack_section)${C_RESET}"
        _doctor_check_stack_drift "$output_md" "$(dirname "$cairn_dir")"
    fi
}

# -----------------------------------------------------------------------------
# Check domains section
# -----------------------------------------------------------------------------
_doctor_check_domains() {
    local cairn_dir="$1"
    local output_md="$cairn_dir/output.md"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_domains)${C_RESET}"
    fi

    if [ ! -f "$output_md" ]; then
        return 0
    fi

    local locked_domains=""
    locked_domains="$(parse_domain_list < "$output_md" || true)"

    if [ -z "$locked_domains" ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_DIM}$(msg_status_no_domains_hint)${C_RESET}"
        fi
        return 0
    fi

    local stale_list=""

    while IFS= read -r d; do
        [ -z "$d" ] && continue
        local domain_file="$cairn_dir/domains/${d}.md"

        if [ ! -f "$domain_file" ]; then
            if [ "$_DOCTOR_JSON" = false ]; then
                printf "  ${C_DIM}·${C_RESET}  $(msg_doctor_domain_not_created "$d")\n"
            fi
            continue
        fi

        local domain_updated=""
        domain_updated="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^updated:" | head -1 | sed 's/^updated: //' | tr -d '[:space:]' || true)"
        local domain_status=""
        domain_status="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^status:" | head -1 | sed 's/^status: //' | tr -d '[:space:]' || true)"

        if [ -z "$domain_updated" ]; then
            if [ "$_DOCTOR_JSON" = false ]; then
                printf "  ${C_DIM}?${C_RESET}  $(msg_doctor_domain_no_updated "$d")\n"
            fi
            continue
        fi

        local result
        result="$(compute_domain_stale "$cairn_dir" "$d")"
        local stale_status new_entries
        stale_status="$(echo "$result" | cut -d'|' -f1)"
        new_entries="$(echo "$result" | cut -d'|' -f4)"

        if [ "$stale_status" = "stale" ]; then
            if [ "$_DOCTOR_JSON" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_domain_stale "$d" "$new_entries" "$domain_updated")"
            fi
            _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            stale_list="${stale_list}${d},"
        else
            if [ "$_DOCTOR_JSON" = false ]; then
                local display_status="${domain_status:-active}"
                printf "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_domain_ok "$d" "$display_status" "$domain_updated")\n"
            fi
        fi
    done <<< "$locked_domains"

    _DOCTOR_JSON_STALE_DOMAINS="${stale_list%,}"
}

# -----------------------------------------------------------------------------
# Check hooks drift between output.md and domain frontmatter.
# -----------------------------------------------------------------------------
_doctor_check_hooks() {
    local cairn_dir="$1"
    local output_md="$cairn_dir/output.md"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_hooks)${C_RESET}"
    fi

    if [ ! -f "$output_md" ]; then
        return 0
    fi

    local locked_domains=""
    locked_domains="$(parse_domain_list < "$output_md" || true)"

    if [ -z "$locked_domains" ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_DIM}$(msg_status_no_domains_hint)${C_RESET}"
        fi
        return 0
    fi

    local found_issue=false

    while IFS= read -r d; do
        [ -z "$d" ] && continue
        local domain_file="$cairn_dir/domains/${d}.md"
        [ -f "$domain_file" ] || continue

        local out_kw_file dm_kw_file
        out_kw_file="$(mktemp)"
        dm_kw_file="$(mktemp)"

        _doctor_output_domain_hooks "$output_md" "$d" \
            | tr '[:upper:]' '[:lower:]' > "$out_kw_file"
        _doctor_domain_hooks "$domain_file" \
            | tr '[:upper:]' '[:lower:]' > "$dm_kw_file"

        while IFS= read -r kw; do
            [ -z "$kw" ] && continue
            if ! grep -qx "$kw" "$dm_kw_file" 2>/dev/null; then
                if [ "$_DOCTOR_JSON" = false ]; then
                    echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_hooks_output_only "$kw")"
                fi
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
                found_issue=true
            fi
        done < "$out_kw_file"

        while IFS= read -r kw; do
            [ -z "$kw" ] && continue
            if ! grep -qx "$kw" "$out_kw_file" 2>/dev/null; then
                if [ "$_DOCTOR_JSON" = false ]; then
                    echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_hooks_domain_only "$kw" "$d")"
                fi
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
                found_issue=true
            fi
        done < "$dm_kw_file"

        rm -f "$out_kw_file" "$dm_kw_file"
    done <<< "$locked_domains"

    if [ "$_DOCTOR_JSON" = false ]; then
        if [ "$found_issue" = true ]; then
            echo -e "  ${C_DIM}  → $(msg_doctor_hooks_run_sync)${C_RESET}"
        else
            echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_status_up_to_date)"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Check for legacy v0.0.9 skill location vs v0.0.10+ location.
# Warns if old .claude/skills/cairn/ directory is still present.
# -----------------------------------------------------------------------------
_doctor_check_skill_drift() {
    local project_root="$1"
    local old_dir="${project_root}/.claude/skills/cairn"
    local new_file="${project_root}/.claude/CLAUDE.md"
    local has_old=false
    local has_new=false

    [ -d "$old_dir" ] && has_old=true
    grep -qF "<!-- cairn:start -->" "$new_file" 2>/dev/null && has_new=true

    if [ "$has_old" = false ]; then
        return 0
    fi

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_skill_drift)${C_RESET}"
    fi

    if [ "$has_new" = false ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_skill_drift_old_only)"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
    else
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_skill_drift_both)"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
    fi
}

# -----------------------------------------------------------------------------
# Check Cairn guide block presence and format in .claude/CLAUDE.md.
# In v0.0.12: block should be a 12-line guide pointing to .cairn/SKILL.md,
# not the old 100-line skill content.
# -----------------------------------------------------------------------------
_doctor_check_skill_guide() {
    local project_root="$1"
    local claude_md="${project_root}/.claude/CLAUDE.md"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_skill_guide)${C_RESET}"
    fi

    _DOCTOR_JSON_SKILL_GUIDE="ok"

    if ! grep -qF "<!-- cairn:start -->" "$claude_md" 2>/dev/null; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_skill_guide_missing)"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        _DOCTOR_JSON_SKILL_GUIDE="missing"
        return 0
    fi

    # Extract cairn block content and check if it's old-format (100-line skill)
    # Old format contains things like "## ON SESSION START" or "## CONSTRAINT PROCESSING"
    # New format (12-line guide) contains "Read .cairn/SKILL.md"
    local block_content
    block_content="$(awk '/<!-- cairn:start -->/{f=1;next} /<!-- cairn:end -->/{f=0} f{print}' \
        "$claude_md" 2>/dev/null || true)"
    local block_lines
    block_lines="$(echo "$block_content" | grep -c '.' || true)"

    if echo "$block_content" | grep -qF "## ON SESSION START" 2>/dev/null || \
       echo "$block_content" | grep -qF "## CONSTRAINT PROCESSING" 2>/dev/null || \
       [ "$block_lines" -gt 30 ] 2>/dev/null; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_skill_guide_old)"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        _DOCTOR_JSON_SKILL_GUIDE="old_format"
    else
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_skill_guide_ok)"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Check .cairn/SKILL.md presence and canonical consistency.
# Compares against skills/claude-code/SKILL.md in the Cairn CLI source directory
# (only if CAIRN_CLI_DIR is set, i.e. running through the cairn dispatcher).
# -----------------------------------------------------------------------------
_doctor_check_skill_md() {
    local cairn_dir="$1"
    local skill_md="${cairn_dir}/SKILL.md"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_skill_md)${C_RESET}"
    fi

    _DOCTOR_JSON_SKILL_MD="ok"

    if [ ! -f "$skill_md" ]; then
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_skill_md_missing)"
        fi
        _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
        _DOCTOR_JSON_SKILL_MD="missing"
        return 0
    fi

    # If we know where the CLI source is, compare against canonical
    if [ -n "${CAIRN_CLI_DIR:-}" ]; then
        local canonical="${CAIRN_CLI_DIR}/../skills/claude-code/SKILL.md"
        if [ -f "$canonical" ] && ! cmp -s "$skill_md" "$canonical" 2>/dev/null; then
            if [ "$_DOCTOR_JSON" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_skill_md_stale)"
            fi
            _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            _DOCTOR_JSON_SKILL_MD="stale"
            return 0
        fi
    fi

    if [ "$_DOCTOR_JSON" = false ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_skill_md_ok)"
    fi
}

# -----------------------------------------------------------------------------
# Warn about v0.0.11 residue directories that are no longer used.
# -----------------------------------------------------------------------------
_doctor_check_v0011_residue() {
    local cairn_dir="$1"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_v0011)${C_RESET}"
    fi

    local found_residue=false
    _DOCTOR_JSON_V0011_RESIDUE=""

    for resdir in staged audits reflections; do
        local dir="${cairn_dir}/${resdir}"
        if [ -d "$dir" ]; then
            local count
            count="$(find "$dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')"
            if [ "${count:-0}" -gt 0 ]; then
                found_residue=true
                _DOCTOR_JSON_V0011_RESIDUE="${_DOCTOR_JSON_V0011_RESIDUE}${resdir},"
                if [ "$_DOCTOR_JSON" = false ]; then
                    case "$resdir" in
                        staged)       echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_v0011_staged "$count")" ;;
                        audits)       echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_v0011_audits "$count")" ;;
                        reflections)  echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_v0011_reflections "$count")" ;;
                    esac
                fi
                _DOCTOR_FAIL=$(( _DOCTOR_FAIL + 1 ))
            fi
        fi
    done
    _DOCTOR_JSON_V0011_RESIDUE="${_DOCTOR_JSON_V0011_RESIDUE%,}"

    if [ "$found_residue" = false ] && [ "$_DOCTOR_JSON" = false ]; then
        echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_v0011_ok)"
    fi
}

# -----------------------------------------------------------------------------
# Check for write-back drift signals using recent git history.
# Skips gracefully when .git/ is absent or git commands fail.
# Signals are advisory — they do NOT increment _DOCTOR_FAIL.
# -----------------------------------------------------------------------------
_doctor_check_write_back() {
    local root="$1"
    local cairn_dir="$2"

    if [ "$_DOCTOR_JSON" = false ]; then
        echo ""
        echo -e "${C_BOLD}$(msg_doctor_section_write_back)${C_RESET}"
    fi

    _DOCTOR_JSON_WRITE_BACK_STATUS="ok"
    _DOCTOR_JSON_WRITE_BACK_REASON="ok"
    _DOCTOR_JSON_WRITE_BACK_SIGNALS=""

    # Skip if no .git/ directory or git unavailable
    if [ ! -d "${root}/.git" ] || ! git -C "$root" rev-parse HEAD >/dev/null 2>&1; then
        _DOCTOR_JSON_WRITE_BACK_STATUS="skipped"
        _DOCTOR_JSON_WRITE_BACK_REASON="no_git"
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_DIM}·  $(msg_doctor_write_back_skipped)${C_RESET}"
        fi
        return 0
    fi

    local since="14 days ago"

    # Signal 1: missing-write-back
    local code_lines=0
    code_lines="$(git -C "$root" log --since="$since" --numstat --format="" 2>/dev/null \
        | grep -v "\.cairn/" \
        | grep -v "\.md$" \
        | awk 'NF>=2 && $1~/^[0-9]+$/ && $2~/^[0-9]+$/ {s+=$1+$2} END {print s+0}' \
        || echo 0)"
    code_lines="${code_lines:-0}"

    if [ "${code_lines}" -ge 100 ]; then
        local ref_ts=""
        ref_ts="$(git -C "$root" log --since="$since" --format="%at" 2>/dev/null | tail -1 || echo "")"
        local has_new_history=false
        if [ -d "${cairn_dir}/history" ] && [ -n "$ref_ts" ]; then
            while IFS= read -r hist_file; do
                local file_ts
                file_ts="$(_doctor_mtime "$hist_file" 2>/dev/null || echo 0)"
                if [ "${file_ts:-0}" -ge "${ref_ts:-0}" ]; then
                    has_new_history=true
                    break
                fi
            done < <(find "${cairn_dir}/history" -maxdepth 1 -name "*.md" -type f 2>/dev/null)
        fi
        if [ "$has_new_history" = false ]; then
            _DOCTOR_JSON_WRITE_BACK_SIGNALS="${_DOCTOR_JSON_WRITE_BACK_SIGNALS}missing-write-back,"
            if [ "$_DOCTOR_JSON" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_write_back_signal_missing_write_back "${code_lines}")"
            fi
        fi
    fi

    # Signal 2: missing-output-follow-up
    local dep_files="package.json go.mod requirements.txt pyproject.toml Cargo.toml"
    local dep_changed=false
    for dep in $dep_files; do
        if git -C "$root" log --since="$since" --oneline -- "$dep" 2>/dev/null | grep -q .; then
            dep_changed=true
            break
        fi
    done
    if [ "$dep_changed" = true ]; then
        local dep_latest_ts=0
        for dep in $dep_files; do
            if [ -f "${root}/${dep}" ]; then
                local ts
                ts="$(_doctor_mtime "${root}/${dep}" 2>/dev/null || echo 0)"
                [ "${ts:-0}" -gt "$dep_latest_ts" ] && dep_latest_ts="${ts:-0}"
            fi
        done
        local output_ts=0
        if [ -f "${cairn_dir}/output.md" ]; then
            output_ts="$(_doctor_mtime "${cairn_dir}/output.md" 2>/dev/null || echo 0)"
        fi
        if [ "${output_ts:-0}" -lt "$dep_latest_ts" ]; then
            _DOCTOR_JSON_WRITE_BACK_SIGNALS="${_DOCTOR_JSON_WRITE_BACK_SIGNALS}missing-output-follow-up,"
            if [ "$_DOCTOR_JSON" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_write_back_signal_missing_output_follow_up)"
            fi
        fi
    fi

    # Signal 3: missing-audit-flag
    local migration_subjects=""
    migration_subjects="$(git -C "$root" log --since="$since" --format="%s" 2>/dev/null \
        | grep -iE 'migrat|renam|replac|deprecat|remov|delet' \
        | head -5 \
        || true)"
    if [ -n "$migration_subjects" ]; then
        local has_transition=false
        local ref_ts=""
        ref_ts="$(git -C "$root" log --since="$since" --format="%at" 2>/dev/null | tail -1 || echo "")"
        if [ -d "${cairn_dir}/history" ] && [ -n "$ref_ts" ]; then
            while IFS= read -r hist_file; do
                local file_ts
                file_ts="$(_doctor_mtime "$hist_file" 2>/dev/null || echo 0)"
                if [ "${file_ts:-0}" -ge "${ref_ts:-0}" ]; then
                    has_transition=true
                    break
                fi
            done < <(grep -rl "^type: transition" "${cairn_dir}/history/" 2>/dev/null || true)
        fi
        if [ "$has_transition" = false ]; then
            _DOCTOR_JSON_WRITE_BACK_SIGNALS="${_DOCTOR_JSON_WRITE_BACK_SIGNALS}missing-audit-flag,"
            if [ "$_DOCTOR_JSON" = false ]; then
                echo -e "  ${C_YELLOW}⚠${C_RESET}  $(msg_doctor_write_back_signal_missing_audit_flag)"
            fi
        fi
    fi

    _DOCTOR_JSON_WRITE_BACK_SIGNALS="${_DOCTOR_JSON_WRITE_BACK_SIGNALS%,}"

    if [ -n "$_DOCTOR_JSON_WRITE_BACK_SIGNALS" ]; then
        _DOCTOR_JSON_WRITE_BACK_STATUS="warn"
        _DOCTOR_JSON_WRITE_BACK_REASON="signals_found"
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_DIM}→  $(msg_doctor_write_back_suggest)${C_RESET}"
        fi
    else
        if [ "$_DOCTOR_JSON" = false ]; then
            echo -e "  ${C_GREEN}✓${C_RESET}  $(msg_doctor_write_back_ok)"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Emit JSON result to stdout.
# -----------------------------------------------------------------------------
_doctor_emit_json() {
    local stale="${_DOCTOR_JSON_STALE_DOMAINS:-}"
    local v0011="${_DOCTOR_JSON_V0011_RESIDUE:-}"
    local wb="${_DOCTOR_JSON_WRITE_BACK_SIGNALS:-}"

    # Convert comma-separated lists to JSON arrays
    local stale_arr="[]"
    if [ -n "$stale" ]; then
        stale_arr='["'"$(echo "$stale" | sed 's/,/","/g')"'"]'
    fi
    local v0011_arr="[]"
    if [ -n "$v0011" ]; then
        v0011_arr='["'"$(echo "$v0011" | sed 's/,/","/g')"'"]'
    fi
    local wb_arr="[]"
    if [ -n "$wb" ]; then
        wb_arr='["'"$(echo "$wb" | sed 's/,/","/g')"'"]'
    fi

    cat <<JSON
{
  "cairn_version": "0.0.14",
  "issues": ${_DOCTOR_FAIL},
  "output": {
    "status": "${_DOCTOR_JSON_OUTPUT_STATUS:-ok}",
    "tokens": ${_DOCTOR_JSON_OUTPUT_TOKENS:-0}
  },
  "domains_stale": ${stale_arr},
  "skill_guide": "${_DOCTOR_JSON_SKILL_GUIDE:-ok}",
  "skill_md": "${_DOCTOR_JSON_SKILL_MD:-ok}",
  "v0011_residue": ${v0011_arr},
  "write_back": {
    "status": "${_DOCTOR_JSON_WRITE_BACK_STATUS:-skipped}",
    "reason": "${_DOCTOR_JSON_WRITE_BACK_REASON:-no_git}",
    "signals": ${wb_arr}
  }
}
JSON
}

# -----------------------------------------------------------------------------
# Main command
# -----------------------------------------------------------------------------
cmd_doctor() {
    # Parse flags
    _DOCTOR_JSON=false
    for arg in "$@"; do
        case "$arg" in
            --json) _DOCTOR_JSON=true ;;
            *) ;;
        esac
    done

    local root
    root="$(require_cairn_root)"
    local cairn_dir="$root/.cairn"

    _DOCTOR_FAIL=0
    _DOCTOR_JSON_OUTPUT_STATUS="ok"
    _DOCTOR_JSON_OUTPUT_TOKENS=0
    _DOCTOR_JSON_STALE_DOMAINS=""
    _DOCTOR_JSON_SKILL_GUIDE="ok"
    _DOCTOR_JSON_SKILL_MD="ok"
    _DOCTOR_JSON_V0011_RESIDUE=""
    _DOCTOR_JSON_WRITE_BACK_STATUS="skipped"
    _DOCTOR_JSON_WRITE_BACK_REASON="no_git"
    _DOCTOR_JSON_WRITE_BACK_SIGNALS=""

    _doctor_check_output "$cairn_dir"
    _doctor_check_domains "$cairn_dir"
    _doctor_check_hooks "$cairn_dir"
    _doctor_check_skill_drift "$root"
    _doctor_check_skill_guide "$root"
    _doctor_check_skill_md "$cairn_dir"
    _doctor_check_v0011_residue "$cairn_dir"
    _doctor_check_write_back "$root" "$cairn_dir"

    if [ "$_DOCTOR_JSON" = true ]; then
        _doctor_emit_json
    else
        echo ""
        if [ "$_DOCTOR_FAIL" -eq 0 ]; then
            echo -e "  ${C_GREEN}$(msg_doctor_summary_ok)${C_RESET}"
        else
            echo -e "  ${C_YELLOW}$(msg_doctor_summary_issues "$_DOCTOR_FAIL")${C_RESET}"
        fi
        echo ""
    fi

    [ "$_DOCTOR_FAIL" -eq 0 ] || exit 1
}
