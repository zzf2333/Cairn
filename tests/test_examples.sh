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
assert_contains "## stage section exists"          "$_EXAMPLE_DIR/output.md" "^## stage$"
assert_contains "## no-go section exists"          "$_EXAMPLE_DIR/output.md" "^## no-go$"
assert_contains "## hooks section exists"          "$_EXAMPLE_DIR/output.md" "^## hooks$"
assert_contains "## stack section exists"          "$_EXAMPLE_DIR/output.md" "^## stack$"
assert_contains "## debt section exists"           "$_EXAMPLE_DIR/output.md" "^## debt$"
assert_contains "## open questions section exists" "$_EXAMPLE_DIR/output.md" "^## open questions$"
assert_section_before "stage before no-go"         "$_EXAMPLE_DIR/output.md" "stage" "no-go"
assert_section_before "no-go before hooks"         "$_EXAMPLE_DIR/output.md" "no-go" "hooks"
assert_section_before "hooks before stack"         "$_EXAMPLE_DIR/output.md" "hooks" "stack"
assert_section_before "stack before debt"          "$_EXAMPLE_DIR/output.md" "stack" "debt"
assert_section_before "debt before open questions" "$_EXAMPLE_DIR/output.md" "debt" "open questions"

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

# =============================================================================
# examples/api-service-2yr — structure and content compliance
# =============================================================================

_API_EXAMPLE_DIR="$REPO_ROOT/examples/api-service-2yr/.cairn"

start_suite "api-service-2yr output.md — Required Sections"
assert_file_exists "api-service-2yr output.md exists" "$_API_EXAMPLE_DIR/output.md"
assert_contains "api-service-2yr: ## stage section"  "$_API_EXAMPLE_DIR/output.md" "^## stage$"
assert_contains "api-service-2yr: ## no-go section"  "$_API_EXAMPLE_DIR/output.md" "^## no-go$"
assert_contains "api-service-2yr: ## hooks section"  "$_API_EXAMPLE_DIR/output.md" "^## hooks$"
assert_contains "api-service-2yr: ## stack section"  "$_API_EXAMPLE_DIR/output.md" "^## stack$"
assert_contains "api-service-2yr: ## debt section"   "$_API_EXAMPLE_DIR/output.md" "^## debt$"

start_suite "api-service-2yr output.md — Field Formats"
assert_contains "api-service-2yr: phase: follows <name> (YYYY-MM+) format" \
    "$_API_EXAMPLE_DIR/output.md" "^phase: .+ \([0-9]{4}-[0-9]{2}\+\)$"
assert_contains "api-service-2yr: mode: uses > priority separator" \
    "$_API_EXAMPLE_DIR/output.md" "^mode: .+ > .+"
assert_contains "api-service-2yr: hooks entries use → read domains/ pattern" \
    "$_API_EXAMPLE_DIR/output.md" "→ read domains/[a-z][a-z0-9-]*\.md first"
assert_contains "api-service-2yr: debt entries use accepted | | format" \
    "$_API_EXAMPLE_DIR/output.md" "^[A-Z][A-Z0-9_-]+: accepted \| .+ \| .+"

start_suite "api-service-2yr — Domain Files Exist"
assert_file_exists "api-gateway.md exists"    "$_API_EXAMPLE_DIR/domains/api-gateway.md"
assert_file_exists "rate-limiting.md exists"  "$_API_EXAMPLE_DIR/domains/rate-limiting.md"
assert_file_exists "observability.md exists"  "$_API_EXAMPLE_DIR/domains/observability.md"
assert_file_exists "db-layer.md exists"       "$_API_EXAMPLE_DIR/domains/db-layer.md"

# Run the standard domain checks for each api-service-2yr domain
_check_domain "api-service-2yr api-gateway.md"   "$_API_EXAMPLE_DIR/domains/api-gateway.md"
_check_domain "api-service-2yr rate-limiting.md" "$_API_EXAMPLE_DIR/domains/rate-limiting.md"
_check_domain "api-service-2yr observability.md" "$_API_EXAMPLE_DIR/domains/observability.md"
_check_domain "api-service-2yr db-layer.md"      "$_API_EXAMPLE_DIR/domains/db-layer.md"

start_suite "api-service-2yr — Domain Titles Match Filenames"
assert_contains "api-gateway.md title is '# api-gateway'" \
    "$_API_EXAMPLE_DIR/domains/api-gateway.md" "^# api-gateway$"
assert_contains "rate-limiting.md title is '# rate-limiting'" \
    "$_API_EXAMPLE_DIR/domains/rate-limiting.md" "^# rate-limiting$"
assert_contains "observability.md title is '# observability'" \
    "$_API_EXAMPLE_DIR/domains/observability.md" "^# observability$"
assert_contains "db-layer.md title is '# db-layer'" \
    "$_API_EXAMPLE_DIR/domains/db-layer.md" "^# db-layer$"

# Run FORMAT.md history compliance checks for all api-service-2yr history files
for _hfile in "$_API_EXAMPLE_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    _hbase="$(basename "$_hfile")"
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    _check_history "api-service-2yr/$_hbase" "$_hfile"
done

start_suite "api-service-2yr — History Filename Format (YYYY-MM_<slug>.md)"
for _hfile in "$_API_EXAMPLE_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    _hbase="$(basename "$_hfile")"
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    if echo "$_hbase" | grep -qE "^[0-9]{4}-[0-9]{2}_[a-z][a-z0-9-]+\.md$"; then
        _pass "api-service-2yr/$_hbase matches YYYY-MM_<slug>.md"
    else
        _fail "api-service-2yr/$_hbase matches YYYY-MM_<slug>.md" \
            "filename '$_hbase' does not match required pattern"
    fi
done

start_suite "api-service-2yr — Minimum History Count (≥ 6 entries)"
_api_history_count=0
for _hfile in "$_API_EXAMPLE_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    _hbase="$(basename "$_hfile")"
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    _api_history_count=$(( _api_history_count + 1 ))
done
if [ "$_api_history_count" -ge 6 ]; then
    _pass "api-service-2yr has ${_api_history_count} history entries (≥ 6)"
else
    _fail "api-service-2yr has ${_api_history_count} history entries (≥ 6)" \
        "expected at least 6 history entries, found ${_api_history_count}"
fi

start_suite "api-service-2yr — Minimum Debt Count (≥ 2 with revisit_when)"
_api_debt_count=0
for _hfile in "$_API_EXAMPLE_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    # A debt entry: type: debt AND non-empty revisit_when (not just "revisit_when: ")
    if grep -q "^type: debt$" "$_hfile" 2>/dev/null; then
        local_revisit=""
        local_revisit="$(grep "^revisit_when:" "$_hfile" | sed 's/^revisit_when: //' | tr -d '[:space:]')"
        if [ -n "$local_revisit" ]; then
            _api_debt_count=$(( _api_debt_count + 1 ))
        fi
    fi
done
if [ "$_api_debt_count" -ge 2 ]; then
    _pass "api-service-2yr has ${_api_debt_count} debt entries with revisit_when (≥ 2)"
else
    _fail "api-service-2yr has ${_api_debt_count} debt entries with revisit_when (≥ 2)" \
        "expected at least 2 debt entries with non-empty revisit_when, found ${_api_debt_count}"
fi

start_suite "api-service-2yr — Intentionally Stale rate-limiting Domain"
# rate-limiting domain should have an old updated: date
assert_contains "rate-limiting.md has updated: in YYYY-MM format" \
    "$_API_EXAMPLE_DIR/domains/rate-limiting.md" "^updated: [0-9]{4}-[0-9]{2}$"
# Verify there is at least one history entry with domain: rate-limiting
_rate_history_count=0
for _hfile in "$_API_EXAMPLE_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    if grep -q "^domain: rate-limiting$" "$_hfile" 2>/dev/null; then
        _rate_history_count=$(( _rate_history_count + 1 ))
    fi
done
if [ "$_rate_history_count" -ge 1 ]; then
    _pass "at least one history entry points to rate-limiting domain"
else
    _fail "at least one history entry points to rate-limiting domain" \
        "no history entries found with domain: rate-limiting"
fi

# =============================================================================
# examples/api-service-2yr-zh — Chinese mirror structure compliance
# =============================================================================

_API_ZH_DIR="$REPO_ROOT/examples/api-service-2yr-zh/.cairn"

start_suite "api-service-2yr-zh — Structure Mirrors English Version"
assert_file_exists "api-service-2yr-zh output.md exists"         "$_API_ZH_DIR/output.md"
assert_file_exists "api-service-2yr-zh api-gateway.md exists"    "$_API_ZH_DIR/domains/api-gateway.md"
assert_file_exists "api-service-2yr-zh rate-limiting.md exists"  "$_API_ZH_DIR/domains/rate-limiting.md"
assert_file_exists "api-service-2yr-zh observability.md exists"  "$_API_ZH_DIR/domains/observability.md"
assert_file_exists "api-service-2yr-zh db-layer.md exists"       "$_API_ZH_DIR/domains/db-layer.md"

start_suite "api-service-2yr-zh — Output.md Field Formats (English keys)"
# Field keys MUST remain English even in zh version
assert_contains "api-service-2yr-zh: phase: key is English" \
    "$_API_ZH_DIR/output.md" "^phase:"
assert_contains "api-service-2yr-zh: mode: key is English" \
    "$_API_ZH_DIR/output.md" "^mode:"
assert_contains "api-service-2yr-zh: hooks entries use → arrow" \
    "$_API_ZH_DIR/output.md" "→ read domains/"

start_suite "api-service-2yr-zh — Domain Frontmatter Keys Are English"
for _zh_domain in api-gateway rate-limiting observability db-layer; do
    _zh_dfile="$_API_ZH_DIR/domains/${_zh_domain}.md"
    assert_contains "api-service-2yr-zh/$_zh_domain: domain: key is English" \
        "$_zh_dfile" "^domain:"
    assert_contains "api-service-2yr-zh/$_zh_domain: hooks: key is English" \
        "$_zh_dfile" "^hooks:"
    assert_contains "api-service-2yr-zh/$_zh_domain: updated: key is English" \
        "$_zh_dfile" "^updated:"
    assert_contains "api-service-2yr-zh/$_zh_domain: status: key is English" \
        "$_zh_dfile" "^status:"
done

start_suite "api-service-2yr-zh — History File Count Matches English Version"
_zh_history_count=0
for _hfile in "$_API_ZH_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    _hbase="$(basename "$_hfile")"
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    _zh_history_count=$(( _zh_history_count + 1 ))
done
if [ "$_zh_history_count" -eq "$_api_history_count" ]; then
    _pass "zh history count (${_zh_history_count}) matches EN (${_api_history_count})"
else
    _fail "zh history count (${_zh_history_count}) matches EN (${_api_history_count})" \
        "EN has ${_api_history_count} entries but ZH has ${_zh_history_count}"
fi

start_suite "api-service-2yr-zh — History Field Keys Are English"
for _hfile in "$_API_ZH_DIR/history/"*.md; do
    [ -f "$_hfile" ] || continue
    _hbase="$(basename "$_hfile")"
    [ "$_hbase" = "_TEMPLATE.md" ] && continue
    assert_contains "api-service-2yr-zh/$_hbase: type: key" \
        "$_hfile" "^type:"
    assert_contains "api-service-2yr-zh/$_hbase: domain: key" \
        "$_hfile" "^domain:"
    assert_contains "api-service-2yr-zh/$_hbase: decision_date: key" \
        "$_hfile" "^decision_date:"
    assert_contains "api-service-2yr-zh/$_hbase: recorded_date: key" \
        "$_hfile" "^recorded_date:"
done
