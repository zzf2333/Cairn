#!/usr/bin/env bash
# cairn analyze — Three-layer cold-start analysis and candidate generation
#
# Usage:
#   cairn analyze [--dry-run] [--since YYYY-MM-DD] [--limit N] [--only TYPE,...]
#
# Layers:
#   Layer 1 (Current Reality):  scan stack/dirs/infra  → .cairn/output.md.draft
#   Layer 2 (Explicit Intent):  read README/arch/ADR   → staged candidates
#   Layer 3 (Historical Events):git reverts/dep-removals/keywords → staged candidates
#
# Candidate files contain meta-comment headers stripped by `cairn stage review`
# on accept. Format:
#   # cairn-analyze: v0.0.6
#   # confidence: high|medium|low
#   # source: <human-readable description>
#   # layer: 1|2|3
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
        | awk -v lim="$limit" 'NR<=lim' \
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

        "$parser" "$dep_file" 2>/dev/null | awk -v n="$MAX_PER_FILE" 'NR<=n' \
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
    git log --format='%ai' --reverse --max-count=1 2>/dev/null | cut -c1-7
}

# ── Layer 1: directory structure detection ────────────────────────────────────
_analyze_detect_dir_structure() {
    local git_root="$1"
    local parts=""

    if [ -d "$git_root/packages" ] || [ -d "$git_root/apps" ]; then
        parts="monorepo"
    fi

    local fb=""
    if [ -d "$git_root/frontend" ] || [ -d "$git_root/web" ] || [ -d "$git_root/client" ]; then
        fb="frontend"
    fi
    if [ -d "$git_root/backend" ] || [ -d "$git_root/server" ] || [ -d "$git_root/api" ]; then
        fb="${fb:+${fb}+}backend"
    fi
    if [ -n "$fb" ]; then
        parts="${parts:+${parts}, }${fb}"
    fi

    if [ -d "$git_root/services" ]; then
        parts="${parts:+${parts}, }microservices (services/)"
    fi

    if [ -d "$git_root/src" ] && [ -z "$parts" ]; then
        parts="src/"
    fi

    [ -z "$parts" ] && parts="standard"
    echo "$parts"
}

# ── Layer 1: infrastructure detection ────────────────────────────────────────
_analyze_detect_infra() {
    local git_root="$1"
    local parts=""

    if [ -f "$git_root/Dockerfile" ]; then
        parts="docker"
    fi
    if [ -f "$git_root/docker-compose.yml" ] || [ -f "$git_root/docker-compose.yaml" ]; then
        parts="${parts:+${parts}, }docker-compose"
    fi
    if [ -d "$git_root/.github/workflows" ]; then
        parts="${parts:+${parts}, }github-actions"
    fi
    if [ -f "$git_root/.gitlab-ci.yml" ]; then
        parts="${parts:+${parts}, }gitlab-ci"
    fi
    if [ -f "$git_root/Jenkinsfile" ]; then
        parts="${parts:+${parts}, }jenkins"
    fi
    if [ -d "$git_root/.circleci" ]; then
        parts="${parts:+${parts}, }circleci"
    fi
    if [ -d "$git_root/k8s" ] || [ -d "$git_root/kubernetes" ] || [ -d "$git_root/helm" ]; then
        parts="${parts:+${parts}, }kubernetes"
    fi
    if [ -d "$git_root/terraform" ] || [ -d "$git_root/infrastructure" ]; then
        parts="${parts:+${parts}, }terraform"
    fi
    if [ -d "$git_root/pulumi" ]; then
        parts="${parts:+${parts}, }pulumi"
    fi

    [ -z "$parts" ] && parts="none detected"
    echo "$parts"
}

# ── Layer 1: domain inference from dirs + deps ────────────────────────────────
# Outputs domain names, one per line, deduplicated.
_analyze_infer_domains() {
    local git_root="$1"
    local stack_lines="$2"

    {
        # Directory-based signals
        if [ -d "$git_root/src/auth" ] || [ -d "$git_root/src/authentication" ]; then
            echo "auth"
        fi
        if [ -d "$git_root/src/api" ] || [ -d "$git_root/api" ]; then
            echo "api"
        fi
        if [ -d "$git_root/src/db" ] || [ -d "$git_root/src/database" ]; then
            echo "database"
        fi
        if [ -d "$git_root/src/ui" ] || [ -d "$git_root/src/components" ] \
                || [ -d "$git_root/frontend" ] || [ -d "$git_root/web" ] \
                || [ -d "$git_root/client" ]; then
            echo "frontend"
        fi
        if [ -d "$git_root/src/worker" ] || [ -d "$git_root/src/workers" ] \
                || [ -d "$git_root/src/jobs" ] || [ -d "$git_root/src/queue" ]; then
            echo "jobs"
        fi
        if [ -d "$git_root/src/admin" ]; then
            echo "admin"
        fi

        # Dependency-based signals
        if [ -n "$stack_lines" ]; then
            echo "$stack_lines" | awk -F': ' '{print $2}' | while IFS= read -r pkg; do
                case "$pkg" in
                    express|fastify|koa|hapi|gin|echo|flask|django|rails|fiber|chi)
                        echo "api" ;;
                    passport|jsonwebtoken|jwt|bcrypt|argon2|auth0)
                        echo "auth" ;;
                    react|vue|angular|svelte|next|nuxt|remix|gatsby)
                        echo "frontend" ;;
                    mongoose|prisma|sequelize|typeorm|sqlalchemy|gorm)
                        echo "database" ;;
                    bull|celery|sidekiq|temporal|inngest|pg-boss)
                        echo "jobs" ;;
                    stripe|braintree|paypal)
                        echo "payments" ;;
                esac
            done
        fi
    } | sort -u | (grep -v '^$' || true)
}

# ── Layer 1: write .cairn/output.md.draft ────────────────────────────────────
_analyze_write_output_draft() {
    local cairn_dir="$1"
    local stack_lines="$2"
    local domains_list="$3"
    local dir_summary="$4"
    local infra_list="$5"
    local first_yymm="$6"
    local draft_file="${cairn_dir}/output.md.draft"
    local gen_date
    gen_date="$(date +%Y-%m-%d)"

    mkdir -p "$cairn_dir"

    {
        echo "# Cairn Layer 1 draft — generated ${gen_date}"
        echo "# Review and merge relevant sections into .cairn/output.md, then delete this file."
        echo ""
        echo "## stage"
        echo ""
        if [ -n "$first_yymm" ]; then
            echo "phase: [TODO] (${first_yymm}+)"
        else
            echo "phase: [TODO]"
        fi
        echo "mode: [TODO — e.g., stability > speed > elegance]"
        echo ""
        echo "## no-go"
        echo ""
        echo "[TODO — run \`cairn stage review\` for Layer 2 candidates]"
        echo ""
        echo "## hooks"
        echo ""

        if [ -n "$domains_list" ]; then
            while IFS= read -r domain; do
                [ -z "$domain" ] && continue
                local kw
                case "$domain" in
                    auth|authentication)  kw="auth/login/session" ;;
                    api)                  kw="api/endpoint/route" ;;
                    database|db)          kw="database/db/query" ;;
                    frontend|ui)          kw="frontend/ui/component" ;;
                    jobs|worker|queue)    kw="job/worker/queue/task" ;;
                    admin)                kw="admin/dashboard" ;;
                    payments)             kw="payment/billing/stripe" ;;
                    services)             kw="service" ;;
                    *)                    kw="$domain" ;;
                esac
                echo "${kw} → domains/${domain}.md"
            done <<< "$domains_list"
        else
            echo "[TODO — add: keyword → domains/domain.md]"
        fi

        echo ""
        echo "## stack"
        echo ""
        if [ -n "$stack_lines" ]; then
            echo "$stack_lines" | awk 'NR<=20'
        else
            echo "[TODO — no dependency files found]"
        fi

        echo ""
        echo "## debt"
        echo ""
        echo "[TODO — run \`cairn stage review\` for Layer 3 candidates]"
        echo ""
        echo "## open questions"
        echo ""
        echo "# ── detection notes ──────────────────────────────────────────────────────────"
        echo "# dir structure : ${dir_summary}"
        echo "# infra         : ${infra_list}"
    } > "$draft_file"
}

# ── Layer 2: find intent documents ───────────────────────────────────────────
# Outputs absolute paths, one per line.
_analyze_find_intent_docs() {
    local git_root="$1"

    {
        # Root-level docs — use canonical casing; find resolves case-insensitively where needed
        for _f in README.md README.rst ARCHITECTURE.md DESIGN.md CONTRIBUTING.md; do
            [ -f "$git_root/$_f" ] && echo "$git_root/$_f"
        done
        # docs/ subdirectory
        for _f in README.md ARCHITECTURE.md DESIGN.md architecture.md design.md; do
            [ -f "$git_root/docs/$_f" ] && echo "$git_root/docs/$_f"
        done
        # ADR directories
        for _adr_dir in "$git_root/docs/adr" "$git_root/decisions" "$git_root/.decisions" "$git_root/adr"; do
            if [ -d "$_adr_dir" ]; then
                find "$_adr_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort
            fi
        done
    } | awk '!seen[$0]++' 2>/dev/null
}

# ── Layer 2: extract conservative no-go signals from docs ────────────────────
# Outputs: FILE|LINENUM|TYPE|TEXT, up to 5 signals per file.
_analyze_extract_intent_signals() {
    local docs_list="$1"
    local MAX_PER_FILE=5
    # Conservative: only strong rejection/avoidance phrases
    local pattern="(we don.t |we do not |don.t use |avoid |avoid using |never use |decided against|we rejected|not going to |we use .* instead|no.go|not supported|we.ll not |we won.t )"

    while IFS= read -r doc_file; do
        [ -z "$doc_file" ] && continue
        [ -f "$doc_file" ] || continue

        local rel_file="${doc_file#${PWD}/}"

        grep -inE "$pattern" "$doc_file" 2>/dev/null \
            | awk -v rel="$rel_file" -v max="$MAX_PER_FILE" '{
                if (NR > max) exit
                colon = index($0, ":")
                linenum = substr($0, 1, colon - 1)
                text = substr($0, colon + 1)
                gsub(/^[[:space:]]+/, "", text)
                if (length(text) > 100) text = substr(text, 1, 100) "..."
                print rel "|" linenum "|rejection|" text
            }' || true
    done <<< "$docs_list"
}

# ── Layer 2: emit intent candidates ──────────────────────────────────────────
_analyze_emit_intent_candidates() {
    local cairn_dir="$1"
    local dry_run="$2"
    local limit="$3"
    local recorded_date="$4"
    local signals_data="$5"

    while IFS='|' read -r src_file lineno sig_type sig_text; do
        [ -z "$src_file" ] && continue
        [ "$_ANALYZE_TOTAL" -ge "$limit" ] && break

        local slug
        slug="analyze-intent-$(_analyze_slugify "${sig_text}")"
        _analyze_slug_seen "$slug" && continue
        _analyze_mark_slug "$slug"

        local fname="${recorded_date}_${slug}.md"
        local source_desc="${src_file}:${lineno} — \"${sig_text}\""
        local summary="[TODO — from ${src_file}: \"${sig_text}\"]"

        if [ "$dry_run" = "false" ]; then
            _analyze_write_candidate \
                "${cairn_dir}/staged/${fname}" \
                "low" \
                "$source_desc" \
                "rejection" \
                "[TODO]" \
                "[TODO]" \
                "$recorded_date" \
                "$summary" \
                "[TODO — clarify what this rejects]" \
                "[TODO]" \
                "[TODO]" \
                "2"
            echo -e "  $(msg_analyze_layer2_candidate_written "$fname")"
        fi

        _ANALYZE_COUNT_LAYER2=$(( _ANALYZE_COUNT_LAYER2 + 1 ))
        _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
        _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|low"$'\n'
    done <<< "$signals_data"
}

# ── Write a candidate file with analyze meta-comments ────────────────────────
# Args: FILE CONFIDENCE SOURCE TYPE DOMAIN DATE RECORDED_DATE SUMMARY REJECTED REASON REVISIT [LAYER]
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
    local entry_layer="${12:-3}"

    mkdir -p "$(dirname "$out_file")"

    {
        echo "# cairn-analyze: v0.0.6"
        echo "# confidence: ${confidence}"
        echo "# source: ${source_desc}"
        echo "# layer: ${entry_layer}"
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
_ANALYZE_COUNT_LAYER2=0
_ANALYZE_TOTAL=0
_ANALYZE_LAYER1_DONE=false
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

# ── Emit output-update-candidate for stack drift (v0.0.8) ────────────────────
# Compares output.md ## stack key: value entries against current dep files.
# Emits one output-update-candidate_ file if any entries are not found.
_analyze_emit_stack_drift_candidate() {
    local cairn_dir="$1" dry_run="$2" limit="$3" recorded_date="$4"
    local output_md="$5"
    shift 5
    local dep_files=("$@")

    [ -f "$output_md" ] || return 0
    [ "$_ANALYZE_TOTAL" -ge "$limit" ] && return 0

    local stack_lines
    stack_lines="$(awk '/^## stack/{found=1; next} /^## [a-z]/{found=0} found && /^[a-zA-Z]/{print}' \
        "$output_md" | grep -E '^[a-zA-Z].*:' || true)"
    [ -z "$stack_lines" ] && return 0

    # Collect all package names from dep files
    local all_deps=""
    for dep_file in "${dep_files[@]}"; do
        [ -f "$dep_file" ] || continue
        local pkgs=""
        case "$dep_file" in
            package.json)     pkgs="$(_analyze_parse_package_json     "$dep_file" 2>/dev/null || true)" ;;
            go.mod)           pkgs="$(_analyze_parse_go_mod           "$dep_file" 2>/dev/null || true)" ;;
            requirements.txt) pkgs="$(_analyze_parse_requirements_txt "$dep_file" 2>/dev/null || true)" ;;
            pyproject.toml)   pkgs="$(_analyze_parse_pyproject_toml   "$dep_file" 2>/dev/null || true)" ;;
            Cargo.toml)       pkgs="$(_analyze_parse_cargo_toml       "$dep_file" 2>/dev/null || true)" ;;
            *) continue ;;
        esac
        all_deps="${all_deps}${pkgs}"$'\n'
    done
    [ -z "$all_deps" ] && return 0

    local drift_lines=""
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
            drift_lines="${drift_lines}${layer}: ${tech}"$'\n'
        fi
    done <<< "$stack_lines"

    [ -z "$drift_lines" ] && return 0

    local slug="analyze-stack-drift"
    _analyze_slug_seen "$slug" && return 0
    _analyze_mark_slug "$slug"

    local fname="output-update-candidate_${recorded_date}_${slug}.md"

    if [ "$dry_run" = "false" ]; then
        mkdir -p "${cairn_dir}/staged"
        {
            echo "# cairn-analyze: v0.0.6"
            echo "# confidence: low"
            echo "# source: stack drift — output.md ## stack vs current dep files"
            echo "# kind: output-update"
            echo "## Suggested output.md ## stack update"
            echo ""
            echo "The following entries in output.md ## stack were not found in current"
            echo "dependency files and may be stale:"
            echo ""
            while IFS= read -r drift_entry; do
                [ -z "$drift_entry" ] && continue
                echo "- ${drift_entry}"
            done <<< "$drift_lines"
            echo ""
            echo "Review output.md ## stack and remove or update stale entries."
        } > "${cairn_dir}/staged/${fname}"
        echo -e "  $(msg_analyze_candidate_written "$fname" "low")"
    fi

    _ANALYZE_COUNT_LOW=$(( _ANALYZE_COUNT_LOW + 1 ))
    _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
    _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|low"$'\n'
}

# ── Emit audit-candidate for migration keyword commits (v0.0.8) ───────────────
# For each commit in keyword_data that contains strong migration signals,
# emits one audit-candidate_ file to track cleanup obligations.
_analyze_emit_audit_candidate() {
    local cairn_dir="$1" dry_run="$2" limit="$3" recorded_date="$4"
    local keyword_data="$5"  # newline-separated SHA|YYYY-MM|SUBJECT

    while IFS='|' read -r sha yymm subject; do
        [ -z "$sha" ] && continue
        [ "$_ANALYZE_TOTAL" -ge "$limit" ] && break

        # Only emit audit candidates for strong migration signals
        echo "$subject" | grep -qiE '(migrat|replac)' || continue

        local slug
        slug="analyze-audit-$(_analyze_slugify "${subject}")"
        _analyze_slug_seen "$slug" && continue
        _analyze_mark_slug "$slug"

        local fname="audit-candidate_${yymm}_${slug}.md"

        if [ "$dry_run" = "false" ]; then
            mkdir -p "${cairn_dir}/staged"
            {
                echo "# cairn-analyze: v0.0.6"
                echo "# confidence: medium"
                echo "# source: commit ${sha} — ${yymm} — ${subject}"
                echo "# kind: audit"
                echo "# Audit: ${subject}"
                echo "date: ${yymm}"
                echo "domain: [TODO]"
                echo "trigger: ${subject}"
                echo "status: open"
                echo ""
                echo "## Expected removals"
                echo "- [TODO]"
                echo ""
                echo "## Findings"
                echo "- [TODO — run cairn audit scan to populate]"
                echo ""
                echo "## Follow-up"
                echo "- [TODO]"
            } > "${cairn_dir}/staged/${fname}"
            echo -e "  $(msg_analyze_candidate_written "$fname" "medium")"
        fi

        _ANALYZE_COUNT_MEDIUM=$(( _ANALYZE_COUNT_MEDIUM + 1 ))
        _ANALYZE_TOTAL=$(( _ANALYZE_TOTAL + 1 ))
        _ANALYZE_CANDIDATE_LINES="${_ANALYZE_CANDIDATE_LINES}${fname}|medium"$'\n'
    done <<< "$keyword_data"
}

# ── Summary ───────────────────────────────────────────────────────────────────
_analyze_print_summary() {
    local dry_run="$1"
    local total_limit="$2"

    echo ""
    echo -e "  ${C_BOLD}$(msg_analyze_summary_header)${C_RESET}"

    if [ "$_ANALYZE_LAYER1_DONE" = "true" ]; then
        echo -e "  ${C_CYAN}  Layer 1:${C_RESET} output.md.draft written"
    fi
    if [ "$_ANALYZE_COUNT_LAYER2" -gt 0 ]; then
        echo -e "  ${C_DIM}  Layer 2: ${_ANALYZE_COUNT_LAYER2} intent candidate(s) (low confidence)${C_RESET}"
    fi
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

    echo ""
    if [ "$_ANALYZE_TOTAL" -gt 0 ] && [ "$dry_run" = "false" ]; then
        echo -e "  ${C_BOLD}$(msg_analyze_next_review)${C_RESET}"
    elif [ "$_ANALYZE_TOTAL" -eq 0 ] && [ "$_ANALYZE_LAYER1_DONE" = "false" ]; then
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
    dep_file_names="${dep_file_names%, }"

    if [ ${#dep_files[@]} -gt 0 ]; then
        echo -e "  $(msg_analyze_dep_files_found "$dep_file_names")"
    else
        echo -e "  ${C_DIM}$(msg_analyze_no_dep_files)${C_RESET}"
    fi

    # ── Build since opt (Layer 3 only) ──
    local since_opt=""
    [ -n "$since_arg" ] && since_opt="--since=${since_arg}"
    [ -n "$since_arg" ] && echo -e "  ${C_DIM}$(msg_analyze_since_applied "$since_arg")${C_RESET}"
    [ "$dry_run" = "true" ] && echo -e "  ${C_DIM}$(msg_analyze_dry_run_banner)${C_RESET}"

    # ── Determine which layers / sub-types to run ──
    local do_layer1=true do_layer2=true do_layer3=true
    local do_revert=true do_dep=true do_keyword=true do_todo=true
    if [ -n "$only_filter" ]; then
        do_layer1=false; do_layer2=false; do_layer3=false
        do_revert=false; do_dep=false; do_keyword=false; do_todo=false
        local IFS_OLD="$IFS"
        IFS=','
        for t in $only_filter; do
            case "$t" in
                layer1)  do_layer1=true ;;
                layer2)  do_layer2=true ;;
                layer3)  do_layer3=true
                         do_revert=true; do_dep=true; do_keyword=true; do_todo=true ;;
                revert)  do_layer3=true; do_revert=true ;;
                dep)     do_layer3=true; do_dep=true ;;
                keyword) do_layer3=true; do_keyword=true ;;
                todo)    do_layer3=true; do_todo=true ;;
            esac
        done
        IFS="$IFS_OLD"
    fi

    # ── Reset counters ──
    _ANALYZE_COUNT_HIGH=0
    _ANALYZE_COUNT_MEDIUM=0
    _ANALYZE_COUNT_LOW=0
    _ANALYZE_COUNT_LAYER2=0
    _ANALYZE_TOTAL=0
    _ANALYZE_LAYER1_DONE=false
    _ANALYZE_SEEN_SLUGS=""
    _ANALYZE_CANDIDATE_LINES=""

    local recorded_date
    recorded_date="$(date +%Y-%m)"

    if [ "$dry_run" = "false" ]; then
        mkdir -p "$cairn_dir/staged"
    fi

    # ====================================================================
    # Layer 1 — Current Reality
    # ====================================================================
    if [ "$do_layer1" = "true" ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_analyze_layer1_header)${C_RESET}"
        echo -e "  ${C_DIM}$(msg_analyze_layer1_scanning)${C_RESET}"

        local dir_summary infra_list stack_lines domains_list
        dir_summary="$(_analyze_detect_dir_structure "$git_root")"
        infra_list="$(_analyze_detect_infra "$git_root")"

        stack_lines=""
        if [ ${#dep_files[@]} -gt 0 ]; then
            stack_lines="$(_analyze_detect_current_stack "${dep_files[@]}")"
        fi

        domains_list="$(_analyze_infer_domains "$git_root" "$stack_lines")"

        echo -e "  $(msg_analyze_layer1_dir_structure "$dir_summary")"
        echo -e "  $(msg_analyze_layer1_infra "$infra_list")"
        if [ -n "$domains_list" ]; then
            local _dom_inline
            _dom_inline="$(echo "$domains_list" | tr '\n' ' ' | sed 's/ *$//')"
            echo -e "  $(msg_analyze_layer1_inferred_domains "$_dom_inline")"
        else
            echo -e "  $(msg_analyze_layer1_inferred_domains "(none inferred)")"
        fi

        # Show detected stack briefly
        if [ -n "$stack_lines" ]; then
            echo ""
            echo -e "  ${C_BOLD}$(msg_analyze_stack_header)${C_RESET}"
            echo "$stack_lines" | awk 'NR<=10' | while IFS= read -r line; do
                [ -n "$line" ] && echo -e "  $(msg_analyze_stack_entry "$line")"
            done
            echo -e "  ${C_DIM}$(msg_analyze_stack_hint)${C_RESET}"
        else
            echo ""
            echo -e "  ${C_DIM}$(msg_analyze_layer1_no_stack)${C_RESET}"
        fi

        _analyze_write_output_draft \
            "$cairn_dir" "$stack_lines" "$domains_list" \
            "$dir_summary" "$infra_list" "${first_date:-}"

        echo ""
        echo -e "  ${C_GREEN}$(msg_analyze_layer1_draft_written)${C_RESET}"
        echo -e "  ${C_DIM}$(msg_analyze_layer1_draft_hint)${C_RESET}"
        _ANALYZE_LAYER1_DONE=true
    fi

    # ====================================================================
    # Layer 2 — Explicit Intent
    # ====================================================================
    if [ "$do_layer2" = "true" ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_analyze_layer2_header)${C_RESET}"
        echo -e "  ${C_DIM}$(msg_analyze_layer2_scanning)${C_RESET}"

        local intent_docs=""
        intent_docs="$(_analyze_find_intent_docs "$git_root")"

        if [ -n "$intent_docs" ]; then
            local doc_count
            doc_count="$(echo "$intent_docs" | wc -l | tr -d '[:space:]')"
            echo -e "  $(msg_analyze_layer2_docs_found "$doc_count")"

            local intent_signals=""
            intent_signals="$(_analyze_extract_intent_signals "$intent_docs")"

            local sig_count=0
            if [ -n "$intent_signals" ]; then
                sig_count="$(echo "$intent_signals" | wc -l | tr -d '[:space:]')"
            fi
            echo -e "  $(msg_analyze_layer2_signals_found "$sig_count")"

            if [ -n "$intent_signals" ]; then
                _analyze_emit_intent_candidates \
                    "$cairn_dir" "$dry_run" "$limit" "$recorded_date" "$intent_signals"
            fi
        else
            echo -e "  ${C_DIM}$(msg_analyze_layer2_no_docs)${C_RESET}"
        fi
    fi

    # ====================================================================
    # Layer 3 — Historical Events
    # ====================================================================
    if [ "$do_layer3" = "true" ]; then
        echo ""
        echo -e "  ${C_BOLD}$(msg_analyze_layer3_header)${C_RESET}"
        echo -e "  ${C_DIM}$(msg_analyze_scanning)${C_RESET}"

        local reverts_data="" dep_data="" keyword_data="" todo_data=""

        if [ "$do_revert" = "true" ]; then
            reverts_data="$(_analyze_detect_reverts "$since_opt")"
            local rcount=0
            [ -n "$reverts_data" ] && rcount="$(echo "$reverts_data" | wc -l | tr -d '[:space:]')"
            echo -e "  $(msg_analyze_phase_reverts "$rcount")"
        fi

        if [ "$do_dep" = "true" ] && [ ${#dep_files[@]} -gt 0 ]; then
            dep_data="$(_analyze_detect_dep_removals "$since_opt" "${dep_files[@]}")"
            local dcount=0
            [ -n "$dep_data" ] && dcount="$(echo "$dep_data" | wc -l | tr -d '[:space:]')"
            echo -e "  $(msg_analyze_phase_dep "$dcount")"
        fi

        if [ "$do_keyword" = "true" ]; then
            keyword_data="$(_analyze_detect_keyword_commits "$since_opt")"
            local kcount=0
            [ -n "$keyword_data" ] && kcount="$(echo "$keyword_data" | wc -l | tr -d '[:space:]')"
            echo -e "  $(msg_analyze_phase_keywords "$kcount")"
        fi

        if [ "$do_todo" = "true" ]; then
            todo_data="$(_analyze_detect_todos 20)"
            local tcount=0
            [ -n "$todo_data" ] && tcount="$(echo "$todo_data" | wc -l | tr -d '[:space:]')"
            echo -e "  $(msg_analyze_phase_todos "$tcount")"
        fi

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
            # Also emit audit candidates for migration-signal commits (v0.0.8)
            _analyze_emit_audit_candidate \
                "$cairn_dir" "$dry_run" "$limit" "$recorded_date" "$keyword_data"
        fi

        if [ "$do_todo" = "true" ] && [ -n "$todo_data" ]; then
            _analyze_emit_todo_candidates \
                "$cairn_dir" "$dry_run" "$limit" "$recorded_date" "$todo_data"
        fi

        # Stack drift candidate: output.md ## stack vs dep files (v0.0.8)
        if [ -f "${cairn_dir}/output.md" ] && [ ${#dep_files[@]} -gt 0 ]; then
            _analyze_emit_stack_drift_candidate \
                "$cairn_dir" "$dry_run" "$limit" "$recorded_date" \
                "${cairn_dir}/output.md" "${dep_files[@]}"
        fi
    fi

    # ── Summary ──
    _analyze_print_summary "$dry_run" "$limit"
}
