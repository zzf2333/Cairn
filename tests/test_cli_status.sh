#!/usr/bin/env bash
# cairn status tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn status output against controlled .cairn/ fixtures.

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# Helper: create a minimal .cairn/ fixture in a temp directory.
# $1 = destination directory (must already exist)
# $2 = phase string (e.g., "early-growth (2024-09+)")
# $3 = domain list (space-separated, e.g., "api-layer auth")
_create_status_fixture() {
    local dir="$1" phase="$2"
    shift 2
    local domains=("$@")

    mkdir -p "$dir/.cairn/domains" "$dir/.cairn/history"

    # Build output.md
    {
        echo "## stage"
        echo ""
        echo "phase: ${phase}"
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

# Helper: create a domain file with frontmatter.
# $1 = dir, $2 = domain name, $3 = updated (YYYY-MM), $4 = status
_create_domain_file() {
    local dir="$1" domain="$2" updated="$3" status="${4:-stable}"
    {
        echo "---"
        echo "domain: ${domain}"
        echo "hooks: [\"${domain}\"]"
        echo "updated: ${updated}"
        echo "status: ${status}"
        echo "---"
        echo ""
        echo "# ${domain}"
        echo ""
        echo "## current design"
        echo "Test domain."
        echo ""
        echo "## trajectory"
        echo "${updated} Initial state"
        echo ""
        echo "## rejected paths"
        echo "- none yet"
        echo "  Re-evaluate when: never"
        echo ""
        echo "## known pitfalls"
        echo ""
        echo "## open questions"
        echo ""
    } > "$dir/.cairn/domains/${domain}.md"
}

# Helper: create a history entry file.
# $1 = dir, $2 = filename (e.g., 2024-05_foo.md), $3 = domain, $4 = recorded_date
_create_history_entry() {
    local dir="$1" filename="$2" domain="$3" recorded_date="$4"
    {
        echo "type: decision"
        echo "domain: ${domain}"
        echo "decision_date: ${recorded_date}"
        echo "recorded_date: ${recorded_date}"
        echo "summary: Test entry for ${domain}"
        echo "rejected: nothing"
        echo "reason: test"
        echo "revisit_when: never"
    } > "$dir/.cairn/history/${filename}"
}

# =============================================================================
# Stage extraction
# =============================================================================

start_suite "cairn status — Stage Extraction"

_st_dir="$_CAIRN_TMPDIR/status_stage_$$"
mkdir -p "$_st_dir"
_create_status_fixture "$_st_dir" "test-phase (2024-06+)" "api-layer"

_st_output="$(cd "$_st_dir" && bash "$_CAIRN_BIN" status 2>&1)"
_st_tmp="$_CAIRN_TMPDIR/status_stage_out.txt"
echo "$_st_output" > "$_st_tmp"

assert_contains "status shows stage phase"  "$_st_tmp" "test-phase \(2024-06\+\)"
assert_contains "status shows domains line" "$_st_tmp" "domains:"
assert_contains "status shows history line" "$_st_tmp" "history:"

# =============================================================================
# Up-to-date domain
# =============================================================================

start_suite "cairn status — Up-to-date Domain"

_utd_dir="$_CAIRN_TMPDIR/status_utd_$$"
mkdir -p "$_utd_dir"
_create_status_fixture "$_utd_dir" "growth (2024-01+)" "auth"
_create_domain_file   "$_utd_dir" "auth" "2024-05"
# History entry recorded BEFORE domain updated date → not stale
_create_history_entry "$_utd_dir" "2024-02_auth-decision.md" "auth" "2024-02"

_utd_output="$(cd "$_utd_dir" && bash "$_CAIRN_BIN" status 2>&1)"
_utd_tmp="$_CAIRN_TMPDIR/status_utd_out.txt"
echo "$_utd_output" > "$_utd_tmp"

assert_contains     "up-to-date domain shows ✓"    "$_utd_tmp" "✓"
assert_contains     "up-to-date domain shows date"  "$_utd_tmp" "2024-05"
assert_not_contains "up-to-date domain has no ⚠"   "$_utd_tmp" "⚠"
assert_not_contains "up-to-date has no cairn sync"  "$_utd_tmp" "cairn sync"

# =============================================================================
# Stale domain
# =============================================================================

start_suite "cairn status — Stale Domain"

_stale_dir="$_CAIRN_TMPDIR/status_stale_$$"
mkdir -p "$_stale_dir"
_create_status_fixture "$_stale_dir" "growth (2024-01+)" "api-layer"
_create_domain_file   "$_stale_dir" "api-layer" "2024-03"
# Two history entries recorded AFTER domain updated date → stale
_create_history_entry "$_stale_dir" "2024-06_api-change.md" "api-layer" "2024-06"
_create_history_entry "$_stale_dir" "2024-08_api-change2.md" "api-layer" "2024-08"

_stale_output="$(cd "$_stale_dir" && bash "$_CAIRN_BIN" status 2>&1)"
_stale_tmp="$_CAIRN_TMPDIR/status_stale_out.txt"
echo "$_stale_output" > "$_stale_tmp"

assert_contains     "stale domain shows ⚠"           "$_stale_tmp" "⚠"
assert_contains     "stale domain shows last updated" "$_stale_tmp" "last updated 2024-03"
assert_contains     "stale domain shows 2 new entries" "$_stale_tmp" "2 new history entries"
assert_contains     "stale domain shows cairn sync"   "$_stale_tmp" "cairn sync api-layer"
assert_not_contains "stale domain has no ✓"           "$_stale_tmp" "✓"

# =============================================================================
# Domain not yet created
# =============================================================================

start_suite "cairn status — Domain Not Yet Created"

_nc_dir="$_CAIRN_TMPDIR/status_nc_$$"
mkdir -p "$_nc_dir"
_create_status_fixture "$_nc_dir" "early (2024-01+)" "database"
# No domain file created, no history for database

_nc_output="$(cd "$_nc_dir" && bash "$_CAIRN_BIN" status 2>&1)"
_nc_tmp="$_CAIRN_TMPDIR/status_nc_out.txt"
echo "$_nc_output" > "$_nc_tmp"

assert_contains     "not-created domain shows ·"       "$_nc_tmp" "·"
assert_contains     "not-created domain shows message" "$_nc_tmp" "not yet created"
assert_not_contains "not-created has no ✓"             "$_nc_tmp" "✓"
assert_not_contains "not-created has no ⚠"             "$_nc_tmp" "⚠"

# =============================================================================
# Domain file without frontmatter
# =============================================================================

start_suite "cairn status — Domain Without Frontmatter (graceful)"

_nofm_dir="$_CAIRN_TMPDIR/status_nofm_$$"
mkdir -p "$_nofm_dir/.cairn/domains" "$_nofm_dir/.cairn/history"
_create_status_fixture "$_nofm_dir" "early (2024-01+)" "legacy"
# Domain file without frontmatter
{
    echo "# legacy"
    echo ""
    echo "## current design"
    echo "Old domain, no frontmatter."
} > "$_nofm_dir/.cairn/domains/legacy.md"

_nofm_output="$(cd "$_nofm_dir" && bash "$_CAIRN_BIN" status 2>&1)"
_nofm_tmp="$_CAIRN_TMPDIR/status_nofm_out.txt"
echo "$_nofm_output" > "$_nofm_tmp"

# Must not crash; must show graceful "no updated date" message
_nofm_exit=0
(cd "$_nofm_dir" && bash "$_CAIRN_BIN" status 2>/dev/null) || _nofm_exit=$?
assert_exit_code "status exits 0 even without domain frontmatter" 0 "$_nofm_exit"
assert_contains  "status notes missing updated date" "$_nofm_tmp" "no updated date"

# =============================================================================
# History count
# =============================================================================

start_suite "cairn status — History Entry Count"

_hc_dir="$_CAIRN_TMPDIR/status_hc_$$"
mkdir -p "$_hc_dir"
_create_status_fixture "$_hc_dir" "growth (2024-01+)" "auth"
_create_domain_file   "$_hc_dir" "auth" "2024-01"
_create_history_entry "$_hc_dir" "2024-02_a.md" "auth" "2024-02"
_create_history_entry "$_hc_dir" "2024-03_b.md" "auth" "2024-03"
_create_history_entry "$_hc_dir" "2024-04_c.md" "auth" "2024-04"
# _TEMPLATE.md should NOT be counted
echo "# template placeholder" > "$_hc_dir/.cairn/history/_TEMPLATE.md"

_hc_output="$(cd "$_hc_dir" && bash "$_CAIRN_BIN" status 2>&1)"
_hc_tmp="$_CAIRN_TMPDIR/status_hc_out.txt"
echo "$_hc_output" > "$_hc_tmp"

assert_contains     "history count shows 3 entries" "$_hc_tmp" "history: 3 entries total"
assert_not_contains "TEMPLATE not counted"          "$_hc_tmp" "4 entries"

# =============================================================================
# Example project smoke test
# =============================================================================

start_suite "cairn status — Example Project Smoke Test"

_ex_output="$(cd "$REPO_ROOT/examples/saas-18mo" && bash "$_CAIRN_BIN" status 2>&1)"
_ex_tmp="$_CAIRN_TMPDIR/status_example_out.txt"
echo "$_ex_output" > "$_ex_tmp"
_ex_exit=0
(cd "$REPO_ROOT/examples/saas-18mo" && bash "$_CAIRN_BIN" status 2>/dev/null) || _ex_exit=$?

assert_exit_code    "status exits 0 on example project"   0 "$_ex_exit"
assert_contains     "example shows stage phase"   "$_ex_tmp" "early-growth"
assert_contains     "example lists api-layer"     "$_ex_tmp" "api-layer"
assert_contains     "example lists auth"          "$_ex_tmp" "auth"
assert_contains     "example lists state-mgmt"    "$_ex_tmp" "state-management"
assert_contains     "example shows database not created" "$_ex_tmp" "not yet created"
assert_contains     "example shows history count" "$_ex_tmp" "history:"
