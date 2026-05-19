# Strict Mode

Applies to: production systems, infrastructure, security-sensitive projects, long-running teams.

## Additional Constraints

### Mandatory Planning

You MUST call `cairn_plan` for ANY change that touches:

- module boundaries
- data models
- API contracts
- authentication / authorization
- infrastructure configuration
- dependency additions or removals

Not just "large refactors" — any structural change requires planning.

### Elevated Challenge Sensitivity

- `suggestion` level challenges are treated as `reflective_challenge`
- `reflective_challenge` requires written justification AND user acknowledgment
- `hard_constraint` is absolute — no override without formal reevaluation

### Mandatory Signaling

Every technical decision must be signaled, not just the ones listed in the standard protocol. This includes:

- library version pinning decisions
- error handling strategy choices
- performance tradeoff decisions
- API design choices

### Governance Enforcement

- All staged entries must be reviewed before session end
- DNA candidates must be reviewed within the same session they appear
- No multi-session backlog of unreviewed items

### Trauma Sensitivity

- Any change to code paths that previously caused incidents requires explicit user approval
- Historical incident patterns are surfaced proactively, not just when challenged
