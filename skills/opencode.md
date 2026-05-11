# Cairn — OpenCode

> Append this file to `AGENTS.md` at your project root.
> OpenCode also supports `CLAUDE.md` as a fallback if `AGENTS.md` is not present.

<!-- cairn:start -->
## Cairn (AI-maintained project memory)

If this project has `.cairn/` and the `cairn` MCP server is available:

1. Call `cairn_context()` at session start to load constraints.
2. Call `cairn_signal()` when you detect a constraint event (user rejection,
   decision, debt acceptance, historical reference).
3. Call `cairn_session_end()` at session end with a summary.

If MCP is unavailable, read `.cairn/views/output.md` for constraints.
Full protocol: `.cairn/SKILL.md`
<!-- cairn:end -->
