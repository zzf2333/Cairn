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
