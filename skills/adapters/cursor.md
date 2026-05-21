# Cursor Adapter

## Platform Rules

This protocol installs into `.cursorrules` or `.cursor/rules/` at the project root.

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
cairn skill show cursor >> .cursorrules
```

**3. Verify the install**

```bash
cairn status
cairn doctor
```

---

## Degraded Mode

If the `cairn` CLI is unavailable, fall back to reading `.cairn/views/` directly:

1. `.cairn/views/output.md` — global constraints
2. `.cairn/views/domains/<name>.md` — per-domain context
3. `.cairn/views/stage.md` — stage advisory
