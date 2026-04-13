#!/usr/bin/env bash
# cairn log tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn log flag mode (non-interactive) behavior.

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# Helper: create a minimal .cairn/ with a given domain list.
_create_log_fixture() {
    local dir="$1"
    shift
    local domains=("$@")

    mkdir -p "$dir/.cairn/history" "$dir/.cairn/domains"

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
# Flag mode — basic entry creation
# =============================================================================

start_suite "cairn log — Flag Mode: Basic Entry"

_log_dir="$_CAIRN_TMPDIR/log_basic_$$"
mkdir -p "$_log_dir"
_create_log_fixture "$_log_dir" "api-layer" "auth"

(cd "$_log_dir" && bash "$_CAIRN_BIN" log \
    --type rejection \
    --domain api-layer \
    --date "2024-05" \
    --summary "Rejected GraphQL after evaluation" \
    --rejected "GraphQL: evaluated but not trialed" \
    --reason "Team size and data complexity do not justify it" \
    --revisit-when "Frontend needs cross-resource queries" \
    2>/dev/null)

# Find the generated file
_log_file="$(find "$_log_dir/.cairn/history" -name "2024-05_*.md" -type f 2>/dev/null | head -1)"

assert_file_exists "log creates a history file"  "$_log_file"

# All 8 required fields must be present
assert_contains "log file has type field"          "$_log_file" "^type:"
assert_contains "log file has domain field"        "$_log_file" "^domain:"
assert_contains "log file has decision_date field" "$_log_file" "^decision_date:"
assert_contains "log file has recorded_date field" "$_log_file" "^recorded_date:"
assert_contains "log file has summary field"       "$_log_file" "^summary:"
assert_contains "log file has rejected field"      "$_log_file" "^rejected:"
assert_contains "log file has reason field"        "$_log_file" "^reason:"
assert_contains "log file has revisit_when field"  "$_log_file" "^revisit_when:"

# =============================================================================
# Flag mode — field values
# =============================================================================

start_suite "cairn log — Flag Mode: Field Values"

assert_contains "type value is correct"         "$_log_file" "^type: rejection$"
assert_contains "domain value is correct"       "$_log_file" "^domain: api-layer$"
assert_contains "decision_date value is correct" "$_log_file" "^decision_date: 2024-05$"
assert_contains "summary value is correct"      "$_log_file" "^summary: Rejected GraphQL after evaluation$"
assert_contains "rejected field has content"    "$_log_file" "^rejected: GraphQL"
assert_contains "reason field has content"      "$_log_file" "^reason: Team size"
assert_contains "revisit_when has content"      "$_log_file" "^revisit_when: Frontend"

# =============================================================================
# Filename format
# =============================================================================

start_suite "cairn log — Filename Format (YYYY-MM_<slug>.md)"

_log_base="$(basename "$_log_file")"
if echo "$_log_base" | grep -qE "^[0-9]{4}-[0-9]{2}_[a-z][a-z0-9-]+\.md$"; then
    _pass "filename follows YYYY-MM_<slug>.md pattern"
else
    _fail "filename follows YYYY-MM_<slug>.md pattern" \
        "filename '$_log_base' does not match pattern"
fi

# Slug derives from summary (lowercase, hyphens)
assert_contains "filename slug derived from summary" \
    /dev/stdin "rejected-graphql" <<< "$_log_base"

# =============================================================================
# Type validation
# =============================================================================

start_suite "cairn log — Type Validation"

_log_type_dir="$_CAIRN_TMPDIR/log_type_$$"
mkdir -p "$_log_type_dir"
_create_log_fixture "$_log_type_dir" "api-layer"

# Valid types must succeed (exit 0)
for _vtype in decision rejection transition debt experiment; do
    _vtype_exit=0
    (cd "$_log_type_dir" && bash "$_CAIRN_BIN" log \
        --type "$_vtype" --domain api-layer \
        --summary "test ${_vtype}" \
        --rejected "none" --reason "test" 2>/dev/null) || _vtype_exit=$?
    assert_exit_code "type '${_vtype}' is accepted" 0 "$_vtype_exit"
done

# Invalid type must fail (exit non-zero)
_bad_type_exit=0
(cd "$_log_type_dir" && bash "$_CAIRN_BIN" log \
    --type invalidtype --domain api-layer \
    --summary "test" --rejected "none" --reason "test" 2>/dev/null) || _bad_type_exit=$?
assert_exit_code "invalid type exits non-zero" 1 "$_bad_type_exit"

# =============================================================================
# Domain validation
# =============================================================================

start_suite "cairn log — Domain Validation"

_log_dval_dir="$_CAIRN_TMPDIR/log_dval_$$"
mkdir -p "$_log_dval_dir"
_create_log_fixture "$_log_dval_dir" "api-layer" "auth"

# Domain not in locked list exits non-zero in flag mode
_bad_domain_exit=0
(cd "$_log_dval_dir" && bash "$_CAIRN_BIN" log \
    --type decision --domain nonexistent-domain \
    --summary "test" --rejected "none" --reason "test" 2>/dev/null) || _bad_domain_exit=$?
assert_exit_code "unlocked domain exits non-zero in flag mode" 1 "$_bad_domain_exit"

# =============================================================================
# Date format validation
# =============================================================================

start_suite "cairn log — Date Validation"

_log_date_dir="$_CAIRN_TMPDIR/log_date_$$"
mkdir -p "$_log_date_dir"
_create_log_fixture "$_log_date_dir" "api-layer"

# Invalid date format must fail
_bad_date_exit=0
(cd "$_log_date_dir" && bash "$_CAIRN_BIN" log \
    --type decision --domain api-layer --date "2024/05" \
    --summary "test" --rejected "none" --reason "test" 2>/dev/null) || _bad_date_exit=$?
assert_exit_code "invalid date format exits non-zero" 1 "$_bad_date_exit"

# Valid date must succeed
_good_date_exit=0
(cd "$_log_date_dir" && bash "$_CAIRN_BIN" log \
    --type decision --domain api-layer --date "2024-05" \
    --summary "test with valid date" --rejected "none" --reason "test" 2>/dev/null) \
    || _good_date_exit=$?
assert_exit_code "valid YYYY-MM date is accepted" 0 "$_good_date_exit"

# =============================================================================
# Required fields
# =============================================================================

start_suite "cairn log — Required Field Enforcement"

_log_req_dir="$_CAIRN_TMPDIR/log_req_$$"
mkdir -p "$_log_req_dir"
_create_log_fixture "$_log_req_dir" "api-layer"

# Missing summary → error
_no_summary_exit=0
(cd "$_log_req_dir" && bash "$_CAIRN_BIN" log \
    --type decision --domain api-layer \
    --rejected "none" --reason "test" 2>/dev/null) || _no_summary_exit=$?
assert_exit_code "missing summary exits non-zero" 1 "$_no_summary_exit"

# Missing rejected → error
_no_rejected_exit=0
(cd "$_log_req_dir" && bash "$_CAIRN_BIN" log \
    --type decision --domain api-layer \
    --summary "test" --reason "test" 2>/dev/null) || _no_rejected_exit=$?
assert_exit_code "missing rejected exits non-zero" 1 "$_no_rejected_exit"

# Missing reason → error
_no_reason_exit=0
(cd "$_log_req_dir" && bash "$_CAIRN_BIN" log \
    --type decision --domain api-layer \
    --summary "test" --rejected "none" 2>/dev/null) || _no_reason_exit=$?
assert_exit_code "missing reason exits non-zero" 1 "$_no_reason_exit"

# =============================================================================
# Generated file passes FORMAT.md history compliance
# =============================================================================

start_suite "cairn log — Generated File Passes History Format Compliance"

# Re-use the file created in the basic entry suite
assert_contains "generated file has valid type value" \
    "$_log_file" "^type: (decision|rejection|transition|debt|experiment)$"
assert_contains "generated decision_date is YYYY-MM" \
    "$_log_file" "^decision_date: [0-9]{4}-[0-9]{2}$"
assert_contains "generated recorded_date is YYYY-MM" \
    "$_log_file" "^recorded_date: [0-9]{4}-[0-9]{2}$"
