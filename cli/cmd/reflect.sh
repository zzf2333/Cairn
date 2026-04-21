#!/usr/bin/env bash
# cairn reflect — Post-task write-back: scan recent changes, generate staged candidates
#
# Usage:
#   cairn reflect [--from-diff] [--since REF] [--from-commit SHA] [--dry-run]
#
# Candidate kinds generated:
#   history-candidate_       reverts and migration events
#   domain-update-candidate_ domains whose files were touched in range
#   output-update-candidate_ stack drift between output.md and current deps
#   audit-candidate_         migration commits that may need cleanup tracking
#
# Compatible with bash 3.2+ (macOS system bash).

# ── slugify (mirrors _log_slugify) ───────────────────────────────────────────
_reflect_slugify() {
    echo "$1" \
        | tr '[:upper:]' '[:lower:]' \
        | tr -cs 'a-z0-9' '-' \
        | sed 's/^-//;s/-$//' \
        | cut -c1-36 \
        | sed 's/-$//'
}

# ── Dedup guard ───────────────────────────────────────────────────────────────
_REFLECT_SEEN_SLUGS=""
_reflect_slug_seen() { echo "$_REFLECT_SEEN_SLUGS" | grep -qF "|${1}|"; }
_reflect_mark_slug() { _REFLECT_SEEN_SLUGS="${_REFLECT_SEEN_SLUGS}|${1}|"; }

# ── Counters ──────────────────────────────────────────────────────────────────
_REFLECT_COUNT_HISTORY=0
_REFLECT_COUNT_DOMAIN=0
_REFLECT_COUNT_OUTPUT=0
_REFLECT_COUNT_AUDIT=0

# ── Write a staged candidate file ─────────────────────────────────────────────
# Args: FILE KIND CONFIDENCE SOURCE CONTENT...
# CONTENT is written verbatim after the meta-comment header.
_reflect_write_candidate() {
    local out_file="$1"
    local kind="$2"
    local confidence="$3"
    local source_desc="$4"
    shift 4

    mkdir -p "$(dirname "$out_file")"

    {
        echo "# cairn-reflect: v0.0.8"
        echo "# kind: ${kind}"
        echo "# confidence: ${confidence}"
        echo "# source: ${source_desc}"
        # Print remaining args as content lines
        local line
        for line in "$@"; do
            echo "$line"
        done
    } > "$out_file"
}

# ── Parse ## stack from output.md ─────────────────────────────────────────────
# Outputs: one "layer: technology" per line
_reflect_parse_stack() {
    local output_md="$1"
    [ -f "$output_md" ] || return 0
    awk '/^## stack/{found=1; next} /^## [a-z]/{found=0} found && /^[a-z]/{print}' "$output_md" \
        | grep -E '^[a-zA-Z].*:' || true
}

# ── Detect stack drift: entries in output.md stack not in current dep files ──
# Outputs lines: LAYER:TECHNOLOGY
_reflect_detect_stack_drift() {
    local output_md="$1"
    local git_root="$2"
    local stack_lines
    stack_lines="$(_reflect_parse_stack "$output_md")"
    [ -z "$stack_lines" ] && return 0

    # Build a flat list of all current dep package names
    local all_deps=""
    for dep_file in package.json go.mod requirements.txt pyproject.toml Cargo.toml; do
        [ -f "$git_root/$dep_file" ] || continue
        case "$dep_file" in
            package.json)
                if command -v jq >/dev/null 2>&1; then
                    all_deps="${all_deps}
$(jq -r '(.dependencies // {}, .devDependencies // {}) | keys[]' "$git_root/$dep_file" 2>/dev/null || true)"
                else
                    all_deps="${all_deps}
$(grep -oE '"[a-zA-Z@][a-zA-Z0-9@/_.-]+"' "$git_root/$dep_file" 2>/dev/null \
    | tr -d '"' | sort -u || true)"
                fi
                ;;
            go.mod)
                all_deps="${all_deps}
$(awk '/^require \(/{in_block=1; next} /^\)/{in_block=0} in_block && /^\t[^\t]/{print $1}
       /^require [^ (]/{print $2}' "$git_root/$dep_file" 2>/dev/null || true)"
                ;;
            requirements.txt)
                all_deps="${all_deps}
$(grep -v '^#\|^-\|^$' "$git_root/$dep_file" 2>/dev/null \
    | sed 's/[>=<!].*//' | sed 's/[[:space:]].*$//' | grep -E '^[a-zA-Z]' || true)"
                ;;
            Cargo.toml)
                all_deps="${all_deps}
$(awk '/^\[dependencies\]/{in_sec=1; next} /^\[dev-dependencies\]/{in_sec=1; next}
   /^\[/{in_sec=0} in_sec && /^[a-z]/{gsub(/[[:space:]]*=.*/,""); print}' \
   "$git_root/$dep_file" 2>/dev/null || true)"
                ;;
        esac
    done

    while IFS=': ' read -r layer tech; do
        [ -z "$tech" ] && continue
        # Normalize: lowercase, strip spaces
        local tech_lower
        tech_lower="$(echo "$tech" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
        # Check if any dep contains the technology name (substring match is intentional)
        if ! echo "$all_deps" | grep -qi "$tech_lower" 2>/dev/null; then
            printf '%s:%s\n' "$layer" "$tech"
        fi
    done <<< "$stack_lines"
}

# ── Detect domain files touched in commit range ───────────────────────────────
# Outputs domain names, one per line.
_reflect_detect_domain_touches() {
    local git_range_args="$1"
    local cairn_dir="$2"
    local output_md="$cairn_dir/output.md"
    [ -f "$output_md" ] || return 0

    local locked_domains
    locked_domains="$(parse_domain_list < "$output_md" || true)"
    [ -z "$locked_domains" ] && return 0

    # Get changed files in range
    local changed_files
    changed_files="$(git diff --name-only $git_range_args 2>/dev/null || true)"
    [ -z "$changed_files" ] && return 0

    while IFS= read -r domain; do
        [ -z "$domain" ] && continue
        local domain_file="$cairn_dir/domains/${domain}.md"
        [ -f "$domain_file" ] || continue

        # Get hooks keywords for this domain
        local hooks
        hooks="$(extract_domain_hooks "$domain_file" 2>/dev/null | tr '[:upper:]' '[:lower:]' | sort -u || true)"
        [ -z "$hooks" ] && continue

        # Check if any changed file path contains any hook keyword
        local found=false
        while IFS= read -r kw; do
            [ -z "$kw" ] && continue
            if echo "$changed_files" | grep -qi "$kw" 2>/dev/null; then
                found=true
                break
            fi
        done <<< "$hooks"

        if [ "$found" = "true" ]; then
            echo "$domain"
        fi
    done <<< "$locked_domains"
}

# ── Detect migration keyword commits ─────────────────────────────────────────
# Outputs: SHA|YYYY-MM|SUBJECT
_reflect_detect_migration_commits() {
    local git_range_args="$1"
    local keywords='migrate|migration|migrated|replace|replaced|removing|removed|dropped|drop|deprecat|refactor'

    git log --format='%h|%ai|%s' $git_range_args 2>/dev/null \
        | (grep -iE "($keywords)" || true) \
        | (grep -iv 'revert' || true) \
        | while IFS='|' read -r sha date_raw subject; do
            [ -z "$sha" ] && continue
            local yymm="${date_raw:0:7}"
            printf '%s|%s|%s\n' "$sha" "$yymm" "$subject"
        done
    return 0
}

# ── Detect revert commits ─────────────────────────────────────────────────────
# Outputs: SHA|YYYY-MM|SUBJECT|REVERTED_THING
_reflect_detect_reverts() {
    local git_range_args="$1"

    git log --format='%h|%ai|%s' $git_range_args 2>/dev/null \
        | (grep -i 'revert' || true) \
        | while IFS='|' read -r sha date_raw subject; do
            [ -z "$sha" ] && continue
            local yymm="${date_raw:0:7}"
            local reverted
            reverted="$(echo "$subject" | sed 's/^[Rr]evert[: ]*//' \
                | sed 's/^["'"'"']//' | sed 's/["'"'"']$//')"
            printf '%s|%s|%s|%s\n' "$sha" "$yymm" "$subject" "$reverted"
        done
    return 0
}

# ── Emit history-candidate for a revert ──────────────────────────────────────
_reflect_emit_revert_candidate() {
    local cairn_dir="$1" dry_run="$2" recorded_date="$3"
    local sha="$4" yymm="$5" subject="$6" reverted="$7"

    local slug
    slug="reflect-revert-$(_reflect_slugify "${reverted:-$sha}")"
    _reflect_slug_seen "$slug" && return 0
    _reflect_mark_slug "$slug"

    local fname="history-candidate_${yymm}_${slug}.md"
    local source_desc="commit ${sha} — ${yymm} — ${subject}"

    if [ "$dry_run" = "false" ]; then
        _reflect_write_candidate \
            "${cairn_dir}/staged/${fname}" \
            "history" \
            "high" \
            "$source_desc" \
            "type: experiment" \
            "domain: [TODO]" \
            "decision_date: ${yymm}" \
            "recorded_date: ${recorded_date}" \
            "summary: [TODO — reverted: ${reverted}]" \
            "rejected: ${reverted:-[TODO]} (reverted in commit ${sha})" \
            "reason: [TODO]" \
            "revisit_when: [TODO]"
        echo -e "  $(msg_reflect_candidate_written "$fname" "high")"
    fi

    _REFLECT_COUNT_HISTORY=$(( _REFLECT_COUNT_HISTORY + 1 ))
}

# ── Emit history-candidate for a migration commit ─────────────────────────────
_reflect_emit_migration_candidate() {
    local cairn_dir="$1" dry_run="$2" recorded_date="$3"
    local sha="$4" yymm="$5" subject="$6"

    local slug
    slug="reflect-migration-$(_reflect_slugify "$subject")"
    _reflect_slug_seen "$slug" && return 0
    _reflect_mark_slug "$slug"

    local fname="history-candidate_${yymm}_${slug}.md"
    local source_desc="commit ${sha} — ${yymm} — ${subject}"

    if [ "$dry_run" = "false" ]; then
        _reflect_write_candidate \
            "${cairn_dir}/staged/${fname}" \
            "history" \
            "medium" \
            "$source_desc" \
            "type: transition" \
            "domain: [TODO]" \
            "decision_date: ${yymm}" \
            "recorded_date: ${recorded_date}" \
            "summary: [TODO — from commit: ${subject}]" \
            "rejected: [TODO — previous approach]" \
            "reason: [TODO]" \
            "revisit_when: [TODO]"
        echo -e "  $(msg_reflect_candidate_written "$fname" "medium")"
    fi

    _REFLECT_COUNT_HISTORY=$(( _REFLECT_COUNT_HISTORY + 1 ))
}

# ── Emit audit-candidate for a migration commit ───────────────────────────────
_reflect_emit_audit_candidate() {
    local cairn_dir="$1" dry_run="$2" recorded_date="$3"
    local sha="$4" yymm="$5" subject="$6"

    local slug
    slug="reflect-audit-$(_reflect_slugify "$subject")"
    _reflect_slug_seen "$slug" && return 0
    _reflect_mark_slug "$slug"

    local fname="audit-candidate_${yymm}_${slug}.md"
    local source_desc="migration commit ${sha} — ${yymm} — ${subject}"

    if [ "$dry_run" = "false" ]; then
        mkdir -p "${cairn_dir}/staged"
        {
            echo "# cairn-reflect: v0.0.8"
            echo "# kind: audit"
            echo "# confidence: medium"
            echo "# source: ${source_desc}"
            echo "# Audit: [TODO — describe the migration this commit is part of]"
            echo "date: ${yymm}"
            echo "domain: [TODO]"
            echo "trigger: ${subject}"
            echo "status: open"
            echo ""
            echo "## Expected removals"
            echo "- [TODO — list files, dirs, or deps expected to be removed]"
            echo ""
            echo "## Findings"
            echo "- [TODO — run cairn audit scan to populate]"
            echo ""
            echo "## Follow-up"
            echo "- [TODO]"
        } > "${cairn_dir}/staged/${fname}"
        echo -e "  $(msg_reflect_candidate_written "$fname" "medium")"
    fi

    _REFLECT_COUNT_AUDIT=$(( _REFLECT_COUNT_AUDIT + 1 ))
}

# ── Emit domain-update-candidate for a touched domain ─────────────────────────
_reflect_emit_domain_candidate() {
    local cairn_dir="$1" dry_run="$2" recorded_date="$3" domain="$4"

    local slug
    slug="reflect-domain-$(_reflect_slugify "$domain")"
    _reflect_slug_seen "$slug" && return 0
    _reflect_mark_slug "$slug"

    local fname="domain-update-candidate_${recorded_date}_${slug}.md"
    local source_desc="domain '${domain}' files modified in range"

    if [ "$dry_run" = "false" ]; then
        mkdir -p "${cairn_dir}/staged"
        {
            echo "# cairn-reflect: v0.0.8"
            echo "# kind: domain-update"
            echo "# confidence: medium"
            echo "# source: ${source_desc}"
            echo "# target-domain: ${domain}"
            echo "# Review the current domains/${domain}.md and update if the recent"
            echo "# changes affected any of its sections (current design, trajectory,"
            echo "# rejected paths, known pitfalls, open questions)."
            echo ""
            echo "domain: ${domain}"
            echo "recorded_date: ${recorded_date}"
            echo "suggested-action: review and update .cairn/domains/${domain}.md"
            echo ""
            echo "## Changes that may affect this domain"
            echo ""
            echo "[TODO — describe what changed in this domain area]"
            echo ""
            echo "## Suggested updates"
            echo ""
            echo "- [ ] Update ## current design if the design changed"
            echo "- [ ] Add a ## trajectory entry for the change"
            echo "- [ ] Update ## rejected paths if anything was rejected in this work"
            echo "- [ ] Update ## known pitfalls if new traps were discovered"
            echo "- [ ] Update ## open questions if any questions were resolved or added"
        } > "${cairn_dir}/staged/${fname}"
        echo -e "  $(msg_reflect_candidate_written "$fname" "medium")"
    fi

    _REFLECT_COUNT_DOMAIN=$(( _REFLECT_COUNT_DOMAIN + 1 ))
}

# ── Emit output-update-candidate for stack drift ──────────────────────────────
_reflect_emit_output_candidate() {
    local cairn_dir="$1" dry_run="$2" recorded_date="$3" drift_lines="$4"

    local slug="reflect-stack-drift"
    _reflect_slug_seen "$slug" && return 0
    _reflect_mark_slug "$slug"

    local fname="output-update-candidate_${recorded_date}_${slug}.md"
    local source_desc="stack drift: output.md ## stack entries not found in current dep files"

    if [ "$dry_run" = "false" ]; then
        mkdir -p "${cairn_dir}/staged"
        {
            echo "# cairn-reflect: v0.0.8"
            echo "# kind: output-update"
            echo "# confidence: low"
            echo "# source: ${source_desc}"
            echo "# Review .cairn/output.md ## stack section."
            echo "# The following entries were not found in current dependency files."
            echo ""
            echo "recorded_date: ${recorded_date}"
            echo "suggested-action: review and update .cairn/output.md ## stack"
            echo ""
            echo "## Potentially stale stack entries"
            echo ""
            while IFS= read -r drift_line; do
                [ -n "$drift_line" ] && echo "- ${drift_line}"
            done <<< "$drift_lines"
            echo ""
            echo "## Suggested action"
            echo ""
            echo "Open .cairn/output.md and:"
            echo "- Remove entries for technologies that are no longer used"
            echo "- Update entries that have changed (e.g. version upgrades)"
            echo "- Add entries for new technologies not yet listed"
        } > "${cairn_dir}/staged/${fname}"
        echo -e "  $(msg_reflect_candidate_written "$fname" "low")"
    fi

    _REFLECT_COUNT_OUTPUT=$(( _REFLECT_COUNT_OUTPUT + 1 ))
}

# ── Summary ───────────────────────────────────────────────────────────────────
_reflect_print_summary() {
    local dry_run="$1"
    local total=$(( _REFLECT_COUNT_HISTORY + _REFLECT_COUNT_DOMAIN + \
                    _REFLECT_COUNT_OUTPUT + _REFLECT_COUNT_AUDIT ))

    echo ""
    echo -e "  ${C_BOLD}$(msg_reflect_summary_header)${C_RESET}"
    echo -e "  ${C_GREEN}$(msg_reflect_summary_history "$_REFLECT_COUNT_HISTORY")${C_RESET}"
    echo -e "  ${C_CYAN}$(msg_reflect_summary_domain  "$_REFLECT_COUNT_DOMAIN")${C_RESET}"
    echo -e "  ${C_YELLOW}$(msg_reflect_summary_output  "$_REFLECT_COUNT_OUTPUT")${C_RESET}"
    echo -e "  ${C_DIM}$(msg_reflect_summary_audit   "$_REFLECT_COUNT_AUDIT")${C_RESET}"
    echo ""

    if [ "$dry_run" = "false" ]; then
        echo -e "  $(msg_reflect_summary_total "$total")"
    else
        echo -e "  $(msg_reflect_dry_run_total "$total")"
    fi

    if [ "$total" -gt 0 ] && [ "$dry_run" = "false" ]; then
        echo -e "  ${C_BOLD}$(msg_reflect_next_review)${C_RESET}"
    elif [ "$total" -eq 0 ]; then
        echo -e "  ${C_DIM}$(msg_reflect_next_noop)${C_RESET}"
    fi
    echo ""
}

# ── Main command ──────────────────────────────────────────────────────────────
cmd_reflect() {
    local dry_run=false
    local mode=""          # "diff" | "since" | "commit" | "" (default: HEAD~5)
    local mode_ref=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --from-diff)
                mode="diff"; shift ;;
            --since)
                mode="since"; mode_ref="$2"; shift 2 ;;
            --from-commit)
                mode="commit"; mode_ref="$2"; shift 2 ;;
            --dry-run)
                dry_run=true; shift ;;
            --help|-h)
                echo ""
                msg_reflect_help
                echo ""
                return 0 ;;
            *)
                echo -e "${C_RED}error:${C_RESET} $(msg_err_unknown_flag "$1")" >&2
                echo -e "$(msg_err_run_help)" >&2
                exit 1 ;;
        esac
    done

    # ── Require .cairn/ ──
    local root
    if ! root="$(find_cairn_root)"; then
        echo -e "${C_YELLOW}warning:${C_RESET} $(msg_reflect_no_cairn_warning)" >&2
        exit 1
    fi
    local cairn_dir="$root/.cairn"

    # ── Require git ──
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo -e "${C_RED}error:${C_RESET} $(msg_reflect_no_git)" >&2
        exit 1
    fi

    local git_root
    git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    cd "$git_root"

    # ── Header ──
    echo ""
    echo -e "${C_BOLD}${C_BLUE}$(msg_reflect_title)${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
    echo ""

    # ── Build git range args ──
    local git_range_args=""
    case "$mode" in
        diff)
            echo -e "  $(msg_reflect_diff_mode)"
            # For diff mode, get staged + unstaged file list; range args unused for commit log
            ;;
        since)
            echo -e "  $(msg_reflect_since_mode "$mode_ref")"
            git_range_args="${mode_ref}..HEAD"
            ;;
        commit)
            echo -e "  $(msg_reflect_commit_mode "$mode_ref")"
            git_range_args="${mode_ref}..HEAD"
            ;;
        *)
            # Default: last 5 commits
            local default_ref="HEAD~5"
            echo -e "  $(msg_reflect_git_range "${default_ref}..HEAD (default)")"
            git_range_args="${default_ref}..HEAD"
            ;;
    esac

    # For diff mode, get changed file list from working tree
    local diff_files=""
    if [ "$mode" = "diff" ]; then
        diff_files="$(git diff --name-only HEAD 2>/dev/null || true)"
        diff_files="${diff_files}
$(git diff --staged --name-only 2>/dev/null || true)"
    fi

    # ── Count commits in range (skip for diff mode) ──
    if [ "$mode" != "diff" ] && [ -n "$git_range_args" ]; then
        local commit_count
        commit_count="$(git rev-list --count $git_range_args 2>/dev/null || echo 0)"
        echo -e "  $(msg_reflect_commits_found "$commit_count")"
        if [ "$commit_count" -eq 0 ]; then
            echo -e "  ${C_YELLOW}$(msg_reflect_no_commits)${C_RESET}"
            echo ""
            return 0
        fi
    fi

    [ "$dry_run" = "true" ] && echo -e "  ${C_DIM}$(msg_reflect_dry_run_banner)${C_RESET}"
    echo ""

    # ── Reset counters and seen slugs ──
    _REFLECT_COUNT_HISTORY=0
    _REFLECT_COUNT_DOMAIN=0
    _REFLECT_COUNT_OUTPUT=0
    _REFLECT_COUNT_AUDIT=0
    _REFLECT_SEEN_SLUGS=""

    local recorded_date
    recorded_date="$(date +%Y-%m)"

    if [ "$dry_run" = "false" ]; then
        mkdir -p "${cairn_dir}/staged"
    fi

    # ====================================================================
    # Pass 1: Reverts → history-candidate (high confidence)
    # ====================================================================
    echo -e "  ${C_BOLD}$(msg_reflect_scanning)${C_RESET}"
    if [ "$mode" != "diff" ] && [ -n "$git_range_args" ]; then
        local reverts_data
        reverts_data="$(_reflect_detect_reverts "$git_range_args")"
        local rcount=0
        [ -n "$reverts_data" ] && rcount="$(echo "$reverts_data" | grep -c '.' || true)"
        echo -e "  $(msg_reflect_phase_reverts "$rcount")"

        if [ -n "$reverts_data" ]; then
            while IFS='|' read -r sha yymm subject reverted; do
                [ -z "$sha" ] && continue
                _reflect_emit_revert_candidate \
                    "$cairn_dir" "$dry_run" "$recorded_date" \
                    "$sha" "$yymm" "$subject" "$reverted"
            done <<< "$reverts_data"
        fi
    fi

    # ====================================================================
    # Pass 2: Migration keyword commits → history-candidate + audit-candidate
    # ====================================================================
    if [ "$mode" != "diff" ] && [ -n "$git_range_args" ]; then
        local migration_data
        migration_data="$(_reflect_detect_migration_commits "$git_range_args")"
        local mcount=0
        [ -n "$migration_data" ] && mcount="$(echo "$migration_data" | grep -c '.' || true)"
        echo -e "  $(msg_reflect_phase_migrations "$mcount")"

        if [ -n "$migration_data" ]; then
            while IFS='|' read -r sha yymm subject; do
                [ -z "$sha" ] && continue
                _reflect_emit_migration_candidate \
                    "$cairn_dir" "$dry_run" "$recorded_date" \
                    "$sha" "$yymm" "$subject"
                # Also emit an audit-candidate for significant migrations
                _reflect_emit_audit_candidate \
                    "$cairn_dir" "$dry_run" "$recorded_date" \
                    "$sha" "$yymm" "$subject"
            done <<< "$migration_data"
        fi
    fi

    # ====================================================================
    # Pass 3: Domain file touches → domain-update-candidate
    # ====================================================================
    local touched_domains=""
    if [ "$mode" = "diff" ]; then
        # Build fake git_range_args for domain touch detection via diff file list
        : # domain detection uses git_range_args; skip for diff mode
    elif [ -n "$git_range_args" ]; then
        touched_domains="$(_reflect_detect_domain_touches "$git_range_args" "$cairn_dir")"
    fi

    local dcount=0
    [ -n "$touched_domains" ] && dcount="$(echo "$touched_domains" | grep -c '.' || true)"
    echo -e "  $(msg_reflect_phase_domains "$dcount")"

    if [ -n "$touched_domains" ]; then
        while IFS= read -r domain; do
            [ -z "$domain" ] && continue
            _reflect_emit_domain_candidate \
                "$cairn_dir" "$dry_run" "$recorded_date" "$domain"
        done <<< "$touched_domains"
    fi

    # ====================================================================
    # Pass 4: Stack drift → output-update-candidate
    # ====================================================================
    local output_md="${cairn_dir}/output.md"
    local drift_lines=""
    drift_lines="$(_reflect_detect_stack_drift "$output_md" "$git_root")"
    local scount=0
    [ -n "$drift_lines" ] && scount="$(echo "$drift_lines" | grep -c '.' || true)"
    echo -e "  $(msg_reflect_phase_stack "$scount")"

    if [ -n "$drift_lines" ]; then
        _reflect_emit_output_candidate \
            "$cairn_dir" "$dry_run" "$recorded_date" "$drift_lines"
    fi

    # ── Summary ──
    _reflect_print_summary "$dry_run"
}
