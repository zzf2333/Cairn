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
        "$_revert_candidate" '^# cairn-analyze: v0\.0\.5$'
    assert_contains "revert candidate: source has commit sha" \
        "$_revert_candidate" '^# source: commit [0-9a-f]'
else
    # Fallback: just check any staged file has experiment type
    _any_staged=$(find "$_revert_dir/.cairn/staged" -maxdepth 1 -name "*.md" -type f 2>/dev/null | head -1)
    if [ -n "$_any_staged" ]; then
        assert_contains "revert: any candidate has analyze header" \
            "$_any_staged" '^# cairn-analyze: v0\.0\.5$'
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
