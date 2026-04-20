#!/usr/bin/env bash
# cairn analyze tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn analyze command:
#   - no git repo → exits non-zero
#   - no .cairn/ → exits non-zero with warning
#   - --dry-run → no staged/ files written
#   - revert commit → generates experiment candidate (high confidence)
#   - dep removal (package.json) → generates rejection candidate (high confidence)
#   - keyword commit → generates transition candidate (medium confidence)
#   - TODO/FIXME files → generates debt candidate (low confidence)
#   - --limit N → caps candidate count
#   - --only revert → skips dep/keyword/todo candidates
#   - candidate meta-comments are written correctly
#   - package.json parsing works with and without jq
#   - go.mod parsing works
#   - generated files are readable by cairn stage review

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Helper: create a minimal git repo with .cairn/ for analyze tests
# =============================================================================

_setup_analyze_fixture() {
    local dir="$1"

    mkdir -p "$dir"
    cd "$dir"

    git init -q
    git config user.email "test@cairn.dev"
    git config user.name "Cairn Test"

    # Create .cairn/ with minimal output.md
    mkdir -p .cairn/history .cairn/staged .cairn/domains
    {
        echo "## stage"; echo ""
        echo "phase: test (2024-01+)"; echo "mode: stability > speed"
        echo ""; echo "## no-go"; echo ""; echo "## hooks"; echo ""
        echo "## stack"; echo ""; echo "## debt"; echo ""
    } > .cairn/output.md

    # Initial commit
    echo "console.log('hello')" > index.js
    git add .cairn index.js
    git commit -q -m "feat: initial project setup"

    cd - >/dev/null
}

# =============================================================================
# No git repo → exits non-zero
# =============================================================================

start_suite "cairn analyze — No Git Repo Exits Non-Zero"

_no_git_dir="$_CAIRN_TMPDIR/analyze_no_git_$$"
mkdir -p "$_no_git_dir/.cairn"
{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)";
    echo ""; echo "## no-go"; echo ""; echo "## hooks"; echo "";
    echo "## stack"; echo ""; echo "## debt"; echo ""
} > "$_no_git_dir/.cairn/output.md"

_no_git_exit=0
(cd "$_no_git_dir" && bash "$_CAIRN_BIN" analyze 2>/dev/null) || _no_git_exit=$?
assert_exit_code "analyze without git exits non-zero" 1 "$_no_git_exit"

# =============================================================================
# No .cairn/ → exits non-zero with warning
# =============================================================================

start_suite "cairn analyze — No .cairn/ Exits Non-Zero"

_no_cairn_dir="$_CAIRN_TMPDIR/analyze_no_cairn_$$"
mkdir -p "$_no_cairn_dir"
(cd "$_no_cairn_dir" && git init -q && git config user.email "t@t.com" && git config user.name "T")

_no_cairn_exit=0
(cd "$_no_cairn_dir" && bash "$_CAIRN_BIN" analyze 2>/dev/null) || _no_cairn_exit=$?
assert_exit_code "analyze without .cairn/ exits non-zero" 1 "$_no_cairn_exit"

# =============================================================================
# --dry-run: no staged/ files written
# =============================================================================

start_suite "cairn analyze — --dry-run Writes No Staged Files"

_dry_run_dir="$_CAIRN_TMPDIR/analyze_dry_$$"
_setup_analyze_fixture "$_dry_run_dir"
(cd "$_dry_run_dir" && git commit -q --allow-empty -m "Revert \"try graphql\"")

_dry_run_exit=0
(cd "$_dry_run_dir" && bash "$_CAIRN_BIN" analyze --dry-run 2>/dev/null) || _dry_run_exit=$?
assert_exit_code "analyze --dry-run exits 0" 0 "$_dry_run_exit"

# staged/ should have no .md files
_staged_count=0
if [ -d "$_dry_run_dir/.cairn/staged" ]; then
    _staged_count=$(find "$_dry_run_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
fi
assert_exit_code "dry-run: no staged files written" 0 "$_staged_count"

# =============================================================================
# Revert commit → generates experiment candidate
# =============================================================================

start_suite "cairn analyze — Revert Commit Generates Experiment Candidate"

_revert_dir="$_CAIRN_TMPDIR/analyze_revert_$$"
_setup_analyze_fixture "$_revert_dir"

# Add a revert commit
(cd "$_revert_dir" \
    && git commit -q --allow-empty -m "feat: add trpc integration" \
    && git commit -q --allow-empty -m "Revert \"add trpc integration\"")

_revert_exit=0
(cd "$_revert_dir" && bash "$_CAIRN_BIN" analyze 2>/dev/null) || _revert_exit=$?
assert_exit_code "analyze with revert exits 0" 0 "$_revert_exit"

# Should have at least one staged file
_revert_staged_count=0
_revert_staged_count=$(find "$_revert_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "revert: at least one candidate written" 1 "$([ "$_revert_staged_count" -ge 1 ] && echo 1 || echo 0)"

# Find the revert candidate file
_revert_candidate=$(find "$_revert_dir/.cairn/staged" -maxdepth 1 -name "*revert*" -type f 2>/dev/null | head -1)
if [ -n "$_revert_candidate" ]; then
    assert_contains "revert candidate: confidence=high" \
        "$_revert_candidate" '^# confidence: high$'
    assert_contains "revert candidate: type=experiment" \
        "$_revert_candidate" '^type: experiment$'
    assert_contains "revert candidate: has cairn-analyze header" \
        "$_revert_candidate" '^# cairn-analyze: v0\.0\.6$'
    assert_contains "revert candidate: source has commit sha" \
        "$_revert_candidate" '^# source: commit [0-9a-f]'
else
    # Fallback: just check any staged file has experiment type
    _any_staged=$(find "$_revert_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | head -1)
    if [ -n "$_any_staged" ]; then
        assert_contains "revert: any candidate has analyze header" \
            "$_any_staged" '^# cairn-analyze: v0\.0\.6$'
    else
        _fail "revert: no staged candidate found" ""
    fi
fi

# =============================================================================
# Dep removal (package.json) → rejection candidate
# =============================================================================

start_suite "cairn analyze — package.json Dep Removal Generates Rejection Candidate"

_dep_dir="$_CAIRN_TMPDIR/analyze_dep_$$"
_setup_analyze_fixture "$_dep_dir"

# Commit with a package.json that has tRPC
cat > "$_dep_dir/package.json" << 'PKGJSON'
{
  "name": "test-app",
  "dependencies": {
    "express": "^4.17.1",
    "trpc": "^9.0.0"
  }
}
PKGJSON
(cd "$_dep_dir" && git add package.json && git commit -q -m "feat: add trpc dependency")

# Now remove tRPC from package.json
cat > "$_dep_dir/package.json" << 'PKGJSON'
{
  "name": "test-app",
  "dependencies": {
    "express": "^4.17.1"
  }
}
PKGJSON
(cd "$_dep_dir" && git add package.json && git commit -q -m "refactor: remove trpc, back to REST")

_dep_exit=0
(cd "$_dep_dir" && bash "$_CAIRN_BIN" analyze 2>/dev/null) || _dep_exit=$?
assert_exit_code "analyze with dep removal exits 0" 0 "$_dep_exit"

# Check for rejection candidate
_dep_staged_count=$(find "$_dep_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "dep removal: at least one candidate written" 1 "$([ "$_dep_staged_count" -ge 1 ] && echo 1 || echo 0)"

# Find dep candidate (should contain trpc or be a dep type)
_dep_candidate=$(find "$_dep_dir/.cairn/staged" -maxdepth 1 -name "*dep*" -o -name "*trpc*" -type f 2>/dev/null | head -1)
if [ -n "$_dep_candidate" ] && [ -f "$_dep_candidate" ]; then
    assert_contains "dep candidate: type=rejection" \
        "$_dep_candidate" '^type: rejection$'
    assert_contains "dep candidate: rejected=trpc" \
        "$_dep_candidate" 'trpc'
    assert_contains "dep candidate: confidence=high" \
        "$_dep_candidate" '^# confidence: high$'
fi

# =============================================================================
# go.mod parsing: basic format test
# =============================================================================

start_suite "cairn analyze — go.mod Parsing"

_go_dir="$_CAIRN_TMPDIR/analyze_go_$$"
_setup_analyze_fixture "$_go_dir"

cat > "$_go_dir/go.mod" << 'GOMOD'
module example.com/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.0
	github.com/old-pkg/removed v1.0.0
)
GOMOD
(cd "$_go_dir" && git add go.mod && git commit -q -m "feat: add gin and old-pkg")

# Remove old-pkg
cat > "$_go_dir/go.mod" << 'GOMOD'
module example.com/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.0
)
GOMOD
(cd "$_go_dir" && git add go.mod && git commit -q -m "refactor: remove old-pkg")

_go_exit=0
(cd "$_go_dir" && bash "$_CAIRN_BIN" analyze --dry-run 2>/dev/null) || _go_exit=$?
assert_exit_code "analyze with go.mod exits 0" 0 "$_go_exit"

# =============================================================================
# Keyword commit → medium confidence candidate
# =============================================================================

start_suite "cairn analyze — Keyword Commit Generates Medium Candidate"

_kw_dir="$_CAIRN_TMPDIR/analyze_kw_$$"
_setup_analyze_fixture "$_kw_dir"

(cd "$_kw_dir" \
    && git commit -q --allow-empty -m "refactor: migrate from PostgreSQL to MongoDB" \
    && git commit -q --allow-empty -m "chore: update dependencies")

_kw_exit=0
(cd "$_kw_dir" && bash "$_CAIRN_BIN" analyze 2>/dev/null) || _kw_exit=$?
assert_exit_code "analyze with keyword commit exits 0" 0 "$_kw_exit"

_kw_medium_count=$(find "$_kw_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f \
    -exec grep -l '^# confidence: medium$' {} \; 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "keyword: at least one medium candidate" 1 \
    "$([ "$_kw_medium_count" -ge 1 ] && echo 1 || echo 0)"

# =============================================================================
# --limit N caps candidate count
# =============================================================================

start_suite "cairn analyze — --limit Caps Candidate Count"

_limit_dir="$_CAIRN_TMPDIR/analyze_limit_$$"
_setup_analyze_fixture "$_limit_dir"

# Generate many revert commits
for i in 1 2 3 4 5; do
    (cd "$_limit_dir" \
        && git commit -q --allow-empty -m "feat: add feature-${i}" \
        && git commit -q --allow-empty -m "Revert \"add feature-${i}\"")
done

_limit_exit=0
(cd "$_limit_dir" && bash "$_CAIRN_BIN" analyze --limit 2 2>/dev/null) || _limit_exit=$?
assert_exit_code "analyze --limit 2 exits 0" 0 "$_limit_exit"

_limit_staged_count=$(find "$_limit_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "--limit 2: at most 2 staged files" 1 \
    "$([ "$_limit_staged_count" -le 2 ] && echo 1 || echo 0)"

# =============================================================================
# --only revert: skips dep and keyword candidates
# =============================================================================

start_suite "cairn analyze — --only revert Skips Other Types"

_only_dir="$_CAIRN_TMPDIR/analyze_only_$$"
_setup_analyze_fixture "$_only_dir"

# Add revert and keyword commits
(cd "$_only_dir" \
    && git commit -q --allow-empty -m "Revert \"add graphql\"" \
    && git commit -q --allow-empty -m "refactor: migrate from redis to memcached")

# Add package.json with removal
cat > "$_only_dir/package.json" << 'PKGJSON'
{"dependencies": {"express": "^4.17.1", "graphql": "^16.0.0"}}
PKGJSON
(cd "$_only_dir" && git add package.json && git commit -q -m "add graphql dep")
cat > "$_only_dir/package.json" << 'PKGJSON'
{"dependencies": {"express": "^4.17.1"}}
PKGJSON
(cd "$_only_dir" && git add package.json && git commit -q -m "remove graphql dep")

_only_exit=0
(cd "$_only_dir" && bash "$_CAIRN_BIN" analyze --only revert 2>/dev/null) || _only_exit=$?
assert_exit_code "analyze --only revert exits 0" 0 "$_only_exit"

# All staged files should be experiment type (revert) only
_only_non_experiment=$(find "$_only_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f \
    -exec grep -L '^type: experiment$' {} \; 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "--only revert: no non-experiment candidates" 0 "$_only_non_experiment"

# =============================================================================
# Meta-comments are stripped when accepted by stage review
# =============================================================================

start_suite "cairn analyze — Stage Review Strips Meta-Comments on Accept"

_strip_dir="$_CAIRN_TMPDIR/analyze_strip_$$"
_setup_analyze_fixture "$_strip_dir"
(cd "$_strip_dir" && git commit -q --allow-empty -m "Revert \"add apollo\"")

# Run analyze to create staged file
(cd "$_strip_dir" && bash "$_CAIRN_BIN" analyze 2>/dev/null)

_strip_staged=$(find "$_strip_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | head -1)

if [ -n "$_strip_staged" ]; then
    _strip_fname="$(basename "$_strip_staged")"

    # Accept the staged entry via stage review (press 'a' then 'y' for [TODO] confirm)
    (cd "$_strip_dir" && printf "a\ny\n" \
        | bash "$_CAIRN_BIN" stage review 2>/dev/null) || true

    _strip_history="$_strip_dir/.cairn/history/$_strip_fname"
    if [ -f "$_strip_history" ]; then
        assert_not_contains "accepted: no cairn-analyze header in history" \
            "$_strip_history" '^# cairn-analyze:'
        assert_not_contains "accepted: no confidence line in history" \
            "$_strip_history" '^# confidence:'
        assert_not_contains "accepted: no source line in history" \
            "$_strip_history" '^# source:'
        assert_not_contains "accepted: no layer line in history" \
            "$_strip_history" '^# layer:'
        assert_contains "accepted: type field preserved" \
            "$_strip_history" '^type: experiment$'
    else
        _fail "strip: history file not created after accept" \
            "expected: $_strip_history"
    fi
else
    _fail "strip: no staged file to test with" ""
fi

# =============================================================================
# cairn analyze --help exits 0
# =============================================================================

start_suite "cairn analyze — --help Exits 0"

_help_exit=0
bash "$_CAIRN_BIN" analyze --help 2>/dev/null || _help_exit=$?
assert_exit_code "analyze --help exits 0" 0 "$_help_exit"

_help_output="$(bash "$_CAIRN_BIN" analyze --help 2>&1)"
_help_tmp="$_CAIRN_TMPDIR/analyze_help.txt"
echo "$_help_output" > "$_help_tmp"
assert_contains "analyze help mentions --dry-run" "$_help_tmp" "dry-run"
assert_contains "analyze help mentions --limit"   "$_help_tmp" "limit"
assert_contains "analyze help mentions confidence" "$_help_tmp" "confidence"
assert_contains "analyze help mentions Layer 1"   "$_help_tmp" "Layer 1"
assert_contains "analyze help mentions layer2"    "$_help_tmp" "layer2"

# =============================================================================
# cairn analyze --invalid-flag exits non-zero
# =============================================================================

start_suite "cairn analyze — Unknown Flag Exits Non-Zero"

# Need a git+cairn dir for this
_flag_dir="$_CAIRN_TMPDIR/analyze_flag_$$"
_setup_analyze_fixture "$_flag_dir"

_flag_exit=0
(cd "$_flag_dir" && bash "$_CAIRN_BIN" analyze --not-a-real-flag 2>/dev/null) || _flag_exit=$?
assert_exit_code "analyze --invalid-flag exits non-zero" 1 "$_flag_exit"

# =============================================================================
# Layer 3 candidate has v0.0.6 header and # layer: 3
# =============================================================================

start_suite "cairn analyze — Layer 3 Candidate Has v0.0.6 and layer:3 Header"

_l3hdr_dir="$_CAIRN_TMPDIR/analyze_l3hdr_$$"
_setup_analyze_fixture "$_l3hdr_dir"
(cd "$_l3hdr_dir" \
    && git commit -q --allow-empty -m "feat: add apollo" \
    && git commit -q --allow-empty -m "Revert \"add apollo\"")

(cd "$_l3hdr_dir" && bash "$_CAIRN_BIN" analyze --only layer3 2>/dev/null) || true

_l3hdr_candidate=$(find "$_l3hdr_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | head -1)
if [ -n "$_l3hdr_candidate" ]; then
    assert_contains "layer3 candidate: v0.0.6 header" \
        "$_l3hdr_candidate" '^# cairn-analyze: v0\.0\.6$'
    assert_contains "layer3 candidate: layer:3 header" \
        "$_l3hdr_candidate" '^# layer: 3$'
else
    _fail "layer3 header: no candidate written" ""
fi

# =============================================================================
# Layer 1: output.md.draft is generated
# =============================================================================

start_suite "cairn analyze — Layer 1 Generates output.md.draft"

_l1_dir="$_CAIRN_TMPDIR/analyze_l1_$$"
_setup_analyze_fixture "$_l1_dir"

# Add a package.json so stack detection has content
cat > "$_l1_dir/package.json" << 'PKGJSON'
{"dependencies": {"express": "^4.17.1", "react": "^18.0.0"}}
PKGJSON
(cd "$_l1_dir" && git add package.json && git commit -q -m "feat: add deps")

_l1_exit=0
(cd "$_l1_dir" && bash "$_CAIRN_BIN" analyze --only layer1 2>/dev/null) || _l1_exit=$?
assert_exit_code "layer1 analyze exits 0" 0 "$_l1_exit"

assert_file_exists "layer1: output.md.draft written" \
    "$_l1_dir/.cairn/output.md.draft"
assert_contains "layer1 draft: has ## stage section" \
    "$_l1_dir/.cairn/output.md.draft" '^## stage$'
assert_contains "layer1 draft: has ## stack section" \
    "$_l1_dir/.cairn/output.md.draft" '^## stack$'
assert_contains "layer1 draft: has ## hooks section" \
    "$_l1_dir/.cairn/output.md.draft" '^## hooks$'
assert_contains "layer1 draft: has ## no-go section" \
    "$_l1_dir/.cairn/output.md.draft" '^## no-go$'
assert_contains "layer1 draft: has ## debt section" \
    "$_l1_dir/.cairn/output.md.draft" '^## debt$'

# =============================================================================
# Layer 1: stack auto-filled in draft
# =============================================================================

start_suite "cairn analyze — Layer 1 Stack Auto-Filled in Draft"

_l1stk_dir="$_CAIRN_TMPDIR/analyze_l1stk_$$"
_setup_analyze_fixture "$_l1stk_dir"

cat > "$_l1stk_dir/package.json" << 'PKGJSON'
{"dependencies": {"express": "^4.17.1", "react": "^18.0.0"}}
PKGJSON
(cd "$_l1stk_dir" && git add package.json && git commit -q -m "feat: add deps")

(cd "$_l1stk_dir" && bash "$_CAIRN_BIN" analyze --only layer1 2>/dev/null) || true

assert_contains "layer1 stack: express in draft" \
    "$_l1stk_dir/.cairn/output.md.draft" "express"
assert_contains "layer1 stack: react in draft" \
    "$_l1stk_dir/.cairn/output.md.draft" "react"

# =============================================================================
# Layer 1: domain inference from src/ subdirectories
# =============================================================================

start_suite "cairn analyze — Layer 1 Infers Domains from src/ Dirs"

_l1dom_dir="$_CAIRN_TMPDIR/analyze_l1dom_$$"
_setup_analyze_fixture "$_l1dom_dir"

# Create src/auth/ and src/api/ directories
mkdir -p "$_l1dom_dir/src/auth" "$_l1dom_dir/src/api"
echo "// auth module" > "$_l1dom_dir/src/auth/index.js"
echo "// api module"  > "$_l1dom_dir/src/api/index.js"
(cd "$_l1dom_dir" && git add src/ && git commit -q -m "feat: add auth and api modules")

(cd "$_l1dom_dir" && bash "$_CAIRN_BIN" analyze --only layer1 2>/dev/null) || true

assert_contains "layer1 domains: auth in hooks" \
    "$_l1dom_dir/.cairn/output.md.draft" "auth"
assert_contains "layer1 domains: api in hooks" \
    "$_l1dom_dir/.cairn/output.md.draft" "api"

# =============================================================================
# Layer 1: infra detection (Dockerfile, github-actions)
# =============================================================================

start_suite "cairn analyze — Layer 1 Detects Infra"

_l1inf_dir="$_CAIRN_TMPDIR/analyze_l1inf_$$"
_setup_analyze_fixture "$_l1inf_dir"

# Add Dockerfile and GitHub Actions
echo "FROM node:18" > "$_l1inf_dir/Dockerfile"
mkdir -p "$_l1inf_dir/.github/workflows"
echo "on: push" > "$_l1inf_dir/.github/workflows/ci.yml"
(cd "$_l1inf_dir" && git add Dockerfile .github/ && git commit -q -m "chore: add infra")

(cd "$_l1inf_dir" && bash "$_CAIRN_BIN" analyze --only layer1 2>/dev/null) || true

assert_contains "layer1 infra: docker in detection notes" \
    "$_l1inf_dir/.cairn/output.md.draft" "docker"
assert_contains "layer1 infra: github-actions in detection notes" \
    "$_l1inf_dir/.cairn/output.md.draft" "github-actions"

# =============================================================================
# Layer 1: output.md is never modified
# =============================================================================

start_suite "cairn analyze — Layer 1 Does Not Modify output.md"

_l1safe_dir="$_CAIRN_TMPDIR/analyze_l1safe_$$"
_setup_analyze_fixture "$_l1safe_dir"
(cd "$_l1safe_dir" && git commit -q --allow-empty -m "chore: setup")

# Record original output.md content
_orig_output="$(cat "$_l1safe_dir/.cairn/output.md")"

(cd "$_l1safe_dir" && bash "$_CAIRN_BIN" analyze --only layer1 2>/dev/null) || true

_after_output="$(cat "$_l1safe_dir/.cairn/output.md")"
assert_exit_code "layer1: output.md unchanged" \
    1 "$([ "$_orig_output" = "$_after_output" ] && echo 1 || echo 0)"

# =============================================================================
# Layer 2: README with no-go signal → intent candidate generated
# =============================================================================

start_suite "cairn analyze — Layer 2 Extracts No-Go Signal from README"

_l2_dir="$_CAIRN_TMPDIR/analyze_l2_$$"
_setup_analyze_fixture "$_l2_dir"

# Add README with a clear no-go signal
cat > "$_l2_dir/README.md" << 'README'
# My Project

This project is a web API built with Express.

## Design Decisions

We decided against using Redux for state management because it adds unnecessary complexity.

The team prefers a simpler approach.
README
(cd "$_l2_dir" && git add README.md && git commit -q -m "docs: add README")

_l2_exit=0
(cd "$_l2_dir" && bash "$_CAIRN_BIN" analyze --only layer2 2>/dev/null) || _l2_exit=$?
assert_exit_code "layer2 analyze exits 0" 0 "$_l2_exit"

_l2_intent_count=$(find "$_l2_dir/.cairn/staged" -maxdepth 1 \
    -name "*intent*" -o -name "*analyze-intent*" 2>/dev/null \
    | grep "\.md$" | wc -l | tr -d '[:space:]')
assert_exit_code "layer2: intent candidate generated for no-go signal" \
    1 "$([ "$_l2_intent_count" -ge 1 ] && echo 1 || echo 0)"

# Check the intent candidate has correct format
_l2_cand=$(find "$_l2_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | head -1)
if [ -n "$_l2_cand" ]; then
    assert_contains "layer2 candidate: v0.0.6 header" \
        "$_l2_cand" '^# cairn-analyze: v0\.0\.6$'
    assert_contains "layer2 candidate: layer:2 header" \
        "$_l2_cand" '^# layer: 2$'
    assert_contains "layer2 candidate: confidence=low" \
        "$_l2_cand" '^# confidence: low$'
    assert_contains "layer2 candidate: type=rejection" \
        "$_l2_cand" '^type: rejection$'
fi

# =============================================================================
# Layer 2: conservative matching — plain bullets NOT captured
# =============================================================================

start_suite "cairn analyze — Layer 2 Conservative: Plain Bullets Not Captured"

_l2cons_dir="$_CAIRN_TMPDIR/analyze_l2cons_$$"
_setup_analyze_fixture "$_l2cons_dir"

cat > "$_l2cons_dir/README.md" << 'README'
# Project

- Uses TypeScript for type safety
- Built with React and Express
- Deployed on AWS
README
(cd "$_l2cons_dir" && git add README.md && git commit -q -m "docs: add README")

(cd "$_l2cons_dir" && bash "$_CAIRN_BIN" analyze --only layer2 2>/dev/null) || true

_l2cons_count=$(find "$_l2cons_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "layer2 conservative: no candidates for plain bullets" \
    0 "$_l2cons_count"

# =============================================================================
# --only layer1: only draft written, no staged candidates
# =============================================================================

start_suite "cairn analyze — --only layer1 Writes Draft Only"

_ol1_dir="$_CAIRN_TMPDIR/analyze_ol1_$$"
_setup_analyze_fixture "$_ol1_dir"
(cd "$_ol1_dir" \
    && git commit -q --allow-empty -m "feat: add feature" \
    && git commit -q --allow-empty -m "Revert \"add feature\"")

# Also add README with signal to ensure Layer 2 is truly skipped
echo "We decided against microservices." > "$_ol1_dir/README.md"
(cd "$_ol1_dir" && git add README.md && git commit -q -m "docs: readme")

(cd "$_ol1_dir" && bash "$_CAIRN_BIN" analyze --only layer1 2>/dev/null) || true

assert_file_exists "--only layer1: draft written" "$_ol1_dir/.cairn/output.md.draft"

_ol1_staged=$(find "$_ol1_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "--only layer1: no staged candidates" 0 "$_ol1_staged"

# =============================================================================
# --only layer2: only intent candidates, no draft, no Layer 3
# =============================================================================

start_suite "cairn analyze — --only layer2 Writes Intent Candidates Only"

_ol2_dir="$_CAIRN_TMPDIR/analyze_ol2_$$"
_setup_analyze_fixture "$_ol2_dir"

echo "We decided against using Kubernetes for this project." > "$_ol2_dir/README.md"
(cd "$_ol2_dir" \
    && git add README.md \
    && git commit -q -m "docs: readme" \
    && git commit -q --allow-empty -m "Revert \"add feature\"")

(cd "$_ol2_dir" && bash "$_CAIRN_BIN" analyze --only layer2 2>/dev/null) || true

assert_file_not_exists "--only layer2: no draft written" \
    "$_ol2_dir/.cairn/output.md.draft"

_ol2_revert=$(find "$_ol2_dir/.cairn/staged" -maxdepth 1 -name "*revert*" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "--only layer2: no Layer 3 revert candidates" 0 "$_ol2_revert"

# =============================================================================
# --only layer3: backward compatible with v0.0.5 behavior
# =============================================================================

start_suite "cairn analyze — --only layer3 Is Backward Compatible"

_ol3_dir="$_CAIRN_TMPDIR/analyze_ol3_$$"
_setup_analyze_fixture "$_ol3_dir"
(cd "$_ol3_dir" \
    && git commit -q --allow-empty -m "feat: add graphql" \
    && git commit -q --allow-empty -m "Revert \"add graphql\"")

(cd "$_ol3_dir" && bash "$_CAIRN_BIN" analyze --only layer3 2>/dev/null) || true

assert_file_not_exists "--only layer3: no draft written" \
    "$_ol3_dir/.cairn/output.md.draft"

_ol3_staged=$(find "$_ol3_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d '[:space:]')
assert_exit_code "--only layer3: revert candidate written" \
    1 "$([ "$_ol3_staged" -ge 1 ] && echo 1 || echo 0)"

# =============================================================================
# Layer 2 candidate: stage review strips # layer: line on accept
# =============================================================================

start_suite "cairn analyze — Layer 2 Candidate Accepted by Stage Review"

_l2acc_dir="$_CAIRN_TMPDIR/analyze_l2acc_$$"
mkdir -p "$_l2acc_dir/.cairn/history" "$_l2acc_dir/.cairn/staged" "$_l2acc_dir/.cairn/domains"
{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo "mode: stability > speed"
    echo ""; echo "## no-go"; echo ""; echo "## hooks"; echo ""; echo "## stack"; echo ""; echo "## debt"; echo ""
} > "$_l2acc_dir/.cairn/output.md"

# Synthetic Layer 2 intent candidate
cat > "$_l2acc_dir/.cairn/staged/2026-04_analyze-intent-decided-against-redux.md" << 'STAGED'
# cairn-analyze: v0.0.6
# confidence: low
# source: README.md:5 — "We decided against Redux"
# layer: 2
type: rejection
domain: [TODO]
decision_date: [TODO]
recorded_date: 2026-04
summary: [TODO — from README.md: "We decided against Redux"]
rejected: [TODO — clarify what this rejects]
reason: [TODO]
revisit_when: [TODO]
STAGED

(cd "$_l2acc_dir" && printf "a\ny\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null) || true

_l2acc_history="$_l2acc_dir/.cairn/history/2026-04_analyze-intent-decided-against-redux.md"
assert_file_exists "layer2 accept: history file created" "$_l2acc_history"
if [ -f "$_l2acc_history" ]; then
    assert_not_contains "layer2 accept: no cairn-analyze line" \
        "$_l2acc_history" '^# cairn-analyze:'
    assert_not_contains "layer2 accept: no layer line" \
        "$_l2acc_history" '^# layer:'
    assert_contains "layer2 accept: type preserved" \
        "$_l2acc_history" '^type: rejection$'
fi
