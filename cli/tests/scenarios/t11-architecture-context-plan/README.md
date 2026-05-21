# T11 — Architecture task triggers context + plan

**Category**: T (skill compliance)

**Promise tested**: Architecture-level tasks must invoke cairn_context (for constraints) and cairn_plan (for conflict detection) before proposing a design.

## Fixture

A `.cairn/` with a G2 rejection of Redis for caching. Skeleton has api and storage domains.

## Prompt

User asks to design a caching layer for the API.

## Pass criteria

1. cairn_context is called first
2. cairn_plan is called before the architecture recommendation
3. Redis rejection is surfaced and respected
4. Alternative caching approach is recommended (in-process, LRU, etc.)
