# T13 — Explicit rejection captured as signal

**Category**: T (skill compliance)

**Promise tested**: When a user explicitly rejects a suggestion with reasoning, the AI must capture it via cairn_signal with signal_type user_rejection and then pivot its recommendation.

## Fixture

Minimal project with infra domain skeleton. No existing blood events.

## Prompt

Multi-turn: Turn 1 asks about caching. Turn 2 rejects Redis with detailed reasoning.

## Pass criteria

1. cairn_context called first
2. cairn_signal called with signal_type=user_rejection, details.what matches Redis
3. AI pivots to in-memory caching alternative
