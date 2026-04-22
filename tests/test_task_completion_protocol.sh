#!/usr/bin/env bash
# Task Completion Protocol conformance tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, _CAIRN_TMPDIR to be set.
#
# Asserts that:
#   A. skills/claude-code/SKILL.md contains the required Cairn reflection block template
#      and the hardened Rule statement.
#   B. spec/TASK-COMPLETION-PROTOCOL.md exists and contains the three result enum values
#      and the protocol-violations section.
#   C. spec/FORMAT.md cross-references TASK-COMPLETION-PROTOCOL.md.
#   D. scripts/cairn-init.sh guide block references "Cairn reflection".
#   E. README.md and README.zh.md have a task-completion protocol subsection.

_SKILL_FILE="$REPO_ROOT/skills/claude-code/SKILL.md"
_PROTOCOL_FILE="$REPO_ROOT/spec/TASK-COMPLETION-PROTOCOL.md"
_PROTOCOL_ZH_FILE="$REPO_ROOT/spec/TASK-COMPLETION-PROTOCOL.zh.md"
_FORMAT_FILE="$REPO_ROOT/spec/FORMAT.md"
_INIT_SCRIPT="$REPO_ROOT/scripts/cairn-init.sh"

# =============================================================================
# A. SKILL.md reflection block contract
# =============================================================================

start_suite "Task Completion Protocol — SKILL.md reflection block"

assert_contains "SKILL.md: has Rule hardening statement" \
    "$_SKILL_FILE" "No task is complete until"

assert_contains "SKILL.md: has Cairn reflection header" \
    "$_SKILL_FILE" "Cairn reflection"

assert_contains "SKILL.md: has Task completion summary header" \
    "$_SKILL_FILE" "Task completion summary"

assert_contains "SKILL.md: reflection result no-op present" \
    "$_SKILL_FILE" "no-op"

assert_contains "SKILL.md: reflection result memory-updated present" \
    "$_SKILL_FILE" "memory-updated"

assert_contains "SKILL.md: reflection result audit-required present" \
    "$_SKILL_FILE" "audit-required"

assert_contains "SKILL.md: has REFLECTION RESULTS quick-reference section" \
    "$_SKILL_FILE" "REFLECTION RESULTS"

# =============================================================================
# B. spec/TASK-COMPLETION-PROTOCOL.md existence and content
# =============================================================================

start_suite "Task Completion Protocol — spec document"

assert_file_exists "spec/TASK-COMPLETION-PROTOCOL.md exists" "$_PROTOCOL_FILE"
assert_file_exists "spec/TASK-COMPLETION-PROTOCOL.zh.md exists" "$_PROTOCOL_ZH_FILE"

assert_contains "protocol spec: has no-op result" \
    "$_PROTOCOL_FILE" "no-op"

assert_contains "protocol spec: has memory-updated result" \
    "$_PROTOCOL_FILE" "memory-updated"

assert_contains "protocol spec: has audit-required result" \
    "$_PROTOCOL_FILE" "audit-required"

assert_contains "protocol spec: has Protocol violations section" \
    "$_PROTOCOL_FILE" "Protocol violations \(machine-detectable\)"

assert_contains "protocol spec: describes missing-write-back signal" \
    "$_PROTOCOL_FILE" "missing-write-back"

assert_contains "protocol spec: describes missing-output-follow-up signal" \
    "$_PROTOCOL_FILE" "missing-output-follow-up"

assert_contains "protocol spec: describes missing-audit-flag signal" \
    "$_PROTOCOL_FILE" "missing-audit-flag"

assert_contains "protocol spec zh: has reflection result enum" \
    "$_PROTOCOL_ZH_FILE" "memory-updated"

# =============================================================================
# C. spec/FORMAT.md cross-reference
# =============================================================================

start_suite "Task Completion Protocol — FORMAT.md cross-reference"

assert_contains "FORMAT.md: references TASK-COMPLETION-PROTOCOL.md" \
    "$_FORMAT_FILE" "TASK-COMPLETION-PROTOCOL.md"

# =============================================================================
# D. guide block in cairn-init.sh
# =============================================================================

start_suite "Task Completion Protocol — guide block sync"

assert_contains "cairn-init.sh guide block: references Cairn reflection" \
    "$_INIT_SCRIPT" "Cairn reflection"

# =============================================================================
# E. README mentions task completion protocol
# =============================================================================

start_suite "Task Completion Protocol — README coverage"

assert_contains "README.md: has task completion protocol subsection" \
    "$REPO_ROOT/README.md" "Task completion protocol"

assert_contains "README.zh.md: has task completion protocol subsection" \
    "$REPO_ROOT/README.zh.md" "任务完成协议"
