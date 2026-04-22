#!/usr/bin/env bash
# cairn-init.sh behavior tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, _CAIRN_TMPDIR to be set.

CAIRN_SCRIPT="$REPO_ROOT/scripts/cairn-init.sh"

# Run cairn-init.sh in a fresh subdirectory of _CAIRN_TMPDIR.
# $1 = scenario name, $2 = printf-format input string (use \n for newlines).
# Echoes the path to the scenario directory.
_run_init() {
    local name="$1" input="$2"
    local dir="${_CAIRN_TMPDIR}/${name}"
    mkdir -p "$dir"
    (cd "$dir" && printf "%b" "$input" | bash "$CAIRN_SCRIPT") >/dev/null 2>&1
    echo "$dir"
}

# =============================================================================
# Scenario A — Full init: api-layer(2) + auth(4), all fields, Claude Code skill
#
# Input sequence (13 reads):
#   1  domain selection        "2,4"
#   2  phase                   "early-growth (2024-01+)"
#   3  mode                    "stability > speed > elegance"
#   4  team                    "3, no-ops"
#   5  reject-if               "migration > 1 week"
#   6  no-go entry 1           "Redux (boilerplate at team-2)"
#   7  no-go end               ""
#   8  stack entry 1           "state: Zustand"
#   9  stack entry 2           "api: REST"
#   10 stack end               ""
#   11 debt entry 1            "AUTH-DEBT: accepted | fix when team>4 | no refactor now"
#   12 debt end                ""
#   13 tool selection          "1"   (Claude Code)
# =============================================================================

_FULL=$(
    _run_init "full" \
        "2,4\nearly-growth (2024-01+)\nstability > speed > elegance\n3, no-ops\nmigration > 1 week\nRedux (boilerplate at team-2)\n\nstate: Zustand\napi: REST\n\nAUTH-DEBT: accepted | fix when team>4 | no refactor now\n\n1\n"
)

start_suite "Directory Structure"
assert_dir_exists  ".cairn/ created"                             "$_FULL/.cairn"
assert_dir_exists  ".cairn/history/ created"                     "$_FULL/.cairn/history"
assert_dir_exists  ".cairn/domains/ created"                     "$_FULL/.cairn/domains"
assert_file_exists ".cairn/output.md created"                    "$_FULL/.cairn/output.md"
assert_file_exists ".cairn/history/_TEMPLATE.md created"         "$_FULL/.cairn/history/_TEMPLATE.md"

start_suite "output.md — Required Sections Present"
assert_contains "## stage section exists"          "$_FULL/.cairn/output.md" "^## stage$"
assert_contains "## no-go section exists"          "$_FULL/.cairn/output.md" "^## no-go$"
assert_contains "## hooks section exists"          "$_FULL/.cairn/output.md" "^## hooks$"
assert_contains "## stack section exists"          "$_FULL/.cairn/output.md" "^## stack$"
assert_contains "## debt section exists"           "$_FULL/.cairn/output.md" "^## debt$"
assert_contains "## open questions section exists" "$_FULL/.cairn/output.md" "^## open questions$"

start_suite "output.md — Section Order (stage → no-go → hooks → stack → debt → open questions)"
assert_section_before "stage before no-go"          "$_FULL/.cairn/output.md" "stage" "no-go"
assert_section_before "no-go before hooks"          "$_FULL/.cairn/output.md" "no-go" "hooks"
assert_section_before "hooks before stack"          "$_FULL/.cairn/output.md" "hooks" "stack"
assert_section_before "stack before debt"           "$_FULL/.cairn/output.md" "stack" "debt"
assert_section_before "debt before open questions"  "$_FULL/.cairn/output.md" "debt" "open questions"

start_suite "output.md — Content Correctness"
assert_contains "phase: field populated"        "$_FULL/.cairn/output.md" "^phase: early-growth"
assert_contains "mode: field populated"         "$_FULL/.cairn/output.md" "^mode: stability > speed"
assert_contains "team: field populated"         "$_FULL/.cairn/output.md" "^team: 3, no-ops"
assert_contains "reject-if: field populated"    "$_FULL/.cairn/output.md" "^reject-if: migration > 1 week"
assert_contains "hooks header line present"     "$_FULL/.cairn/output.md" \
    "planning / designing / suggesting for:"
assert_contains "hooks references api-layer"    "$_FULL/.cairn/output.md" \
    "→ domains/api-layer\.md"
assert_contains "hooks references auth"         "$_FULL/.cairn/output.md" \
    "→ domains/auth\.md"
assert_contains "no-go entry written"           "$_FULL/.cairn/output.md" "^- Redux"
assert_contains "stack entry written"           "$_FULL/.cairn/output.md" "^state: Zustand"
assert_contains "second stack entry written"    "$_FULL/.cairn/output.md" "^api: REST"

start_suite "output.md — Debt Format Compliance (FORMAT.md: ID: accepted | when | constraint)"
assert_contains "debt entry has 'accepted' keyword" \
    "$_FULL/.cairn/output.md" "accepted \|"
assert_contains "debt entry is pipe-delimited (3 parts)" \
    "$_FULL/.cairn/output.md" "^AUTH-DEBT: accepted \| .+ \| .+"

start_suite "history/_TEMPLATE.md — All 8 Required Fields"
assert_contains "field: type"          "$_FULL/.cairn/history/_TEMPLATE.md" "^type:"
assert_contains "field: domain"        "$_FULL/.cairn/history/_TEMPLATE.md" "^domain:"
assert_contains "field: decision_date" "$_FULL/.cairn/history/_TEMPLATE.md" "^decision_date:"
assert_contains "field: recorded_date" "$_FULL/.cairn/history/_TEMPLATE.md" "^recorded_date:"
assert_contains "field: summary"       "$_FULL/.cairn/history/_TEMPLATE.md" "^summary:"
assert_contains "field: rejected (most critical field)" \
    "$_FULL/.cairn/history/_TEMPLATE.md" "^rejected:"
assert_contains "field: reason"        "$_FULL/.cairn/history/_TEMPLATE.md" "^reason:"
assert_contains "field: revisit_when"  "$_FULL/.cairn/history/_TEMPLATE.md" "^revisit_when:"

start_suite "Skill Installation — Claude Code"
assert_file_exists ".claude/CLAUDE.md created (Claude Code installs here)" \
    "$_FULL/.claude/CLAUDE.md"
assert_contains "CLAUDE.md references .cairn/output.md" \
    "$_FULL/.claude/CLAUDE.md" "\.cairn/output\.md"
assert_contains "CLAUDE.md has ON SESSION START section" \
    "$_FULL/.claude/CLAUDE.md" "ON SESSION START"
assert_contains "CLAUDE.md has REACTIVE EVOLUTION section" \
    "$_FULL/.claude/CLAUDE.md" "REACTIVE EVOLUTION"

# =============================================================================
# Scenario A2 — Cursor skill installation
#
# Input: domain 2, minimal fields, tool "2" (Cursor)
# =============================================================================

_CURSOR=$(
    _run_init "cursor_skill" \
        "2\ntest (2024-01+)\nspeed > quality\n\n\n\n\n\n2\n"
)

start_suite "Skill Installation — Cursor"
assert_file_exists ".cursor/rules/cairn.mdc created" \
    "$_CURSOR/.cursor/rules/cairn.mdc"
assert_contains "cairn.mdc has YAML frontmatter delimiter" \
    "$_CURSOR/.cursor/rules/cairn.mdc" "^---$"
assert_contains "cairn.mdc has description: field" \
    "$_CURSOR/.cursor/rules/cairn.mdc" "^description:"
assert_contains "cairn.mdc has alwaysApply: true" \
    "$_CURSOR/.cursor/rules/cairn.mdc" "^alwaysApply: true"

# =============================================================================
# Scenario B — Domain validation: out-of-range number + uppercase name
#
# Input: "99,2,BadName,custom-valid"
#   99        → out of range (1-11), ignored
#   2         → api-layer (valid)
#   BadName   → fails ^[a-z][a-z0-9-]*$ (uppercase), ignored
#   custom-valid → valid kebab-case, accepted
# =============================================================================

_VALID=$(
    _run_init "domain_validation" \
        "99,2,BadName,custom-valid\ntest (2024-01+)\nspeed > quality\n\n\n\n\n\n\n"
)

start_suite "Domain Validation"
assert_contains "valid standard domain (api-layer) included in hooks" \
    "$_VALID/.cairn/output.md" "→ domains/api-layer\.md"
assert_contains "valid custom domain (custom-valid) included in hooks" \
    "$_VALID/.cairn/output.md" "→ domains/custom-valid\.md"
assert_not_contains "out-of-range number (99) not in hooks" \
    "$_VALID/.cairn/output.md" "domains/99"
assert_not_contains "uppercase domain (BadName) rejected" \
    "$_VALID/.cairn/output.md" "BadName"

# =============================================================================
# Scenario C — Deduplication: domain 2 selected twice
#
# Input: "2,2,4" → should produce exactly 1 api-layer hook, 1 auth hook
# =============================================================================

_DEDUP=$(
    _run_init "deduplication" \
        "2,2,4\ntest (2024-01+)\nspeed > quality\n\n\n\n\n\n\n"
)

start_suite "Domain Deduplication"
assert_count "api-layer hook entry appears exactly once" \
    "$_DEDUP/.cairn/output.md" "→ domains/api-layer\.md" 1
assert_count "auth hook entry appears exactly once" \
    "$_DEDUP/.cairn/output.md" "→ domains/auth\.md" 1

# =============================================================================
# Scenario D — Overwrite protection: existing .cairn/, input "no" cancels
# =============================================================================

_OW_DIR="${_CAIRN_TMPDIR}/overwrite_cancel"
mkdir -p "$_OW_DIR/.cairn"   # pre-create .cairn/ to trigger the overwrite prompt

_ow_exit=0
(cd "$_OW_DIR" && printf "no\n" | bash "$CAIRN_SCRIPT") >/dev/null 2>&1 || _ow_exit=$?

start_suite "Overwrite Protection"
assert_exit_code "script exits 0 when overwrite cancelled" 0 "$_ow_exit"
assert_file_not_exists "output.md NOT created when overwrite cancelled" \
    "$_OW_DIR/.cairn/output.md"

# =============================================================================
# Scenario E — Three-choice menu: [3] Cancel keeps data intact
# =============================================================================

_TC_CANCEL_DIR="${_CAIRN_TMPDIR}/threechoice_cancel_$$"
mkdir -p "$_TC_CANCEL_DIR/.cairn"
echo "existing-data" > "$_TC_CANCEL_DIR/.cairn/output.md"

_tc_cancel_exit=0
(cd "$_TC_CANCEL_DIR" && printf "3\n" | bash "$CAIRN_SCRIPT") >/dev/null 2>&1 \
    || _tc_cancel_exit=$?

start_suite "Three-Choice Menu — Cancel ([3])"
assert_exit_code "exit 0 on [3] cancel" 0 "$_tc_cancel_exit"
assert_contains  "output.md unchanged on cancel" \
    "$_TC_CANCEL_DIR/.cairn/output.md" "existing-data"

# =============================================================================
# Scenario F — Three-choice menu: [2] Skills-only does not overwrite output.md
# =============================================================================

_TC_SKILLS_DIR="${_CAIRN_TMPDIR}/threechoice_skills_$$"
mkdir -p "$_TC_SKILLS_DIR/.cairn"
echo "existing-output" > "$_TC_SKILLS_DIR/.cairn/output.md"

# Record mtime before (seconds since epoch)
_tc_mtime_before="$(stat -f '%m' "$_TC_SKILLS_DIR/.cairn/output.md" 2>/dev/null \
    || stat -c '%Y' "$_TC_SKILLS_DIR/.cairn/output.md" 2>/dev/null || echo 0)"

# Input: [2] (skills-only), then select Claude Code (1)
(cd "$_TC_SKILLS_DIR" && printf "2\n1\n" | bash "$CAIRN_SCRIPT") >/dev/null 2>&1 || true

start_suite "Three-Choice Menu — Skills-Only ([2])"
assert_contains  "output.md content unchanged after skills-only run" \
    "$_TC_SKILLS_DIR/.cairn/output.md" "existing-output"
assert_file_exists "claude skill file created in skills-only mode" \
    "$_TC_SKILLS_DIR/.claude/CLAUDE.md"
assert_contains    "claude skill has cairn:start marker" \
    "$_TC_SKILLS_DIR/.claude/CLAUDE.md" "cairn:start"
