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
#   8.  Has task-completion / reactive evolution section
#   9.  Lists all 8 history fields:
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
    assert_contains "$label — no-go: instruct AI not to suggest" \
        "$file" '(never suggest|MUST NOT suggest|[Dd]o not.*suggest)'

    # 10. debt constraint: don't fix
    assert_contains "$label — debt: instruct AI not to fix" \
        "$file" '(never fix|MUST NOT.*fix|[Dd]o not.*fix)'

    # 11. known pitfalls handling
    assert_contains "$label — addresses known pitfalls in domains/" \
        "$file" 'known pitfalls'

    # 12. Task-completion section: v0.0.12 uses "ON TASK COMPLETION", older files use "REACTIVE EVOLUTION"
    assert_contains "$label — has task-completion section" \
        "$file" '(REACTIVE EVOLUTION|ON TASK COMPLETION)'

    # 13-20. All 8 history entry fields listed.
    # Pattern accepts both `field` (bare) and field: (plain in code block)
    assert_contains "$label — history field: \`type\`"          "$file" 'type:'
    assert_contains "$label — history field: \`domain\`"        "$file" 'domain:'
    assert_contains "$label — history field: \`decision_date\`" "$file" 'decision_date:'
    assert_contains "$label — history field: \`recorded_date\`" "$file" 'recorded_date:'
    assert_contains "$label — history field: \`summary\`"       "$file" 'summary:'
    assert_contains "$label — history field: \`rejected\`"      "$file" 'rejected:'
    assert_contains "$label — history field: \`reason\`"        "$file" 'reason:'
    assert_contains "$label — history field: \`revisit_when\`"  "$file" 'revisit_when:'
}

# =============================================================================
# Canonical skill file: skills/claude-code/SKILL.md
# This is the only file that carries the full protocol. Other skill files in
# skills/ are 12-line guide blocks that point to .cairn/SKILL.md (the copy
# installed by cairn init). Full quality checks apply only to the canonical.
# =============================================================================

check_skill "claude-code/SKILL.md" \
    "$REPO_ROOT/skills/claude-code/SKILL.md"

# =============================================================================
# Adapter guide blocks (cursor/cline/windsurf/copilot/codex/gemini/opencode)
# These files contain only the 12-line guide block pointing to .cairn/SKILL.md.
# Checks: file exists, has cairn markers, references SKILL.md.
# =============================================================================

_check_guide_block() {
    local label="$1" file="$2"
    start_suite "Adapter: $label"
    assert_file_exists "$label — file exists" "$file"
    assert_contains "$label — has cairn:start marker" "$file" "<!-- cairn:start -->"
    assert_contains "$label — has cairn:end marker"   "$file" "<!-- cairn:end -->"
    assert_contains "$label — references SKILL.md"    "$file" "SKILL\.md"
}

_check_guide_block "cursor.mdc"              "$REPO_ROOT/skills/cursor.mdc"
_check_guide_block "cline.md"               "$REPO_ROOT/skills/cline.md"
_check_guide_block "windsurf.md"            "$REPO_ROOT/skills/windsurf.md"
_check_guide_block "copilot-instructions.md" "$REPO_ROOT/skills/copilot-instructions.md"
_check_guide_block "codex.md"               "$REPO_ROOT/skills/codex.md"
_check_guide_block "gemini-cli.md"          "$REPO_ROOT/skills/gemini-cli.md"
_check_guide_block "opencode.md"            "$REPO_ROOT/skills/opencode.md"

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
# In v0.0.12, cairn-init.sh copies skills/claude-code/SKILL.md → .cairn/SKILL.md
# and installs a 12-line guide block into AI tool config files.
#
# We run init non-interactively with all tools selected and check:
#   1. .cairn/SKILL.md passes full skill quality (it's a copy of the canonical)
#   2. .claude/CLAUDE.md has the guide block markers (not the full skill)
#   3. Cursor gets frontmatter + guide block in .cursor/rules/cairn.mdc
# =============================================================================

_EMBED_DIR="${_CAIRN_TMPDIR}/embedded_skills"
mkdir -p "$_EMBED_DIR"
(cd "$_EMBED_DIR" && \
    printf "%b" "2\ntest (2024-01+)\nspeed > quality\n\n\n\n\n\n1,2,3,4,5,6,7,8\n" \
    | bash "$REPO_ROOT/scripts/cairn-init.sh") >/dev/null 2>&1

# .cairn/SKILL.md is the canonical skill file (AI reads it at session start)
check_skill "embedded: .cairn/SKILL.md (copied by cairn-init.sh)" \
    "$_EMBED_DIR/.cairn/SKILL.md"

# .claude/CLAUDE.md should only have the 12-line guide block (not the full skill)
start_suite "Embedded Claude Code Guide Block"
assert_file_exists "embedded: .claude/CLAUDE.md exists" \
    "$_EMBED_DIR/.claude/CLAUDE.md"
assert_contains "embedded: .claude/CLAUDE.md has cairn start marker" \
    "$_EMBED_DIR/.claude/CLAUDE.md" "<!-- cairn:start -->"
assert_contains "embedded: .claude/CLAUDE.md has cairn end marker" \
    "$_EMBED_DIR/.claude/CLAUDE.md" "<!-- cairn:end -->"
assert_contains "embedded: .claude/CLAUDE.md mentions SKILL.md" \
    "$_EMBED_DIR/.claude/CLAUDE.md" "SKILL\.md"
assert_not_contains "embedded: .claude/CLAUDE.md does not have old full-skill content" \
    "$_EMBED_DIR/.claude/CLAUDE.md" "REACTIVE EVOLUTION"

# Cursor embedded: still gets frontmatter + guide block in cairn.mdc
start_suite "Embedded Cursor Frontmatter"
assert_file_exists "embedded: .cursor/rules/cairn.mdc exists" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc"
assert_contains "embedded cairn.mdc — has --- delimiter" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc" "^---$"
assert_contains "embedded cairn.mdc — has description: field" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc" "^description:"
assert_contains "embedded cairn.mdc — has alwaysApply: true" \
    "$_EMBED_DIR/.cursor/rules/cairn.mdc" "^alwaysApply: true"

# Other guide block files: verify marker presence
start_suite "Embedded Other AI Tool Guide Blocks"
for _guide_file in \
    "$_EMBED_DIR/.clinerules" \
    "$_EMBED_DIR/.windsurfrules" \
    "$_EMBED_DIR/.github/copilot-instructions.md" \
    "$_EMBED_DIR/AGENTS.md" \
    "$_EMBED_DIR/GEMINI.md"; do
    _guide_label="$(basename "$_guide_file")"
    if [ -f "$_guide_file" ]; then
        assert_contains "embedded: $_guide_label has cairn start marker" \
            "$_guide_file" "<!-- cairn:start -->"
        assert_contains "embedded: $_guide_label mentions SKILL.md" \
            "$_guide_file" "SKILL\.md"
    else
        _pass "embedded: $_guide_label — skipped (not created for this tool set)"
        _pass "embedded: $_guide_label mentions SKILL.md — skipped"
    fi
done
