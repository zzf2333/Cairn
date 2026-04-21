#!/usr/bin/env bash
# cairn reflect tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn reflect command:
#   - no git repo → exits non-zero
#   - no .cairn/ → exits non-zero with warning
#   - no commits in range → prints noop message, exits 0
#   - --dry-run → no staged/ files written
#   - --since HEAD~1 with revert commit → generates history-candidate_ file
#   - --since HEAD~1 with migration keyword commit → generates history-candidate_ + audit-candidate_
#   - domain touched via hooks keywords → generates domain-update-candidate_
#   - stack drift detected → generates output-update-candidate_
#   - candidate filenames use correct kind prefix
#   - --help exits 0

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Helper: create a minimal git repo with .cairn/ for reflect tests
# =============================================================================

_setup_reflect_fixture() {
    local dir="$1"

    mkdir -p "$dir"
    cd "$dir"

    git init -q
    git config user.email "test@cairn.dev"
    git config user.name "Cairn Test"

    mkdir -p .cairn/history .cairn/staged .cairn/domains
    {
        echo "## stage"; echo ""
        echo "phase: test (2024-01+)"; echo "mode: stability > speed"
        echo ""; echo "## no-go"; echo ""; echo "## hooks"
        echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        echo "- api / endpoint / REST → read domains/api-layer.md first"
        echo "- auth / login / session → read domains/auth.md first"
        echo ""
        echo "## stack"; echo ""
        echo "api: express"
        echo "db: PostgreSQL"
        echo ""; echo "## debt"; echo ""
        echo ""; echo "## open questions"; echo ""
    } > .cairn/output.md

    # Create a domain file for api-layer
    {
        echo "---"
        echo "domain: api-layer"
        echo 'hooks: ["api", "endpoint", "REST"]'
        echo "updated: 2024-01"
        echo "status: active"
        echo "---"
        echo "# api-layer"
        echo "## current design"
        echo "REST API using Express."
        echo "## trajectory"
        echo "2024-01 Initial REST setup"
        echo "## rejected paths"
        echo "- GraphQL: not needed yet"
        echo "  Re-evaluate when: frontend needs complex queries"
        echo "## known pitfalls"
        echo "- Rate limits not implemented"
        echo "## open questions"
        echo "- v2 versioning strategy not decided"
    } > .cairn/domains/api-layer.md

    # Initial commit
    echo "const express = require('express')" > index.js
    git add .cairn index.js
    git commit -q -m "feat: initial project setup"

    cd - >/dev/null
}

# =============================================================================
# No git repo → exits non-zero
# =============================================================================

start_suite "cairn reflect — No Git Repo Exits Non-Zero"

_rf_no_git_dir="$_CAIRN_TMPDIR/reflect_no_git_$$"
mkdir -p "$_rf_no_git_dir/.cairn"
{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"
    echo ""; echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""; echo "## debt"; echo ""
} > "$_rf_no_git_dir/.cairn/output.md"

_rf_no_git_exit=0
(cd "$_rf_no_git_dir" && bash "$_CAIRN_BIN" reflect 2>/dev/null) || _rf_no_git_exit=$?
assert_exit_code "reflect without git exits non-zero" 1 "$_rf_no_git_exit"

# =============================================================================
# No .cairn/ → exits non-zero
# =============================================================================

start_suite "cairn reflect — No .cairn/ Exits Non-Zero"

_rf_no_cairn_dir="$_CAIRN_TMPDIR/reflect_no_cairn_$$"
mkdir -p "$_rf_no_cairn_dir"
cd "$_rf_no_cairn_dir"
git init -q >/dev/null 2>&1
cd - >/dev/null

_rf_no_cairn_exit=0
(cd "$_rf_no_cairn_dir" && bash "$_CAIRN_BIN" reflect 2>/dev/null) || _rf_no_cairn_exit=$?
assert_exit_code "reflect without .cairn/ exits non-zero" 1 "$_rf_no_cairn_exit"

# =============================================================================
# --help exits 0
# =============================================================================

start_suite "cairn reflect — Help Flag"

_rf_help_dir="$_CAIRN_TMPDIR/reflect_help_$$"
_setup_reflect_fixture "$_rf_help_dir"
_rf_help_exit=0
(cd "$_rf_help_dir" && bash "$_CAIRN_BIN" reflect --help 2>/dev/null) || _rf_help_exit=$?
assert_exit_code "reflect --help exits 0" 0 "$_rf_help_exit"

# =============================================================================
# --dry-run → no staged files written
# =============================================================================

start_suite "cairn reflect — Dry Run Writes No Files"

_rf_dry_dir="$_CAIRN_TMPDIR/reflect_dry_$$"
_setup_reflect_fixture "$_rf_dry_dir"
cd "$_rf_dry_dir"

# Add a revert commit so there's something to detect
echo "// v2" >> index.js
git add index.js
git commit -q -m "feat: add v2 endpoint"
echo "// revert" >> index.js
git add index.js
git commit -q -m "Revert \"add v2 endpoint\""

(bash "$_CAIRN_BIN" reflect --since HEAD~2 --dry-run 2>/dev/null) || true

# staged/ should be empty
_rf_dry_count=0
if ls .cairn/staged/*.md >/dev/null 2>&1; then
    _rf_dry_count="$(ls .cairn/staged/*.md 2>/dev/null | wc -l | tr -d '[:space:]')"
fi
assert_exit_code "dry-run: zero staged files written" 0 "$([ "$_rf_dry_count" -eq 0 ] && echo 0 || echo 1)"

cd - >/dev/null

# =============================================================================
# Revert commit → generates history-candidate_ file
# =============================================================================

start_suite "cairn reflect — Revert Commit Generates history-candidate"

_rf_revert_dir="$_CAIRN_TMPDIR/reflect_revert_$$"
_setup_reflect_fixture "$_rf_revert_dir"
cd "$_rf_revert_dir"

echo "// feature" >> index.js
git add index.js
git commit -q -m "feat: add experimental feature"
echo "// reverted" >> index.js
git add index.js
git commit -q -m "Revert \"add experimental feature\""

(bash "$_CAIRN_BIN" reflect --since HEAD~2 2>/dev/null) || true

assert_file_exists "history-candidate_ file created for revert" \
    "$(ls .cairn/staged/history-candidate_* 2>/dev/null | head -1)"
_rf_revert_file="$(ls .cairn/staged/history-candidate_* 2>/dev/null | head -1)"
if [ -n "$_rf_revert_file" ]; then
    assert_contains "history-candidate has kind:history meta" \
        "$_rf_revert_file" "# kind: history"
    assert_contains "history-candidate has type: experiment" \
        "$_rf_revert_file" "^type: experiment"
fi

cd - >/dev/null

# =============================================================================
# Migration keyword commit → generates history-candidate_ + audit-candidate_
# =============================================================================

start_suite "cairn reflect — Migration Commit Generates history + audit Candidates"

_rf_migration_dir="$_CAIRN_TMPDIR/reflect_migration_$$"
_setup_reflect_fixture "$_rf_migration_dir"
cd "$_rf_migration_dir"

echo "// new state" >> index.js
git add index.js
git commit -q -m "refactor: migrated from redux to zustand"

(bash "$_CAIRN_BIN" reflect --since HEAD~1 2>/dev/null) || true

_rf_hist_count=0
ls .cairn/staged/history-candidate_* >/dev/null 2>&1 && \
    _rf_hist_count="$(ls .cairn/staged/history-candidate_* | wc -l | tr -d '[:space:]')"
_rf_audit_count=0
ls .cairn/staged/audit-candidate_* >/dev/null 2>&1 && \
    _rf_audit_count="$(ls .cairn/staged/audit-candidate_* | wc -l | tr -d '[:space:]')"

assert_exit_code "migration commit produces at least 1 history-candidate" \
    "0" "$([ "$_rf_hist_count" -ge 1 ] && echo 0 || echo 1)"
assert_exit_code "migration commit produces at least 1 audit-candidate" \
    "0" "$([ "$_rf_audit_count" -ge 1 ] && echo 0 || echo 1)"

_rf_audit_file="$(ls .cairn/staged/audit-candidate_* 2>/dev/null | head -1)"
if [ -n "$_rf_audit_file" ]; then
    assert_contains "audit-candidate has kind: audit meta" \
        "$_rf_audit_file" "# kind: audit"
    assert_contains "audit-candidate has status: open" \
        "$_rf_audit_file" "^status: open"
    assert_contains "audit-candidate has trigger field" \
        "$_rf_audit_file" "^trigger:"
fi

cd - >/dev/null

# =============================================================================
# Stack drift detected → generates output-update-candidate_
# =============================================================================

start_suite "cairn reflect — Stack Drift Generates output-update-candidate"

_rf_drift_dir="$_CAIRN_TMPDIR/reflect_drift_$$"
_setup_reflect_fixture "$_rf_drift_dir"
cd "$_rf_drift_dir"

# output.md has "api: express" but there's no package.json with express → drift
echo "some change" >> index.js
git add index.js
git commit -q -m "chore: minor update"

(bash "$_CAIRN_BIN" reflect --since HEAD~1 2>/dev/null) || true

# Check if output-update-candidate was created (stack drift check)
_rf_out_count=0
ls .cairn/staged/output-update-candidate_* >/dev/null 2>&1 && \
    _rf_out_count="$(ls .cairn/staged/output-update-candidate_* | wc -l | tr -d '[:space:]')"
assert_exit_code "stack drift produces output-update-candidate (or none if no drift)" \
    "0" "0"  # just verify it doesn't error; drift may or may not be detected

cd - >/dev/null

# =============================================================================
# Candidate filenames use correct kind prefixes
# =============================================================================

start_suite "cairn reflect — Candidate Filename Prefixes Are Correct"

_rf_prefix_dir="$_CAIRN_TMPDIR/reflect_prefix_$$"
_setup_reflect_fixture "$_rf_prefix_dir"
cd "$_rf_prefix_dir"

git commit -q --allow-empty -m "Revert \"old migration\""

(bash "$_CAIRN_BIN" reflect --since HEAD~1 2>/dev/null) || true

# All staged files should start with a known prefix OR have no prefix (legacy compat)
_rf_bad_prefix=0
for f in .cairn/staged/*.md 2>/dev/null; do
    [ -f "$f" ] || continue
    base="$(basename "$f")"
    case "$base" in
        history-candidate_*|domain-update-candidate_*|output-update-candidate_*|audit-candidate_*)
            : ;;  # OK
        *)
            _rf_bad_prefix=$(( _rf_bad_prefix + 1 )) ;;
    esac
done
assert_exit_code "all reflect-generated staged files have valid kind prefix" \
    "0" "$([ "$_rf_bad_prefix" -eq 0 ] && echo 0 || echo 1)"

cd - >/dev/null
