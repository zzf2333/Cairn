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
to the current task. Cairn's three-layer injection — always-on (`output.md`),
on-demand by domain (`domains/*.md`), and precision-queried (`history/`) — is a
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
Cairn's `domains/*.md` layer pre-compresses decision history by domain, so the AI gets
exactly the relevant context without reading the full archive.

**5. The `rejected` field is structurally absent.**
ADRs have an "alternatives considered" section, but it is optional, free-form, and
rarely written with enough specificity for AI use. The rejected paths — the directions
that were evaluated and ruled out — are the most important inputs for preventing AI
from re-proposing already-discarded options. Cairn treats `rejected` as the most
critical field in every history entry: even a `decision` entry MUST record what was
considered and not chosen.

---

## What Cairn Adds for AI

Cairn does not replace ADRs. It adds a structured, AI-targeted constraint layer on top
of (or alongside) whatever documentation the team already keeps.

**Automatic signal capture.**
Cairn captures project signals automatically from two sources: the Git ear
(reverts, dependency changes, large refactors) and the conversation ear (AI reports
user rejections, decisions, constraints via `cairn_signal()`). ADRs require a human
author to write each record. Cairn's dual-ear design means constraint-relevant events
are captured as they happen, with no manual documentation step.

**Trust-routed memory with human review.**
Captured signals flow through a Trust Router that assigns trust levels (L0–L3).
Low-confidence signals accumulate in a candidate pool. High-impact signals go to
a staged review queue for human approval before becoming formal memory. Only signals
with strong evidence (e.g., git reverts of local-scope changes) are written
automatically. This ensures memory quality without requiring humans to write every entry.

**Token-budget-aware constraint views.**
Cairn auto-generates `views/output.md` from memory with a target of 500 tokens and a
hard limit of 800. The format uses `key: value` pairs and short bullet lists, not prose.
Every line must change AI behavior — if removing it would not alter a response, the
Views Engine does not include it.

**Machine-readable `behavior_effect` field.**
Every memory entry declares its `behavior_effect` — how the AI's behavior should
change. Four types are supported:

- `avoid_suggestion`: the AI MUST NOT suggest this direction
- `prefer_approach`: the AI should prefer this approach
- `warn_before`: the AI should warn before touching this area
- `require_review`: changes in this area need human sign-off

This is a direct behavioral instruction, not narrative context. ADRs describe
consequences in prose; Cairn encodes them as machine-readable constraints.

**Domain-scoped context separation.**
Each domain (`api-layer`, `auth`, `state-management`, etc.) has its own compressed
view file. When the AI calls `cairn_context({ task: "API design" })`, it receives
only API-relevant constraints — not auth history, not deployment history.

---

## Using Both Together

ADRs and Cairn are not competing systems. The same technical event produces a different
artifact in each:

| | ADR | Cairn memory entry |
|--|-----|---------------------|
| Audience | Human engineers | AI constraint system |
| Format | Prose paragraphs | Structured YAML fields |
| Purpose | Institutional memory | Behavioral input |
| Creation | Human writes | Captured from signals, routed through trust levels |
| Injection | Read by humans on demand | Returned by `cairn_context()` MCP tool |
| Constraint | None — informational only | `behavior_effect`, `revisit`, `relations` |

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

**The Cairn version** (`.cairn/memory/mem_2023_03_database_postgresql.yaml`):

```yaml
id: mem_2023_03_database_postgresql
type: decision
domain: database
scope: local
status: active
confidence:
  level: high
source:
  kind: conversation
  refs:
    - type: session
      id: sess_2023_03_15
  captured_at: "2023-03-15T00:00:00Z"
subject:
  name: PostgreSQL
summary: Chose PostgreSQL as primary database; relational model fits structured data
rejected:
  what: MongoDB, DynamoDB
  reason: >
    MongoDB — document model ill-fitted to relational data requirements.
    DynamoDB — vendor lock-in risk, team had no AWS ops familiarity.
chosen:
  what: PostgreSQL
  reason: >
    Data is highly relational. ACID guarantees required for financial records.
    Prisma ORM reduces migration friction for a team of 2.
behavior_effect:
  type: prefer_approach
  instruction: Use PostgreSQL for new data storage needs
revisit:
  when:
    - Data model becomes document-heavy
    - Multi-region latency demands a globally distributed store
  status: not_met
```

The Views Engine auto-generates `views/output.md` with `db: PostgreSQL` in the
stack section, and `views/domains/database.md` with the rejected paths.

The ADR tells the story. The Cairn memory entry enforces the constraint. Both are
correct for their purpose. Neither replaces the other.
