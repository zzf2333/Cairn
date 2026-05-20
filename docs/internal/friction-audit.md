# Friction Audit — Cairn Lifecycle Protocol

Date: 2026-05-20
Method: Real dogfood session on Cairn itself + code analysis of all 6 lifecycle tools

## Findings

### F1: session_end output lacks actionable summary [FIXED]

**Problem**: session_end returns a large JSON (git_signals, decay, calibration, stage, dna_compression, dna_safety_valve). The protocol tells AI to "report if X happens" but the AI must parse every nested field to find notable events.

**Impact**: AI either reports nothing (misses important events) or dumps the entire response (noise).

**Fix applied**: Added `highlights: string[]` at the top of session_end output. Collects: reevaluation trigger, stage transitions, archived events, new DNA candidates, pending reviews, confidence reductions. Protocol updated to say "check highlights first".

---

### F2: observe candidate structure is appropriately lean

**Finding**: Initially suspected verbose — 6 fields per candidate. But `domain` and `evidence` are already optional with defaults. The required fields (signal_type, details.what, recommendation, recommendation_reason) are the minimum needed for routing decisions.

**Status**: No change needed.

---

### F3: Recovery flow requires 3 round-trips

**Problem**: Stale session detection flow: `context → blocked → recover → context again`. That's 3 MCP calls before work can start.

**Mitigating factors**: 
- Only triggers when previous session had signals (signals_count > 0) AND is stale (>60 min)
- Fresh sessions with signals_count=0 are silently overwritten
- The explicit recovery preserves session data for the record

**Status**: Accepted trade-off. The data preservation justifies the extra calls. Could revisit if real usage shows high recovery frequency.

---

### F4: mcp-instructions.md and SKILL.md duplication risk

**Problem**: Both define the lifecycle. MCP instructions load via server.ts into the MCP protocol description. SKILL.md loads via the platform adapter (Claude Code). If they drift, conflicting signals.

**Current state**: 
- `mcp-instructions.md` — dense, tool-focused, all 6 steps + initialization + review + diagnostics
- `SKILL.md` — inlined core.md (behavior-focused) + reference index

**Risk**: Low right now (both were updated in the same session) but will grow over time.

**Recommendation**: Add a CI check or `cairn doctor` rule that validates mcp-instructions.md mentions the same lifecycle steps as protocol/core.md. Or consider making mcp-instructions.md auto-generated from core.md.

---

### F5: No mid-session compliance self-check

**Problem**: AI can't check "have I called plan/observe yet?" without calling cairn_status (which returns everything).

**Assessment**: Not actually friction — the protocol tells AI WHEN to call each tool based on context (before architecture → plan, before commit → observe). The AI doesn't need to self-check; it needs to follow triggers. Compliance is tracked passively and reported at session_end.

**Status**: No change needed.

---

### F6: context's observe_reminder is static

**Problem**: `observe_reminder: "Call cairn_observe before every git commit"` appears on every context call, regardless of session state.

**Assessment**: Low friction. The reminder is correct and brief. Making it dynamic (e.g., "3 signals captured, remember to observe before commit") would add complexity for marginal benefit.

**Status**: No change needed.

---

### F7: domain inference is easy to skip

**Problem**: cairn_signal and cairn_observe both accept optional `domain`. AI often omits it or guesses wrong because it doesn't remember the skeleton domains from context.

**Mitigating factors**:
- TrustRouter handles unknown domains gracefully
- Skeleton domains are returned in cairn_context output
- For global decisions, omitting domain is correct

**Status**: Acceptable. Could improve by having signal/observe return "suggested domain based on subject" in the response, but this is a low-priority enhancement.

## Summary

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| F1 | session_end lacks highlights | High | **Fixed** |
| F2 | observe candidates verbose | Low | No change (already lean) |
| F3 | Recovery 3 round-trips | Medium | Accepted trade-off |
| F4 | mcp-instructions / SKILL.md drift risk | Medium | Future: CI check |
| F5 | No mid-session compliance check | Low | No change (by design) |
| F6 | Static observe_reminder | Low | No change |
| F7 | Domain inference skipped | Low | Acceptable |

## Protocol Health

The protocol is structurally sound. The main friction is output readability (F1, now fixed), not tool design. The minimal-intervention rules correctly scope when to skip lifecycle steps. The anti-patterns doc covers real failure modes.

The biggest risk going forward is F4 (duplication drift between mcp-instructions.md and SKILL.md/core.md). Consider automation.
