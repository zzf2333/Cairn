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

**Three-layer injection with explicit timing.**
`output.md` is injected at every session start — always-on, token-budgeted at 500
tokens target, 800 hard limit. Domain files (`domains/*.md`) are injected only when
the AI's task matches a keyword in the `## hooks` section. History entries are fetched
on demand for precise queries. Each layer has a defined injection moment, so the AI
never reads irrelevant context and never misses a critical constraint.

**Token-budget-aware constraint format.**
`output.md` uses `key: value` pairs and short bullet lists, not prose. The format is
deliberately terse. Every line must be able to change AI behavior — if removing a line
would not alter a response, it does not belong. The token budget (target 500, hard
limit 800) is a first-class design constraint, not an afterthought.

**Machine-readable `rejected` field.**
Every history entry has a `rejected` field that records alternatives considered and
not chosen, with explicit rejection reasons. This is the field the AI uses to avoid
re-proposing paths that have already been ruled out. Domain files surface the same
information in their `## rejected paths` section, with a `Re-evaluate when:` condition
that tells the AI what would need to change before the direction is worth reconsidering.

**Active behavior modification through three constraint types.**
Cairn distinguishes three AI-directed constraint types that ADRs do not separate:

- `no-go`: a directional exclusion — the AI MUST NOT suggest this direction
- `accepted debt`: a known defect the AI MUST NOT attempt to fix, with an explicit
  `revisit_when` condition
- `known pitfalls`: operational traps the AI MUST actively consider when working in
  a domain

Each type triggers different AI behavior. An ADR treats all three as narrative context.
Cairn treats them as behavioral instructions.

**Domain-scoped context separation.**
Each domain (`api-layer`, `auth`, `state-management`, etc.) has its own compressed
context file. When the AI is doing API work, it reads `domains/api-layer.md` — not
the auth history, not the deployment history. Context is scoped to the task.

---

## Using Both Together

ADRs and Cairn are not competing systems. The same technical event produces a different
artifact in each:

| | ADR | Cairn history entry |
|--|-----|---------------------|
| Audience | Human engineers | AI constraint system |
| Format | Prose paragraphs | Structured fields |
| Purpose | Institutional memory | Behavioral input |
| Injection | Read by humans on demand | Queried by AI on demand |
| Constraint | None — informational only | `rejected`, `reason`, `revisit_when` |

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

**The Cairn version** (`history/2023-03_database-choice.md`):

```
type: decision
domain: database
decision_date: 2023-03
recorded_date: 2023-03
summary: Chose PostgreSQL as primary database; relational model fits structured data
rejected: MongoDB — prior team experience, but document model ill-fitted to relational
  data requirements. DynamoDB — vendor lock-in risk, team had no AWS ops familiarity.
reason: Data is highly relational. ACID guarantees required for financial records.
  Prisma ORM reduces migration friction for a team of 2.
revisit_when: If data model becomes document-heavy or multi-region latency demands
  a globally distributed store
```

And in `output.md`:

```
## stack

db: PostgreSQL
```

And in `domains/database.md`:

```
## rejected paths

- MongoDB: document model does not fit highly relational data requirements
  Re-evaluate when: data model fundamentally shifts toward document-heavy structure
- DynamoDB: vendor lock-in + no team AWS ops familiarity at decision time
  Re-evaluate when: multi-region deployment requires globally distributed store
```

The ADR tells the story. The Cairn entries enforce the constraint. Both are correct
for their purpose. Neither replaces the other.
