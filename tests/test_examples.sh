#!/usr/bin/env bash
# Example file FORMAT.md compliance tests
# Sourced by run_tests.sh — expects TESTS_DIR and REPO_ROOT to be set.
#
# Validates that examples/saas-18mo/.cairn/ conforms to spec/FORMAT.md:
#   - output.md: required sections, field formats
#   - domains/*.md: 5 required sections, rejected-paths conventions
#   - history/*.md: all 8 required fields, valid type values, YYYY-MM dates

_EXAMPLE_DIR="$REPO_ROOT/examples/saas-18mo/.cairn"

# =============================================================================
# output.md compliance
# =============================================================================

start_suite "Example output.md — Required Sections & Order"
assert_contains "## stage section exists"  "$_EXAMPLE_DIR/output.md" "^## stage$"
assert_contains "## no-go section exists"  "$_EXAMPLE_DIR/output.md" "^## no-go$"
assert_contains "## hooks section exists"  "$_EXAMPLE_DIR/output.md" "^## hooks$"
assert_contains "## stack section exists"  "$_EXAMPLE_DIR/output.md" "^## stack$"
assert_contains "## debt section exists"   "$_EXAMPLE_DIR/output.md" "^## debt$"
assert_section_before "stage before no-go" "$_EXAMPLE_DIR/output.md" "stage" "no-go"
assert_section_before "no-go before hooks" "$_EXAMPLE_DIR/output.md" "no-go" "hooks"
assert_section_before "hooks before stack" "$_EXAMPLE_DIR/output.md" "hooks" "stack"
assert_section_before "stack before debt"  "$_EXAMPLE_DIR/output.md" "stack" "debt"

start_suite "Example output.md — Field Formats"
# phase: <name> (YYYY-MM+)
assert_contains "phase: follows <name> (YYYY-MM+) format" \
    "$_EXAMPLE_DIR/output.md" "^phase: .+ \([0-9]{4}-[0-9]{2}\+\)$"
# mode: priorities separated by >
assert_contains "mode: uses > priority separator" \
    "$_EXAMPLE_DIR/output.md" "^mode: .+ > .+"
# hooks: keyword → read domains/<name>.md first
assert_contains "hooks entries use → read domains/ pattern" \
    "$_EXAMPLE_DIR/output.md" "→ read domains/[a-z][a-z0-9-]*\.md first"
# debt: ID: accepted | condition | constraint
assert_contains "debt entries use accepted | | format" \
    "$_EXAMPLE_DIR/output.md" "^[A-Z][A-Z0-9_-]+: accepted \| .+ \| .+"

# =============================================================================
# Domain files compliance
# =============================================================================

# Run quality checks against a single domain file.
# $1 = label, $2 = absolute path to domain file
_check_domain() {
    local label="$1" file="$2"

    start_suite "Domain: $label"

    assert_file_exists "$label — file exists" "$file"

    # Frontmatter (FORMAT.md: MUST appear before # title heading)
    assert_contains "$label — frontmatter: opening --- delimiter" \
        "$file" "^---$"
    assert_contains "$label — frontmatter: domain field" \
        "$file" "^domain: [a-z][a-z0-9-]*$"
    assert_contains "$label — frontmatter: hooks field (JSON array)" \
        "$file" "^hooks: \[\"[^\"]+\""
    assert_contains "$label — frontmatter: updated field (YYYY-MM)" \
        "$file" "^updated: [0-9]{4}-[0-9]{2}$"

    # Required sections (FORMAT.md: current design, trajectory, rejected paths, known pitfalls, open questions)
    assert_contains "$label — has ## current design section" \
        "$file" "^## current design$"
    assert_contains "$label — has ## trajectory section" \
        "$file" "^## trajectory$"
    assert_contains "$label — has ## rejected paths section" \
        "$file" "^## rejected paths$"
    assert_contains "$label — has ## known pitfalls section" \
        "$file" "^## known pitfalls$"
    assert_contains "$label — has ## open questions section" \
        "$file" "^## open questions$"

    # trajectory: entries have YYYY-MM dates.
    # FORMAT.md format description uses [YYYY-MM] with brackets, but FORMAT.md's own
    # complete example (and all example files) use YYYY-MM without brackets — both accepted.
    assert_contains "$label — trajectory entries contain YYYY-MM dates" \
        "$file" "(\[[0-9]{4}-[0-9]{2}\]|^[0-9]{4}-[0-9]{2} )"

    # rejected paths: each entry has Re-evaluate when: note (FORMAT.md REQUIRED)
    assert_contains "$label — rejected paths include Re-evaluate when: notes" \
        "$file" "Re-evaluate when:"
}

_check_domain "api-layer.md" "$_EXAMPLE_DIR/domains/api-layer.md"
_check_domain "auth.md"      "$_EXAMPLE_DIR/domains/auth.md"
_check_domain "state-management.md" "$_EXAMPLE_DIR/domains/state-management.md"

# Domain title must match filename (FORMAT.md: "MUST match the domain key")
start_suite "Domain Files — Title Matches Filename"
assert_contains "api-layer.md title is '# api-layer'" \
    "$_EXAMPLE_DIR/domains/api-layer.md" "^# api-layer$"
assert_contains "auth.md title is '# auth'" \
    "$_EXAMPLE_DIR/domains/auth.md" "^# auth$"
assert_contains "state-management.md title is '# state-management'" \
    "$_EXAMPLE_DIR/domains/state-management.md" "^# state-management$"

# =============================================================================
# History files compliance
# =============================================================================

# Run quality checks against a single history entry file.
# $1 = label, $2 = absolute path to history file
_check_history() {
    local label="$1" file="$2"

    start_suite "History: $label"

    assert_file_exists "$label — file exists" "$file"

    # All 8 required fields (FORMAT.md: MUST)
    assert_contains "$label — field: type"          "$file" "^type:"
    assert_contains "$label — field: domain"        "$file" "^domain:"
    assert_contains "$label — field: decision_date" "$file" "^decision_date:"
    assert_contains "$label — field: recorded_date" "$file" "^recorded_date:"
    assert_contains "$label — field: summary"       "$file" "^summary:"
    assert_contains "$label — field: rejected (most critical)" \
        "$file" "^rejected:"
    assert_contains "$label — field: reason"        "$file" "^reason:"
    assert_contains "$label — field: revisit_when"  "$file" "^revisit_when:"

    # type: must be one of the 5 valid values
    assert_contains "$label — type is a valid entry type" \
        "$file" "^type: (decision|rejection|transition|debt|experiment)$"

    # decision_date: YYYY-MM format
    assert_contains "$label — decision_date follows YYYY-MM format" \
        "$file" "^decision_date: [0-9]{4}-[0-9]{2}$"

    # recorded_date: YYYY-MM format
    assert_contains "$label — recorded_date follows YYYY-MM format" \
        "$file" "^recorded_date: [0-9]{4}-[0-9]{2}$"
}

# History files: iterate over all .md files excluding _TEMPLATE.md
for _hfile in "$_EXAMPLE_DIR/history/"*.md; do
    _hbase="$(basename "$_hfile")"
    # Skip the template
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    _check_history "$_hbase" "$_hfile"
done

# History filename format: YYYY-MM_<slug>.md
start_suite "History Files — Filename Format (YYYY-MM_<slug>.md)"
for _hfile in "$_EXAMPLE_DIR/history/"*.md; do
    _hbase="$(basename "$_hfile")"
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    if echo "$_hbase" | grep -qE "^[0-9]{4}-[0-9]{2}_[a-z][a-z0-9-]+\.md$"; then
        _pass "$_hbase matches YYYY-MM_<slug>.md"
    else
        _fail "$_hbase matches YYYY-MM_<slug>.md" \
            "filename '$_hbase' does not match required pattern"
    fi
done
