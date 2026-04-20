#!/usr/bin/env bash
# Cairn Phase 1 test suite entry point.
#
# Usage:
#   chmod +x tests/run_tests.sh
#   ./tests/run_tests.sh
#
# Exit code: 0 if all tests pass, 1 if any test fails.
#
# Test files sourced in order:
#   helpers.sh           — shared assertion functions and counters
#   test_init_script.sh  — cairn-init.sh behavior and output format tests
#   test_skill_files.sh  — skill file best-practice quality tests
#   test_examples.sh     — example file FORMAT.md compliance tests

TESTS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$TESTS_DIR/.." && pwd)"

# Temp directory for cairn-init.sh test scenarios
_CAIRN_TMPDIR=$(mktemp -d)
trap "rm -rf '$_CAIRN_TMPDIR'" EXIT

echo ""
echo -e "\033[1m\033[0;34mCairn Phase 1 Test Suite\033[0m"
echo -e "\033[2mRepo: $REPO_ROOT\033[0m"

# shellcheck source=helpers.sh
source "$TESTS_DIR/helpers.sh"
# shellcheck source=test_init_script.sh
source "$TESTS_DIR/test_init_script.sh"
# shellcheck source=test_skill_files.sh
source "$TESTS_DIR/test_skill_files.sh"
# shellcheck source=test_examples.sh
source "$TESTS_DIR/test_examples.sh"
# shellcheck source=test_cli_dispatch.sh
source "$TESTS_DIR/test_cli_dispatch.sh"
# shellcheck source=test_cli_status.sh
source "$TESTS_DIR/test_cli_status.sh"
# shellcheck source=test_cli_log.sh
source "$TESTS_DIR/test_cli_log.sh"
# shellcheck source=test_cli_sync.sh
source "$TESTS_DIR/test_cli_sync.sh"
# shellcheck source=test_cli_log_quick.sh
source "$TESTS_DIR/test_cli_log_quick.sh"
# shellcheck source=test_cli_doctor.sh
source "$TESTS_DIR/test_cli_doctor.sh"
# shellcheck source=test_cli_stage.sh
source "$TESTS_DIR/test_cli_stage.sh"
# shellcheck source=test_cli_analyze.sh
source "$TESTS_DIR/test_cli_analyze.sh"
# shellcheck source=test_cli_symlink.sh
source "$TESTS_DIR/test_cli_symlink.sh"

print_summary
