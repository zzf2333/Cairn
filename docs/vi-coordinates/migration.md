# Migration

> Upgrade paths. Each version lists only what changed from the previous one. Skip versions still works — the migrate command catches up multiple steps.

General flow: `npm install -g cairn-mcp-server@<new>` → `cairn migrate` → `cairn status` to confirm `cairn_version` reflects the new release.

---

## 0.4.x line

### 0.4.0 → 0.4.1 (docs + adapter scope, no engine change)

**No breaking changes.** Pure docs / supported-platform scope tightening.

Removed:
- `spec/` directory (9 files) — content folded into the redesigned `docs/` tree
- 5 platform adapters (`skills/cline.md`, `windsurf.md`, `cursor.mdc`, `gemini-cli`, `copilot-instructions`, `opencode`) — only Claude Code + Codex remain first-class

Added: 5 new English authoritative docs (`PHILOSOPHY`, `ARCHITECTURE`, `QUICK_START`, `SCHEMA`, `GLOSSARY`).

Upgrade:

```bash
npm install -g cairn-mcp-server@0.4.1
cairn migrate    # idempotent; just stamps cairn_version: "0.4.1"
```

If you were using cline / windsurf / cursor / copilot / gemini-cli / opencode adapters, they'll return in the 1.x line. Until then, those integrations are unsupported.

### 0.4.1 → 0.4.2 (docs philosophical redesign, no engine change)

**No breaking changes.** Pure docs reorganization.

Removed:
- The old flat `docs/*.md` layout (`PHILOSOPHY.md`, `ARCHITECTURE.md`, `QUICK_START.md`, etc.)

Added:
- Six-volume `docs/` structure organized around the cognitive-organism metaphor:
  - `0-enter.md`
  - `i-origin/` (3 essays — code-abundance, cognitive-collapse, not-a-memory)
  - `ii-anatomy/` (6 organ pages — skeleton / blood / dna / capillaries / gravity / governance)
  - `iii-life/` (4 lifecycle pages — capture-and-ratify / decay-and-resurrection / compression / trauma)
  - `iv-self/` (3 reflexivity pages — trust-router / calibration / reevaluation)
  - `v-intervene/` (3 operational pages — enter / protocol / tend)
  - `vi-coordinates/` (5 reference pages — glossary / schema / stability / performance / migration)

Upgrade:

```bash
npm install -g cairn-mcp-server@0.4.2
cairn migrate
```

Bookmarks to old `docs/*.md` URLs will 404. Use the new tree from [`docs/0-enter.md`](../0-enter.md).

### 0.3.x → 0.4.0 (stability, recovery, observability — no breaking changes)

**No breaking changes.** Pure additions.

Added:
- `state.cairn_version` field (recorded on every write)
- `state.session_in_progress` checkpoint field
- `cairn migrate` CLI
- `cairn doctor --fix` (corruption quarantine)
- `cairn doctor --recover` (clear stale session checkpoint)
- `cairn doctor --metrics` (health snapshot)
- `.cairn/logs/tools-*.jsonl` (toggle via `config.logging`)
- `cairn_context` may emit `interaction_hint` (`review_staged_first` / `needs_init`)

Upgrade:

```bash
npm install -g cairn-mcp-server@0.4.0
cd your-project
cairn migrate    # stamps cairn_version: "0.4.0" — no data change required
cairn status     # should show no warnings
```

---

## Version detection

`cairn_init_status` returns `warnings[]` based on `state.cairn_version`:

| Condition | Warning |
|-----------|---------|
| `.cairn/` exists, no `cairn_version` | `cairn_version_missing` — run `cairn migrate` to stamp |
| Recorded version < runtime version | `cairn_version_older` — run `cairn migrate` to apply pending migrations |
| Recorded version > runtime version | `cairn_version_newer` — upgrade runtime, don't downgrade data |
| `state.session_in_progress` present | `incomplete_session` — run `cairn doctor --recover` |

---

## Pre-1.0 contract

0.x releases follow best-effort backward compatibility but don't enforce strict SemVer. Breaking changes are:

- Called out prominently in CHANGELOG
- Accompanied by automatic migration logic in `cairn migrate`
- Tested via the existing test suite + scenarios before tagging

After 1.0, breaking changes require major version bump + ≥ 6-month deprecation window. See [`stability.md`](./stability.md).

---

## Rollback

A 0.4.x data directory generally reads cleanly under 0.3.x — newer fields are ignored. `session_in_progress`, however, is ignored entirely by 0.3.x, so any pending checkpoint information is lost on downgrade.

Safer rollback path:

```bash
cairn doctor --recover    # clear any pending checkpoint first
npm install -g cairn-mcp-server@<older-version>
```

---

## See also

- [`stability.md`](./stability.md) — which fields are Stable / Experimental / Internal
- [`schema.md`](./schema.md) — field reference at the current schema version
- [`../v-intervene/tend.md`](../v-intervene/tend.md) — how to read version warnings in `cairn doctor`
