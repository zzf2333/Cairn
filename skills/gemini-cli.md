# Cairn — Gemini CLI

> Add this file to `GEMINI.md` at your project root (or `~/.gemini/GEMINI.md` for global scope).
> Gemini CLI loads `GEMINI.md` from the global home directory, the project root, and any parent directories up to the filesystem root.

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
