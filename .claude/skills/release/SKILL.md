Run the full Cairn release checklist: docs review, CHANGELOG, version sync, tests, commit, and tag.

---

## TRIGGER

Activate this skill when the user says any of: release, publish, bump version, cut a release, 发布, 发版, 打版本.

Ask for the new version number if not provided. Format: semver without `v` prefix (e.g., `0.1.0`).

---

## STEP 1 — Read Current State

Before doing anything, establish the current state:

1. Read `CHANGELOG.md` — note the most recent released version
2. Run `grep 'CAIRN_VERSION' cli/cairn` — note CLI version
3. Run `node -p "require('./mcp/package.json').version"` from repo root — note MCP version
4. Run `grep 'version:' mcp/src/server.ts` — note server.ts version

If any of the four values differ, report the inconsistency to the user before proceeding.

---

## STEP 2 — Docs Review

Check each file below for content that may need updating for the new version. Read each file and report what (if anything) needs changing. Do NOT edit yet — present findings first.

| File | What to check |
|---|---|
| `README.md` | Version references, install commands, feature list, roadmap |
| `spec/DESIGN.md` | Roadmap section — is the phase status still accurate? |
| `spec/adoption-guide.md` | Phase references — are they still correct? |
| `mcp/README.md` | Install instructions, version-specific notes |

After reviewing all four files, summarise what needs updating and ask the user to confirm before making changes.

---

## STEP 3 — Auto-generate CHANGELOG Entry

Run the following command to collect all commits since the last tag (or the very first commit if no tag exists yet):

```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD --pretty=format:"%s"
```

From that output, classify each commit into one of three buckets using its conventional-commit prefix:

| Prefix | Bucket |
|---|---|
| `feat:` | Added |
| `fix:` | Fixed |
| `refactor:` / `perf:` | Changed |
| `docs:` / `chore:` / `test:` / `ci:` | Changed |

Strip the prefix, capitalise the first letter, keep the rest of the message as-is. Drop merge commits and version-bump commits (`chore: release v*`, `chore: bump version*`).

Compose the draft section:

```
## [X.Y.Z] - YYYY-MM-DD

### Added
- <feat entries>

### Changed
- <refactor / docs / chore / ci entries>

### Fixed
- <fix entries>
```

Use today's date. Omit any section that has no entries.

**Present the draft to the user and wait for explicit confirmation.** The user may edit entries before approving. Only insert the confirmed section into `CHANGELOG.md` (at the top, below the header, above the previous release entry) after the user says yes.

---

## STEP 4 — Apply Docs Edits

Apply any edits agreed in Step 2. Each edit should be minimal — change only what is inaccurate, do not rewrite surrounding content.

---

## STEP 5 — Sync Version Numbers

Run the version sync script to update all four locations atomically:

```bash
bash scripts/sync-version.sh X.Y.Z
```

This updates:
- `mcp/package.json`
- `mcp/package-lock.json`
- `mcp/src/server.ts`
- `cli/cairn`

After running, verify all four values read back as `X.Y.Z`.

---

## STEP 6 — Run Tests

Run both test suites. Both must pass before proceeding.

```bash
bash ./tests/run_tests.sh
```

```bash
cd mcp && npm ci && npm run build && npm test
```

If any test fails, stop. Do not proceed to commit or tag. Report the failure and wait for the user to fix it.

---

## STEP 7 — Commit

Stage all changed files and create a single commit:

```bash
git add CHANGELOG.md cli/cairn mcp/package.json mcp/package-lock.json mcp/src/server.ts
# add any docs files edited in Step 4
git commit -m "chore: release vX.Y.Z"
```

Show the user the staged diff before committing.

---

## STEP 8 — Tag and Push

**Always ask for explicit confirmation before running these commands.**

```bash
git tag vX.Y.Z
git push origin main --tags
```

Confirm the tag and branch with the user. Never force-push.

---

## RELEASE COMPLETE

After the push, remind the user:

- The `release.yml` workflow will run automatically on the tag push
- It will: verify version consistency → verify CHANGELOG entry → publish `cairn-mcp-server` to npm → create a GitHub Release with CLI and skills archives
- Monitor progress at: `https://github.com/zzf2333/Cairn/actions`
- If `NPM_TOKEN` is not set in repo secrets, the publish step will fail
