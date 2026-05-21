# Codex Adapter

## Platform Rules

`AGENTS.md` is the Codex CLI convention for project-level instructions (analogue of `CLAUDE.md`). This protocol block should be in your project's `AGENTS.md` or `~/.codex/AGENTS.md` for global scope.

You must actively use Cairn during technical work. Do not treat Cairn as optional memory.

Always follow the lifecycle:

```
context -> plan -> signal -> observe -> session_end
```

---

## Setup

**1. Install the CLI**

```bash
npm install -g cairn-rt
```

Requires Node.js 18+.

**2. Install the protocol**

```bash
cairn skill show codex >> AGENTS.md
```

**3. Verify the install**

```bash
cairn status
cairn doctor
```

---

## Degraded Mode

If the `cairn` CLI is unavailable, fall back in this order:

1. Read-only views: `.cairn/views/output.md`, `.cairn/views/domains/<name>.md`, `.cairn/views/stage.md`
2. CLI for state inspection: `cairn status`, `cairn doctor`, `cairn review`, `cairn dna list`, `cairn stage list`
3. CLI for review queues: `cairn dna accept/reject <id>`, `cairn stage accept/reject <id>`
