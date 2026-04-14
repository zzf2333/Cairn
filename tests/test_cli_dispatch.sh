#!/usr/bin/env bash
# CLI dispatcher tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests:
#   - cairn --help / help exits 0 and prints usage
#   - cairn --version / version exits 0 and prints version string
#   - cairn <unknown-command> exits non-zero
#   - Commands requiring .cairn/ exit non-zero when run outside a Cairn project

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Help and version
# =============================================================================

start_suite "CLI Dispatch — Help and Version"

# cairn help exits 0
_help_output="$(bash "$_CAIRN_BIN" help 2>&1)"
_help_exit=$?
assert_exit_code "cairn help exits 0" 0 "$_help_exit"

# cairn --help exits 0
_help_output2="$(bash "$_CAIRN_BIN" --help 2>&1)"
_help_exit2=$?
assert_exit_code "cairn --help exits 0" 0 "$_help_exit2"

# cairn (no args) exits 0 and shows help
_noarg_output="$(bash "$_CAIRN_BIN" 2>&1)"
_noarg_exit=$?
assert_exit_code "cairn (no args) exits 0" 0 "$_noarg_exit"

# help output contains command names
_help_tmp="$_CAIRN_TMPDIR/help_output.txt"
echo "$_help_output" > "$_help_tmp"
assert_contains "help mentions init command"   "$_help_tmp" "init"
assert_contains "help mentions status command" "$_help_tmp" "status"
assert_contains "help mentions log command"    "$_help_tmp" "log"
assert_contains "help mentions sync command"   "$_help_tmp" "sync"

# cairn version exits 0
_ver_output="$(bash "$_CAIRN_BIN" version 2>&1)"
_ver_exit=$?
assert_exit_code "cairn version exits 0" 0 "$_ver_exit"

# cairn --version exits 0
_ver_output2="$(bash "$_CAIRN_BIN" --version 2>&1)"
_ver_exit2=$?
assert_exit_code "cairn --version exits 0" 0 "$_ver_exit2"

# version output contains a version string (N.N.N)
_ver_tmp="$_CAIRN_TMPDIR/version_output.txt"
echo "$_ver_output" > "$_ver_tmp"
assert_contains "version output matches N.N.N format" "$_ver_tmp" "[0-9]+\.[0-9]+\.[0-9]+"

# =============================================================================
# Unknown command
# =============================================================================

start_suite "CLI Dispatch — Unknown Command"

_unk_exit=0
bash "$_CAIRN_BIN" foobar 2>/dev/null || _unk_exit=$?
assert_exit_code "cairn foobar exits non-zero" 1 "$_unk_exit"

_unk_exit2=0
bash "$_CAIRN_BIN" notacommand 2>/dev/null || _unk_exit2=$?
assert_exit_code "cairn notacommand exits non-zero" 1 "$_unk_exit2"

# =============================================================================
# Commands requiring .cairn/ — run from non-Cairn directory
# =============================================================================

start_suite "CLI Dispatch — Requires .cairn/ (run from non-project dir)"

# Create a temp dir with no .cairn/
_no_cairn_dir="$_CAIRN_TMPDIR/no_cairn_$$"
mkdir -p "$_no_cairn_dir"

# cairn status outside a Cairn project exits non-zero
_status_exit=0
(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" status 2>/dev/null) || _status_exit=$?
assert_exit_code "cairn status without .cairn/ exits non-zero" 1 "$_status_exit"

# cairn log outside a Cairn project exits non-zero
_log_exit=0
(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" log --type decision --domain api-layer \
    --summary "test" --rejected "none" --reason "test" 2>/dev/null) || _log_exit=$?
assert_exit_code "cairn log without .cairn/ exits non-zero" 1 "$_log_exit"

# cairn sync outside a Cairn project exits non-zero
_sync_exit=0
(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" sync api-layer 2>/dev/null) || _sync_exit=$?
assert_exit_code "cairn sync without .cairn/ exits non-zero" 1 "$_sync_exit"

# cairn init does NOT require .cairn/ (it creates it)
# We just check it doesn't immediately error with "no .cairn/ found"
# (it may fail for other reasons, like missing init script — that's fine)
_init_err_output="$(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" init 2>&1 || true)"
_init_err_tmp="$_CAIRN_TMPDIR/init_err.txt"
echo "$_init_err_output" > "$_init_err_tmp"
assert_not_contains "cairn init does not complain about missing .cairn/" \
    "$_init_err_tmp" "no .cairn/ directory found"

# cairn doctor outside a Cairn project exits non-zero
_doctor_exit=0
(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _doctor_exit=$?
assert_exit_code "cairn doctor without .cairn/ exits non-zero" 1 "$_doctor_exit"

# cairn stage review outside a Cairn project exits non-zero
_stage_exit=0
(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" stage review 2>/dev/null) || _stage_exit=$?
assert_exit_code "cairn stage review without .cairn/ exits non-zero" 1 "$_stage_exit"

# =============================================================================
# Help output — new v0.0.3 commands appear
# =============================================================================

start_suite "CLI Dispatch — Help Mentions v0.0.3 Commands"

# Re-use the help output captured above
assert_contains "help mentions doctor command" "$_help_tmp" "doctor"
assert_contains "help mentions stage command"  "$_help_tmp" "stage"

# =============================================================================
# Stage subcommand — help/no-args exits 0
# =============================================================================

start_suite "CLI Dispatch — cairn stage (no args) Exits 0"

_stage_help_dir="$_CAIRN_TMPDIR/stage_help_dir_$$"
mkdir -p "$_stage_help_dir/.cairn"

_stage_noarg_exit=0
(cd "$_stage_help_dir" && bash "$_CAIRN_BIN" stage 2>/dev/null) || _stage_noarg_exit=$?
assert_exit_code "cairn stage (no args) exits 0" 0 "$_stage_noarg_exit"
