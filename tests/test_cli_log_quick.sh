#!/usr/bin/env bash
# cairn log --quick tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn log --quick (interactive quick-capture mode):
#   - writes to .cairn/staged/ (not history/)
#   - required 4 fields: type, domain, summary, rejected
#   - reason and revisit_when contain [TODO] placeholders
#   - conflict detection: staged/ and history/ both checked
#   - filename format matches YYYY-MM_<slug>.md

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# Helper: create a minimal .cairn/ with a given domain list (same as log tests).
_create_quick_fixture() {
    local dir="$1"
    shift
    local domains=("$@")

    mkdir -p "$dir/.cairn/history" "$dir/.cairn/domains" "$dir/.cairn/staged"

    {
        echo "## stage"
        echo ""
        echo "phase: test-phase (2024-01+)"
        echo "mode: stability > speed"
        echo ""
        echo "## no-go"
        echo ""
        echo "## hooks"
        echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        for d in "${domains[@]}"; do
            echo "- ${d} → read domains/${d}.md first"
        done
        echo ""
        echo "## stack"
        echo ""
        echo "## debt"
        echo ""
    } > "$dir/.cairn/output.md"
}

# =============================================================================
# Quick mode — basic flow: writes to staged/, not history/
# =============================================================================

start_suite "cairn log --quick — Basic Flow (staged/, not history/)"

_quick_dir="$_CAIRN_TMPDIR/log_quick_basic_$$"
mkdir -p "$_quick_dir"
_create_quick_fixture "$_quick_dir" "api-layer" "auth"

# Simulate interactive input: type=rejection(2), domain=api-layer(1), summary, rejected
(cd "$_quick_dir" && echo -e "2\n1\nGraphQL spike rejected after 3 weeks\nGraphQL: N+1 risk without DataLoader" \
    | bash "$_CAIRN_BIN" log --quick 2>/dev/null)

# File must appear in staged/, not in history/
_quick_staged="$(find "$_quick_dir/.cairn/staged" -name "*.md" -type f 2>/dev/null | head -1)"
_quick_history="$(find "$_quick_dir/.cairn/history" -name "*.md" -type f 2>/dev/null | head -1)"

assert_file_exists     "quick log creates staged file"          "$_quick_staged"
assert_file_not_exists "quick log does NOT write to history/"   "${_quick_history:-/nonexistent/file}"

# =============================================================================
# Quick mode — required fields all present
# =============================================================================

start_suite "cairn log --quick — Required Fields Present"

assert_contains "staged file has type field"          "$_quick_staged" "^type:"
assert_contains "staged file has domain field"        "$_quick_staged" "^domain:"
assert_contains "staged file has decision_date field" "$_quick_staged" "^decision_date:"
assert_contains "staged file has recorded_date field" "$_quick_staged" "^recorded_date:"
assert_contains "staged file has summary field"       "$_quick_staged" "^summary:"
assert_contains "staged file has rejected field"      "$_quick_staged" "^rejected:"
assert_contains "staged file has reason field"        "$_quick_staged" "^reason:"
assert_contains "staged file has revisit_when field"  "$_quick_staged" "^revisit_when:"

# =============================================================================
# Quick mode — [TODO] placeholders in reason and revisit_when
# =============================================================================

start_suite "cairn log --quick — [TODO] Placeholders"

assert_contains "reason field contains [TODO]"        "$_quick_staged" "^reason: \[TODO\]"
assert_contains "revisit_when field contains [TODO]"  "$_quick_staged" "^revisit_when: \[TODO\]"

# Verify [TODO] appears exactly 2 times (reason + revisit_when)
assert_count "exactly 2 [TODO] placeholders" "$_quick_staged" "\[TODO\]" 2

# =============================================================================
# Quick mode — field values from input
# =============================================================================

start_suite "cairn log --quick — Field Values"

assert_contains "type value is correct"     "$_quick_staged" "^type: rejection$"
assert_contains "domain value is correct"   "$_quick_staged" "^domain: api-layer$"
assert_contains "summary field has content" "$_quick_staged" "^summary: GraphQL"
assert_contains "rejected field has content" "$_quick_staged" "^rejected: GraphQL"
# decision_date set to current YYYY-MM
assert_contains "decision_date is YYYY-MM format" "$_quick_staged" "^decision_date: [0-9]{4}-[0-9]{2}$"
assert_contains "recorded_date is YYYY-MM format" "$_quick_staged" "^recorded_date: [0-9]{4}-[0-9]{2}$"

# =============================================================================
# Quick mode — filename format
# =============================================================================

start_suite "cairn log --quick — Filename Format"

_quick_base="$(basename "$_quick_staged")"
if echo "$_quick_base" | grep -qE "^[0-9]{4}-[0-9]{2}_[a-z][a-z0-9-]+\.md$"; then
    _pass "filename follows YYYY-MM_<slug>.md pattern"
else
    _fail "filename follows YYYY-MM_<slug>.md pattern" \
        "filename '$_quick_base' does not match pattern"
fi

# Slug should be derived from the summary
assert_contains "filename slug derived from summary" \
    /dev/stdin "graphql" <<< "$_quick_base"

# =============================================================================
# Quick mode — conflict detection: staged/ collision
# =============================================================================

start_suite "cairn log --quick — Staged Conflict Detection"

_quick_conflict_dir="$_CAIRN_TMPDIR/log_quick_conflict_$$"
mkdir -p "$_quick_conflict_dir"
_create_quick_fixture "$_quick_conflict_dir" "api-layer"

# Run quick mode once to create a staged file
(cd "$_quick_conflict_dir" && echo -e "1\napi-layer\nSame summary again\nsome alternative" \
    | bash "$_CAIRN_BIN" log --quick 2>/dev/null)

# Running quick mode again with same summary should fail (staged/ conflict)
_conflict_exit=0
(cd "$_quick_conflict_dir" && echo -e "1\napi-layer\nSame summary again\nsome alternative" \
    | bash "$_CAIRN_BIN" log --quick 2>/dev/null) || _conflict_exit=$?
assert_exit_code "duplicate staged entry exits non-zero" 1 "$_conflict_exit"

# =============================================================================
# Quick mode — conflict detection: history/ collision
# =============================================================================

start_suite "cairn log --quick — History Conflict Detection"

_quick_hconflict_dir="$_CAIRN_TMPDIR/log_quick_hconflict_$$"
mkdir -p "$_quick_hconflict_dir"
_create_quick_fixture "$_quick_hconflict_dir" "api-layer"

# Create a file in history/ that would conflict
_current_month="$(date +%Y-%m)"
_slug_summary="history-conflict-test"
_prefab_history="$_quick_hconflict_dir/.cairn/history/${_current_month}_history-conflict-test.md"
{
    echo "type: decision"
    echo "domain: api-layer"
    echo "decision_date: ${_current_month}"
    echo "recorded_date: ${_current_month}"
    echo "summary: history conflict test"
    echo "rejected: none"
    echo "reason: already recorded"
    echo "revisit_when: never"
} > "$_prefab_history"

_hconflict_exit=0
(cd "$_quick_hconflict_dir" && echo -e "1\napi-layer\nhistory conflict test\nsome alt" \
    | bash "$_CAIRN_BIN" log --quick 2>/dev/null) || _hconflict_exit=$?
assert_exit_code "history conflict detected, exits non-zero" 1 "$_hconflict_exit"

# =============================================================================
# Quick mode — missing required field: empty summary exits non-zero
# =============================================================================

start_suite "cairn log --quick — Required Field Enforcement"

_quick_fields_dir="$_CAIRN_TMPDIR/log_quick_fields_$$"
mkdir -p "$_quick_fields_dir"
_create_quick_fixture "$_quick_fields_dir" "api-layer"

# Empty summary (send blank line for summary)
_nosummary_exit=0
(cd "$_quick_fields_dir" && echo -e "1\napi-layer\n\nsome rejected" \
    | bash "$_CAIRN_BIN" log --quick 2>/dev/null) || _nosummary_exit=$?
assert_exit_code "empty summary exits non-zero" 1 "$_nosummary_exit"

# =============================================================================
# Quick mode — output is not written to history (integrity check)
# =============================================================================

start_suite "cairn log --quick — Staged is Separate from History"

# Confirm the history dir stays empty in the basic fixture (no flag-mode runs)
_history_count=0
_history_count="$(find "$_quick_dir/.cairn/history" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')"
if [ "$_history_count" -eq 0 ]; then
    _pass "history/ remains empty after quick log"
else
    _fail "history/ remains empty after quick log" \
        "found ${_history_count} file(s) in history/"
fi
