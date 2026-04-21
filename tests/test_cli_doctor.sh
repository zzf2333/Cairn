#!/usr/bin/env bash
# cairn doctor tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn doctor rule-based health checks:
#   - exit 0 on clean project
#   - exit 1 (token over-budget) when output.md > 800 approx tokens
#   - exit 1 (no-go unsupported) when no-go entry has no history backing
#   - exit 1 (stale domain) when history recorded_date newer than domain updated
#   - exit 1 (staged [TODO]) when staged entries have [TODO] fields
#
# All tests use non-interactive flag-mode fixtures (no stdin needed).

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Fixture helpers
# =============================================================================

# Create a minimal clean .cairn/ that passes all doctor checks.
_create_doctor_clean_fixture() {
    local dir="$1"

    mkdir -p "$dir/.cairn/history" "$dir/.cairn/domains" "$dir/.cairn/staged"

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
# NOTE: must NOT use "cat file >> file" — that causes an infinite loop.
# Append padding directly; original file (~250 chars) + padding (~3400 chars) > 3200 total.
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

# Add a no-go entry with a keyword that has no history backing
{
    sed 's/^## no-go$/## no-go\n/' "$_doctor_nogo_dir/.cairn/output.md" | head -n -1
    echo "- KafkaStreaming (operational overhead; microservices not justified)"
} >> "$_doctor_nogo_dir/.cairn/output.md"
# Rewrite properly with the unsupported no-go
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

# history/ only has GraphQL, no KafkaStreaming mention
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

# Add a NEW history entry (recorded_date 2024-06) for the same domain
# This makes domain stale: recorded_date 2024-06 > updated 2023-01
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
assert_contains "stale check output contains ⚠ symbol"   "$_stale_tmp" "⚠"
assert_contains "stale check mentions domain name"        "$_stale_tmp" "api-layer"

# =============================================================================
# Staged entries with [TODO] → exit 1
# =============================================================================

start_suite "cairn doctor — Staged [TODO] Detection"

_doctor_staged_dir="$_CAIRN_TMPDIR/doctor_staged_$$"
mkdir -p "$_doctor_staged_dir"
_create_doctor_clean_fixture "$_doctor_staged_dir"

# Place a staged entry with [TODO] fields
{
    echo "type: rejection"
    echo "domain: api-layer"
    echo "decision_date: 2024-03"
    echo "recorded_date: 2024-03"
    echo "summary: gRPC internal traffic rejected"
    echo "rejected: gRPC: latency improvement below 30% threshold"
    echo "reason: [TODO]"
    echo "revisit_when: [TODO]"
} > "$_doctor_staged_dir/.cairn/staged/2024-03_grpc-internal-traffic-rejected.md"

_staged_exit=0
(cd "$_doctor_staged_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _staged_exit=$?
assert_exit_code "staged [TODO] causes exit 1" 1 "$_staged_exit"

_staged_output="$(cd "$_doctor_staged_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
_staged_tmp="$_CAIRN_TMPDIR/doctor_staged_out.txt"
echo "$_staged_output" > "$_staged_tmp"
assert_contains "staged check output mentions [TODO]" "$_staged_tmp" "\[TODO\]"

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
# api-service-2yr example: rate-limiting is flagged as stale
# =============================================================================

start_suite "cairn doctor — api-service-2yr Example: Stale rate-limiting"

_api_example_dir="$REPO_ROOT/examples/api-service-2yr"

if [ -d "$_api_example_dir/.cairn" ]; then
    _api_doctor_exit=0
    _api_doctor_output="$(cd "$_api_example_dir" && bash "$_CAIRN_BIN" doctor 2>&1 || true)"
    (cd "$_api_example_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _api_doctor_exit=$?

    _api_doctor_tmp="$_CAIRN_TMPDIR/doctor_api_out.txt"
    echo "$_api_doctor_output" > "$_api_doctor_tmp"

    assert_exit_code "api-service-2yr example doctor exits 1 (stale domain)" 1 "$_api_doctor_exit"
    assert_contains "doctor flags rate-limiting as stale" "$_api_doctor_tmp" "rate-limiting"
    assert_contains "stale flag shows ⚠ symbol" "$_api_doctor_tmp" "⚠"
else
    _pass "api-service-2yr example directory not present — skipping"
    _pass "api-service-2yr doctor stale check — skipped"
    _pass "api-service-2yr stale ⚠ symbol — skipped"
fi

# =============================================================================
# cairn doctor — Hooks Drift Shows Run Sync Hint
# =============================================================================

start_suite "cairn doctor — Hooks Drift Shows Sync Hint"

_doctor_hooks_dir="$_CAIRN_TMPDIR/doctor_hooks_$$"
mkdir -p "$_doctor_hooks_dir"
_create_doctor_clean_fixture "$_doctor_hooks_dir"

# Introduce drift: add a keyword to domain hooks[] that's not in output.md
# The clean fixture has: output.md hooks "api/rest/endpoint" and domain hooks ["api","rest","endpoint"]
# We add "graphql" to the domain frontmatter but NOT to output.md
_doctor_hooks_domain="$_doctor_hooks_dir/.cairn/domains/api-layer.md"
# Replace hooks line in domain file to add an extra keyword
sed -i.bak 's/hooks: \["api", "rest", "endpoint"\]/hooks: ["api", "rest", "endpoint", "graphql"]/' "$_doctor_hooks_domain" 2>/dev/null \
    || sed -i 's/hooks: \["api", "rest", "endpoint"\]/hooks: ["api", "rest", "endpoint", "graphql"]/' "$_doctor_hooks_domain"

_drift_output="$_CAIRN_TMPDIR/doctor_hooks_out_$$.txt"
_drift_exit=0
(cd "$_doctor_hooks_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_drift_output" || _drift_exit=$?
assert_exit_code "hooks drift exits 1" 1 "$_drift_exit"
assert_contains "drift warning shown" "$_drift_output" "graphql"
assert_contains "sync hint shown" "$_drift_output" "cairn sync --hooks"

# =============================================================================
# cairn doctor — Bidirectional Hooks Drift
# =============================================================================

start_suite "cairn doctor — Bidirectional Hooks Drift Detection"

_doctor_bidir_dir="$_CAIRN_TMPDIR/doctor_bidir_$$"
mkdir -p "$_doctor_bidir_dir"
_create_doctor_clean_fixture "$_doctor_bidir_dir"

# output.md has extra keyword "extra-in-output" not in domain hooks[]
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
mkdir -p "$_doctor_stack_dir/.cairn/history" "$_doctor_stack_dir/.cairn/domains" \
    "$_doctor_stack_dir/.cairn/staged"

{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""
    echo "api: express"
    echo "db: PostgreSQL"
    echo ""; echo "## debt"; echo ""
} > "$_doctor_stack_dir/.cairn/output.md"

# package.json that does NOT include "express"
printf '{"dependencies":{"fastify":"^4.0.0","axios":"^1.0.0"}}' \
    > "$_doctor_stack_dir/package.json"

_stack_drift_output="$_CAIRN_TMPDIR/doctor_stack_out_$$.txt"
_stack_drift_exit=0
(cd "$_doctor_stack_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_stack_drift_output" \
    || _stack_drift_exit=$?

assert_exit_code "stack drift: doctor exits 1 (drift found)" 1 "$_stack_drift_exit"
assert_contains "stack drift: express not found warning" "$_stack_drift_output" "express"

# =============================================================================
# Stack drift: all stack entries present in dep file → no warning
# =============================================================================

start_suite "cairn doctor — Stack Drift OK When Tech Found in Dep File"

_doctor_stack_ok_dir="$_CAIRN_TMPDIR/doctor_stack_ok_$$"
mkdir -p "$_doctor_stack_ok_dir/.cairn/history" "$_doctor_stack_ok_dir/.cairn/domains" \
    "$_doctor_stack_ok_dir/.cairn/staged"

{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""
    echo "api: fastify"
    echo ""; echo "## debt"; echo ""
} > "$_doctor_stack_ok_dir/.cairn/output.md"

# package.json that DOES include "fastify"
printf '{"dependencies":{"fastify":"^4.0.0","axios":"^1.0.0"}}' \
    > "$_doctor_stack_ok_dir/package.json"

_stack_ok_exit=0
_stack_ok_output="$_CAIRN_TMPDIR/doctor_stack_ok_out_$$.txt"
(cd "$_doctor_stack_ok_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_stack_ok_output" \
    || _stack_ok_exit=$?

assert_exit_code "stack ok: doctor exits 0" 0 "$_stack_ok_exit"
assert_contains "stack ok: no drift warning" "$_stack_ok_output" "stack entries match"

# =============================================================================
# Audit check: transition without audit → warns
# =============================================================================

start_suite "cairn doctor — Transition History Without Audit Warns"

_doctor_noaudit_dir="$_CAIRN_TMPDIR/doctor_noaudit_$$"
mkdir -p "$_doctor_noaudit_dir/.cairn/history" "$_doctor_noaudit_dir/.cairn/domains" \
    "$_doctor_noaudit_dir/.cairn/staged"

{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""; echo "## debt"; echo ""
} > "$_doctor_noaudit_dir/.cairn/output.md"

# Write a transition history entry with no corresponding audit
{
    echo "type: transition"
    echo "domain: state-management"
    echo "decision_date: 2024-05"
    echo "recorded_date: 2024-05"
    echo "summary: migrated from Redux to Zustand"
    echo "rejected: Redux: boilerplate overhead"
    echo "reason: Team alignment on simpler state model"
    echo "revisit_when: never"
} > "$_doctor_noaudit_dir/.cairn/history/2024-05_redux-to-zustand.md"

_noaudit_output="$_CAIRN_TMPDIR/doctor_noaudit_out_$$.txt"
_noaudit_exit=0
(cd "$_doctor_noaudit_dir" && bash "$_CAIRN_BIN" doctor 2>&1) > "$_noaudit_output" \
    || _noaudit_exit=$?

assert_exit_code "missing audit: doctor exits 1" 1 "$_noaudit_exit"
assert_contains "missing audit: warning shows domain" "$_noaudit_output" "state-management"

# =============================================================================
# Audit check: transition WITH matching audit → no warning
# =============================================================================

start_suite "cairn doctor — Transition With Matching Audit Is OK"

_doctor_audit_ok_dir="$_CAIRN_TMPDIR/doctor_audit_ok_$$"
mkdir -p "$_doctor_audit_ok_dir/.cairn/history" "$_doctor_audit_ok_dir/.cairn/domains" \
    "$_doctor_audit_ok_dir/.cairn/staged" "$_doctor_audit_ok_dir/.cairn/audits"

{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""
    echo "## stack"; echo ""; echo "## debt"; echo ""
} > "$_doctor_audit_ok_dir/.cairn/output.md"

{
    echo "type: transition"
    echo "domain: state-management"
    echo "decision_date: 2024-05"
    echo "recorded_date: 2024-05"
    echo "summary: migrated from Redux to Zustand"
    echo "rejected: Redux"
    echo "reason: Simpler model"
    echo "revisit_when: never"
} > "$_doctor_audit_ok_dir/.cairn/history/2024-05_redux-to-zustand.md"

# Audit file for the same domain
{
    echo "# Audit: migrated from Redux to Zustand"
    echo "date: 2024-05"
    echo "domain: state-management"
    echo "trigger: migrated from Redux to Zustand"
    echo "status: complete"
    echo ""
    echo "## Expected removals"
    echo "- redux package"
    echo ""
    echo "## Findings"
    echo "- redux removed from package.json"
    echo ""
    echo "## Follow-up"
    echo "- none"
} > "$_doctor_audit_ok_dir/.cairn/audits/2024-05_state-management-migration.md"

_audit_ok_exit=0
(cd "$_doctor_audit_ok_dir" && bash "$_CAIRN_BIN" doctor 2>/dev/null) || _audit_ok_exit=$?
assert_exit_code "audit ok: doctor exits 0" 0 "$_audit_ok_exit"
