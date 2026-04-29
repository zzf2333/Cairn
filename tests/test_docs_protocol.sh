#!/usr/bin/env bash
# Public documentation protocol regression tests.
# Sourced by run_tests.sh — expects TESTS_DIR and REPO_ROOT to be set.

start_suite "Docs Protocol — MCP README Current Tool Surface"

_MCP_README_EN="$REPO_ROOT/mcp/README.md"
_MCP_README_ZH="$REPO_ROOT/mcp/README.zh.md"

for _mcp_readme in "$_MCP_README_EN" "$_MCP_README_ZH"; do
    _mcp_label="$(basename "$_mcp_readme")"
    assert_contains "$_mcp_label: documents cairn_output" \
        "$_mcp_readme" "cairn_output"
    assert_contains "$_mcp_label: documents cairn_domain" \
        "$_mcp_readme" "cairn_domain"
    assert_contains "$_mcp_label: documents cairn_query" \
        "$_mcp_readme" "cairn_query"
    assert_contains "$_mcp_label: documents cairn_write_history" \
        "$_mcp_readme" "cairn_write_history"
    assert_contains "$_mcp_label: documents cairn_doctor" \
        "$_mcp_readme" "cairn_doctor"
    assert_contains "$_mcp_label: documents cairn_match" \
        "$_mcp_readme" "cairn_match"

    assert_not_contains "$_mcp_label: no old cairn_propose tool" \
        "$_mcp_readme" "cairn_propose"
    assert_not_contains "$_mcp_label: no old cairn_sync_domain tool" \
        "$_mcp_readme" "cairn_sync_domain"
    assert_not_contains "$_mcp_label: no staged workflow" \
        "$_mcp_readme" "\\.cairn/staged/"
done

start_suite "Docs Protocol — Public English Current Workflow"

_PUBLIC_DOCS_EN="
$REPO_ROOT/README.md
$REPO_ROOT/mcp/README.md
$REPO_ROOT/spec/adoption-guide.md
$REPO_ROOT/examples/README.md
"

for _public_doc in $_PUBLIC_DOCS_EN; do
    _doc_label="${_public_doc#$REPO_ROOT/}"

    assert_not_contains "$_doc_label: no deleted cairn status command" \
        "$_public_doc" "cairn status"
    assert_not_contains "$_doc_label: no deleted cairn log command" \
        "$_public_doc" "cairn log"
    assert_not_contains "$_doc_label: no deleted cairn sync command" \
        "$_public_doc" "cairn sync"
    assert_not_contains "$_doc_label: no deleted cairn stage command" \
        "$_public_doc" "cairn stage"
    assert_not_contains "$_doc_label: no deleted cairn reflect command" \
        "$_public_doc" "cairn reflect"
    assert_not_contains "$_doc_label: no deleted cairn analyze command" \
        "$_public_doc" "cairn analyze"
    assert_not_contains "$_doc_label: no deleted cairn audit command" \
        "$_public_doc" "cairn audit"
    assert_not_contains "$_doc_label: no deleted cairn install-skill command" \
        "$_public_doc" "cairn install-skill"
    assert_not_contains "$_doc_label: no old cairn_propose MCP tool" \
        "$_public_doc" "cairn_propose"
    assert_not_contains "$_doc_label: no old cairn_sync_domain MCP tool" \
        "$_public_doc" "cairn_sync_domain"
done

assert_contains "README.md: documents cairn init" \
    "$REPO_ROOT/README.md" "cairn init"
assert_contains "README.md: documents cairn doctor" \
    "$REPO_ROOT/README.md" "cairn doctor"
assert_contains "adoption-guide.md: documents cairn init" \
    "$REPO_ROOT/spec/adoption-guide.md" "cairn init"
assert_contains "adoption-guide.md: documents cairn doctor" \
    "$REPO_ROOT/spec/adoption-guide.md" "cairn doctor"
assert_contains "examples/README.md: documents cairn doctor" \
    "$REPO_ROOT/examples/README.md" "cairn doctor"
