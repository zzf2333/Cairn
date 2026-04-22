#!/usr/bin/env bash
# Skill protocol CLI-ceremony regression tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, _CAIRN_TMPDIR to be set.
#
# Asserts that skills/claude-code/SKILL.md does NOT reference any deleted CLI
# commands (cairn reflect / cairn stage / cairn audit / cairn log / cairn sync /
# cairn analyze / cairn status / cairn install-skill / cairn install-global).
#
# These tests prevent regression: if someone edits SKILL.md and accidentally
# re-introduces CLI ceremony, these tests will catch it.

_SKILL_FILE="$REPO_ROOT/skills/claude-code/SKILL.md"

start_suite "Skill Protocol — No CLI Ceremony"

assert_file_exists "skills/claude-code/SKILL.md exists" "$_SKILL_FILE"

assert_not_contains "SKILL.md: no 'cairn reflect'" \
    "$_SKILL_FILE" "cairn reflect"

assert_not_contains "SKILL.md: no 'cairn stage'" \
    "$_SKILL_FILE" "cairn stage"

assert_not_contains "SKILL.md: no 'cairn audit'" \
    "$_SKILL_FILE" "cairn audit"

assert_not_contains "SKILL.md: no 'cairn log'" \
    "$_SKILL_FILE" "cairn log"

assert_not_contains "SKILL.md: no 'cairn sync'" \
    "$_SKILL_FILE" "cairn sync"

assert_not_contains "SKILL.md: no 'cairn analyze'" \
    "$_SKILL_FILE" "cairn analyze"

assert_not_contains "SKILL.md: no 'cairn install-skill'" \
    "$_SKILL_FILE" "cairn install-skill"

assert_not_contains "SKILL.md: no 'cairn install-global'" \
    "$_SKILL_FILE" "cairn install-global"

assert_not_contains "SKILL.md: no 'cairn-reflection:' protocol line" \
    "$_SKILL_FILE" "cairn-reflection:"

assert_not_contains "SKILL.md: no reference to .cairn/staged/" \
    "$_SKILL_FILE" "\.cairn/staged"

start_suite "Skill Protocol — AI-Direct Write Model Present"

assert_contains "SKILL.md: has ON TASK COMPLETION section" \
    "$_SKILL_FILE" "ON TASK COMPLETION"

assert_contains "SKILL.md: has 'cairn: recorded' verification line format" \
    "$_SKILL_FILE" "cairn: recorded"

assert_contains "SKILL.md: has 'no event recorded' verification line format" \
    "$_SKILL_FILE" "no event recorded"

assert_contains "SKILL.md: instructs Write tool usage" \
    "$_SKILL_FILE" "Write"

assert_contains "SKILL.md: instructs Edit tool usage" \
    "$_SKILL_FILE" "Edit"

assert_contains "SKILL.md: has Cairn reflection block template" \
    "$_SKILL_FILE" "Cairn reflection"

assert_contains "SKILL.md: has audit-required enum value" \
    "$_SKILL_FILE" "audit-required"

assert_contains "SKILL.md: has memory-updated enum value" \
    "$_SKILL_FILE" "memory-updated"
