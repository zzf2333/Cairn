# Lightweight Mode

Applies to: side projects, prototypes, short sessions.

## Relaxations

### Reduced Governance

- G1 and G2 signals auto-confirm to blood (no staging)
- Only G3 signals require human review
- DNA candidates can accumulate across sessions

### Reduced Signal Strictness

Signal only when the user explicitly:

- rejects a direction
- states a hard constraint
- references a past failure

Skip signaling for routine decisions and implicit preferences.

### Reduced Challenge Frequency

- `suggestion` level challenges are silent
- `reflective_challenge` is downgraded to `suggestion`
- Only `hard_constraint` and `trauma` maintain full force

### Observe Is Optional

`cairn_observe` before commit is recommended but not mandatory. Skip for small commits and quick fixes.

## Retained Requirements

These are NOT relaxed in lightweight mode:

- `cairn_context` before technical reasoning — always mandatory
- `cairn_session_end` at session close — always mandatory
- `cairn_session_recover` when stale sessions detected — always mandatory
- Trauma constraints — always at full strength
- Security constraints — always at full strength
