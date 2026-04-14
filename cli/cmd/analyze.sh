#!/usr/bin/env bash
# cairn analyze — Analyze git history and generate staged candidates
#
# Usage:
#   cairn analyze [--dry-run] [--since YYYY-MM-DD] [--limit N] [--only TYPE,...]
#
# Phases:
#   Phase 1: git data collection (reverts, dep changes, keyword commits, TODOs)
#   Phase 2: write candidates to .cairn/staged/ with confidence metadata
#   Phase 3: print summary and stack suggestions
#
# Candidate files contain meta-comment headers stripped by `cairn stage review`
# on accept. Format:
#   # cairn-analyze: v0.0.5
#   # confidence: high|medium|low
#   # source: <human-readable description>
#
# Compatible with bash 3.2+ (macOS system bash).

# ── Local slugify (mirrors _log_slugify from log.sh) ─────────────────────────
_analyze_slugify() {
    echo "$1" \
        | tr '[:upper:]' '[:lower:]' \
        | tr -cs 'a-z0-9' '-' \
        | sed 's/^-//;s/-$//' \
        | cut -c1-36 \
        | sed 's/-$//'
}

# ── Dependency file: parse current package list from a dep file ───────────────
# Each parser outputs one package name per line (no version, no whitespace).

_analyze_parse_package_json() {
    local file="$1"
    [ -f "$file" ] || return 0
    if command -v jq >/dev/null 2>&1; then
        jq -r '(.dependencies // {}, .devDependencies // {}) | keys[]' "$file" 2>/dev/null \
            | sort -u || true
    else
        # grep fallback: lines like   "package-name": "version"
        grep -E '"[a-zA-Z@][a-zA-Z0-9@/_.-]+": "[^"]+"' "$file" 2>/dev/null \
            | sed 's/.*"\([^"]*\)": "[^"]*".*/\1/' \
            | grep -v '^scripts$\|^engines$\|^peerDependencies$' \
            | sort -u || true
    fi
}

_analyze_parse_go_mod() {
    local file="$1"
    [ -f "$file" ] || return 0
    # Lines inside require() blocks: \t<module> <version>
    awk '/^require \(/{in_block=1; next} /^\)/{in_block=0} in_block && /^\t[^\t]/{print $1}
         /^require [^ (]/{print $2}' "$file" 2>/dev/null \
        | grep -v '^//' | sort -u || true
}

_analyze_parse_requirements_txt() {
    local file="$1"
    [ -f "$file" ] || return 0
    # Lines like: package==1.0 or package>=1.0 or package
    grep -v '^#\|^-\|^$' "$file" 2>/dev/null \
        | sed 's/[>=<!].*//' \
        | sed 's/[[:space:]].*$//' \
        | grep -E '^[a-zA-Z]' \
        | sort -u || true
}

_analyze_parse_pyproject_toml() {
    local file="$1"
    [ -f "$file" ] || return 0
    # Extract from [tool.poetry.dependencies] or [project] dependencies array
    # Handles: name = "^version" and "name>=version" list items
    awk '
        /^\[tool\.poetry\.dependencies\]/ { in_sec=1; next }
        /^\[tool\.poetry\.dev-dependencies\]/ { in_sec=1; next }
        /^\[project\]/ { in_proj=1; next }
        /^\[/ { in_sec=0; if (in_proj && !/dependencies/) in_proj=0 }
        in_sec && /^[a-zA-Z]/ { gsub(/[[:space:]]*=.*/,""); print }
        in_proj && /^\s*"[a-zA-Z]/ { gsub(/^\s*"/,""); gsub(/".*$/,""); gsub(/[>=!<].*/,""); print }
    ' "$file" 2>/dev/null \
        | grep -v '^python$\|^\[' \
        | sort -u || true
}

_analyze_parse_cargo_toml() {
    local file="$1"
    [ -f "$file" ] || return 0
    # Lines under [dependencies] or [dev-dependencies]: name = "version"
    awk '
        /^\[dependencies\]/ { in_sec=1; next }
        /^\[dev-dependencies\]/ { in_sec=1; next }
        /^\[/ { in_sec=0 }
        in_sec && /^[a-z]/ { gsub(/[[:space:]]*=.*/,""); print }
    ' "$file" 2>/dev/null \
        | sort -u || true
}

# ── Parse one side of a dep-file diff line into a package name ────────────────
# Input: a single diff line (starting with + or -)
# Output: package name if extractable, empty otherwise
_analyze_dep_diff_pkg() {
    local line="$1" dep_file="$2"
    case "$dep_file" in
        package.json)
            # Lines like: +    "express": "^4.17.1",
            echo "$line" | grep -E '"[a-zA-Z@][a-zA-Z0-9@/_.-]+": "' \
                | sed 's/.*"\([^"]*\)": "[^"]*".*/\1/' \
                | grep -v '^scripts$\|^engines$\|^peerDependencies$' || true
            ;;
        go.mod)
            # Lines like: +\tgithub.com/gin-gonic/gin v1.7.4
            echo "$line" | grep -E '^\+?\t[a-z]' \
                | awk '{print $1}' | sed 's/^\+//' || true
            ;;
        requirements.txt)
            # Lines like: +flask==2.0.0
            echo "$line" | grep -E '^\+[a-zA-Z]' \
                | sed 's/^\+//' | sed 's/[>=<!<].*//' | sed 's/[[:space:]].*//' || true
            ;;
        Cargo.toml)
            # Lines like: +serde = "1.0"
            echo "$line" | grep -E '^\+[a-z]' \
                | sed 's/[[:space:]]*=.*//' | sed 's/^\+//' || true
            ;;
        pyproject.toml)
            echo "$line" | grep -E '^\+"[a-zA-Z]' \
                | sed 's/^\+"//' | sed 's/["><=!].*//' || true
            ;;
    esac
}

# ── Check if a package name appears in the current HEAD dep file ──────────────
_analyze_pkg_in_current() {
    local pkg="$1" dep_file="$2"
    _analyze_parse_package_json_for_check() {
        if command -v jq >/dev/null 2>&1; then
            jq -r '(.dependencies // {}, .devDependencies // {}) | keys[]' "$dep_file" 2>/dev/null || true
        else
            grep -E '"'"$pkg"'"' "$dep_file" >/dev/null 2>&1 && echo "$pkg" || true
        fi
    }
    case "$dep_file" in
        package.json) _analyze_parse_package_json "$dep_file" | grep -qxF "$pkg" 2>/dev/null ;;
        go.mod)       _analyze_parse_go_mod "$dep_file"       | grep -qxF "$pkg" 2>/dev/null ;;
        requirements.txt) _analyze_parse_requirements_txt "$dep_file" | grep -qxF "$pkg" 2>/dev/null ;;
        pyproject.toml)   _analyze_parse_pyproject_toml "$dep_file"   | grep -qxF "$pkg" 2>/dev/null ;;
        Cargo.toml)   _analyze_parse_cargo_toml "$dep_file"   | grep -qxF "$pkg" 2>/dev/null ;;
        *) return 1 ;;
    esac
    return $?
}

# ── Phase 1a: detect revert commits ──────────────────────────────────────────
# Outputs lines: SHA|YYYY-MM|SUBJECT|REVERTED_THING
_analyze_detect_reverts() {
    local since_opt="$1"

    git log --format='%h|%ai|%s' $since_opt 2>/dev/null \
        | (grep -i 'revert' || true) \
        | while IFS='|' read -r sha date_raw subject; do
            [ -z "$sha" ] && continue
            local yymm="${date_raw:0:7}"
            # Extract what was reverted from the subject line
            # Patterns: Revert "foo", Revert 'foo', Revert: foo
            local reverted
            reverted="$(echo "$subject" | sed 's/^[Rr]evert[: ]*//' \
                | sed 's/^["'"'"']//' | sed 's/["'"'"']$//')"
            printf '%s|%s|%s|%s\n' "$sha" "$yymm" "$subject" "$reverted"
        done
    return 0
}

# ── Phase 1b: detect removed dependencies ────────────────────────────────────
# Outputs lines: SHA|YYYY-MM|PKG|DEP_FILE
_analyze_detect_dep_removals() {
    local since_opt="$1"
    shift
    local dep_files=("$@")

    for dep_file in "${dep_files[@]}"; do
        [ -f "$dep_file" ] || continue

        # Walk commits that touched this dep file
        git log --format='%h|%ai' $since_opt -- "$dep_file" 2>/dev/null \
            | while IFS='|' read -r sha date_raw; do
                [ -z "$sha" ] && continue
                local yymm="${date_raw:0:7}"

                # Get lines that were removed in this commit
                while IFS= read -r diff_line; do
                    local pkg
                    pkg="$(_analyze_dep_diff_pkg "$diff_line" "$dep_file")"
                    [ -z "$pkg" ] && continue
                    # Confirm this pkg is NOT in current HEAD
                    if ! _analyze_pkg_in_current "$pkg" "$dep_file" 2>/dev/null; then
                        printf '%s|%s|%s|%s\n' "$sha" "$yymm" "$pkg" "$dep_file"
                    fi
                done < <(
                    git diff "${sha}^" "$sha" -- "$dep_file" 2>/dev/null \
                        | (grep '^-' || true) | (grep -v '^---' || true)
                )
            done
    done | sort -u
    return 0
}

# ── Phase 1c: detect keyword-matched commits (medium confidence) ──────────────
# Outputs lines: SHA|YYYY-MM|SUBJECT
_analyze_detect_keyword_commits() {
    local since_opt="$1"
    local keywords='migrate|migration|migrated|replace|replaced|removing|removed|dropped|drop|deprecat'

    git log --format='%h|%ai|%s' $since_opt 2>/dev/null \
        | (grep -iE "($keywords)" || true) \
        | (grep -iv 'revert' || true) \
        | while IFS='|' read -r sha date_raw subject; do
            [ -z "$sha" ] && continue
            local yymm="${date_raw:0:7}"
            printf '%s|%s|%s\n' "$sha" "$yymm" "$subject"
        done
    return 0
}

# ── Phase 1d: detect TODO/FIXME density ──────────────────────────────────────
# Outputs lines: FILE|COUNT
_analyze_detect_todos() {
    local limit="${1:-10}"

    # git grep returns "file:line:content" for each match; exits 1 if no matches
    (git grep -n -E 'TODO|FIXME|HACK|XXX' -- \
        '*.go' '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.rb' '*.rs' '*.java' '*.kt' \
        '*.swift' '*.c' '*.cpp' '*.h' '*.cs' '*.php' \
        2>/dev/null || true) \
        | (grep -v '^node_modules/\|^vendor/\|^.cairn/' || true) \
        | cut -d: -f1 \
        | sort \
        | uniq -c \
        | sort -rn \
        | head -"$limit" \
        | awk '{print $2"|"$1}'
    return 0
}

# ── Phase 1e: detect current stack ───────────────────────────────────────────
# Outputs lines: ECOSYSTEM:PKG (top packages, deduped)
_analyze_detect_current_stack() {
    local dep_files=("$@")
    local MAX_PER_FILE=15

    for dep_file in "${dep_files[@]}"; do
        [ -f "$dep_file" ] || continue
        local eco
        case "$dep_file" in
            package.json)      eco="js" ;;
            go.mod)            eco="go" ;;
            requirements.txt)  eco="py" ;;
            pyproject.toml)    eco="py" ;;
            Cargo.toml)        eco="rust" ;;
            *)                 eco="?" ;;
        esac

        local parser
        case "$dep_file" in
            package.json)     parser="_analyze_parse_package_json" ;;
            go.mod)           parser="_analyze_parse_go_mod" ;;
            requirements.txt) parser="_analyze_parse_requirements_txt" ;;
            pyproject.toml)   parser="_analyze_parse_pyproject_toml" ;;
            Cargo.toml)       parser="_analyze_parse_cargo_toml" ;;
        esac

        "$parser" "$dep_file" 2>/dev/null | head -"$MAX_PER_FILE" \
            | while IFS= read -r pkg; do
                [ -n "$pkg" ] && printf '%s: %s\n' "$eco" "$pkg"
            done
    done
}

# ── Phase 1f: get git repo metadata ──────────────────────────────────────────
_analyze_git_commit_count() {
    git rev-list --count HEAD 2>/dev/null || echo "0"
}

_analyze_git_first_date() {
    # Returns YYYY-MM of first commit
    git log --format='%ai' --reverse 2>/dev/null | head -1 | cut -c1-7
}

# ── Write a candidate file with analyze meta-comments ────────────────────────
# Args: FILE CONFIDENCE SOURCE TYPE DOMAIN DATE RECORDED_DATE SUMMARY REJECTED REASON REVISIT
_analyze_write_candidate() {
    local out_file="$1"
    local confidence="$2"
    local source_desc="$3"
    local entry_type="$4"
    local entry_domain="$5"
    local entry_date="$6"
    local recorded_date="$7"
    local entry_summary="$8"
    local entry_rejected="$9"
    local entry_reason="${10}"
    local entry_revisit="${11}"

    mkdir -p "$(dirname "$out_file")"

    {
        echo "# cairn-analyze: v0.0.5"
        echo "# confidence: ${confidence}"
        echo "# source: ${source_desc}"
        echo "type: ${entry_type}"
        echo "domain: ${entry_domain}"
        echo "decision_date: ${entry_date}"
        echo "recorded_date: ${recorded_date}"
        echo "summary: ${entry_summary}"
        echo "rejected: ${entry_rejected}"
        echo "reason: ${entry_reason}"
        echo "revisit_when: ${entry_revisit}"
    } > "$out_file"
}

# ── Deduplication guard ───────────────────────────────────────────────────────
# Tracks which slugs have already been emitted in this run to avoid duplicates.
_ANALYZE_SEEN_SLUGS=""

_analyze_slug_seen() {
    local slug="$1"
    echo "$_ANALYZE_SEEN_SLUGS" | grep -qF "|${slug}|"
}

_analyze_mark_slug() {
    local slug="$1"
    _ANALYZE_SEEN_SLUGS="${_ANALYZE_SEEN_SLUGS}|${slug}|"
}

# ── Phase 2: emit all candidates ─────────────────────────────────────────────
# Returns: sets global _ANALYZE_COUNT_HIGH / _ANALYZE_COUNT_MEDIUM / _ANALYZE_COUNT_LOW
_ANALYZE_COUNT_HIGH=0
_ANALYZE_COUNT_MEDIUM=0
_ANALYZE_COUNT_LOW=0
_ANALYZE_TOTAL=0
_ANALYZE_CANDIDATE_LINES=""  # accumulates "FILE|CONFIDENCE" for dry-run summary

_analyze_emit_revert_candidates() {
    local cairn_dir="$1" dry_run="$2" limit="$3" recorded_date="$4"
    local reverts_data="$5"  # newline-separated SHA|YYYY-MM|SUBJECT|REVERTED_THING

    while IFS='|' read -r sha yymm subject reverted; do
        [ -z "$sha" ] && continue
        [ "$_ANALYZE_TOTAL" -ge "$limit" ] && break

        local slug
        slug="analyze-revert-$(_analyze_slugify "${reverted:-$sha}")"
        _analyze_slug_seen "$slug" && continue
        _analyze_mark_slug "$slug"

        local fname="${yymm}_${slug}.md"
        local source_desc="commit ${sha} — ${yymm} — ${subject}"
        local summary="[TODO — reverted: ${reverted}]"
        local rejected
        if [ -n "$reverted" ]; then
            rejected="$reverted (reverted in commit ${sha})"
        else
            rejected="[TODO]"
        fi

        if [ "$dry_run" = "false" ]; then
            _analyze_write_candidate \
                "${cairn_dir}/staged/${fname}" \
                "high" \
                "$source_desc" \
                "experiment" \
                "[TODO]" \
                "$yymm" \
                "$recorded_date" \
                "$summary" \
                "$rejected" \
                "[TODO]" \
                "[TODO]"
            echo -e "  $(msg_analyze_candidate_written "$fname" "high")"
        fi

        _ANALYZE_COUNT_HIGH=$(( _ANALYZE_COUNT_HIGH + 1 ))
        _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
        _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|high"$'\n'
    done <<< "$reverts_data"
}

_analyze_emit_dep_candidates() {
    local cairn_dir="$1" dry_run="$2" limit="$3" recorded_date="$4"
    local dep_data="$5"  # newline-separated SHA|YYYY-MM|PKG|DEP_FILE

    while IFS='|' read -r sha yymm pkg dep_file; do
        [ -z "$sha" ] && continue
        [ "$_ANALYZE_TOTAL" -ge "$limit" ] && break

        local slug
        slug="analyze-dep-$(_analyze_slugify "${pkg}")"
        _analyze_slug_seen "$slug" && continue
        _analyze_mark_slug "$slug"

        local fname="${yymm}_${slug}.md"
        local source_desc="${dep_file} — removed ${pkg} in commit ${sha} (${yymm})"
        local summary="[TODO — removed dependency: ${pkg}]"

        if [ "$dry_run" = "false" ]; then
            _analyze_write_candidate \
                "${cairn_dir}/staged/${fname}" \
                "high" \
                "$source_desc" \
                "rejection" \
                "[TODO]" \
                "$yymm" \
                "$recorded_date" \
                "$summary" \
                "$pkg" \
                "[TODO]" \
                "[TODO]"
            echo -e "  $(msg_analyze_candidate_written "$fname" "high")"
        fi

        _ANALYZE_COUNT_HIGH=$(( _ANALYZE_COUNT_HIGH + 1 ))
        _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
        _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|high"$'\n'
    done <<< "$dep_data"
}

_analyze_emit_keyword_candidates() {
    local cairn_dir="$1" dry_run="$2" limit="$3" recorded_date="$4"
    local keyword_data="$5"  # newline-separated SHA|YYYY-MM|SUBJECT
    local seen_dep_shas="$6" # SHAs already emitted as dep candidates

    while IFS='|' read -r sha yymm subject; do
        [ -z "$sha" ] && continue
        [ "$_ANALYZE_TOTAL" -ge "$limit" ] && break
        # Skip if this commit was already captured as a dep change
        echo "$seen_dep_shas" | grep -qF "$sha" && continue

        local slug
        slug="analyze-kw-$(_analyze_slugify "${subject}")"
        _analyze_slug_seen "$slug" && continue
        _analyze_mark_slug "$slug"

        local fname="${yymm}_${slug}.md"
        local source_desc="commit ${sha} — ${yymm} — ${subject}"
        local summary="[TODO — from commit: ${subject}]"

        if [ "$dry_run" = "false" ]; then
            _analyze_write_candidate \
                "${cairn_dir}/staged/${fname}" \
                "medium" \
                "$source_desc" \
                "transition" \
                "[TODO]" \
                "$yymm" \
                "$recorded_date" \
                "$summary" \
                "[TODO — previous approach]" \
                "[TODO]" \
                "[TODO]"
            echo -e "  $(msg_analyze_candidate_written "$fname" "medium")"
        fi

        _ANALYZE_COUNT_MEDIUM=$(( _ANALYZE_COUNT_MEDIUM + 1 ))
        _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
        _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|medium"$'\n'
    done <<< "$keyword_data"
}

_analyze_emit_todo_candidates() {
    local cairn_dir="$1" dry_run="$2" limit="$3" recorded_date="$4"
    local todo_data="$5"  # newline-separated FILE|COUNT

    while IFS='|' read -r todo_file count; do
        [ -z "$todo_file" ] && continue
        [ "$_ANALYZE_TOTAL" -ge "$limit" ] && break

        local slug
        slug="analyze-debt-$(_analyze_slugify "$todo_file")"
        _analyze_slug_seen "$slug" && continue
        _analyze_mark_slug "$slug"

        local fname="${recorded_date}_${slug}.md"
        local source_desc="TODO/FIXME in ${todo_file} (${count} occurrence(s))"
        local summary="[TODO — technical debt in ${todo_file}]"

        if [ "$dry_run" = "false" ]; then
            _analyze_write_candidate \
                "${cairn_dir}/staged/${fname}" \
                "low" \
                "$source_desc" \
                "debt" \
                "[TODO]" \
                "[TODO]" \
                "$recorded_date" \
                "$summary" \
                "[TODO — clean implementation]" \
                "[TODO]" \
                "[TODO]"
            echo -e "  $(msg_analyze_candidate_written "$fname" "low")"
        fi

        _ANALYZE_COUNT_LOW=$(( _ANALYZE_COUNT_LOW + 1 ))
        _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
        _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|low"$'\n'
    done <<< "$todo_data"
}

# ── Phase 3: print summary ────────────────────────────────────────────────────
_analyze_print_summary() {
    local dry_run="$1"
    local stack_lines="$2"
    local total_limit="$3"

    echo ""
    echo -e "  ${C_BOLD}$(msg_analyze_summary_header)${C_RESET}"
    echo -e "  ${C_GREEN}$(msg_analyze_summary_high   "$_ANALYZE_COUNT_HIGH")${C_RESET}"
    echo -e "  ${C_YELLOW}$(msg_analyze_summary_medium "$_ANALYZE_COUNT_MEDIUM")${C_RESET}"
    echo -e "  ${C_DIM}$(msg_analyze_summary_low    "$_ANALYZE_COUNT_LOW")${C_RESET}"
    echo ""
    if [ "$dry_run" = "false" ]; then
        echo -e "  $(msg_analyze_summary_total "$_ANALYZE_TOTAL")"
    else
        echo -e "  $(msg_analyze_dry_run_total "$_ANALYZE_TOTAL")"
    fi

    if [ "$_ANALYZE_TOTAL" -ge "$total_limit" ]; then
        echo -e "  ${C_DIM}$(msg_analyze_limit_applied "$total_limit")${C_RESET}"
    fi

    if [ -n "$stack_lines" ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_analyze_stack_header)${C_RESET}"
        echo "$stack_lines" | head -20 | while IFS= read -r line; do
            [ -n "$line" ] && echo -e "  $(msg_analyze_stack_entry "$line")"
        done
        echo -e "  ${C_DIM}$(msg_analyze_stack_hint)${C_RESET}"
    fi

    echo ""
    if [ "$_ANALYZE_TOTAL" -gt 0 ] && [ "$dry_run" = "false" ]; then
        echo -e "  ${C_BOLD}$(msg_analyze_next_review)${C_RESET}"
    elif [ "$_ANALYZE_TOTAL" -eq 0 ]; then
        echo -e "  ${C_DIM}$(msg_analyze_next_noop)${C_RESET}"
    fi
    echo ""
}

# ── Main command ──────────────────────────────────────────────────────────────
cmd_analyze() {
    # ── Parse flags ──
    local dry_run=false
    local since_arg=""
    local limit=30
    local only_filter=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --dry-run)     dry_run=true; shift ;;
            --since)       since_arg="$2"; shift 2 ;;
            --limit)       limit="$2"; shift 2 ;;
            --only)        only_filter="$2"; shift 2 ;;
            --help|-h)
                echo ""
                msg_analyze_help
                echo ""
                return 0
                ;;
            *)
                echo -e "${C_RED}error:${C_RESET} $(msg_err_unknown_flag "$1")" >&2
                echo -e "$(msg_err_run_help)" >&2
                exit 1
                ;;
        esac
    done

    # Validate --limit
    if ! echo "$limit" | grep -qE '^[0-9]+$' || [ "$limit" -lt 1 ]; then
        echo -e "${C_RED}error:${C_RESET} --limit must be a positive integer" >&2
        exit 1
    fi

    # ── Require git ──
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo -e "${C_RED}error:${C_RESET} $(msg_analyze_no_git)" >&2
        exit 1
    fi

    # ── Require .cairn/ ──
    local root=""
    if ! root="$(find_cairn_root)"; then
        echo -e "${C_YELLOW}warning:${C_RESET} $(msg_analyze_no_cairn_warning)" >&2
        exit 1
    fi
    local cairn_dir="$root/.cairn"

    # ── Go to repo root (git analysis needs it) ──
    local git_root
    git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    cd "$git_root"

    # ── Header ──
    echo ""
    echo -e "${C_BOLD}${C_BLUE}$(msg_analyze_title)${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
    echo ""

    # ── Check commits exist ──
    local commit_count
    commit_count="$(_analyze_git_commit_count)"
    if [ "$commit_count" -eq 0 ]; then
        echo -e "${C_YELLOW}warning:${C_RESET} $(msg_analyze_no_commits)" >&2
        exit 1
    fi

    local first_date
    first_date="$(_analyze_git_first_date)"

    echo -e "  $(msg_analyze_git_info "$commit_count" "${first_date:-unknown}")"

    # ── Detect available dep files ──
    local dep_files=()
    local dep_file_names=""
    for f in package.json go.mod requirements.txt pyproject.toml Cargo.toml; do
        if [ -f "$git_root/$f" ]; then
            dep_files+=("$f")
            dep_file_names="${dep_file_names}${f}, "
        fi
    done
    dep_file_names="${dep_file_names%, }"  # strip trailing ", "

    if [ ${#dep_files[@]} -gt 0 ]; then
        echo -e "  $(msg_analyze_dep_files_found "$dep_file_names")"
    else
        echo -e "  ${C_DIM}$(msg_analyze_no_dep_files)${C_RESET}"
    fi

    # ── Build since opt ──
    local since_opt=""
    [ -n "$since_arg" ] && since_opt="--since=${since_arg}"
    [ -n "$since_arg" ] && echo -e "  ${C_DIM}$(msg_analyze_since_applied "$since_arg")${C_RESET}"
    [ "$dry_run" = "true" ] && echo -e "  ${C_DIM}$(msg_analyze_dry_run_banner)${C_RESET}"
    echo ""

    echo -e "  ${C_DIM}$(msg_analyze_scanning)${C_RESET}"

    # ── Phase 1: collect data ──

    # Determine what to collect based on --only filter
    local do_revert=true do_dep=true do_keyword=true do_todo=true
    if [ -n "$only_filter" ]; then
        do_revert=false; do_dep=false; do_keyword=false; do_todo=false
        local IFS_OLD="$IFS"
        IFS=','
        for t in $only_filter; do
            case "$t" in
                revert)  do_revert=true ;;
                dep)     do_dep=true ;;
                keyword) do_keyword=true ;;
                todo)    do_todo=true ;;
            esac
        done
        IFS="$IFS_OLD"
    fi

    local reverts_data="" dep_data="" keyword_data="" todo_data="" stack_lines=""

    if [ "$do_revert" = "true" ]; then
        reverts_data="$(_analyze_detect_reverts "$since_opt")"
        local rcount=0
        if [ -n "$reverts_data" ]; then
            rcount="$(echo "$reverts_data" | wc -l | tr -d '[:space:]')"
        fi
        echo -e "  $(msg_analyze_phase_reverts "$rcount")"
    fi

    if [ "$do_dep" = "true" ] && [ ${#dep_files[@]} -gt 0 ]; then
        dep_data="$(_analyze_detect_dep_removals "$since_opt" "${dep_files[@]}")"
        local dcount=0
        if [ -n "$dep_data" ]; then
            dcount="$(echo "$dep_data" | wc -l | tr -d '[:space:]')"
        fi
        echo -e "  $(msg_analyze_phase_dep "$dcount")"
    fi

    if [ "$do_keyword" = "true" ]; then
        keyword_data="$(_analyze_detect_keyword_commits "$since_opt")"
        local kcount=0
        if [ -n "$keyword_data" ]; then
            kcount="$(echo "$keyword_data" | wc -l | tr -d '[:space:]')"
        fi
        echo -e "  $(msg_analyze_phase_keywords "$kcount")"
    fi

    if [ "$do_todo" = "true" ]; then
        todo_data="$(_analyze_detect_todos 20)"
        local tcount=0
        if [ -n "$todo_data" ]; then
            tcount="$(echo "$todo_data" | wc -l | tr -d '[:space:]')"
        fi
        echo -e "  $(msg_analyze_phase_todos "$tcount")"
    fi

    # Collect current stack (always)
    if [ ${#dep_files[@]} -gt 0 ]; then
        stack_lines="$(_analyze_detect_current_stack "${dep_files[@]}")"
    fi

    # ── Reset counters ──
    _ANALYZE_COUNT_HIGH=0
    _ANALYZE_COUNT_MEDIUM=0
    _ANALYZE_COUNT_LOW=0
    _ANALYZE_TOTAL=0
    _ANALYZE_SEEN_SLUGS=""
    _ANALYZE_CANDIDATE_LINES=""

    local recorded_date
    recorded_date="$(date +%Y-%m)"

    echo ""
    if [ "$dry_run" = "false" ]; then
        mkdir -p "$cairn_dir/staged"
    fi

    # ── Phase 2: emit candidates ──
    # Collect dep SHAs to avoid re-emitting as keyword candidates
    local dep_shas=""
    [ -n "$dep_data" ] && dep_shas="$(echo "$dep_data" | cut -d'|' -f1 | sort -u)"

    if [ "$do_revert" = "true" ] && [ -n "$reverts_data" ]; then
        _analyze_emit_revert_candidates \
            "$cairn_dir" "$dry_run" "$limit" "$recorded_date" "$reverts_data"
    fi

    if [ "$do_dep" = "true" ] && [ -n "$dep_data" ]; then
        _analyze_emit_dep_candidates \
            "$cairn_dir" "$dry_run" "$limit" "$recorded_date" "$dep_data"
    fi

    if [ "$do_keyword" = "true" ] && [ -n "$keyword_data" ]; then
        _analyze_emit_keyword_candidates \
            "$cairn_dir" "$dry_run" "$limit" "$recorded_date" \
            "$keyword_data" "$dep_shas"
    fi

    if [ "$do_todo" = "true" ] && [ -n "$todo_data" ]; then
        _analyze_emit_todo_candidates \
            "$cairn_dir" "$dry_run" "$limit" "$recorded_date" "$todo_data"
    fi

    # ── Phase 3: summary ──
    _analyze_print_summary "$dry_run" "$stack_lines" "$limit"
}
