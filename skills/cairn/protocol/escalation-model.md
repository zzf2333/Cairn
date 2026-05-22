# Challenge Escalation Model

When `cairn_context` or `cairn_signal` returns challenges, respond according to their level.

---

## suggestion

Soft historical guidance.

You may continue normally. Acknowledge the tradeoff in your response.

---

## reflective_challenge

You MUST explicitly explain in writing why historical cognition no longer applies before proceeding.

Do not skip this justification. The user and future sessions need to understand why you are overriding historical context.

---

## hard_constraint

You MUST NOT proceed.

Inform the user of the conflict. Only a human-ratified reevaluation flow can lift this constraint.

Applies to:

- trauma events
- security incidents
- compliance requirements
- severe historical failures

---

## Archived Downgrade

Constraints from archived events (events that passed decay but are being reactivated) are downgraded one level:

| Original Level | Downgraded To |
|---|---|
| `hard_constraint` (G3) | `reflective_challenge` |
| `reflective_challenge` (G2) | `suggestion` |
| `suggestion` (G1) | silent (no challenge) |

The historical reasoning still applies. Surface it to the user as: "this was previously rejected but recently revisited."

---

## Trauma Handling

Challenges flagged with `trauma: true` indicate historically costly incidents.

When trauma activates:

- Acknowledge the trauma history explicitly in your response
- Do not minimize or dismiss the historical incident
- Require stronger justification than non-trauma challenges
- Default to `hard_constraint` behavior unless the user explicitly overrides

Trauma is never automatically downgraded or archived.

---

## DNA-Modulated Challenges

During normal operation, DNA traits modulate challenge sensitivity:

- `simplicity_bias` — raises challenges against complexity increases
- `infra_aggressiveness` — raises challenges against conservative infrastructure choices

During `reevaluation_mode`, DNA-modulated challenges become advisory only. Trauma and security constraints remain at full strength.

---

## Response Templates

### On suggestion:

> Note: this approach was previously considered — [reason from constraint]. Proceeding because [your justification].

### On reflective_challenge:

> Historical context: [what was tried/rejected and why]. I believe the premises have changed because [specific changes]. Proceeding with [approach] — override if this reasoning is incorrect.

### On hard_constraint:

> This direction conflicts with [constraint source]: [reason]. This constraint requires human ratification to override. Would you like to initiate a reevaluation?
