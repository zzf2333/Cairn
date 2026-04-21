#!/usr/bin/env bash
# cairn audit — Migration cleanup tracking
#
# Subcommands:
#   start <domain> --trigger "<change>"
#       Create a new .cairn/audits/YYYY-MM_<domain>-<slug>.md audit file.
#
#   scan [<domain>]
#       Detect residue: scan source files for keywords from rejected paths
#       and check dep files for previously-removed packages still referenced.
#
# Compatible with bash 3.2+ (macOS system bash).

# ── slugify ───────────────────────────────────────────────────────────────────
_audit_slugify() {
    echo "$1" \
        | tr '[:upper:]' '[:lower:]' \
        | tr -cs 'a-z0-9' '-' \
        | sed 's/^-//;s/-$//' \
        | cut -c1-36 \
        | sed 's/-$//'
}

# ── Get mtime (macOS + Linux portable) ───────────────────────────────────────
_audit_mtime() {
    local file="$1"
    if stat -f %m "$file" >/dev/null 2>&1; then
        stat -f %m "$file"
    else
        stat -c %Y "$file"
    fi
}

# ── Parse rejected-paths keywords from a domain file ─────────────────────────
# Extracts option names from "- <option>: <reason>" bullets.
# Outputs one keyword per line.
_audit_parse_rejected_keywords() {
    local domain_file="$1"
    [ -f "$domain_file" ] || return 0
    awk '/^## rejected paths/{found=1; next} /^## [a-z]/{found=0}
         found && /^- [a-zA-Z]/{
             sub(/^- /, ""); sub(/:.*/, ""); gsub(/[[:space:]].*/, ""); print
         }' "$domain_file" 2>/dev/null \
        | grep -E '^[a-zA-Z]' | sort -u || true
}

# ── Parse status from an audit file ──────────────────────────────────────────
_audit_parse_status() {
    local audit_file="$1"
    grep -m1 '^status:' "$audit_file" 2>/dev/null \
        | sed 's/^status:[[:space:]]*//' | tr -d '[:space:]' || echo "unknown"
}

# ── Parse domain from an audit file ──────────────────────────────────────────
_audit_parse_domain() {
    local audit_file="$1"
    grep -m1 '^domain:' "$audit_file" 2>/dev/null \
        | sed 's/^domain:[[:space:]]*//' | tr -d '[:space:]' || echo ""
}

# ── Scan source files for a pattern ──────────────────────────────────────────
# Returns matching file:line references (max 5 per keyword).
_audit_scan_pattern() {
    local pattern="$1"
    local git_root="$2"
    local MAX=5

    (git grep -nriF "$pattern" -- \
        '*.go' '*.js' '*.ts' '*.jsx' '*.tsx' '*.py' '*.rb' '*.rs' \
        '*.java' '*.kt' '*.swift' '*.c' '*.cpp' '*.h' '*.cs' '*.php' \
        '*.vue' '*.svelte' \
        2>/dev/null || true) \
        | (grep -v '^.cairn/\|^node_modules/\|^vendor/' || true) \
        | awk -v n="$MAX" 'NR<=n{print}' \
        | while IFS= read -r line; do
            local file ref
            file="$(echo "$line" | cut -d: -f1)"
            ref="${file}:$(echo "$line" | cut -d: -f2)"
            echo "$ref"
        done
    return 0
}

# =============================================================================
# audit start
# =============================================================================

_audit_start() {
    local domain="" trigger=""

    # Parse: first positional arg is domain, then flags
    if [ $# -gt 0 ]; then
        case "$1" in
            --*) : ;;
            *)  domain="$1"; shift ;;
        esac
    fi

    while [ $# -gt 0 ]; do
        case "$1" in
            --trigger) trigger="$2"; shift 2 ;;
            --help|-h)
                echo ""
                msg_audit_help
                echo ""
                return 0 ;;
            *)
                echo -e "${C_RED}error:${C_RESET} $(msg_err_unknown_flag "$1")" >&2
                exit 1 ;;
        esac
    done

    if [ -z "$domain" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_audit_missing_domain)" >&2
        exit 1
    fi
    if [ -z "$trigger" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_audit_missing_trigger)" >&2
        exit 1
    fi

    local root
    root="$(require_cairn_root)"
    local cairn_dir="$root/.cairn"
    local output_md="$cairn_dir/output.md"

    # Warn if domain not in locked list
    if [ -f "$output_md" ]; then
        local locked
        locked="$(parse_domain_list < "$output_md" || true)"
        if ! echo "$locked" | grep -qx "$domain" 2>/dev/null; then
            echo -e "  ${C_YELLOW}warning:${C_RESET} $(msg_audit_start_domain_warn "$domain")"
        fi
    fi

    local current_date
    current_date="$(date +%Y-%m)"

    local slug
    slug="$(_audit_slugify "$trigger")"
    local filename="${current_date}_${domain}-${slug}.md"
    local audit_file="${cairn_dir}/audits/${filename}"

    if [ -f "$audit_file" ]; then
        echo -e "${C_RED}error:${C_RESET} $(msg_audit_start_conflict "$filename")" >&2
        exit 1
    fi

    echo ""
    echo -e "  $(msg_audit_start_header "$domain")"

    mkdir -p "${cairn_dir}/audits"

    {
        echo "# Audit: ${trigger}"
        echo "date: ${current_date}"
        echo "domain: ${domain}"
        echo "trigger: ${trigger}"
        echo "status: open"
        echo ""
        echo "## Expected removals"
        echo "- [TODO — list files, dirs, or deps expected to be removed]"
        echo ""
        echo "## Findings"
        echo "- [TODO — run cairn audit scan ${domain} to populate]"
        echo ""
        echo "## Follow-up"
        echo "- [TODO]"
    } > "$audit_file"

    echo -e "  ${C_GREEN}$(msg_audit_start_written "$filename")${C_RESET}"
    echo -e "  ${C_DIM}$(msg_audit_start_hint "$filename" "$domain")${C_RESET}"
    echo ""
}

# =============================================================================
# audit scan
# =============================================================================

_audit_scan() {
    local domain_filter=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --help|-h)
                echo ""
                msg_audit_help
                echo ""
                return 0 ;;
            --*)
                echo -e "${C_RED}error:${C_RESET} $(msg_err_unknown_flag "$1")" >&2
                exit 1 ;;
            *)
                domain_filter="$1"; shift ;;
        esac
    done

    local root
    root="$(require_cairn_root)"
    local cairn_dir="$root/.cairn"

    # Require git (for grep)
    local git_root=""
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git_root="$(git rev-parse --show-toplevel 2>/dev/null)"
    fi

    echo ""
    echo -e "${C_BOLD}${C_BLUE}$(msg_audit_scan_header)${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
    echo ""

    if [ -n "$domain_filter" ]; then
        echo -e "  $(msg_audit_scan_domain_filter "$domain_filter")"
    fi

    echo -e "  $(msg_audit_scan_scanning)"
    echo ""

    # Collect audit files
    local audit_files=()
    if [ -d "${cairn_dir}/audits" ]; then
        while IFS= read -r f; do
            [ -z "$f" ] && continue
            audit_files+=("$f")
        done < <(find "${cairn_dir}/audits" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
    fi

    if [ ${#audit_files[@]} -eq 0 ]; then
        echo -e "  ${C_DIM}$(msg_audit_scan_no_audits)${C_RESET}"
        echo ""
        return 0
    fi

    local total_hits=0
    local files_scanned=0

    for audit_file in "${audit_files[@]}"; do
        local abase
        abase="$(basename "$audit_file")"

        local adomain
        adomain="$(_audit_parse_domain "$audit_file")"

        # Apply domain filter
        if [ -n "$domain_filter" ] && [ "$adomain" != "$domain_filter" ]; then
            continue
        fi

        local astatus
        astatus="$(_audit_parse_status "$audit_file")"

        echo -e "  $(msg_audit_scan_file "$abase" "$astatus")"
        files_scanned=$(( files_scanned + 1 ))

        local domain_file="${cairn_dir}/domains/${adomain}.md"
        local file_hits=0

        # Pass A: Scan rejected-paths keywords in source files (if git available)
        if [ -n "$git_root" ] && [ -f "$domain_file" ]; then
            echo -e "  $(msg_audit_scan_rejected_kw "$adomain")"
            cd "$git_root"

            local rejected_keywords
            rejected_keywords="$(_audit_parse_rejected_keywords "$domain_file")"

            if [ -n "$rejected_keywords" ]; then
                while IFS= read -r kw; do
                    [ -z "$kw" ] && continue
                    # Skip very short keywords (too generic)
                    [ "${#kw}" -lt 4 ] && continue

                    local hits
                    hits="$(_audit_scan_pattern "$kw" "$git_root")"
                    if [ -n "$hits" ]; then
                        while IFS= read -r hit_ref; do
                            [ -z "$hit_ref" ] && continue
                            echo -e "  $(msg_audit_scan_hit "$adomain" "$kw" "$hit_ref")"
                            file_hits=$(( file_hits + 1 ))
                            total_hits=$(( total_hits + 1 ))
                        done <<< "$hits"
                    fi
                done <<< "$rejected_keywords"
            fi

            cd - >/dev/null
        fi

        if [ "$file_hits" -eq 0 ]; then
            echo -e "  $(msg_audit_scan_no_hits)"
        fi
        echo ""
    done

    echo -e "  $(msg_audit_scan_summary "$total_hits" "$files_scanned")"
    if [ "$total_hits" -gt 0 ]; then
        echo -e "  ${C_DIM}$(msg_audit_scan_hint)${C_RESET}"
    fi
    echo ""
}

# =============================================================================
# Main command dispatcher
# =============================================================================

cmd_audit() {
    local subverb="${1:-}"
    shift 2>/dev/null || true

    echo ""
    echo -e "${C_BOLD}${C_BLUE}$(msg_audit_title)${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"

    case "$subverb" in
        start)
            _audit_start "$@"
            ;;
        scan)
            _audit_scan "$@"
            ;;
        ""|help|--help|-h)
            echo ""
            msg_audit_help
            echo ""
            ;;
        *)
            echo -e "${C_RED}error:${C_RESET} $(msg_audit_unknown_sub "$subverb")" >&2
            exit 1
            ;;
    esac
}
