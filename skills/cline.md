# Cairn — Cline / Roo Code

> Append this content to your Cline / Roo Code custom instructions.

<!-- cairn:start -->
## Cairn (AI-maintained project memory)

If this project has `.cairn/` and the `cairn` MCP server is available:

1. Call `cairn_context()` at session start to load constraints (no_go, active_debt, stage, challenges).
2. Call `cairn_signal()` when you detect a constraint event (user rejection,
   decision, debt acceptance, historical reference, user constraint).
3. Call `cairn_plan()` before design/architecture tasks for historical constraints.
4. When `cairn_context` warns of pending staged entries, call `cairn_stage_list()`,
   present to user, then `cairn_stage_accept({ id })` or `cairn_stage_reject({ id, reason })`.
5. Call `cairn_session_end()` at session end with a summary.

If MCP is unavailable, read `.cairn/views/output.md` for constraints.
Full protocol: `.cairn/SKILL.md`
<!-- cairn:end -->
