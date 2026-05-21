# Enter

> The install path is short on purpose. The hard work — building cognition — happens after you're in.

---

## What you need

- Node.js **18+**
- An AI tool that supports Cairn — today: **Claude Code** or **Codex**
- A git repository (non-git also works, with reduced calibration features)

---

## Claude Code (recommended)

### 1. Install the runtime

```bash
npm install -g cairn-rt
```

Verify:

```bash
cairn --version
# 0.4.x
```

### 2. Install the protocol skill

```bash
npx skills add zzf2333/Cairn
```

This clones the Cairn protocol to `.claude/skills/cairn/`. Claude Code auto-loads it at session start.

### 3. Initialize

Tell Claude Code:

> Initialize Cairn for this project

That's it. The AI takes it from here — the whole process takes about 2 minutes.

**What happens behind the scenes:**

1. AI calls `cairn_init_status()` — gets a structured guide
2. AI analyzes your project — reads README, deps, git log, directory structure
3. AI proposes initial cognition (dry run) — shows you:
   ```
   Proposed:
     - 4 skeletons: api, data, auth, ui
     - 9 blood_candidates_auto_confirmed (G0/G1)
     - 3 blood_candidates_staged (G2+, need your review)
     - stage: maturity (confidence 0.78)
   ```
4. You confirm — the AI writes the cognition
5. You review staged events — high-gravity decisions (G2+) need your explicit accept/reject
6. Done — `cairn_context()` now returns real constraints

### 4. Verify

```bash
cairn doctor --metrics
```

Expected output:

```
.cairn health:
  cairn_version:       0.4.6
  blood events:        10 (10 active, 0 archived, 0 trauma)
  DNA identity:        emerging
  DNA traits:          1 (simplicity_bias: medium)
  staged backlog:      0
  last session_end:    never
  stage:               growth (confidence 0.80, advisory)
```

Non-zero blood events and a stamped `cairn_version` confirm initialization succeeded.

### Update the skill

```bash
npx skills add zzf2333/Cairn --force
```

---

## Codex

### 1. Install

```bash
npm install -g cairn-rt
```

### 2. Install the protocol

```bash
cairn skill show codex >> AGENTS.md
```

This appends the full Cairn protocol to your project's `AGENTS.md`.

### 3. Initialize

Tell Codex:

> Initialize Cairn for this project

### 4. Verify

```bash
cairn doctor --metrics
```

---

## A note on `.cairn/`

After the first session, your project has a `.cairn/` directory. **Commit it.**

`.cairn/` is git-tracked by design. It's not a cache — it is the project's cognition export. Adding it to `.gitignore` is the most common newcomer mistake; it makes the whole system local-only.

`.gitignore` entry of `.cairn/logs/` is fine. `.gitignore` entry of `.cairn/` is not.

---

## Two supported hosts, deliberately

Today: Claude Code, Codex. That's it.

Other AI tools (Cline, Windsurf, Cursor, Copilot, Gemini CLI, OpenCode) had adapters in earlier releases. They return in the 1.x line, one at a time, after each one passes the reverse-regression bar.

---

## See also

- [`protocol.md`](./protocol.md) — what the AI does once it has the skill file
- [`tend.md`](./tend.md) — keeping the system healthy
- [`../0-enter.md`](../0-enter.md) — the conceptual entry point
