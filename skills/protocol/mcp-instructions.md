Cairn is a project memory engine. It captures decisions, rejections, and constraints — then enforces them as active cognition. 16 MCP tools across a mandatory lifecycle.

INITIALIZATION — If cairn_init_status returns not_initialized/partial, or cairn_context returns interaction_hint=needs_init, you MUST complete initialization before any other work.
Steps (in order): config -> skeleton -> blood -> dna -> stage. For each: analyze, dry_run preview, user confirms, commit, check next. Blood auto-confirms during init. DNA traits are staged for human review.

MANDATORY LIFECYCLE — You MUST follow this sequence during every technical session. Skipping any step degrades the project's cognitive health.

1. CONTEXT FIRST — You MUST call cairn_context({ task?, files? }) BEFORE responding to any technical request. No cairn_context = no technical recommendation. This is non-negotiable.
If response includes session.recovery_required, call cairn_session_recover() first, then cairn_context() again.
Respect ALL returned constraints for the entire session:
- constraints.no_go: NEVER suggest these directions. Entries with archived:true are weaker but still warn.
- constraints.accepted_debt: do NOT fix. Work within.
- constraints.stage_constraints: adjust suggestion aggressiveness to project phase.
- challenges: respond per level — suggestion (acknowledge), reflective_challenge (justify in writing why history no longer applies), hard_constraint (do NOT proceed, inform user).

2. PLAN BEFORE ARCHITECTURE — You MUST call cairn_plan({ task }) before proposing frameworks, infrastructure changes, migrations, or large refactors. Requires prior cairn_context. Detects conflicts with historical rejections, trauma, accepted debt, and DNA modulation.

3. SIGNAL ON COGNITION — You MUST call cairn_signal() when you detect: user_rejection, constraint_declaration, decision, historical_reference, debt_acceptance, stage_constraint. Include details.aliases for synonym recognition. Do NOT signal routine fixes or duplicates. Missing a signal = the project permanently loses memory of this decision.

4. OBSERVE BEFORE COMMIT — You MUST call cairn_observe({ summary, candidates }) BEFORE every git commit. Extract candidate signals from work done since last observe. Each gets recommendation (capture/skip). If staged > 0, present to user before committing.

5. SESSION END — You MUST call cairn_session_end({ summary, changed_domains?, decisions_made?, unresolved? }) when the task completes. Skipping means: git commits unscanned, decay paused, DNA candidates lost, calibration skipped. Not optional.
After calling, report to user if: dna_safety_valve.entered_reevaluation, stage.changed, decay.archived.length > 0, or dna_compression.new_staged.length > 0.

REVIEW QUEUES — Two separate channels, both require human ratification:
- EvolutionEvent staged: cairn_stage_list() -> cairn_stage_accept/reject per user decision. Never auto-accept.
- DNA trait candidates: cairn_dna_list() -> cairn_dna_accept/reject per user decision. A wrong DNA trait silently distorts every future decision.

DIAGNOSTICS:
- cairn_status() — system state snapshot (counts, DNA status, stage phase, drift warnings).
- cairn_doctor() — consistency validation. Side effect: auto-resurrects archived G0/G1 events with high recent activation. G2+ surface as candidates only.
