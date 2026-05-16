# Cairn — Cline / Roo Code

> Append this content to your Cline / Roo Code custom instructions.

<!-- cairn:start -->
## Cairn (AI-maintained project memory)

If this project has `.cairn/` and the `cairn` MCP server is available:

0. On first encounter, call `cairn_init_status()`. If not initialized, analyze
   the project (README, git log, deps, structure), then `cairn_init_commit()`
   with skeleton, blood candidates, stage, and DNA.
1. Call `cairn_context({ task?, files? })` at session start. Respect all returned
   constraints: `no_go` (never suggest), `accepted_debt` (do not fix),
   `stage` (adjust aggressiveness), `challenges` (respond by level).
2. Call `cairn_signal()` when you detect a constraint event:
   `user_rejection`, `historical_reference`, `constraint_declaration`,
   `decision`, `debt_acceptance`, `stage_constraint`.
3. Call `cairn_plan({ task })` before design/architecture tasks for historical
   constraints and DNA guidance. Read-only, no side effects.
4. When pending staged entries exist, call `cairn_stage_list()`, present to user,
   then `cairn_stage_accept({ id })` or `cairn_stage_reject({ id, reason })`.
5. Call `cairn_session_end({ summary, changed_domains?, decisions_made? })` at
   session end.
6. Call `cairn_status()` or `cairn_doctor()` when the user asks about Cairn health.

**Challenge response**: `suggestion` — note and proceed; `reflective_challenge` —
explain why history no longer applies; `hard_constraint` — do not proceed.

If MCP is unavailable, read `.cairn/views/output.md` for constraints.
Full protocol: `skills/claude-code/SKILL.md`
<!-- cairn:end -->
