# T12 — Blocked session triggers recover then context

**Category**: T (skill compliance)

**Promise tested**: When a stale session exists, the AI must detect the block via cairn_context, recover it via cairn_session_recover, then call cairn_context again to start a fresh session.

## Fixture

A `.cairn/` with a stale active_session (signals_count=3, last_touched 2+ hours ago).

## Prompt

User asks to refactor the auth module.

## Pass criteria

1. cairn_context is called first and returns blocked_by_unclosed_session
2. cairn_session_recover is called
3. cairn_context is called again and returns an active session
