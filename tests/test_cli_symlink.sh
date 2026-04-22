#!/usr/bin/env bash
# CLI symlink invocation regression tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# These tests verify that invoking cairn via a symlink correctly resolves the
# script's real directory, allowing lang/*.sh and cmd/*.sh to be sourced.
# Regression guard for the BASH_SOURCE[0] symlink path-resolution fix in v0.0.7.

_CAIRN_REAL_BIN="$REPO_ROOT/cli/cairn"
_CAIRN_SYMLINK_DIR="$_CAIRN_TMPDIR/symlink_bin"
mkdir -p "$_CAIRN_SYMLINK_DIR"

# =============================================================================
# Single-level symlink
# =============================================================================

start_suite "CLI Symlink — Single-level symlink invocation"

_sym1="$_CAIRN_SYMLINK_DIR/cairn"
ln -sf "$_CAIRN_REAL_BIN" "$_sym1"

# version exits 0 via symlink
_sym1_ver_out="$(bash "$_sym1" version 2>&1)"
_sym1_ver_exit=$?
assert_exit_code "symlink: cairn version exits 0" 0 "$_sym1_ver_exit"

# version output contains N.N.N
_sym1_ver_tmp="$_CAIRN_TMPDIR/sym1_version.txt"
echo "$_sym1_ver_out" > "$_sym1_ver_tmp"
assert_contains "symlink: version output contains N.N.N" "$_sym1_ver_tmp" "[0-9]+\.[0-9]+\.[0-9]+"

# no 'No such file or directory' errors (lang/*.sh load failure signature)
assert_not_contains "symlink: no missing-file errors in version output" "$_sym1_ver_tmp" "No such file or directory"

# help exits 0 via symlink
_sym1_help_out="$(bash "$_sym1" help 2>&1)"
_sym1_help_exit=$?
assert_exit_code "symlink: cairn help exits 0" 0 "$_sym1_help_exit"

_sym1_help_tmp="$_CAIRN_TMPDIR/sym1_help.txt"
echo "$_sym1_help_out" > "$_sym1_help_tmp"
assert_contains "symlink: help output contains 'init'"   "$_sym1_help_tmp" "init"
assert_contains "symlink: help output contains 'doctor'" "$_sym1_help_tmp" "doctor"
assert_not_contains "symlink: no missing-file errors in help output" "$_sym1_help_tmp" "No such file or directory"

# =============================================================================
# Nested (double-level) symlink
# =============================================================================

start_suite "CLI Symlink — Nested symlink (symlink → symlink → real)"

_sym_mid="$_CAIRN_SYMLINK_DIR/cairn_mid"
_sym_outer="$_CAIRN_SYMLINK_DIR/cairn_outer"
ln -sf "$_CAIRN_REAL_BIN" "$_sym_mid"
ln -sf "$_sym_mid" "$_sym_outer"

_sym_nested_out="$(bash "$_sym_outer" version 2>&1)"
_sym_nested_exit=$?
assert_exit_code "nested symlink: cairn version exits 0" 0 "$_sym_nested_exit"

_sym_nested_tmp="$_CAIRN_TMPDIR/sym_nested_version.txt"
echo "$_sym_nested_out" > "$_sym_nested_tmp"
assert_contains "nested symlink: version output contains N.N.N" "$_sym_nested_tmp" "[0-9]+\.[0-9]+\.[0-9]+"
assert_not_contains "nested symlink: no missing-file errors" "$_sym_nested_tmp" "No such file or directory"

# =============================================================================
# Symlink in project with .cairn/ — subcommand dispatch works
# =============================================================================

start_suite "CLI Symlink — Subcommand dispatch via symlink"

# Reuse the example project fixture which already has .cairn/
_symlink_fixture_dir="$REPO_ROOT/examples/saas-18mo"

# cairn doctor requires .cairn/ — should succeed (not fail on missing lang file)
_sym_doctor_out="$(cd "$_symlink_fixture_dir" && bash "$_sym1" doctor 2>&1 || true)"
_sym_doctor_exit=0
(cd "$_symlink_fixture_dir" && bash "$_sym1" doctor 2>/dev/null) || _sym_doctor_exit=$?
# doctor may exit 1 if the example has issues — we just check no lang-load errors
_sym_doctor_tmp="$_CAIRN_TMPDIR/sym1_doctor.txt"
echo "$_sym_doctor_out" > "$_sym_doctor_tmp"
assert_not_contains "symlink: doctor output has no missing-file errors" "$_sym_doctor_tmp" "No such file or directory"

# Cleanup
rm -f "$_sym1" "$_sym_mid" "$_sym_outer"
rmdir "$_CAIRN_SYMLINK_DIR" 2>/dev/null || true
