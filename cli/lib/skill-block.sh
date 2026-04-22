#!/usr/bin/env bash
# cli/lib/skill-block.sh — Managed-block upsert for AI tool config files
#
# Provides a single shared function used by cairn init to write and refresh
# Cairn skill blocks (delimited by HTML comment markers) inside AI tool
# configuration files. Preserves all content outside the marker block.
#
# Compatible with bash 3.2+ (macOS system bash) and POSIX awk.

# _skill_block_upsert <file> <marker_start> <marker_end> <content>
#
# Writes <content> between <marker_start> and <marker_end> in <file>.
# Prints one of three result tokens to stdout:
#   appended  — block did not exist; content was appended (or file was created)
#   refreshed — block existed but content differed; block was updated in place
#   unchanged — block existed and content already matches; no write performed
#
# All content outside the markers is preserved verbatim.
_skill_block_upsert() {
    local file="$1"
    local ms="$2"      # marker_start, e.g. "<!-- cairn:start -->"
    local me="$3"      # marker_end,   e.g. "<!-- cairn:end -->"
    local content="$4" # text to place between markers (no markers included)

    local dir
    dir="$(dirname "$file")"

    # ── Case 1: file does not exist ───────────────────────────────────────────
    if [ ! -f "$file" ]; then
        mkdir -p "$dir"
        {
            echo "$ms"
            echo "$content"
            echo "$me"
        } > "$file"
        echo "appended"
        return 0
    fi

    # ── Case 2: marker not present → append ──────────────────────────────────
    if ! grep -qF "$ms" "$file" 2>/dev/null; then
        [ -s "$file" ] && printf '\n' >> "$file"
        {
            echo "$ms"
            echo "$content"
            echo "$me"
        } >> "$file"
        echo "appended"
        return 0
    fi

    # ── Case 3: marker present → compare, then replace only if different ─────
    local tmp_new tmp_cur tmp_result
    tmp_new="$(mktemp)"
    tmp_cur="$(mktemp)"
    tmp_result="$(mktemp)"

    # Build expected new block (inclusive of markers) in a temp file
    {
        echo "$ms"
        echo "$content"
        echo "$me"
    } > "$tmp_new"

    # Extract current block (inclusive of markers) for comparison
    awk -v ms="$ms" -v me="$me" '
        index($0, ms) == 1          { in_b=1 }
        in_b                        { print }
        index($0, me) == 1 && in_b  { in_b=0 }
    ' "$file" > "$tmp_cur"

    if cmp -s "$tmp_new" "$tmp_cur"; then
        rm -f "$tmp_new" "$tmp_cur"
        echo "unchanged"
        return 0
    fi
    rm -f "$tmp_cur"

    # Replace old block with new block; preserve all content outside markers
    awk -v ms="$ms" -v me="$me" -v nb="$tmp_new" '
        BEGIN { in_b=0; done=0 }
        index($0, ms) == 1 && !done {
            while ((getline ln < nb) > 0) print ln
            close(nb)
            in_b=1; done=1
            next
        }
        index($0, me) == 1 && in_b { in_b=0; next }
        in_b { next }
        { print }
    ' "$file" > "$tmp_result"

    cp "$tmp_result" "$file"
    rm -f "$tmp_new" "$tmp_result"
    echo "refreshed"
}
