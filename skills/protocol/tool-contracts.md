# Tool Contracts

16 MCP tools across 6 lifecycle phases.

---

## cairn_context

**Purpose**: Load active cognition into reasoning. Session guard.

**Required Before**: technical recommendations, code generation, refactor strategy, architecture discussion.

```
cairn_context({ task?: string, files?: string[] })
```

**Returns**: stage, dna, constraints (no_go, accepted_debt, stage_constraints), relevant_domains, challenges, session status.

**Side Effects**: creates or updates `active_session` in `state.yaml`.

---

## cairn_plan

**Purpose**: Challenge architectural direction before implementation.

**Required Before**: framework introduction, infrastructure changes, migrations, abstraction increases.

**Precondition**: requires prior `cairn_context`. Will reject if context not loaded.

```
cairn_plan({ task: string })
```

**Returns**: stage guidance, DNA guidance, historical constraints, recommended direction, warnings, open questions.

**Side Effects**: none (read-only).

---

## cairn_signal

**Purpose**: Capture explicit cognition from conversation.

**Required When**: user rejects, constrains, decides, references history, accepts debt, or declares phase limits.

```
cairn_signal({
  signal_type: "user_rejection" | "historical_reference" | "constraint_declaration" | "decision" | "debt_acceptance" | "stage_constraint",
  domain?: string,
  details: {
    what: string,
    aliases?: string[],
    reason?: string,
    rejected_alternatives?: [{ path, reason }],
    revisit_when?: string[]
  },
  evidence: {
    user_said?: string,
    files?: string[],
    commit_ref?: string
  }
})
```

**Returns**: accepted, routing (level, destination, governance), challenges.

**Side Effects**: routes through TrustRouter. May write to blood or staged.

---

## cairn_observe

**Purpose**: Capture implicit cognition from code evolution before commit.

**Required Before**: every git commit (except empty/merge/typo-only).

```
cairn_observe({
  summary: string,
  candidates: [{
    signal_type, domain?, details, evidence,
    recommendation: "capture" | "skip",
    recommendation_reason: string
  }]
})
```

**Returns**: total, captured, skipped, staged count, instructions.

**Side Effects**: routes captured candidates through TrustRouter.

---

## cairn_session_end

**Purpose**: Finalize cognitive lifecycle. Run maintenance pipeline.

**Required When**: task complete, direction stabilized, debugging finished, user changes topic.

```
cairn_session_end({
  summary: string,
  changed_domains?: string[],
  decisions_made?: string[],
  unresolved?: string[]
})
```

**Pipeline**: git scan -> decay -> calibration + safety valve -> stage inference -> compression -> views regeneration.

**Returns**: signals_processed, new_blood, new_staged, git_signals, decay, calibration, stage, dna_compression, dna_safety_valve.

**Side Effects**: extensive. May write to blood, staged, dna/staged, state.

---

## cairn_session_recover

**Purpose**: Recover interrupted cognition lifecycle.

**Required When**: `cairn_context` returns `session.recovery_required: true`.

```
cairn_session_recover()
```

**Pipeline**: runs full `session_end` pipeline for the stale session.

**Side Effects**: same as `cairn_session_end`.

---

## cairn_init_status

**Purpose**: Check initialization state.

```
cairn_init_status()
```

**Returns**: status, completed_steps, current_step, next_action, guide.

---

## cairn_init_commit

**Purpose**: Write initial cognition (config, skeleton, blood, stage, DNA).

```
cairn_init_commit({
  step: "config" | "skeleton" | "blood" | "dna" | "stage",
  dry_run?: boolean,
  ...step-specific fields
})
```

Step-by-step with `dry_run: true` preview before each write. Blood candidates auto-confirm during init. DNA traits are staged.

---

## cairn_stage_list

**Purpose**: List pending staged EvolutionEvent entries.

```
cairn_stage_list()
```

---

## cairn_stage_accept

**Purpose**: Promote staged entry to blood (permanent cognition).

```
cairn_stage_accept({ id: string })
```

Never auto-accept. Always present to user first.

---

## cairn_stage_reject

**Purpose**: Reject staged entry with reason.

```
cairn_stage_reject({ id: string, reason: string })
```

---

## cairn_dna_list

**Purpose**: List pending DNA trait candidates from compression.

```
cairn_dna_list()
```

---

## cairn_dna_accept

**Purpose**: Confirm a DNA trait candidate. Writes to `dna/identity.yaml`.

```
cairn_dna_accept({ id: string })
```

Always require human ratification. A wrong DNA trait silently distorts every future decision.

---

## cairn_dna_reject

**Purpose**: Reject a DNA trait candidate with reason.

```
cairn_dna_reject({ id: string, reason: string })
```

---

## cairn_status

**Purpose**: System state snapshot.

```
cairn_status()
```

**Returns**: blood/staged counts, DNA status + reevaluation_mode + drift warnings, stage advisory, pending DNA candidates, governance pending.

---

## cairn_doctor

**Purpose**: Cognitive consistency validator.

```
cairn_doctor()
```

**Side Effect**: auto-resurrects archived G0/G1 events with >=5 hits in 30 days. G2+ surface as `resurrection_candidates` for human ratification.

5 consistency checks: DNA vs recent events, no-go blood support, skeleton reality, archived over-activation, contradictory constraints.
