#!/usr/bin/env bash
# First-user onboarding E2E.
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

start_suite "Onboarding E2E — Fresh Project Init to Doctor"

_ONBOARD_DIR="$_CAIRN_TMPDIR/onboarding_e2e_$$"
mkdir -p "$_ONBOARD_DIR"

(cd "$_ONBOARD_DIR" && git init -q && git config user.email "test@cairn" && git config user.name "Test")

_onboard_input="2
adoption-test (2026-04+)
stability > speed
1, solo




1
"

_onboard_init_out="$_CAIRN_TMPDIR/onboarding_init_out.txt"
_onboard_init_exit=0
(cd "$_ONBOARD_DIR" && printf "%s" "$_onboard_input" | bash "$_CAIRN_BIN" init) \
    > "$_onboard_init_out" 2>&1 || _onboard_init_exit=$?

assert_exit_code "onboarding init exits 0" 0 "$_onboard_init_exit"
assert_file_exists "onboarding: output.md created" "$_ONBOARD_DIR/.cairn/output.md"
assert_file_exists "onboarding: SKILL.md created" "$_ONBOARD_DIR/.cairn/SKILL.md"
assert_file_exists "onboarding: history template created" "$_ONBOARD_DIR/.cairn/history/_TEMPLATE.md"
assert_dir_exists "onboarding: domains directory created" "$_ONBOARD_DIR/.cairn/domains"
assert_file_exists "onboarding: Claude guide block created" "$_ONBOARD_DIR/.claude/CLAUDE.md"

assert_contains "onboarding output references api-layer" \
    "$_ONBOARD_DIR/.cairn/output.md" "domains/api-layer\.md"
assert_contains "onboarding SKILL has task completion protocol" \
    "$_ONBOARD_DIR/.cairn/SKILL.md" "ON TASK COMPLETION"
assert_contains "onboarding guide block points to SKILL.md" \
    "$_ONBOARD_DIR/.claude/CLAUDE.md" "\.cairn/SKILL\.md"

_onboard_doctor_out="$_CAIRN_TMPDIR/onboarding_doctor_out.txt"
_onboard_doctor_exit=0
(cd "$_ONBOARD_DIR" && bash "$_CAIRN_BIN" doctor) \
    > "$_onboard_doctor_out" 2>&1 || _onboard_doctor_exit=$?

assert_exit_code "onboarding doctor exits 0" 0 "$_onboard_doctor_exit"
assert_contains "onboarding doctor reports no issues" "$_onboard_doctor_out" "no issues found"

_onboard_json_out="$_CAIRN_TMPDIR/onboarding_doctor_json.txt"
(cd "$_ONBOARD_DIR" && bash "$_CAIRN_BIN" doctor --json) > "$_onboard_json_out" 2>/dev/null

assert_contains "onboarding doctor json has zero issues" "$_onboard_json_out" '"issues": 0'
assert_contains "onboarding doctor json guide ok" "$_onboard_json_out" '"skill_guide": "ok"'
assert_contains "onboarding doctor json skill ok" "$_onboard_json_out" '"skill_md": "ok"'
