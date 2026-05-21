#!/usr/bin/env bash
# =============================================================================
# sync-version.sh — Update version strings across the Cairn repository
#
# Usage:
#   bash scripts/sync-version.sh <version>
#
# Example:
#   bash scripts/sync-version.sh 2.0.0
#
# Updates version in:
#   - package.json              (root — skill discovery)
#   - cli/package.json          (via npm version --no-git-tag-version)
#   - mcp/package-lock.json     (updated automatically by npm)
#   - cli/src/server.ts         (hardcoded version field in createCairnServer)
#   - cli/src/constants.ts      (VERSION constant)
# =============================================================================

set -euo pipefail

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    echo "Usage: bash scripts/sync-version.sh <version>" >&2
    echo "Example: bash scripts/sync-version.sh 2.0.0" >&2
    exit 1
fi

# Validate semver format (x.y.z or x.y.z-tag.n, no leading 'v')
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
    echo "Error: version must be semver format without 'v' prefix (e.g., 2.0.0 or 2.0.0-alpha.1)" >&2
    exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Syncing version to $VERSION..."

# 1. Root package.json (skill discovery)
cd "$REPO_ROOT"
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
echo "  [OK] package.json (root)"

# 2. cli/package.json + mcp/package-lock.json
cd "$REPO_ROOT/cli"
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null
echo "  [OK] cli/package.json and mcp/package-lock.json"

# 3. cli/src/server.ts — replace hardcoded version: "x.y.z..."
SERVER_TS="$REPO_ROOT/cli/src/server.ts"
sed -i.bak "s/version: \"[0-9]*\.[0-9]*\.[0-9]*[^\"]*\"/version: \"$VERSION\"/" "$SERVER_TS"
rm -f "${SERVER_TS}.bak"
echo "  [OK] cli/src/server.ts"

# 4. cli/src/constants.ts — replace VERSION constant
CONSTANTS_TS="$REPO_ROOT/cli/src/constants.ts"
sed -i.bak "s/const VERSION = \"[^\"]*\"/const VERSION = \"$VERSION\"/" "$CONSTANTS_TS"
rm -f "${CONSTANTS_TS}.bak"
echo "  [OK] cli/src/constants.ts"

echo ""
echo "Done. All files updated to version $VERSION."
echo ""
echo "Verify with:"
echo "  grep '\"version\"' package.json cli/package.json"
echo "  grep 'version:' cli/src/server.ts"
echo "  grep 'VERSION' cli/src/constants.ts"
