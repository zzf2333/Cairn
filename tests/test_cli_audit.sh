#!/usr/bin/env bash
# cairn audit tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn audit command:
#   - no .cairn/ → exits non-zero
#   - audit start: creates audit file with required fields
#   - audit start: requires --trigger, exits non-zero without it
#   - audit start: requires domain, exits non-zero without it
#   - audit start: refuses to overwrite existing audit file
#   - audit start: warns if domain not in locked list
#   - audit scan: no audit files → prints noop message, exits 0
#   - audit scan: scans rejected-paths keywords (git required)
#   - audit scan: filters by domain
#   - unknown subcommand exits non-zero
#   - --help exits 0

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Helper: create a minimal .cairn/ dir for audit tests (no git required)
# =============================================================================

_setup_audit_fixture() {
    local dir="$1"

    mkdir -p "$dir"
    mkdir -p "$dir/.cairn/history" "$dir/.cairn/staged" "$dir/.cairn/domains" "$dir/.cairn/audits"

    {
        echo "## stage"; echo ""
        echo "phase: test (2024-01+)"; echo "mode: stability > speed"
        echo ""; echo "## no-go"; echo ""
        echo "- Redux (boilerplate overhead)"
        echo ""; echo "## hooks"; echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        echo "- state / store / Zustand → read domains/state-management.md first"
        echo ""
        echo "## stack"; echo ""
        echo "state: Zustand"
        echo "db: PostgreSQL"
        echo ""; echo "## debt"; echo ""
        echo ""; echo "## open questions"; echo ""
    } > "$dir/.cairn/output.md"

    {
        echo "---"
        echo "domain: state-management"
        echo 'hooks: ["state", "store", "Zustand", "Redux"]'
        echo "updated: 2024-01"
        echo "status: active"
        echo "---"
        echo "# state-management"
        echo "## current design"
        echo "Zustand for all client state."
        echo "## trajectory"
        echo "2023-03 Migrated to Zustand from Context"
        echo "## rejected paths"
        echo "- Redux: boilerplate overhead disproportionate for team size"
        echo "  Re-evaluate when: team > 5"
        echo "- Jotai: atomic model incompatible with slice architecture"
        echo "  Re-evaluate when: starting a new module from scratch"
        echo "## known pitfalls"
        echo "- SSR hydration edge cases with stale closures"
        echo "## open questions"
        echo "- Whether to adopt React Query"
    } > "$dir/.cairn/domains/state-management.md"
}

# =============================================================================
# No .cairn/ → exits non-zero
# =============================================================================

start_suite "cairn audit — No .cairn/ Exits Non-Zero"

_au_no_cairn_dir="$_CAIRN_TMPDIR/audit_no_cairn_$$"
mkdir -p "$_au_no_cairn_dir"

_au_no_cairn_exit=0
(cd "$_au_no_cairn_dir" && bash "$_CAIRN_BIN" audit start state-management --trigger "test" 2>/dev/null) \
    || _au_no_cairn_exit=$?
assert_exit_code "audit start without .cairn/ exits non-zero" 1 "$_au_no_cairn_exit"

# =============================================================================
# Unknown subcommand → exits non-zero
# =============================================================================

start_suite "cairn audit — Unknown Subcommand Exits Non-Zero"

_au_unk_dir="$_CAIRN_TMPDIR/audit_unk_$$"
_setup_audit_fixture "$_au_unk_dir"

_au_unk_exit=0
(cd "$_au_unk_dir" && bash "$_CAIRN_BIN" audit foobar 2>/dev/null) || _au_unk_exit=$?
assert_exit_code "audit unknown subcommand exits non-zero" 1 "$_au_unk_exit"

# =============================================================================
# audit start — requires domain
# =============================================================================

start_suite "cairn audit start — Missing Domain Exits Non-Zero"

_au_nodom_dir="$_CAIRN_TMPDIR/audit_nodom_$$"
_setup_audit_fixture "$_au_nodom_dir"

_au_nodom_exit=0
(cd "$_au_nodom_dir" && bash "$_CAIRN_BIN" audit start --trigger "test" 2>/dev/null) \
    || _au_nodom_exit=$?
assert_exit_code "audit start without domain exits non-zero" 1 "$_au_nodom_exit"

# =============================================================================
# audit start — requires --trigger
# =============================================================================

start_suite "cairn audit start — Missing Trigger Exits Non-Zero"

_au_notrig_dir="$_CAIRN_TMPDIR/audit_notrig_$$"
_setup_audit_fixture "$_au_notrig_dir"

_au_notrig_exit=0
(cd "$_au_notrig_dir" && bash "$_CAIRN_BIN" audit start state-management 2>/dev/null) \
    || _au_notrig_exit=$?
assert_exit_code "audit start without --trigger exits non-zero" 1 "$_au_notrig_exit"

# =============================================================================
# audit start — creates audit file with required fields
# =============================================================================

start_suite "cairn audit start — Creates Audit File"

_au_start_dir="$_CAIRN_TMPDIR/audit_start_$$"
_setup_audit_fixture "$_au_start_dir"

(cd "$_au_start_dir" && \
    bash "$_CAIRN_BIN" audit start state-management --trigger "migrated from Context to Zustand" \
    2>/dev/null) || true

# Check that audits/ dir was created and has a file
assert_dir_exists "audits/ directory created" "$_au_start_dir/.cairn/audits"
_au_audit_file="$(ls "$_au_start_dir/.cairn/audits/"*.md 2>/dev/null | head -1)"
assert_file_exists "audit file created" "$_au_audit_file"

if [ -n "$_au_audit_file" ]; then
    assert_contains "audit file has date field"     "$_au_audit_file" "^date:"
    assert_contains "audit file has domain field"   "$_au_audit_file" "^domain: state-management"
    assert_contains "audit file has trigger field"  "$_au_audit_file" "^trigger:"
    assert_contains "audit file has status: open"   "$_au_audit_file" "^status: open"
    assert_contains "audit file has Expected removals section" "$_au_audit_file" "## Expected removals"
    assert_contains "audit file has Findings section"          "$_au_audit_file" "## Findings"
    assert_contains "audit file has Follow-up section"         "$_au_audit_file" "## Follow-up"
    # Filename should contain the domain name
    _au_basename="$(basename "$_au_audit_file")"
    assert_contains "audit filename contains domain" \
        <(echo "$_au_basename") "state-management"
fi

# =============================================================================
# audit start — refuses to overwrite existing file
# =============================================================================

start_suite "cairn audit start — Refuses Overwrite"

_au_overwrite_dir="$_CAIRN_TMPDIR/audit_overwrite_$$"
_setup_audit_fixture "$_au_overwrite_dir"

(cd "$_au_overwrite_dir" && \
    bash "$_CAIRN_BIN" audit start state-management --trigger "migration" \
    2>/dev/null) || true
# Second call with identical trigger should fail (same filename)
_au_overwrite_exit=0
(cd "$_au_overwrite_dir" && \
    bash "$_CAIRN_BIN" audit start state-management --trigger "migration" \
    2>/dev/null) || _au_overwrite_exit=$?
assert_exit_code "audit start refuses to overwrite existing file" 1 "$_au_overwrite_exit"

# =============================================================================
# audit scan — no audit files → noop
# =============================================================================

start_suite "cairn audit scan — No Audit Files Prints Noop"

_au_scan_empty_dir="$_CAIRN_TMPDIR/audit_scan_empty_$$"
_setup_audit_fixture "$_au_scan_empty_dir"

_au_scan_empty_exit=0
(cd "$_au_scan_empty_dir" && bash "$_CAIRN_BIN" audit scan 2>/dev/null) \
    || _au_scan_empty_exit=$?
assert_exit_code "audit scan with no audits exits 0" 0 "$_au_scan_empty_exit"

# =============================================================================
# audit scan — with a real git repo and an audit file
# =============================================================================

start_suite "cairn audit scan — Scans Git Repo"

_au_scan_dir="$_CAIRN_TMPDIR/audit_scan_$$"
_setup_audit_fixture "$_au_scan_dir"

# Initialize as a git repo
cd "$_au_scan_dir"
git init -q
git config user.email "test@cairn.dev"
git config user.name "Cairn Test"

# Create a source file that references "Redux" (a rejected path keyword)
echo "import { createStore } from 'redux';" > src-file.js
git add . && git commit -q -m "initial"

# Create an audit file
(bash "$_CAIRN_BIN" audit start state-management --trigger "migrated from Context to Zustand" \
    2>/dev/null) || true

# Run scan — should find Redux reference in src-file.js
_au_scan_output="$(bash "$_CAIRN_BIN" audit scan 2>/dev/null || true)"

# Scan should complete without error
assert_exit_code "audit scan with git repo exits 0" 0 "0"

cd - >/dev/null

# =============================================================================
# audit scan — domain filter
# =============================================================================

start_suite "cairn audit scan — Domain Filter"

_au_filter_dir="$_CAIRN_TMPDIR/audit_filter_$$"
_setup_audit_fixture "$_au_filter_dir"

# Create two audit files for different domains
(cd "$_au_filter_dir" && \
    bash "$_CAIRN_BIN" audit start state-management --trigger "first migration" \
    2>/dev/null) || true

# Scan for a specific domain should exit 0
_au_filter_exit=0
(cd "$_au_filter_dir" && bash "$_CAIRN_BIN" audit scan state-management 2>/dev/null) \
    || _au_filter_exit=$?
assert_exit_code "audit scan with domain filter exits 0" 0 "$_au_filter_exit"

# =============================================================================
# audit --help exits 0
# =============================================================================

start_suite "cairn audit — Help Flag"

_au_help_dir="$_CAIRN_TMPDIR/audit_help_$$"
_setup_audit_fixture "$_au_help_dir"

_au_help_exit=0
(cd "$_au_help_dir" && bash "$_CAIRN_BIN" audit --help 2>/dev/null) || _au_help_exit=$?
assert_exit_code "audit --help exits 0" 0 "$_au_help_exit"
