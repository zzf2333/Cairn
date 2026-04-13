#!/usr/bin/env bash
# Cairn test utilities — source this file, do not execute directly.
# Expects TESTS_DIR and REPO_ROOT to be set by run_tests.sh.

# ── Color support ──────────────────────────────────────────────────────────────
if [ -t 1 ] && command -v tput >/dev/null 2>&1 \
    && tput colors >/dev/null 2>&1 && [ "$(tput colors)" -ge 8 ]; then
    C_RESET="\033[0m"; C_BOLD="\033[1m"
    C_GREEN="\033[0;32m"; C_RED="\033[0;31m"
    C_YELLOW="\033[0;33m"; C_CYAN="\033[0;36m"; C_DIM="\033[2m"
else
    C_RESET=""; C_BOLD=""; C_GREEN=""; C_RED=""
    C_YELLOW=""; C_CYAN=""; C_DIM=""
fi

# ── Global counters ────────────────────────────────────────────────────────────
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# ── Suite header ───────────────────────────────────────────────────────────────
start_suite() {
    echo ""
    echo -e "${C_BOLD}${C_CYAN}▶ $1${C_RESET}"
    echo -e "${C_DIM}$(printf '─%.0s' $(seq 1 60))${C_RESET}"
}

# ── Core primitives ────────────────────────────────────────────────────────────
_pass() {
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "  ${C_GREEN}✓${C_RESET} $1"
}

_fail() {
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo -e "  ${C_RED}✗${C_RESET} $1"
    [ -n "${2:-}" ] && echo -e "    ${C_DIM}↳ $2${C_RESET}"
}

# ── Assertions ─────────────────────────────────────────────────────────────────

assert_dir_exists() {
    local desc="$1" path="$2"
    if [ -d "$path" ]; then _pass "$desc"
    else _fail "$desc" "directory not found: $path"; fi
}

assert_file_exists() {
    local desc="$1" path="$2"
    if [ -f "$path" ]; then _pass "$desc"
    else _fail "$desc" "file not found: $path"; fi
}

assert_file_not_exists() {
    local desc="$1" path="$2"
    if [ ! -f "$path" ]; then _pass "$desc"
    else _fail "$desc" "file should not exist: $path"; fi
}

# grep -qE pattern match
assert_contains() {
    local desc="$1" file="$2" pattern="$3"
    if grep -qE "$pattern" "$file" 2>/dev/null; then
        _pass "$desc"
    else
        _fail "$desc" "pattern not found: $pattern"
    fi
}

assert_not_contains() {
    local desc="$1" file="$2" pattern="$3"
    if ! grep -qE "$pattern" "$file" 2>/dev/null; then
        _pass "$desc"
    else
        _fail "$desc" "unexpected pattern found: $pattern"
    fi
}

# Verify "## sectionA" heading appears before "## sectionB" (line-number check)
assert_section_before() {
    local desc="$1" file="$2" section_a="$3" section_b="$4"
    local line_a line_b
    line_a=$(grep -n "^## ${section_a}$" "$file" 2>/dev/null | head -1 | cut -d: -f1)
    line_b=$(grep -n "^## ${section_b}$" "$file" 2>/dev/null | head -1 | cut -d: -f1)
    if [ -n "$line_a" ] && [ -n "$line_b" ] && [ "$line_a" -lt "$line_b" ]; then
        _pass "$desc"
    else
        _fail "$desc" \
            "'## $section_a' (line ${line_a:-missing}) not before '## $section_b' (line ${line_b:-missing})"
    fi
}

# Assert exit code
assert_exit_code() {
    local desc="$1" expected="$2" actual="$3"
    if [ "$actual" -eq "$expected" ]; then
        _pass "$desc"
    else
        _fail "$desc" "expected exit code $expected, got $actual"
    fi
}

# Count occurrences of pattern; assert equals expected
assert_count() {
    local desc="$1" file="$2" pattern="$3" expected="$4"
    local actual
    actual=$(grep -cE "$pattern" "$file" 2>/dev/null)
    if [ "${actual:-0}" -eq "$expected" ]; then
        _pass "$desc"
    else
        _fail "$desc" "expected $expected match(es) of '$pattern', found ${actual:-0}"
    fi
}

# ── Summary ────────────────────────────────────────────────────────────────────
print_summary() {
    local border
    border=$(printf '═%.0s' $(seq 1 60))
    echo ""
    echo -e "${C_BOLD}${border}${C_RESET}"
    echo -e "${C_BOLD}  Results: ${TESTS_PASSED} / ${TESTS_RUN} passed${C_RESET}"
    if [ "$TESTS_FAILED" -gt 0 ]; then
        echo -e "  ${C_RED}${TESTS_FAILED} test(s) failed${C_RESET}"
        echo -e "${C_BOLD}${border}${C_RESET}"
        echo ""
        return 1
    else
        echo -e "  ${C_GREEN}All ${TESTS_RUN} tests passed${C_RESET}"
        echo -e "${C_BOLD}${border}${C_RESET}"
        echo ""
        return 0
    fi
}
