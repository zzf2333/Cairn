#!/usr/bin/env bash
# cairn doctor tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn doctor rule-based health checks:
#   - exit 0 on clean project
#   - exit 1 (token over-budget) when output.md > 800 approx tokens
#   - exit 1 (no-go unsupported) when no-go entry has no history backing
#   - exit 1 (stale domain) when history recorded_date newer than domain updated
#   - exit 1 (guide block old/missing)
#   - exit 1 (v0.0.11 residue present)
#   - --json mode emits valid JSON
#
# All tests use non-interactive flag-mode fixtures (no stdin needed).

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Fixture helpers
# =============================================================================

# Create a minimal clean .cairn/ that passes all doctor checks.
_create_doctor_clean_fixture() {
    local dir="$1"

    mkdir -p "$dir/.cairn/history" "$dir/.cairn/domains"

    # output.md: small (< 500 tokens), no-go has history support, 1 domain
    {
        echo "## stage"
        echo ""
        echo "phase: test-phase (2024-01+)"
        echo "mode: stability > speed"
        echo "team: 2"
        echo ""
        echo "## no-go"
        echo ""
        echo "- GraphQL (N+1 risk without DataLoader; see 2024-01 history)"
        echo ""
        echo "## hooks"
        echo ""
        echo "planning / designing / suggesting for:"
        echo ""
        echo "- api / rest / endpoint → read domains/api-layer.md first"
        echo ""
        echo "## stack"
        echo ""
        echo "Node.js / Express / PostgreSQL"
        echo ""
        echo "## debt"
        echo ""
    } > "$dir/.cairn/output.md"

    # domain file matching the hooks section exactly
    {
        echo "---"
        echo "domain: api-layer"
        echo "hooks: [\"api\", \"rest\", \"endpoint\"]"
        echo "updated: 2024-01"
        echo "status: stable"
        echo "---"
        echo ""
        echo "# api-layer"
        echo ""
        echo "## current design"
        echo ""
        echo "Express REST API."
        echo ""
        echo "## trajectory"
        echo ""
        echo "2024-01 Initial design"
        echo ""
        echo "## rejected paths"
        echo ""
        echo "- GraphQL: evaluated, rejected. Re-evaluate when: never"
        echo ""
        echo "## known pitfalls"
        echo ""
        echo "None."
        echo ""
        echo "## open questions"
        echo ""
        echo "None."
    } > "$dir/.cairn/domains/api-layer.md"

    # history entry providing GraphQL rejection (supports the no-go)
    {
        echo "type: rejection"
        echo "domain: api-layer"
        echo "decision_date: 2024-01"
        echo "recorded_date: 2024-01"
        echo "summary: GraphQL spike rejected"
        echo "rejected: GraphQL: evaluated 3 weeks, N+1 risk"
        echo "reason: Team size and data complexity do not justify it"
        echo "revisit_when: never"
    } > "$dir/.cairn/history/2024-01_graphql-spike-rejected.md"

    # .cairn/SKILL.md — copy canonical so it passes skill-md consistency check
    cp "$REPO_ROOT/skills/claude-code/SKILL.md" "$dir/.cairn/SKILL.md"

    # .claude/CLAUDE.md with valid 12-line guide block (satisfies guide-block check)
    mkdir -p "$dir/.claude"
    {
        echo "<!-- cairn:start -->"
        echo "## Cairn (path-dependent constraint memory)"
        echo ""
        echo "Read .cairn/output.md at session start."
        echo "Read .cairn/SKILL.md for operating protocol."
        echo "<!-- cairn:end -->"
    } > "$dir/.claude/CLAUDE.md"
}

# =============================================================================
# Clean project → exit 0
# =============================================================================

start_suite "cairn doctor — Clean Project Exits 0"

_doctor_clean_dir="$_CAIRN_TMPDIR/doctor_clean_$$"
mkdir -p "$_doctor_clean_dir"
_create_doctor_clean_fixture "$_doctor_clean_dir"

_clean_exit=0
(cd "$_doctor_clean_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _clean_exit=$?
assert_exit_code "clean project exits 0" 0 "$_clean_exit"

# =============================================================================
# Token over-budget → exit 1
# =============================================================================

start_suite "cairn doctor — Token Over-Budget (> 800 approx tokens)"

_doctor_tokens_dir="$_CAIRN_TMPDIR/doctor_tokens_$$"
mkdir -p "$_doctor_tokens_dir"
_create_doctor_clean_fixture "$_doctor_tokens_dir"

# Pad output.md to exceed 800 * 4 = 3200 characters.
python3 -c "print('# padding\n' + ('xpad ' * 700))" 2>/dev/null \
    >> "$_doctor_tokens_dir/.cairn/output.md" \
    || printf '%0.s#padding-line-for-token-test-very-long-line-here\n' $(seq 1 70) \
        >> "$_doctor_tokens_dir/.cairn/output.md"

_tokens_exit=0
(cd "$_doctor_tokens_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _tokens_exit=$?
assert_exit_code "over-budget output.md causes exit 1" 1 "$_tokens_exit"

_tokens_output="$(cd "$_doctor_tokens_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
_tokens_tmp="$_CAIRN_TMPDIR/doctor_tokens_out.txt"
echo "$_tokens_output" > "$_tokens_tmp"
assert_contains "token check output contains ✗ or ⚠ symbol" "$_tokens_tmp" "(✗|⚠)"

# =============================================================================
# No-go without history support → exit 1
# =============================================================================

start_suite "cairn doctor — No-Go Without History Support"

_doctor_nogo_dir="$_CAIRN_TMPDIR/doctor_nogo_$$"
mkdir -p "$_doctor_nogo_dir"
_create_doctor_clean_fixture "$_doctor_nogo_dir"

# Rewrite output.md with unsupported no-go
{
    echo "## stage"
    echo ""
    echo "phase: test-phase (2024-01+)"
    echo "mode: stability > speed"
    echo ""
    echo "## no-go"
    echo ""
    echo "- KafkaStreaming (too complex for current team)"
    echo ""
    echo "## hooks"
    echo ""
    echo "planning / designing / suggesting for:"
    echo ""
    echo "- api / rest / endpoint → read domains/api-layer.md first"
    echo ""
    echo "## stack"
    echo ""
    echo "Node.js"
    echo ""
    echo "## debt"
    echo ""
} > "$_doctor_nogo_dir/.cairn/output.md"

_nogo_exit=0
(cd "$_doctor_nogo_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _nogo_exit=$?
assert_exit_code "unsupported no-go causes exit 1" 1 "$_nogo_exit"

_nogo_output="$(cd "$_doctor_nogo_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
_nogo_tmp="$_CAIRN_TMPDIR/doctor_nogo_out.txt"
echo "$_nogo_output" > "$_nogo_tmp"
assert_contains "no-go check output mentions KafkaStreaming" "$_nogo_tmp" "KafkaStreaming"

# =============================================================================
# Stale domain → exit 1
# =============================================================================

start_suite "cairn doctor — Stale Domain Detection"

_doctor_stale_dir="$_CAIRN_TMPDIR/doctor_stale_$$"
mkdir -p "$_doctor_stale_dir"
_create_doctor_clean_fixture "$_doctor_stale_dir"

# Override domain file with an old updated date
{
    echo "---"
    echo "domain: api-layer"
    echo "hooks: [\"api\", \"rest\", \"endpoint\"]"
    echo "updated: 2023-01"
    echo "status: active"
    echo "---"
    echo ""
    echo "# api-layer"
    echo ""
    echo "## current design"
    echo ""
    echo "Express REST API."
    echo ""
    echo "## trajectory"
    echo ""
    echo "2023-01 Initial"
    echo ""
    echo "## rejected paths"
    echo ""
    echo "- GraphQL: rejected. Re-evaluate when: never"
    echo ""
    echo "## known pitfalls"
    echo ""
    echo "None."
    echo ""
    echo "## open questions"
    echo ""
    echo "None."
} > "$_doctor_stale_dir/.cairn/domains/api-layer.md"

# Add a NEW history entry (recorded_date 2024-06) — makes domain stale
{
    echo "type: decision"
    echo "domain: api-layer"
    echo "decision_date: 2024-06"
    echo "recorded_date: 2024-06"
    echo "summary: REST versioning strategy decided"
    echo "rejected: GraphQL versioning: too complex"
    echo "reason: REST is simpler for current client count"
    echo "revisit_when: client count > 10"
} > "$_doctor_stale_dir/.cairn/history/2024-06_rest-versioning-strategy.md"

_stale_exit=0
(cd "$_doctor_stale_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _stale_exit=$?
assert_exit_code "stale domain causes exit 1" 1 "$_stale_exit"

_stale_output="$(cd "$_doctor_stale_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
_stale_tmp="$_CAIRN_TMPDIR/doctor_stale_out.txt"
echo "$_stale_output" > "$_stale_tmp"
assert_contains "stale check output contains ⚠ symbol" "$_stale_tmp" "⚠"
assert_contains "stale check mentions domain name"      "$_stale_tmp" "api-layer"

# =============================================================================
# No .cairn/ directory → exit 1
# =============================================================================

start_suite "cairn doctor — Requires .cairn/ Directory"

_doctor_nocairn_dir="$_CAIRN_TMPDIR/doctor_nocairn_$$"
mkdir -p "$_doctor_nocairn_dir"

_nocairn_exit=0
(cd "$_doctor_nocairn_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _nocairn_exit=$?
assert_exit_code "doctor without .cairn/ exits non-zero" 1 "$_nocairn_exit"

# =============================================================================
# Hooks drift: domain-only keyword warns + shows hint
# =============================================================================

start_suite "cairn doctor — Hooks Drift Shows Sync Hint"

_doctor_hooks_dir="$_CAIRN_TMPDIR/doctor_hooks_$$"
mkdir -p "$_doctor_hooks_dir"
_create_doctor_clean_fixture "$_doctor_hooks_dir"

# Add "graphql" to domain hooks[] but NOT to output.md
_doctor_hooks_domain="$_doctor_hooks_dir/.cairn/domains/api-layer.md"
sed -i.bak 's/hooks: \["api", "rest", "endpoint"\]/hooks: ["api", "rest", "endpoint", "graphql"]/' "$_doctor_hooks_domain" 2>/dev/null \
    || sed -i 's/hooks: \["api", "rest", "endpoint"\]/hooks: ["api", "rest", "endpoint", "graphql"]/' "$_doctor_hooks_domain"

_drift_output="$_CAIRN_TMPDIR/doctor_hooks_out_$$.txt"
_drift_exit=0
(cd "$_doctor_hooks_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_drift_output" || _drift_exit=$?
assert_exit_code "hooks drift exits 1" 1 "$_drift_exit"
assert_contains "drift warning shown" "$_drift_output" "graphql"

# =============================================================================
# Bidirectional hooks drift
# =============================================================================

start_suite "cairn doctor — Bidirectional Hooks Drift Detection"

_doctor_bidir_dir="$_CAIRN_TMPDIR/doctor_bidir_$$"
mkdir -p "$_doctor_bidir_dir"
_create_doctor_clean_fixture "$_doctor_bidir_dir"

_bidir_output_md="$_doctor_bidir_dir/.cairn/output.md"
sed -i.bak 's|- api / rest / endpoint → read domains/api-layer.md first|- api / rest / endpoint / extra-in-output → read domains/api-layer.md first|' "$_bidir_output_md" 2>/dev/null \
    || sed -i 's|- api / rest / endpoint → read domains/api-layer.md first|- api / rest / endpoint / extra-in-output → read domains/api-layer.md first|' "$_bidir_output_md"

_bidir_output="$_CAIRN_TMPDIR/doctor_bidir_out_$$.txt"
_bidir_exit=0
(cd "$_doctor_bidir_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_bidir_output" || _bidir_exit=$?
assert_exit_code "bidirectional drift exits 1" 1 "$_bidir_exit"
assert_contains "output-only drift warning" "$_bidir_output" "extra-in-output"

# =============================================================================
# Stack drift: stack entry not found in dep files → warns
# =============================================================================

start_suite "cairn doctor — Stack Drift Warns When Tech Not in Dep File"

_doctor_stack_dir="$_CAIRN_TMPDIR/doctor_stack_$$"
mkdir -p "$_doctor_stack_dir/.cairn/history" "$_doctor_stack_dir/.cairn/domains"

{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""
    echo "api: express"
    echo "db: PostgreSQL"
    echo ""; echo "## debt"; echo ""
} > "$_doctor_stack_dir/.cairn/output.md"

printf '{"dependencies":{"fastify":"^4.0.0","axios":"^1.0.0"}}' \
    > "$_doctor_stack_dir/package.json"

_stack_drift_output="$_CAIRN_TMPDIR/doctor_stack_out_$$.txt"
_stack_drift_exit=0
(cd "$_doctor_stack_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_stack_drift_output" \
    || _stack_drift_exit=$?

assert_exit_code "stack drift: doctor exits 1 (drift found)" 1 "$_stack_drift_exit"
assert_contains "stack drift: express not found warning" "$_stack_drift_output" "express"

# =============================================================================
# Stack drift: all entries present → no warning
# =============================================================================

start_suite "cairn doctor — Stack Drift OK When Tech Found in Dep File"

_doctor_stack_ok_dir="$_CAIRN_TMPDIR/doctor_stack_ok_$$"
mkdir -p "$_doctor_stack_ok_dir/.cairn/history" "$_doctor_stack_ok_dir/.cairn/domains" \
    "$_doctor_stack_ok_dir/.claude"

{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""
    echo "api: fastify"
    echo ""; echo "## debt"; echo ""
} > "$_doctor_stack_ok_dir/.cairn/output.md"

printf '{"dependencies":{"fastify":"^4.0.0","axios":"^1.0.0"}}' \
    > "$_doctor_stack_ok_dir/package.json"

# Add required v0.0.12 files so doctor exits 0
cp "$REPO_ROOT/skills/claude-code/SKILL.md" "$_doctor_stack_ok_dir/.cairn/SKILL.md"
{
    echo "<!-- cairn:start -->"
    echo "## Cairn"
    echo "Read .cairn/SKILL.md"
    echo "<!-- cairn:end -->"
} > "$_doctor_stack_ok_dir/.claude/CLAUDE.md"

_stack_ok_exit=0
_stack_ok_output="$_CAIRN_TMPDIR/doctor_stack_ok_out_$$.txt"
(cd "$_doctor_stack_ok_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_stack_ok_output" \
    || _stack_ok_exit=$?

assert_exit_code "stack ok: doctor exits 0" 0 "$_stack_ok_exit"
assert_contains "stack ok: no drift warning" "$_stack_ok_output" "stack entries match"

# =============================================================================
# Guide block: missing → exit 1
# =============================================================================

start_suite "cairn doctor — Guide Block Missing in .claude/CLAUDE.md"

_doctor_noguide_dir="$_CAIRN_TMPDIR/doctor_noguide_$$"
mkdir -p "$_doctor_noguide_dir"
_create_doctor_clean_fixture "$_doctor_noguide_dir"
# .claude/CLAUDE.md exists but has no cairn markers
mkdir -p "$_doctor_noguide_dir/.claude"
echo "# User config" > "$_doctor_noguide_dir/.claude/CLAUDE.md"

_noguide_exit=0
_noguide_out="$(cd "$_doctor_noguide_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
(cd "$_doctor_noguide_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _noguide_exit=$?
assert_exit_code "missing guide block: doctor exits 1" 1 "$_noguide_exit"
_noguide_tmp="$_CAIRN_TMPDIR/doctor_noguide_out.txt"
echo "$_noguide_out" > "$_noguide_tmp"
assert_contains "missing guide block: warning mentions cairn init" "$_noguide_tmp" "cairn init"

# =============================================================================
# Guide block: old format (100-line skill) → warns to refresh
# =============================================================================

start_suite "cairn doctor — Guide Block Old Format Detected"

_doctor_oldguide_dir="$_CAIRN_TMPDIR/doctor_oldguide_$$"
mkdir -p "$_doctor_oldguide_dir"
_create_doctor_clean_fixture "$_doctor_oldguide_dir"
mkdir -p "$_doctor_oldguide_dir/.claude"
{
    echo "<!-- cairn:start -->"
    # Simulate old 100-line skill with ON SESSION START section
    printf '## ON SESSION START\n\nRead .cairn/output.md...\n'
    printf '## REACTIVE EVOLUTION\n\nSome old content\n'
    printf '%0.s# more old content\n' $(seq 1 40)
    echo "<!-- cairn:end -->"
} > "$_doctor_oldguide_dir/.claude/CLAUDE.md"

_oldguide_exit=0
_oldguide_out="$(cd "$_doctor_oldguide_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
(cd "$_doctor_oldguide_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _oldguide_exit=$?
assert_exit_code "old format guide: doctor exits 1" 1 "$_oldguide_exit"
_oldguide_tmp="$_CAIRN_TMPDIR/doctor_oldguide_out.txt"
echo "$_oldguide_out" > "$_oldguide_tmp"
assert_contains "old format guide: warning mentions refresh-skills" "$_oldguide_tmp" "refresh-skills"

# =============================================================================
# v0.0.11 residue: staged/ present → warns
# =============================================================================

start_suite "cairn doctor — v0.0.11 Residue: staged/ Present"

_doctor_residue_dir="$_CAIRN_TMPDIR/doctor_residue_$$"
mkdir -p "$_doctor_residue_dir"
_create_doctor_clean_fixture "$_doctor_residue_dir"
# Simulate v0.0.11 residue
mkdir -p "$_doctor_residue_dir/.cairn/staged"
echo "type: decision" > "$_doctor_residue_dir/.cairn/staged/2024-01_old-entry.md"

_residue_exit=0
_residue_out="$(cd "$_doctor_residue_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
(cd "$_doctor_residue_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _residue_exit=$?
assert_exit_code "staged residue: doctor exits 1" 1 "$_residue_exit"
_residue_tmp="$_CAIRN_TMPDIR/doctor_residue_out.txt"
echo "$_residue_out" > "$_residue_tmp"
assert_contains "staged residue: warning mentions staged" "$_residue_tmp" "staged"

# =============================================================================
# --json mode emits valid JSON
# =============================================================================

start_suite "cairn doctor — JSON Output Mode"

_doctor_json_dir="$_CAIRN_TMPDIR/doctor_json_$$"
mkdir -p "$_doctor_json_dir"
_create_doctor_clean_fixture "$_doctor_json_dir"

_json_out="$(cd "$_doctor_json_dir" && bash "$_CAIRN_BIN" doctor --json 2>/dev/null || true)"
_json_tmp="$_CAIRN_TMPDIR/doctor_json_out.txt"
echo "$_json_out" > "$_json_tmp"

# Should contain JSON structure markers
assert_contains "json output starts with {" "$_json_tmp" "^\{"
assert_contains "json output has issues field" "$_json_tmp" '"issues"'
assert_contains "json output has cairn_version field" "$_json_tmp" '"cairn_version"'
assert_contains "json output has write_back field" "$_json_tmp" '"write_back"'

# =============================================================================
# v0.0.11: doctor warns on old skill location (old only, no new)
# =============================================================================

start_suite "cairn doctor — Skill Drift: old location only"

_doctor_old_skill_dir="${_CAIRN_TMPDIR}/doctor_old_skill_$$"
_create_doctor_clean_fixture "$_doctor_old_skill_dir"

mkdir -p "$_doctor_old_skill_dir/.claude/skills/cairn"
echo "old skill" > "$_doctor_old_skill_dir/.claude/skills/cairn/SKILL.md"

_old_skill_exit=0
_old_skill_out="$(cd "$_doctor_old_skill_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null)" \
    || _old_skill_exit=$?

assert_exit_code "doctor exits 1 (old skill only)" 1 "$_old_skill_exit"
# Output mentions the guide block is missing (since no .claude/CLAUDE.md with cairn markers)
assert_exit_code "output mentions guide block issue" \
    "0" "$(echo "$_old_skill_out" | grep -qi "cairn init\|guide\|skills/cairn" && echo 0 || echo 1)"

# =============================================================================
# v0.0.11: doctor warns when both old and new skill locations present
# =============================================================================

start_suite "cairn doctor — Skill Drift: both old and new present"

_doctor_both_skill_dir="${_CAIRN_TMPDIR}/doctor_both_skill_$$"
_create_doctor_clean_fixture "$_doctor_both_skill_dir"

mkdir -p "$_doctor_both_skill_dir/.claude/skills/cairn"
echo "old skill" > "$_doctor_both_skill_dir/.claude/skills/cairn/SKILL.md"
mkdir -p "$_doctor_both_skill_dir/.claude"
{
    echo "<!-- cairn:start -->"
    echo "## Cairn"
    echo "Read .cairn/SKILL.md"
    echo "<!-- cairn:end -->"
} > "$_doctor_both_skill_dir/.claude/CLAUDE.md"

_both_exit=0
_both_out="$(cd "$_doctor_both_skill_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null)" \
    || _both_exit=$?

assert_exit_code "doctor exits 1 (both old and new)" 1 "$_both_exit"
assert_exit_code "output warns about old file" \
    "0" "$(echo "$_both_out" | grep -qi "skills/cairn" && echo 0 || echo 1)"

# =============================================================================
# v0.0.11: doctor passes skill check when only new location exists
# =============================================================================

start_suite "cairn doctor — Skill Drift: clean (no old location)"

_doctor_clean_skill_dir="${_CAIRN_TMPDIR}/doctor_clean_skill_$$"
_create_doctor_clean_fixture "$_doctor_clean_skill_dir"

_clean_skill_out="$(cd "$_doctor_clean_skill_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null || true)"

# With no .claude/skills/cairn/ old dir, should not warn about skill drift
assert_exit_code "skill drift: no old-location warning" \
    "0" "$(echo "$_clean_skill_out" | grep -qi "skills/cairn" && echo 1 || echo 0)"

# =============================================================================
# v0.0.13: write_back — no .git/ → status skipped
# =============================================================================

start_suite "cairn doctor — Write-back: no git → skipped"

_doctor_wb_nogit_dir="${_CAIRN_TMPDIR}/doctor_wb_nogit_$$"
mkdir -p "$_doctor_wb_nogit_dir"
_create_doctor_clean_fixture "$_doctor_wb_nogit_dir"
# Deliberately no .git/ directory

_wb_nogit_json="$(cd "$_doctor_wb_nogit_dir" && bash "$_CAIRN_BIN" doctor --json 2>/dev/null || true)"
_wb_nogit_tmp="${_CAIRN_TMPDIR}/doctor_wb_nogit_json.txt"
echo "$_wb_nogit_json" > "$_wb_nogit_tmp"

assert_contains "write_back: json has write_back field"     "$_wb_nogit_tmp" '"write_back"'
assert_contains "write_back: status is skipped (no git)"    "$_wb_nogit_tmp" '"skipped"'
assert_contains "write_back: reason is no_git"              "$_wb_nogit_tmp" '"no_git"'

# =============================================================================
# v0.0.13: write_back — git repo with large change + no history → missing-write-back
# =============================================================================

start_suite "cairn doctor — Write-back: large change, no history"

_doctor_wb_large_dir="${_CAIRN_TMPDIR}/doctor_wb_large_$$"
mkdir -p "$_doctor_wb_large_dir"
_create_doctor_clean_fixture "$_doctor_wb_large_dir"

# Initialise a git repo so the write-back check runs
(cd "$_doctor_wb_large_dir" && git init -q && git config user.email "test@cairn" && git config user.name "Test")

# Write 110+ code lines and commit — enough to cross the 100-line threshold
mkdir -p "$_doctor_wb_large_dir/src"
python3 -c "
lines = ['# auto-generated test line ' + str(i) for i in range(115)]
print('\n'.join(lines))
" > "$_doctor_wb_large_dir/src/generated.py"
(cd "$_doctor_wb_large_dir" && git add src/generated.py && git commit -q -m "feat: add generated module")

# Remove the history entry so the "new history" check fails
rm -f "$_doctor_wb_large_dir/.cairn/history/2024-01_graphql-spike-rejected.md"

_wb_large_json="$(cd "$_doctor_wb_large_dir" && bash "$_CAIRN_BIN" doctor --json 2>/dev/null || true)"
_wb_large_tmp="${_CAIRN_TMPDIR}/doctor_wb_large_json.txt"
echo "$_wb_large_json" > "$_wb_large_tmp"

assert_contains "write_back large: json has write_back field"     "$_wb_large_tmp" '"write_back"'
assert_contains "write_back large: status is warn"                "$_wb_large_tmp" '"warn"'
assert_contains "write_back large: signals has missing-write-back" "$_wb_large_tmp" "missing-write-back"
