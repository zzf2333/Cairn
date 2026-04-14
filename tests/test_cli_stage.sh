#!/usr/bin/env bash
# cairn stage tests
# Sourced by run_tests.sh — expects TESTS_DIR, REPO_ROOT, and _CAIRN_TMPDIR to be set.
#
# Tests cairn stage review interactive loop (stdin simulation):
#   - empty staged dir → exit 0 with "no entries" message
#   - skip: file stays in staged/
#   - accept (no [TODO]): file moves from staged/ to history/
#   - accept with [TODO]: triggers confirmation; 'n' → stays; 'y' → moves
#   - quit: stops without processing remaining entries
#   - history conflict: accept skips when filename already in history/

_CAIRN_BIN="$REPO_ROOT/cli/cairn"

# =============================================================================
# Fixture helper
# =============================================================================

# Create a minimal .cairn/ with a staged entry.
# $1 = project dir
# $2 = staged filename (e.g. "2024-05_test-entry.md")
# $3 = "has_todo" | "no_todo"  — controls whether [TODO] is in the file
_create_stage_fixture() {
    local dir="$1"
    local staged_fname="$2"
    local todo_mode="${3:-no_todo}"

    mkdir -p "$dir/.cairn/history" "$dir/.cairn/domains" "$dir/.cairn/staged"

    {
        echo "## stage"
        echo ""
        echo "phase: test-phase (2024-01+)"
        echo "mode: stability > speed"
        echo ""
        echo "## no-go"
        echo ""
        echo "## hooks"
        echo ""
        echo "## stack"
        echo ""
        echo "## debt"
        echo ""
    } > "$dir/.cairn/output.md"

    local reason_val="Latency improvement below threshold"
    local revisit_val="When P99 > 200ms consistently"
    if [ "$todo_mode" = "has_todo" ]; then
        reason_val="[TODO]"
        revisit_val="[TODO]"
    fi

    {
        echo "type: rejection"
        echo "domain: api-layer"
        echo "decision_date: 2024-05"
        echo "recorded_date: 2024-05"
        echo "summary: gRPC internal traffic rejected"
        echo "rejected: gRPC: latency improvement < 30%"
        echo "reason: ${reason_val}"
        echo "revisit_when: ${revisit_val}"
    } > "$dir/.cairn/staged/$staged_fname"
}

# =============================================================================
# Empty staged directory → exit 0
# =============================================================================

start_suite "cairn stage review — Empty Staged Dir Exits 0"

_stage_empty_dir="$_CAIRN_TMPDIR/stage_empty_$$"
mkdir -p "$_stage_empty_dir"
mkdir -p "$_stage_empty_dir/.cairn/history" "$_stage_empty_dir/.cairn/staged"
{
    echo "## stage"; echo ""; echo "phase: test (2024-01+)"; echo ""
    echo "## no-go"; echo ""; echo "## hooks"; echo ""; echo "## stack"; echo ""; echo "## debt"; echo ""
} > "$_stage_empty_dir/.cairn/output.md"

_empty_exit=0
(cd "$_stage_empty_dir" && echo "q" | bash "$_CAIRN_BIN" stage review 2>/dev/null) \
    || _empty_exit=$?
assert_exit_code "empty staged dir exits 0" 0 "$_empty_exit"

# =============================================================================
# Skip: file remains in staged/, does not move to history/
# =============================================================================

start_suite "cairn stage review — Skip Keeps File in Staged"

_stage_skip_dir="$_CAIRN_TMPDIR/stage_skip_$$"
mkdir -p "$_stage_skip_dir"
_create_stage_fixture "$_stage_skip_dir" "2024-05_grpc-internal-traffic-rejected.md" "no_todo"

# Send "s" to skip, then "q" to quit
(cd "$_stage_skip_dir" && printf "s\nq\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null)

assert_file_exists "staged file remains after skip" \
    "$_stage_skip_dir/.cairn/staged/2024-05_grpc-internal-traffic-rejected.md"
assert_file_not_exists "history file not created after skip" \
    "$_stage_skip_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md"

# =============================================================================
# Accept (no [TODO]): file moves from staged/ to history/
# =============================================================================

start_suite "cairn stage review — Accept Moves File to History"

_stage_accept_dir="$_CAIRN_TMPDIR/stage_accept_$$"
mkdir -p "$_stage_accept_dir"
_create_stage_fixture "$_stage_accept_dir" "2024-05_grpc-internal-traffic-rejected.md" "no_todo"

# Send "a" to accept
(cd "$_stage_accept_dir" && printf "a\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null)

assert_file_not_exists "staged file removed after accept" \
    "$_stage_accept_dir/.cairn/staged/2024-05_grpc-internal-traffic-rejected.md"
assert_file_exists "history file created after accept" \
    "$_stage_accept_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md"

# Verify the moved file content is intact
_accepted_file="$_stage_accept_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md"
assert_contains "accepted file has correct type"   "$_accepted_file" "^type: rejection$"
assert_contains "accepted file has correct domain" "$_accepted_file" "^domain: api-layer$"

# =============================================================================
# Accept with [TODO]: 'n' cancels (file stays in staged/)
# =============================================================================

start_suite "cairn stage review — Accept with [TODO]: Cancel Keeps in Staged"

_stage_todo_n_dir="$_CAIRN_TMPDIR/stage_todo_n_$$"
mkdir -p "$_stage_todo_n_dir"
_create_stage_fixture "$_stage_todo_n_dir" "2024-05_grpc-internal-traffic-rejected.md" "has_todo"

# Send "a" then "n" to cancel the [TODO] confirmation
(cd "$_stage_todo_n_dir" && printf "a\nn\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null) || true

assert_file_exists "staged file stays after 'a' + 'n' cancel" \
    "$_stage_todo_n_dir/.cairn/staged/2024-05_grpc-internal-traffic-rejected.md"
assert_file_not_exists "history file not created after 'a' + 'n' cancel" \
    "$_stage_todo_n_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md"

# =============================================================================
# Accept with [TODO]: 'y' overrides and moves to history/
# =============================================================================

start_suite "cairn stage review — Accept with [TODO]: 'y' Moves to History"

_stage_todo_y_dir="$_CAIRN_TMPDIR/stage_todo_y_$$"
mkdir -p "$_stage_todo_y_dir"
_create_stage_fixture "$_stage_todo_y_dir" "2024-05_grpc-internal-traffic-rejected.md" "has_todo"

# Send "a" then "y" to confirm [TODO] override
(cd "$_stage_todo_y_dir" && printf "a\ny\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null)

assert_file_not_exists "staged file removed after 'a' + 'y' override" \
    "$_stage_todo_y_dir/.cairn/staged/2024-05_grpc-internal-traffic-rejected.md"
assert_file_exists "history file created after 'a' + 'y' override" \
    "$_stage_todo_y_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md"

# Verify [TODO] is preserved in history (we accepted as-is)
assert_contains "accepted file still has [TODO] (user chose to keep)" \
    "$_stage_todo_y_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md" "\[TODO\]"

# =============================================================================
# Quit: stops processing, remaining files stay in staged/
# =============================================================================

start_suite "cairn stage review — Quit Stops Without Processing"

_stage_quit_dir="$_CAIRN_TMPDIR/stage_quit_$$"
mkdir -p "$_stage_quit_dir"
_create_stage_fixture "$_stage_quit_dir" "2024-05_first-entry.md" "no_todo"
# Add a second staged entry
cp "$_stage_quit_dir/.cairn/staged/2024-05_first-entry.md" \
   "$_stage_quit_dir/.cairn/staged/2024-06_second-entry.md"

# Send "q" immediately
_quit_exit=0
(cd "$_stage_quit_dir" && printf "q\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null) || _quit_exit=$?
assert_exit_code "quit exits 0" 0 "$_quit_exit"

assert_file_exists "first staged file untouched after quit" \
    "$_stage_quit_dir/.cairn/staged/2024-05_first-entry.md"
assert_file_exists "second staged file untouched after quit" \
    "$_stage_quit_dir/.cairn/staged/2024-06_second-entry.md"

# =============================================================================
# History conflict: accept skips gracefully when filename already in history/
# =============================================================================

start_suite "cairn stage review — History Conflict: Accept Skips"

_stage_conflict_dir="$_CAIRN_TMPDIR/stage_conflict_$$"
mkdir -p "$_stage_conflict_dir"
_create_stage_fixture "$_stage_conflict_dir" "2024-05_grpc-internal-traffic-rejected.md" "no_todo"

# Pre-populate history/ with the same filename
cp "$_stage_conflict_dir/.cairn/staged/2024-05_grpc-internal-traffic-rejected.md" \
   "$_stage_conflict_dir/.cairn/history/2024-05_grpc-internal-traffic-rejected.md"

# Send "a" — should detect conflict and skip (not crash)
_conflict_exit=0
(cd "$_stage_conflict_dir" && printf "a\n" \
    | bash "$_CAIRN_BIN" stage review 2>/dev/null) || _conflict_exit=$?
assert_exit_code "history conflict: stage review exits 0 (graceful)" 0 "$_conflict_exit"

assert_file_exists "staged file still present after conflict" \
    "$_stage_conflict_dir/.cairn/staged/2024-05_grpc-internal-traffic-rejected.md"

# =============================================================================
# Stage subcommand: unknown subverb exits non-zero
# =============================================================================

start_suite "cairn stage — Unknown Subverb Exits Non-Zero"

_stage_unk_dir="$_CAIRN_TMPDIR/stage_unk_$$"
mkdir -p "$_stage_unk_dir/.cairn"

_stage_unk_exit=0
(cd "$_stage_unk_dir" && bash "$_CAIRN_BIN" stage purge 2>/dev/null) || _stage_unk_exit=$?
assert_exit_code "cairn stage purge exits non-zero" 1 "$_stage_unk_exit"
