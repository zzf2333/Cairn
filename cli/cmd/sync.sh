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
        echo -e "${C_YELLOW}warning:${C_RESET} no history entries found for domain '${domain}'" >&2
        echo -e "  Record some decisions first with ${C_BOLD}cairn log${C_RESET}." >&2
        return 1
    fi

    local current_file_section
    if [ -f "$domain_file" ]; then
        current_file_section="## Current domain file (.cairn/domains/${domain}.md)

$(cat "$domain_file")"
    else
        current_file_section="## Current domain file

This domain file does not exist yet. Create it from scratch."
    fi

    # ---- Output the prompt ----
    cat <<PROMPT
You are updating a Cairn domain file based on accumulated history entries.
Cairn is an AI path-dependency constraint system. Domain files provide
pre-compressed design context that is injected when the AI works on related tasks.

${current_file_section}

## History entries for domain: ${domain} (chronological)
${history_entries}
## Your task

Generate an updated domain file for \`${domain}\` using EXACTLY this structure:

\`\`\`markdown
---
domain: ${domain}
hooks: ["keyword1", "keyword2", "..."]
updated: ${latest_date:-$(date +%Y-%m)}
status: active
---

# ${domain}

## current design

[1–3 sentences: current design state, primary choice in use, any unresolved boundary]

## trajectory

[Chronological. One line per event. Format: YYYY-MM <description> → <reason if changed>]

## rejected paths

- <option>: <rejection reason, one sentence>
  Re-evaluate when: <condition for reconsideration>

## known pitfalls

- <name>: <trigger> / <why it happens> / <what NOT to do>

## open questions

- <unresolved design question>
\`\`\`

## Rules

1. OVERWRITE the entire file — do not append to the existing content
2. Keep the total file length within 200–400 tokens
3. Every line MUST change AI behavior — if removing a line wouldn't change AI suggestions, delete it
4. The \`rejected\` fields in history entries are the most critical content — include ALL rejected alternatives in "rejected paths"
5. "known pitfalls" are operational traps, NOT accepted debts or direction exclusions
6. Set \`updated:\` in frontmatter to the latest history entry's \`decision_date\`: ${latest_date:-$(date +%Y-%m)}
7. Choose \`status: active\` if the domain is still evolving, \`status: stable\` if settled

When done, save the output to: .cairn/domains/${domain}.md
Then run: cairn status
PROMPT
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
    echo -e "  ${C_BOLD}Dry run: cairn sync ${domain}${C_RESET}"
    echo ""

    if [ -f "$domain_file" ]; then
        local domain_updated=""
        domain_updated="$(awk '/^---$/{count++; next} count==1{print}' "$domain_file" \
            | grep "^updated:" | head -1 | sed 's/^updated: //' | tr -d '[:space:]' || true)"
        echo -e "  ${C_GREEN}Domain file:${C_RESET} exists (updated: ${domain_updated:-unknown})"
    else
        echo -e "  ${C_YELLOW}Domain file:${C_RESET} not yet created — prompt will instruct AI to create it"
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

    echo -e "  ${C_GREEN}History entries:${C_RESET} ${entry_count}"
    if [ -n "$entry_list" ]; then
        echo -e "${C_DIM}${entry_list}${C_RESET}"
    fi

    if [ "$entry_count" -eq 0 ]; then
        echo -e "  ${C_YELLOW}Note:${C_RESET} no history entries found — nothing to sync"
    else
        echo -e "  ${C_DIM}Run ${C_BOLD}cairn sync ${domain}${C_DIM} to generate the full prompt.${C_RESET}"
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
                echo -e "${C_RED}error:${C_RESET} unknown flag '$1'" >&2
                exit 1
                ;;
            *)
                if [ -z "$target_domain" ]; then
                    target_domain="$1"
                else
                    echo -e "${C_RED}error:${C_RESET} unexpected argument '$1'" >&2
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # ---- Validate arguments ----
    if [ -z "$target_domain" ] && [ "$flag_stale" = false ]; then
        echo -e "${C_RED}error:${C_RESET} specify a domain name or use --stale" >&2
        echo ""
        echo -e "  Usage:"
        echo -e "    cairn sync <domain>     Generate prompt for a specific domain"
        echo -e "    cairn sync --stale      Generate prompts for all stale domains"
        echo -e "    cairn sync <domain> --dry-run   Show summary without generating prompt"
        echo ""
        exit 1
    fi

    # ---- Collect target domains ----
    local target_domains=""
    if [ "$flag_stale" = true ]; then
        target_domains="$(_sync_stale_domains "$output_md" "$domains_dir" "$history_dir")"
        if [ -z "$target_domains" ]; then
            echo ""
            echo -e "  ${C_GREEN}✓${C_RESET} No stale domains found — all domain files are up to date."
            echo -e "  ${C_DIM}Run ${C_BOLD}cairn status${C_DIM} to verify.${C_RESET}"
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
                echo -e "  ${C_GREEN}✓${C_RESET} Prompt copied to clipboard (pbcopy)"
                echo -e "  ${C_DIM}Paste it into your AI tool to generate the updated domain file.${C_RESET}"
                echo ""
            elif command -v xclip >/dev/null 2>&1; then
                echo "$prompt_output" | xclip -selection clipboard
                echo ""
                echo -e "  ${C_GREEN}✓${C_RESET} Prompt copied to clipboard (xclip)"
                echo -e "  ${C_DIM}Paste it into your AI tool to generate the updated domain file.${C_RESET}"
                echo ""
            else
                echo -e "${C_YELLOW}warning:${C_RESET} --copy requires pbcopy (macOS) or xclip (Linux)" >&2
                echo ""
                echo "$prompt_output"
            fi
        else
            echo "$prompt_output"
        fi
    fi
}
