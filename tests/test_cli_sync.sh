#!/usr/bin/env bash
# cairn sync tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn sync prompt generation.

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# Helper: create a minimal .cairn/ fixture with a domain file and history entries.
# $1 = destination directory
# $2 = domain name
# $3 = domain updated date
_create_sync_fixture() {
    local dir="$1" domain="$2" updated="$3"

    mkdir -p "$dir/.cairn/domains" "$dir/.cairn/history"

    # output.md
    {
        echo "## stage"
        echo ""
        echo "phase: test (2024-01+)"
        echo "mode: stability > speed"
        echo ""
        echo "## no-go"
        echo ""
        echo "## hooks"
        echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        echo "- ${domain} → read domains/${domain}.md first"
        echo ""
        echo "## stack"
        echo ""
        echo "## debt"
        echo ""
    } > "$dir/.cairn/output.md"

    # Domain file
    {
        echo "---"
        echo "domain: ${domain}"
        echo "hooks: [\"${domain}\"]"
        echo "updated: ${updated}"
        echo "status: stable"
        echo "---"
        echo ""
        echo "# ${domain}"
        echo ""
        echo "## current design"
        echo "Current design for ${domain}."
        echo ""
        echo "## trajectory"
        echo "${updated} Initial state"
        echo ""
        echo "## rejected paths"
        echo "- nothing: not evaluated"
        echo "  Re-evaluate when: never"
        echo ""
        echo "## known pitfalls"
        echo ""
        echo "## open questions"
        echo ""
    } > "$dir/.cairn/domains/${domain}.md"

    # History entry
    {
        echo "type: rejection"
        echo "domain: ${domain}"
        echo "decision_date: 2024-06"
        echo "recorded_date: 2024-06"
        echo "summary: Rejected alternative approach"
        echo "rejected: Alternative A: too complex / Alternative B: not evaluated"
        echo "reason: Current approach works well enough"
        echo "revisit_when: When complexity increases significantly"
    } > "$dir/.cairn/history/2024-06_rejection.md"
}

# =============================================================================
# Basic prompt generation
# =============================================================================

start_suite "cairn sync — Basic Prompt Generation"

_sync_dir="$_CAIRN_TMPDIR/sync_basic_$$"
mkdir -p "$_sync_dir"
_create_sync_fixture "$_sync_dir" "api-layer" "2024-03"

_sync_output="$(cd "$_sync_dir" && bash "$_CAIRN_BIN" sync api-layer 2>&1)"
_sync_tmp="$_CAIRN_TMPDIR/sync_basic_out.txt"
echo "$_sync_output" > "$_sync_tmp"

_sync_exit=0
(cd "$_sync_dir" && bash "$_CAIRN_BIN" sync api-layer 2>/dev/null) || _sync_exit=$?
assert_exit_code "sync exits 0 for valid domain" 0 "$_sync_exit"

# Prompt contains current domain file content
assert_contains "prompt includes current domain file header" \
    "$_sync_tmp" "Current domain file"
assert_contains "prompt includes domain file content" \
    "$_sync_tmp" "Current design for api-layer"

# Prompt contains history entries
assert_contains "prompt includes history entries header" \
    "$_sync_tmp" "History entries for domain: api-layer"
assert_contains "prompt includes history filename" \
    "$_sync_tmp" "2024-06_rejection.md"
assert_contains "prompt includes rejected field content" \
    "$_sync_tmp" "Alternative A"

# Prompt contains format instructions
assert_contains "prompt includes format instructions" \
    "$_sync_tmp" "## Your task"
assert_contains "prompt includes overwrite rule" \
    "$_sync_tmp" "OVERWRITE"
assert_contains "prompt includes token budget rule" \
    "$_sync_tmp" "200"
assert_contains "prompt mentions the domain name in output path" \
    "$_sync_tmp" ".cairn/domains/api-layer.md"

# =============================================================================
# Prompt for non-existent domain file
# =============================================================================

start_suite "cairn sync — Non-existent Domain File (creation mode)"

_sync_nc_dir="$_CAIRN_TMPDIR/sync_nc_$$"
mkdir -p "$_sync_nc_dir/.cairn/history"

# output.md with domain hook but no domain file
{
    echo "## stage"
    echo ""
    echo "phase: test (2024-01+)"
    echo "mode: stability > speed"
    echo ""
    echo "## no-go"
    echo ""
    echo "## hooks"
    echo ""
    echo "planning / designing / suggesting for:"
    echo ""
    echo "- database → read domains/database.md first"
    echo ""
    echo "## stack"
    echo ""
    echo "## debt"
    echo ""
} > "$_sync_nc_dir/.cairn/output.md"

# History entry for database domain
{
    echo "type: decision"
    echo "domain: database"
    echo "decision_date: 2024-02"
    echo "recorded_date: 2024-02"
    echo "summary: Chose PostgreSQL"
    echo "rejected: MySQL: familiarity preference but fewer JSON features"
    echo "reason: Better JSON support needed for schema flexibility"
    echo "revisit_when: If team shifts to MongoDB ecosystem"
} > "$_sync_nc_dir/.cairn/history/2024-02_database-decision.md"

mkdir -p "$_sync_nc_dir/.cairn/domains"

_nc_output="$(cd "$_sync_nc_dir" && bash "$_CAIRN_BIN" sync database 2>&1)"
_nc_tmp="$_CAIRN_TMPDIR/sync_nc_out.txt"
echo "$_nc_output" > "$_nc_tmp"

assert_contains "creation-mode prompt notes file does not exist" \
    "$_nc_tmp" "does not exist yet"
assert_contains "creation-mode prompt still includes history" \
    "$_nc_tmp" "2024-02_database-decision.md"

# =============================================================================
# --dry-run flag
# =============================================================================

start_suite "cairn sync — Dry Run"

_sync_dr_dir="$_CAIRN_TMPDIR/sync_dr_$$"
mkdir -p "$_sync_dr_dir"
_create_sync_fixture "$_sync_dr_dir" "auth" "2024-03"

_dr_output="$(cd "$_sync_dr_dir" && bash "$_CAIRN_BIN" sync auth --dry-run 2>&1)"
_dr_tmp="$_CAIRN_TMPDIR/sync_dr_out.txt"
echo "$_dr_output" > "$_dr_tmp"

assert_contains     "dry-run shows domain name"       "$_dr_tmp" "auth"
assert_contains     "dry-run shows file exists"       "$_dr_tmp" "exists"
assert_contains     "dry-run shows history count"     "$_dr_tmp" "History entries: 1"
assert_not_contains "dry-run omits full prompt"       "$_dr_tmp" "## Your task"
assert_not_contains "dry-run omits format template"   "$_dr_tmp" "OVERWRITE"

# =============================================================================
# --stale flag
# =============================================================================

start_suite "cairn sync — Stale Flag"

_sync_stale_dir="$_CAIRN_TMPDIR/sync_stale_$$"
mkdir -p "$_sync_stale_dir"
_create_sync_fixture "$_sync_stale_dir" "api-layer" "2024-03"
# History has recorded_date 2024-06 > domain updated 2024-03 → stale

_stale_output="$(cd "$_sync_stale_dir" && bash "$_CAIRN_BIN" sync --stale 2>&1)"
_stale_tmp="$_CAIRN_TMPDIR/sync_stale_out.txt"
echo "$_stale_output" > "$_stale_tmp"

_stale_exit=0
(cd "$_sync_stale_dir" && bash "$_CAIRN_BIN" sync --stale 2>/dev/null) || _stale_exit=$?
assert_exit_code "sync --stale exits 0" 0 "$_stale_exit"
assert_contains  "stale sync generates prompt for stale domain" "$_stale_tmp" "api-layer"

# All-up-to-date case: no stale domains
_utd_sync_dir="$_CAIRN_TMPDIR/sync_utd_$$"
mkdir -p "$_utd_sync_dir"
_create_sync_fixture "$_utd_sync_dir" "api-layer" "2025-01"
# Domain updated 2025-01 > history recorded_date 2024-06 → not stale

_utd_stale_output="$(cd "$_utd_sync_dir" && bash "$_CAIRN_BIN" sync --stale 2>&1)"
_utd_stale_tmp="$_CAIRN_TMPDIR/sync_utd_stale_out.txt"
echo "$_utd_stale_output" > "$_utd_stale_tmp"
assert_contains "no stale domains shows up-to-date message" \
    "$_utd_stale_tmp" "up to date"

# =============================================================================
# No history entries
# =============================================================================

start_suite "cairn sync — No History Entries"

_sync_empty_dir="$_CAIRN_TMPDIR/sync_empty_$$"
mkdir -p "$_sync_empty_dir/.cairn/domains" "$_sync_empty_dir/.cairn/history"

{
    echo "## stage"
    echo ""
    echo "phase: test (2024-01+)"
    echo "mode: stability > speed"
    echo ""
    echo "## no-go"
    echo ""
    echo "## hooks"
    echo ""
    echo "planning / designing / suggesting for:"
    echo ""
    echo "- testing → read domains/testing.md first"
    echo ""
    echo "## stack"
    echo ""
    echo "## debt"
    echo ""
} > "$_sync_empty_dir/.cairn/output.md"

{
    echo "---"
    echo "domain: testing"
    echo "hooks: [\"test\"]"
    echo "updated: 2024-01"
    echo "status: stable"
    echo "---"
    echo ""
    echo "# testing"
    echo "## current design"
    echo "Unit tests only."
    echo "## trajectory"
    echo "2024-01 Initial"
    echo "## rejected paths"
    echo "## known pitfalls"
    echo "## open questions"
} > "$_sync_empty_dir/.cairn/domains/testing.md"

# sync with no history entries should exit non-zero and show a warning
_empty_exit=0
(cd "$_sync_empty_dir" && bash "$_CAIRN_BIN" sync testing 2>/dev/null) || _empty_exit=$?
assert_exit_code "sync exits non-zero with no history entries" 1 "$_empty_exit"

# =============================================================================
# Example project smoke test
# =============================================================================

start_suite "cairn sync — Example Project Smoke Test"

_ex_sync_exit=0
(cd "$REPO_ROOT/examples/saas-18mo" && bash "$_CAIRN_BIN" sync api-layer 2>/dev/null) \
    || _ex_sync_exit=$?
assert_exit_code "sync exits 0 on example project" 0 "$_ex_sync_exit"

_ex_sync_out="$(cd "$REPO_ROOT/examples/saas-18mo" && bash "$_CAIRN_BIN" sync api-layer 2>&1)"
_ex_sync_tmp="$_CAIRN_TMPDIR/sync_example_out.txt"
echo "$_ex_sync_out" > "$_ex_sync_tmp"

assert_contains "example sync includes domain file content" \
    "$_ex_sync_tmp" "api-layer"
assert_contains "example sync includes history content" \
    "$_ex_sync_tmp" "tRPC"
assert_contains "example sync includes task instructions" \
    "$_ex_sync_tmp" "## Your task"

# =============================================================================
# cairn sync --hooks — Regenerate hooks section from domain frontmatter
# =============================================================================

start_suite "cairn sync --hooks — Basic Output"

_sync_hooks_dir="$_CAIRN_TMPDIR/sync_hooks_$$"
mkdir -p "$_sync_hooks_dir"
_create_sync_fixture "$_sync_hooks_dir" "api-layer" "2024-03"

_hooks_output_file="$_CAIRN_TMPDIR/sync_hooks_output_$$.txt"
(cd "$_sync_hooks_dir" && bash "$_CAIRN_BIN" sync --hooks 2>/dev/null) > "$_hooks_output_file"

assert_contains "hooks section header present" "$_hooks_output_file" "^## hooks"
assert_contains "planning line present" "$_hooks_output_file" "planning / designing / suggesting for:"
assert_contains "domain bullet present" "$_hooks_output_file" "→ read domains/"
assert_contains "keywords from frontmatter" "$_hooks_output_file" "api"
assert_contains "paste hint shown" "$_hooks_output_file" "output.md"

# =============================================================================
# cairn sync --hooks — Exit code 0
# =============================================================================

start_suite "cairn sync --hooks — Exit Code 0"

_hooks_exit=0
(cd "$_sync_hooks_dir" && bash "$_CAIRN_BIN" sync --hooks 2>/dev/null) || _hooks_exit=$?
assert_exit_code "--hooks exits 0" 0 "$_hooks_exit"

# =============================================================================
# cairn sync --hooks — Mutual exclusion with --stale
# =============================================================================

start_suite "cairn sync --hooks — Mutual Exclusion With --stale"

_hooks_stale_exit=0
(cd "$_sync_hooks_dir" && bash "$_CAIRN_BIN" sync --hooks --stale 2>/dev/null) || _hooks_stale_exit=$?
assert_exit_code "--hooks --stale exits 1" 1 "$_hooks_stale_exit"

# =============================================================================
# cairn sync --hooks — Mutual exclusion with domain argument
# =============================================================================

start_suite "cairn sync --hooks — Mutual Exclusion With Domain Argument"

_hooks_domain_exit=0
(cd "$_sync_hooks_dir" && bash "$_CAIRN_BIN" sync --hooks api-layer 2>/dev/null) || _hooks_domain_exit=$?
assert_exit_code "--hooks with domain exits 1" 1 "$_hooks_domain_exit"

# =============================================================================
# cairn sync --hooks — Empty domains directory
# =============================================================================

start_suite "cairn sync --hooks — Empty Domains Directory"

_sync_empty_hooks_dir="$_CAIRN_TMPDIR/sync_hooks_empty_$$"
mkdir -p "$_sync_empty_hooks_dir/.cairn/domains" "$_sync_empty_hooks_dir/.cairn/history" "$_sync_empty_hooks_dir/.cairn/staged"
{
    echo "## stage"
    echo ""
    echo "phase: test"
    echo ""
    echo "## no-go"
    echo ""
    echo "## hooks"
    echo ""
    echo "## stack"
    echo ""
    echo "## debt"
    echo ""
} > "$_sync_empty_hooks_dir/.cairn/output.md"

_hooks_empty_file="$_CAIRN_TMPDIR/sync_hooks_empty_out_$$.txt"
_hooks_empty_exit=0
(cd "$_sync_empty_hooks_dir" && bash "$_CAIRN_BIN" sync --hooks 2>&1) > "$_hooks_empty_file" || _hooks_empty_exit=$?
assert_exit_code "empty domains exits 0" 0 "$_hooks_empty_exit"
assert_contains "empty domains hint shown" "$_hooks_empty_file" "nothing to generate|No domain files"
