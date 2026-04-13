#!/usr/bin/env bash
# cairn status — Three-layer summary and stale domain warnings
#
# Scans .cairn/ and reports:
#   - Current project stage (from output.md)
#   - Domain file status: up-to-date, stale, or not yet created
#   - History entry count
#
# Stale detection: a domain is stale when any of its history entries have a
# recorded_date newer than the domain file's frontmatter `updated` field.
#
# Compatible with bash 3.2+ (macOS system bash).

cmd_status() {
    local root
    root="$(require_cairn_root)"

    local cairn_dir="$root/.cairn"
    local output_md="$cairn_dir/output.md"
    local domains_dir="$cairn_dir/domains"
    local history_dir="$cairn_dir/history"

    # ---- Parse stage from output.md ----
    local stage_phase=""
    if [ -f "$output_md" ]; then
        stage_phase="$(awk '
            /^## stage/{in_stage=1; next}
            /^## [a-z]/{in_stage=0}
            in_stage && /^phase:/{sub(/^phase: /, ""); print; exit}
        ' "$output_md")"
    fi

    # ---- Extract locked domain list from hooks ----
    local locked_domains=""
    if [ -f "$output_md" ]; then
        locked_domains="$(grep -oE '→ read domains/[a-z][a-z0-9-]+\.md first' "$output_md" \
            | sed 's/→ read domains\///;s/\.md first//')"
    fi

    # ---- Count total history entries ----
    local total_history=0
    if [ -d "$history_dir" ]; then
        while IFS= read -r hist_file; do
            local hbase
            hbase="$(basename "$hist_file")"
            [ "$hbase" = "_TEMPLATE.md" ] && continue
            total_history=$(( total_history + 1 ))
        done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
    fi

    # ---- Compute summary counts ----
    local active_count=0
    local not_created_count=0
    while IFS= read -r d; do
        [ -z "$d" ] && continue
        if [ -f "$domains_dir/${d}.md" ]; then
            active_count=$(( active_count + 1 ))
        else
            not_created_count=$(( not_created_count + 1 ))
        fi
    done <<< "$locked_domains"

    # ---- Print header ----
    echo ""
    if [ -n "$stage_phase" ]; then
        printf "stage:   %s\n" "$stage_phase"
    else
        printf "stage:   (unknown)\n"
    fi

    local domains_summary
    if [ -z "$locked_domains" ]; then
        domains_summary="none configured"
    elif [ "$not_created_count" -eq 0 ]; then
        domains_summary="${active_count} active"
    elif [ "$active_count" -eq 0 ]; then
        domains_summary="${not_created_count} not created"
    else
        domains_summary="${active_count} active, ${not_created_count} not created"
    fi
    printf "domains: %s\n" "$domains_summary"
    echo ""

    # ---- Per-domain status ----
    if [ -z "$locked_domains" ]; then
        echo -e "  ${C_DIM}No domains configured in .cairn/output.md hooks section.${C_RESET}"
    fi

    while IFS= read -r d; do
        [ -z "$d" ] && continue
        local domain_file="$domains_dir/${d}.md"

        # Count and collect history for this domain
        local hist_count=0
        local latest_hist=""
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

                hist_count=$(( hist_count + 1 ))
                if [ -z "$latest_hist" ] || [[ "$hrdate" > "$latest_hist" ]]; then
                    latest_hist="$hrdate"
                fi
            done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
        fi

        if [ ! -f "$domain_file" ]; then
            printf "  ${C_DIM}·${C_RESET}  %-28s not yet created (%d history %s)\n" \
                "$d" "$hist_count" "$([ "$hist_count" -eq 1 ] && echo 'entry' || echo 'entries')"
            continue
        fi

        # Parse domain's frontmatter updated field
        # Use || true to prevent pipefail from triggering when grep finds no match
        local domain_updated=""
        domain_updated="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^updated:" | head -1 | sed 's/^updated: //' | tr -d '[:space:]' || true)"

        if [ -z "$domain_updated" ]; then
            printf "  ${C_DIM}?${C_RESET}  %-28s no updated date in frontmatter\n" "$d"
            continue
        fi

        # Count new history entries since domain_updated
        local new_entries=0
        if [ -n "$latest_hist" ] && [[ "$latest_hist" > "$domain_updated" ]]; then
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
                    [[ "$hrdate" > "$domain_updated" ]] && new_entries=$(( new_entries + 1 ))
                done < <(find "$history_dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | sort)
            fi
        fi

        if [ "$new_entries" -gt 0 ]; then
            printf "  ${C_YELLOW}⚠${C_RESET}  %-28s last updated %s · %d new %s since\n" \
                "$d" "$domain_updated" "$new_entries" \
                "$([ "$new_entries" -eq 1 ] && echo 'history entry' || echo 'history entries')"
            printf "     %-28s ${C_DIM}run: cairn sync %s${C_RESET}\n" "" "$d"
        else
            printf "  ${C_GREEN}✓${C_RESET}  %-28s up to date (%s)\n" "$d" "$domain_updated"
        fi
    done <<< "$locked_domains"

    echo ""
    printf "history: %d %s total\n" "$total_history" \
        "$([ "$total_history" -eq 1 ] && echo 'entry' || echo 'entries')"
    echo ""
}
