# T14 — Typo-only task: minimal Cairn intervention

**Category**: T (skill compliance)

**Promise tested**: Trivial tasks (typo fixes, formatting) should invoke cairn_context (always mandatory) but NOT cairn_plan or cairn_signal. The minimal-intervention principle prevents unnecessary cognitive overhead.

## Fixture

Minimal project with docs domain skeleton.

## Prompt

User asks to fix a single typo in README.md.

## Pass criteria

1. cairn_context is called (mandatory)
2. cairn_plan is NOT called (no architecture decision)
3. cairn_signal is NOT called (no signal worth capturing)
4. Total tool calls are low (at most 5)
