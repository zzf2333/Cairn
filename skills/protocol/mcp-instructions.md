Cairn is a project memory engine. It captures decisions, rejections, and constraints — then enforces them as active cognition. 16 MCP tools across a mandatory lifecycle.

INITIALIZATION — If cairn_init_status returns not_initialized/partial, or cairn_context returns interaction_hint=needs_init, you MUST complete initialization before any other work.
Steps (in order): config -> skeleton -> blood -> dna -> stage. For each: analyze, dry_run preview, user confirms, commit, check next. Blood auto-confirms during init. DNA traits are staged for human review.

MANDATORY LIFECYCLE — You MUST follow this sequence during every technical session. Skipping any step degrades the project's cognitive health.
Does NOT activate for: trivial formatting, typo fixes, pure explanation, non-technical conversation.

1. LOAD CONSTRAINTS BEFORE REASONING — Active cognition must precede technical reasoning. cairn_context({ task?, files? }). No cairn_context = no technical recommendation.
If response includes session.recovery_required, call cairn_session_recover() first, then cairn_context() again.
Respect ALL returned constraints for the entire session — they are runtime state, not suggestions:
- constraints.no_go: NEVER suggest these directions. Entries with archived:true are weaker but still warn.
- constraints.accepted_debt: do NOT fix. Work within.
- constraints.stage_constraints: adjust suggestion aggressiveness to project phase.
- challenges: respond per level — suggestion (acknowledge), reflective_challenge (justify in writing why history no longer applies), hard_constraint (do NOT proceed, inform user).

2. CHALLENGE DIRECTION BEFORE ARCHITECTURE — Historical cognition must validate direction before implementation. cairn_plan({ task }). Required before: framework introduction, module boundary changes, migrations, infrastructure changes, large refactors. Requires prior cairn_context.

3. CAPTURE EXPLICIT COGNITION — Long-term cognition expressed by the user must never be silently acknowledged. cairn_signal() when you detect: user_rejection, constraint_declaration, decision, historical_reference, debt_acceptance, stage_constraint. Include details.aliases for synonym recognition. Do NOT signal routine fixes or duplicates. Missing a signal = the project permanently loses memory of this decision.

4. CAPTURE IMPLICIT COGNITION BEFORE COMMIT — Complex work generates decisions never explicitly stated. cairn_observe({ summary, candidates }) before git commit. Extract candidate signals, each gets recommendation (capture/skip). If staged > 0, present to user before committing. Skip for whitespace-only or docs-only commits.

5. CLOSE THE COGNITIVE LIFECYCLE — Every technical session must close. cairn_session_end({ summary, changed_domains?, decisions_made?, unresolved? }). Skipping breaks: git scanning, decay, DNA emergence, calibration. Not optional.
Check the `highlights` array first — it surfaces notable events (reevaluation, stage transitions, archived events, new DNA candidates, pending reviews). Report any non-empty highlights to the user.

6. RECOVER BEFORE RESUMING — If previous session was unclosed, cairn_session_recover() before starting new work.

REVIEW QUEUES — Two separate channels, both require human ratification:
- EvolutionEvent staged: cairn_stage_list() -> cairn_stage_accept/reject per user decision. Never auto-accept.
- DNA trait candidates: cairn_dna_list() -> cairn_dna_accept/reject per user decision. A wrong DNA trait silently distorts every future decision.

DIAGNOSTICS:
- cairn_status() — system state snapshot (counts, DNA status, stage phase, drift warnings).
- cairn_doctor() — consistency validation. Side effect: auto-resurrects archived G0/G1 events with high recent activation. G2+ surface as candidates only.
