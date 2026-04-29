#!/usr/bin/env bash
# =============================================================================
# sync-version.sh — Update version strings across the Cairn repository
#
# Usage:
#   bash scripts/sync-version.sh <version>
#
# Example:
#   bash scripts/sync-version.sh 0.1.0
#
# Updates version in:
#   - mcp/package.json        (via npm version --no-git-tag-version)
#   - mcp/package-lock.json   (updated automatically by npm)
#   - mcp/src/server.ts       (hardcoded version field in createCairnServer)
#   - cli/cmd/doctor.sh       (doctor --json cairn_version field)
#   - cli/cairn               (CAIRN_VERSION constant)
# =============================================================================

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    echo "Usage: bash scripts/sync-version.sh <version>" >&2
    echo "Example: bash scripts/sync-version.sh 0.1.0" >&2
    exit 1
fi

# Validate semver format (x.y.z, no leading 'v')
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "Error: version must be semver format without 'v' prefix (e.g., 1.2.3)" >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Syncing version to $VERSION..."

# 1. mcp/package.json + mcp/package-lock.json
cd "$REPO_ROOT/mcp"
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
echo "  [OK] mcp/package.json and mcp/package-lock.json"

# 2. mcp/src/server.ts — replace hardcoded version: "x.y.z"
SERVER_TS="$REPO_ROOT/mcp/src/server.ts"
# Use sed compatible with both macOS (BSD) and Linux (GNU)
sed -i.bak "s/version: \"[0-9]*\.[0-9]*\.[0-9]*\"/version: \"$VERSION\"/" "$SERVER_TS"
rm -f "${SERVER_TS}.bak"
echo "  [OK] mcp/src/server.ts"

# 3. cli/cairn — replace CAIRN_VERSION="x.y.z"
CLI_FILE="$REPO_ROOT/cli/cairn"
sed -i.bak "s/^CAIRN_VERSION=\"[0-9]*\.[0-9]*\.[0-9]*\"/CAIRN_VERSION=\"$VERSION\"/" "$CLI_FILE"
rm -f "${CLI_FILE}.bak"
echo "  [OK] cli/cairn"

# 4. cli/cmd/doctor.sh — replace JSON cairn_version field
DOCTOR_SH="$REPO_ROOT/cli/cmd/doctor.sh"
sed -i.bak "s/\"cairn_version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"cairn_version\": \"$VERSION\"/" "$DOCTOR_SH"
rm -f "${DOCTOR_SH}.bak"
echo "  [OK] cli/cmd/doctor.sh"

echo ""
echo "Done. All files updated to version $VERSION."
echo ""
echo "Verify with:"
echo "  grep 'version' mcp/package.json"
echo "  grep 'version:' mcp/src/server.ts"
echo "  grep 'CAIRN_VERSION' cli/cairn"
echo "  grep 'cairn_version' cli/cmd/doctor.sh"
