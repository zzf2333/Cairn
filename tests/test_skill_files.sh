#!/usr/bin/env bash
# Skill file best-practice tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, _CAIRN_TMPDIR to be set.
#
# Best-practice checklist (from spec/FORMAT.md and CLAUDE.md):
#   1.  Reads .cairn/output.md at session start
#   2.  Covers all 5 output.md sections (stage, no-go, hooks, stack, debt)
#   3.  Instructs domain file injection on planning tasks
#   4.  Instructs history file access on precise queries
#   5.  no-go constraint: do not suggest
#   6.  debt constraint: do not fix
#   7.  known pitfalls: avoid trigger conditions
#   8.  Has REACTIVE EVOLUTION section
#   9.  Reactive evolution lists all 8 history fields:
#       type, domain, decision_date, recorded_date, summary, rejected, reason, revisit_when

# Run quality checks against a single skill file.
# $1 = human-readable label, $2 = absolute path to skill file
check_skill() {
    local label="$1" file="$2"

    start_suite "Skill: $label"

    assert_file_exists "$label — file exists" "$file"

    # 1. Session start: reads .cairn/output.md
    assert_contains "$label — reads .cairn/output.md at session start" \
        "$file" '\.cairn/output\.md'

    # 2-6. All 5 output.md sections explained
    assert_contains "$label — explains \`## stage\` section" \
        "$file" '`## stage`'
    assert_contains "$label — explains \`## no-go\` section" \
        "$file" '`## no-go`'
    assert_contains "$label — explains \`## hooks\` section" \
        "$file" '`## hooks`'
    assert_contains "$label — explains \`## stack\` section" \
        "$file" '`## stack`'
    assert_contains "$label — explains \`## debt\` section" \
        "$file" '`## debt`'

    # 7. Domain injection on planning tasks
    assert_contains "$label — instructs domain file injection on planning" \
        "$file" 'domains/.*\.md'

    # 8. History file access
    assert_contains "$label — instructs history file access" \
        "$file" 'history/'

    # 9. no-go constraint: don't suggest
    # Accepts: "Do not suggest", "never suggest", "MUST NOT suggest" (all semantically equivalent)
    assert_contains "$label — no-go: instruct AI not to suggest" \
        "$file" '(never suggest|MUST NOT suggest|[Dd]o not.*suggest)'

    # 10. debt constraint: don't fix
    # Accepts: "Do not attempt to fix", "never fix", "MUST NOT fix/attempt" (all semantically equivalent)
    assert_contains "$label — debt: instruct AI not to fix" \
        "$file" '(never fix|MUST NOT.*fix|[Dd]o not.*fix)'

    # 11. known pitfalls handling
    assert_contains "$label — addresses known pitfalls in domains/" \
        "$file" 'known pitfalls'

    # 12. Reactive evolution section present
    assert_contains "$label — has REACTIVE EVOLUTION section" \
        "$file" 'REACTIVE EVOLUTION'

    # 13-20. All 8 history entry fields listed (backtick-quoted as per spec)
    assert_contains "$label — history field: \`type\`"          "$file" '`type`'
    assert_contains "$label — history field: \`domain\`"        "$file" '`domain`'
    assert_contains "$label — history field: \`decision_date\`" "$file" '`decision_date`'
    assert_contains "$label — history field: \`recorded_date\`" "$file" '`recorded_date`'
    assert_contains "$label — history field: \`summary\`"       "$file" '`summary`'
    assert_contains "$label — history field: \`rejected\`"      "$file" '`rejected`'
    assert_contains "$label — history field: \`reason\`"        "$file" '`reason`'
    assert_contains "$label — history field: \`revisit_when\`"  "$file" '`revisit_when`'
}

# =============================================================================
# Canonical skill files in skills/
# =============================================================================

check_skill "claude-code/SKILL.md" \
    "$REPO_ROOT/skills/claude-code/SKILL.md"

check_skill "cursor.mdc" \
    "$REPO_ROOT/skills/cursor.mdc"

check_skill "cline.md" \
    "$REPO_ROOT/skills/cline.md"

check_skill "windsurf.md" \
    "$REPO_ROOT/skills/windsurf.md"

check_skill "copilot-instructions.md" \
    "$REPO_ROOT/skills/copilot-instructions.md"

check_skill "codex.md" \
    "$REPO_ROOT/skills/codex.md"

check_skill "gemini-cli.md" \
    "$REPO_ROOT/skills/gemini-cli.md"

check_skill "opencode.md" \
    "$REPO_ROOT/skills/opencode.md"

# =============================================================================
# Cursor-specific: YAML frontmatter requirements
# The .mdc format requires description + alwaysApply to enable auto-injection
# =============================================================================

start_suite "Cursor Frontmatter (MDC format requirements)"
assert_contains "cursor.mdc — has --- frontmatter delimiter" \
    "$REPO_ROOT/skills/cursor.mdc" "^---$"
assert_contains "cursor.mdc — has description: field" \
    "$REPO_ROOT/skills/cursor.mdc" "^description:"
assert_contains "cursor.mdc — has alwaysApply: true" \
    "$REPO_ROOT/skills/cursor.mdc" "^alwaysApply: true"
assert_contains "cursor.mdc — description mentions cairn" \
    "$REPO_ROOT/skills/cursor.mdc" "description:.*[Cc]airn"

# =============================================================================
# Embedded skills: verify cairn-init.sh installs quality-compliant content
#
# cairn-init.sh embeds its own copies of skill content. These embedded versions
# should also pass all quality criteria. Any failures here indicate a drift
# between the embedded content and the canonical files in skills/.
#
# We install all tools in one run (tool input "1,2,3,4,5,6,7,8")
# =============================================================================

_EMBED_DIR="${_CAIRN_TMPDIR}/embedded_skills"
mkdir -p "$_EMBED_DIR"
(cd "$_EMBED_DIR" && \
    printf "%b" "2\ntest (2024-01+)\nspeed > quality\n\n\n\n\n\n1,2,3,4,5,6,7,8\n" \
    | bash "$REPO_ROOT/scripts/cairn-init.sh") >/dev/null 2>&1

check_skill "embedded: Claude Code (SKILL_CLAUDE_CODE in cairn-init.sh)" \
    "$_EMBED_DIR/.claude/skills/cairn/SKILL.md"

check_skill "embedded: Cursor (SKILL_CURSOR in cairn-init.sh)" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc"

check_skill "embedded: Cline (SKILL_GENERIC → .clinerules)" \
    "$_EMBED_DIR/.clinerules"

check_skill "embedded: Windsurf (SKILL_GENERIC → .windsurfrules)" \
    "$_EMBED_DIR/.windsurfrules"

check_skill "embedded: Copilot (SKILL_GENERIC → copilot-instructions.md)" \
    "$_EMBED_DIR/.github/copilot-instructions.md"

check_skill "embedded: Codex/OpenCode (SKILL_AGENTS → AGENTS.md)" \
    "$_EMBED_DIR/AGENTS.md"

check_skill "embedded: Gemini CLI (SKILL_GEMINI → GEMINI.md)" \
    "$_EMBED_DIR/GEMINI.md"

# Cursor-specific frontmatter check for embedded version
start_suite "Embedded Cursor Frontmatter"
assert_contains "embedded cairn.mdc — has --- delimiter" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc" "^---$"
assert_contains "embedded cairn.mdc — has description: field" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc" "^description:"
assert_contains "embedded cairn.mdc — has alwaysApply: true" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc" "^alwaysApply: true"
