[中文](vs-adr.zh.md) | English

# Cairn vs. ADR

## TL;DR

ADRs are written for humans to read. Cairn is written for AI to use.
They capture different things, serve different audiences, and belong in the same project together.

---

## What ADR Does

Architecture Decision Records (ADRs), popularized by Michael Nygard in 2011, give teams
a lightweight format to document significant technical decisions over time. A typical ADR
contains three parts:

- **Context** — the situation that forced a decision
- **Decision** — what was chosen
- **Consequences** — what changes as a result, including trade-offs

ADRs work well for humans. A new engineer joining the team can read through the ADR log
and understand why the codebase is shaped the way it is — why the team chose PostgreSQL
over MongoDB, why Redux was dropped, why the API layer was redesigned in year two. The
format is prose-friendly, chronological, and designed to be read by someone who can
apply judgment to incomplete information.

ADRs are widely adopted. Tools like `adr-tools`, Backstage, and Notion all support the
format. Many teams already have an ADR directory.

---

## Where ADR Falls Short for AI

The same properties that make ADRs good for humans make them poorly suited as AI
constraint inputs.

**1. Free-prose format without token budget awareness.**
ADRs are written as paragraphs — context, rationale, trade-offs, alternatives, future
considerations. An AI receiving a set of ADRs has no signal about which sentences are
load-bearing constraints versus background narrative. A 600-word ADR might contain one
sentence that should change AI behavior, buried in three paragraphs of historical
context. The AI has no way to distinguish them.

**2. No concept of injection timing.**
ADRs sit in a directory and are either all read or all ignored. There is no mechanism
to say "read this one always," "read this one only when planning API work," or "only
fetch this one if the user asks about authentication history." An AI reading 30 ADRs
at session start consumes most of its context budget on history that may be irrelevant
to the current task. Cairn's activation pipeline — always-on (`output.md`),
on-demand by domain (`domains/*.md`), and precision-queried via `cairn_context()` — is a
concept ADRs do not model.

**3. No explicit no-go enforcement mechanism.**
An ADR may document that tRPC was tried and abandoned. But nothing in the ADR format
signals to an AI: "do not propose tRPC again." The AI might read the ADR, understand
the history, and still offer tRPC as a suggestion in a future conversation — because
nothing in the format marks it as a forbidden direction. Cairn's `## no-go` section
in `output.md` is a direct behavioral instruction: the AI MUST NOT suggest these
directions.

**4. No domain-scoped context separation.**
A team with 20 ADRs has decisions about auth, API design, state management, deployment,
and testing all mixed in the same directory, sorted chronologically. When an AI is
planning an API change, it has no efficient way to pull only the API-relevant history.
Cairn's skeleton maps domains to ownership boundaries, and `domains/*.md` views
pre-compress evolution history by domain, so the AI gets exactly the relevant context
without reading the full archive.

**5. The `rejected` field is structurally absent.**
ADRs have an "alternatives considered" section, but it is optional, free-form, and
rarely written with enough specificity for AI use. The rejected paths — the directions
that were evaluated and ruled out — are the most important inputs for preventing AI
from re-proposing already-discarded options. Cairn treats rejected paths as critical
data: every evolution event with `behavior_effect: avoid_suggestion` records what was
tried and why it was excluded.

---

## What Cairn Adds for AI

Cairn does not replace ADRs. It adds a structured, AI-targeted constraint layer on top
of (or alongside) whatever documentation the team already keeps.

**Automatic signal capture.**
Cairn captures project signals automatically from three sources: the Git ear
(reverts, dependency changes, large refactors), the conversation ear (AI reports
user rejections, decisions, constraints via `cairn_signal()`), and the calibration ear
(detects drift between code reality and cognitive state). ADRs require a human
author to write each record. Cairn's tri-ear design means constraint-relevant events
are captured as they happen, with no manual documentation step.

**Gravity-routed cognition with human review.**
Captured signals flow through a Trust Router that assigns gravity (G0–G3).
G0 signals are noise and get dropped. G1 suggestions are written automatically in
lightweight mode or system-validated in standard mode. G2 reflective challenges require
the AI to present reasoning. G3 hard constraints always require human ratification.
Trauma domains permanently upgrade gravity for new signals. DNA traits modulate gravity
based on project personality. This ensures cognitive quality without requiring humans
to write every entry.

**Token-budget-aware constraint views.**
Cairn auto-generates `views/output.md` from blood events with a target of 500 tokens and a
hard limit of 800. The format uses `key: value` pairs and short bullet lists, not prose.
Every line must change AI behavior — if removing it would not alter a response, the
Views Engine does not include it.

**Machine-readable `behavior_effect` field.**
Every evolution event declares its `behavior_effect` — how the AI's behavior should
change. Four types are supported:

- `avoid_suggestion`: the AI MUST NOT suggest this direction
- `prefer_approach`: the AI should prefer this approach
- `warn_before`: the AI should warn before touching this area
- `require_review`: changes in this area need human sign-off

This is a direct behavioral instruction, not narrative context. ADRs describe
consequences in prose; Cairn encodes them as machine-readable constraints.

**Domain-scoped context via Skeleton.**
Each domain in the skeleton (`api-layer`, `auth`, `state-management`, etc.) defines
ownership boundaries and causal keywords. When the AI calls
`cairn_context({ task: "API design" })`, the activation engine maps the task to
relevant domains and returns only domain-specific constraints — not auth history,
not deployment history.

---

## Using Both Together

ADRs and Cairn are not competing systems. The same technical event produces a different
artifact in each:

| | ADR | Cairn evolution event |
|--|-----|----------------------|
| Audience | Human engineers | AI cognitive system |
| Format | Prose paragraphs | Structured YAML with gravity, lifecycle, trauma |
| Purpose | Institutional memory | Behavioral constraint input |
| Creation | Human writes | Captured from signals, routed through gravity |
| Injection | Read by humans on demand | Returned by `cairn_context()` MCP tool |
| Constraint | None — informational only | `behavior_effect`, `lifecycle`, `trauma`, `governance` |

### Example: Choosing PostgreSQL

**The ADR version** (`docs/decisions/0012-database-choice.md`):

> **Status:** Accepted
>
> **Context:** We needed a primary data store for the application. The team evaluated
> several options in early 2023 as user data complexity grew. We had prior experience
> with MongoDB from a previous project but wanted to evaluate relational options given
> our data's increasingly structured nature.
>
> **Decision:** We will use PostgreSQL as our primary database.
>
> **Consequences:** We gain strong consistency guarantees, ACID transactions, and
> mature tooling (Prisma, pgAdmin). We lose the schema flexibility of document
> databases. The team will need to manage migrations. MongoDB was the primary
> alternative; DynamoDB was briefly considered but ruled out due to vendor lock-in
> concerns and the team's lack of AWS familiarity at the time.

This is the right format for a human reader: narrative, contextual, explains the
reasoning fully, readable without any tool.

**The Cairn version** (`.cairn/blood/evt_2023_03_database_postgresql.yaml`):

```yaml
id: evt_2023_03_database_postgresql
type: decision
domain: database
subject:
  name: PostgreSQL
  category: database
summary: Chose PostgreSQL as primary database; relational model fits structured data
gravity:
  level: G2
  architectural: medium
  operational: low
  local: high
source:
  kind: conversation
  refs:
    - type: session
      id: sess_2023_03_15
  captured_at: "2023-03-15T00:00:00Z"
behavior_effect:
  type: prefer_approach
  instruction: Use PostgreSQL for new data storage needs
  scope: local
lifecycle:
  validity: strategic
  decay_policy: downgrade
revisit:
  when:
    - Data model becomes document-heavy
    - Multi-region latency demands a globally distributed store
  status: not_met
governance:
  status: human_ratified
  ratified_by: human
  ratified_at: "2023-03-15T00:00:00Z"
health:
  last_accessed: "2023-03-15T00:00:00Z"
  access_count: 0
  staleness: fresh
```

The Views Engine auto-generates `views/output.md` with `db: PostgreSQL` in the
stack section, and `views/domains/database.md` with the evolution trajectory.

The ADR tells the story. The Cairn evolution event enforces the constraint. Both are
correct for their purpose. Neither replaces the other.
