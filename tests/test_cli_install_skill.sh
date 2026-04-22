#!/usr/bin/env bash
# cairn install-skill tests (v0.0.11)
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.

_CAIRN_BIN="$REPO_ROOT/cli/cairn"
_INIT_SCRIPT="$REPO_ROOT/scripts/cairn-init.sh"

# =============================================================================
# Helper: create a minimal .cairn/ project directory (no skill files)
# =============================================================================
_create_bare_cairn() {
    local dir="$1"
    mkdir -p "$dir/.cairn/history" "$dir/.cairn/domains"
    echo "## stage" > "$dir/.cairn/output.md"
}

# =============================================================================
# No .cairn/ → should exit 1 with error message
# =============================================================================

start_suite "cairn install-skill — No .cairn/ guard"

_is_no_cairn_dir="${_CAIRN_TMPDIR}/install_skill_no_cairn_$$"
mkdir -p "$_is_no_cairn_dir"

_is_no_cairn_exit=0
_is_no_cairn_out="$(cd "$_is_no_cairn_dir" && bash "$_CAIRN_BIN" install-skill claude-code 2>&1)" \
    || _is_no_cairn_exit=$?

assert_exit_code "exits 1 when no .cairn/ exists" 1 "$_is_no_cairn_exit"
assert_exit_code "output mentions cairn init" \
    "0" "$(echo "$_is_no_cairn_out" | grep -qi "cairn init" && echo 0 || echo 1)"

# =============================================================================
# --help flag exits 0
# =============================================================================

start_suite "cairn install-skill — Help flag"

_is_help_dir="${_CAIRN_TMPDIR}/install_skill_help_$$"
_create_bare_cairn "$_is_help_dir"

_is_help_exit=0
_is_help_out="$(cd "$_is_help_dir" && bash "$_CAIRN_BIN" install-skill --help 2>&1)" \
    || _is_help_exit=$?

assert_exit_code "install-skill --help exits 0" 0 "$_is_help_exit"
assert_exit_code "help output mentions claude-code" \
    "0" "$(echo "$_is_help_out" | grep -qi "claude-code" && echo 0 || echo 1)"

# =============================================================================
# Direct install: claude-code alias → writes .claude/CLAUDE.md
# =============================================================================

start_suite "cairn install-skill — Direct install (claude-code)"

_is_cc_dir="${_CAIRN_TMPDIR}/install_skill_claude_$$"
_create_bare_cairn "$_is_cc_dir"

_is_cc_exit=0
(cd "$_is_cc_dir" && bash "$_CAIRN_BIN" install-skill claude-code 2>/dev/null) \
    || _is_cc_exit=$?

assert_exit_code "install-skill claude-code exits 0"   0 "$_is_cc_exit"
assert_file_exists ".claude/CLAUDE.md created"         "$_is_cc_dir/.claude/CLAUDE.md"
assert_contains    "CLAUDE.md has cairn:start marker"  "$_is_cc_dir/.claude/CLAUDE.md" "cairn:start"

# =============================================================================
# Alias 'claude' also resolves to claude-code
# =============================================================================

start_suite "cairn install-skill — 'claude' alias resolves correctly"

_is_alias_dir="${_CAIRN_TMPDIR}/install_skill_alias_$$"
_create_bare_cairn "$_is_alias_dir"

(cd "$_is_alias_dir" && bash "$_CAIRN_BIN" install-skill claude 2>/dev/null) || true

assert_file_exists "claude alias: .claude/CLAUDE.md created" "$_is_alias_dir/.claude/CLAUDE.md"
assert_contains    "claude alias: marker present"            "$_is_alias_dir/.claude/CLAUDE.md" "cairn:start"

# =============================================================================
# Idempotency: running twice does NOT duplicate the block
# =============================================================================

start_suite "cairn install-skill — Idempotency (claude-code)"

_is_idem_dir="${_CAIRN_TMPDIR}/install_skill_idem_$$"
_create_bare_cairn "$_is_idem_dir"

(cd "$_is_idem_dir" && bash "$_CAIRN_BIN" install-skill claude-code 2>/dev/null) || true
(cd "$_is_idem_dir" && bash "$_CAIRN_BIN" install-skill claude-code 2>/dev/null) || true

# The marker should appear exactly once
assert_count "cairn:start appears exactly once (idempotent)" \
    "$_is_idem_dir/.claude/CLAUDE.md" "cairn:start" 1

# =============================================================================
# Old skill path migration (y: delete old directory)
# =============================================================================

start_suite "cairn install-skill — Old skill migration (accept delete)"

_is_migrate_dir="${_CAIRN_TMPDIR}/install_skill_migrate_$$"
_create_bare_cairn "$_is_migrate_dir"

# Simulate old v0.0.9 skill location
mkdir -p "$_is_migrate_dir/.claude/skills/cairn"
echo "old skill content" > "$_is_migrate_dir/.claude/skills/cairn/SKILL.md"

# Record mtime of output.md before install
_mtime_before="$(stat -f '%m' "$_is_migrate_dir/.cairn/output.md" 2>/dev/null \
    || stat -c '%Y' "$_is_migrate_dir/.cairn/output.md" 2>/dev/null || echo 0)"

# Answer 'y' to remove old files
(cd "$_is_migrate_dir" && printf "y\n" | bash "$_CAIRN_BIN" install-skill claude-code 2>/dev/null) || true

assert_file_exists "new .claude/CLAUDE.md created" \
    "$_is_migrate_dir/.claude/CLAUDE.md"
assert_file_not_exists "old .claude/skills/cairn/ removed" \
    "$_is_migrate_dir/.claude/skills/cairn/SKILL.md"
assert_contains "new CLAUDE.md has cairn block" \
    "$_is_migrate_dir/.claude/CLAUDE.md" "cairn:start"

# Data layer must not be touched
_mtime_after="$(stat -f '%m' "$_is_migrate_dir/.cairn/output.md" 2>/dev/null \
    || stat -c '%Y' "$_is_migrate_dir/.cairn/output.md" 2>/dev/null || echo 0)"
assert_exit_code "output.md mtime unchanged (data layer not touched)" \
    "0" "$([ "$_mtime_before" = "$_mtime_after" ] && echo 0 || echo 1)"

# =============================================================================
# Old skill path migration (n: keep old directory)
# =============================================================================

start_suite "cairn install-skill — Old skill migration (decline delete)"

_is_keep_dir="${_CAIRN_TMPDIR}/install_skill_keep_$$"
_create_bare_cairn "$_is_keep_dir"
mkdir -p "$_is_keep_dir/.claude/skills/cairn"
echo "old skill content" > "$_is_keep_dir/.claude/skills/cairn/SKILL.md"

# Answer 'n' to keep old files
(cd "$_is_keep_dir" && printf "n\n" | bash "$_CAIRN_BIN" install-skill claude-code 2>/dev/null) || true

assert_file_exists "new .claude/CLAUDE.md still created despite keeping old" \
    "$_is_keep_dir/.claude/CLAUDE.md"
assert_file_exists "old SKILL.md preserved when user says no" \
    "$_is_keep_dir/.claude/skills/cairn/SKILL.md"

# =============================================================================
# Unknown tool name → exits 1
# =============================================================================

start_suite "cairn install-skill — Unknown tool name"

_is_unknown_dir="${_CAIRN_TMPDIR}/install_skill_unknown_$$"
_create_bare_cairn "$_is_unknown_dir"

_is_unknown_exit=0
(cd "$_is_unknown_dir" && bash "$_CAIRN_BIN" install-skill notarealide 2>/dev/null) \
    || _is_unknown_exit=$?

assert_exit_code "unknown tool exits 1" 1 "$_is_unknown_exit"

# =============================================================================
# cairn install-skill appears in cairn help output
# =============================================================================

start_suite "cairn install-skill — Appears in help"

_is_help_out2="$(bash "$_CAIRN_BIN" help 2>/dev/null || bash "$_CAIRN_BIN" --help 2>/dev/null || true)"
assert_exit_code "help output mentions install-skill" \
    "0" "$(echo "$_is_help_out2" | grep -q "install-skill" && echo 0 || echo 1)"
