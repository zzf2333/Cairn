# T14 — Typo-only task: minimal Cairn intervention

**Category**: T (skill compliance)

**Promise tested**: Trivial tasks (typo fixes, formatting) should NOT invoke heavy Cairn lifecycle tools. Per `minimal-intervention.md`, typo fixes may skip `cairn_context` entirely. `cairn_plan`, `cairn_signal`, `cairn_observe`, and `cairn_session_end` must NOT be called.

## Fixture

Minimal project with docs domain skeleton and a README.md containing a typo ("recieve").

## Prompt

User asks to fix a single typo in README.md.

## Pass criteria

1. cairn_plan is NOT called (no architecture decision)
2. cairn_signal is NOT called (no signal worth capturing)
3. cairn_observe is NOT called (no commit candidates)
4. cairn_session_end is NOT called (trivial fix, no session to close)
5. Total tool calls are low
