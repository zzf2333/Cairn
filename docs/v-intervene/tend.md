# Tend

> A living system requires tending. Cairn doesn't run unattended — it runs *almost* unattended, with a small set of acts the team takes when the diagnostic surface shows something to attend to.

---

## The diagnostic surface

The single most useful command:

```bash
cairn doctor --metrics
```

```
.cairn health:
  cairn_version:       0.4.x
  blood events:        47 (44 active, 3 archived, 2 trauma)
  DNA identity:        emerged
  DNA traits:          2 (1 medium, 1 high)
  DNA reevaluation:    off
  DNA staged candid.:  0
  staged backlog:      3
  last session_end:    2 days ago
  stage:               maturity (confidence 0.84, advisory)
```

What each line is telling you:

| Field | Healthy looks like | Worry when |
|-------|--------------------|------------|
| `blood events` | Grows ~5–20/month on an active project | Sharp spike or sudden stop |
| `archived` ratio | 10–30% over a year | 0% (decay isn't running) or 60%+ (cognition is being lost) |
| `trauma` count | A few, tied to real incidents | Many (10+ in one domain → trauma inflation) |
| `DNA identity` | `emerged` after 3+ months of real use | Stuck at `not_yet_emerged` after a year of active use |
| `DNA reevaluation` | `off` | `ACTIVE` — pending team reevaluation |
| `staged backlog` | 0–5 | Climbing without bound |
| `last session_end` | Hours / a day ago | Days / weeks — pipeline isn't running |
| `session_in_progress` | (not present) | Present — crash recovery needed |

---

## Common situations, by symptom

### "The AI isn't calling `cairn_context`"

Most common newcomer problem. Symptom: AI gives answers without referencing constraints or rejected paths.

Check:

1. The protocol skill is installed. For Claude Code: `npx skills add zzf2333/Cairn` (check `.claude/skills/cairn/SKILL.md` exists). For Codex: verify `AGENTS.md` contains the protocol. Without it, the tools are visible to the AI but the protocol isn't loaded.
2. Restart the host (Claude Code, Codex). The skill file is read at session start.
3. Test: ask the AI "Call `cairn_context` and show me the raw response." If it can't, the installation is broken; if it can but doesn't on its own, the skill isn't being loaded.

### "Staged backlog keeps climbing"

Symptom: `staged backlog: 47` and growing.

Two paths:

- **Wrong cognitive mode** — you're on `institutional` when your team is willing to pay `standard`-level overhead. Edit `config.yaml.cognitive_mode`. Existing staged entries don't auto-resolve, but the inflow drops.
- **No one is reviewing** — schedule a 10-minute review at the start of standups, or use `cairn review` to batch-process. The AI is supposed to surface staged count after `cairn_session_end`; if it isn't, re-check the skill installation.

For old queues created before evidence metadata existed:

```bash
cairn review --clusters
cairn review dismiss --cluster noisy-large-refactor --dry-run
cairn review dismiss --cluster noisy-large-refactor --yes
```

The dismiss command only supports known legacy noise clusters. It marks entries `rejected` and writes governance audit records; it does not delete staged files.

### "Stage is stuck at exploration"

Symptom: `views/stage.md` or `cairn status` shows low confidence even though the project has implementation, test, and documentation history.

Run a normal lifecycle close:

```bash
cairn session-end --summary "close current work"
```

Stage inference now combines git age/activity with recent session summaries, test/acceptance evidence, docs presence, and bugfix/review cadence. Phase changes still go through hysteresis and staged human review, but confidence and evidence update on every session close.

### "DNA emerged, then immediately drifted"

Symptom: `cairn doctor --metrics` shows `DNA reevaluation: ACTIVE`.

```bash
cairn dna reevaluate
```

Walks each paused trait. For each, decide:

- **Keep** — drift was circumstance; trait still applies
- **Adjust** — trait was too strong / too weak; drop a level
- **Reject** — trait was wrong; remove

The audit log records the decision. Routing resumes after every trait is decided.

This is normal life for a healthy project — drift catches happen, the team adjusts. A project that *never* has reevaluation_mode trip is either too young to have stable DNA, or has DNA so weak it never modulates.

### "A yaml file got corrupted"

Symptom: `cairn status` errors with `YAMLParseError`, or the runtime fails to start.

```bash
cairn doctor --fix
```

Scans `.cairn/blood`, `.cairn/staged`, `.cairn/skeleton`, `.cairn/dna/staged` for yaml parse failures. Moves bad files to `.cairn/quarantine/<iso-timestamp>/`. The main directories stay clean; the system reboots; the quarantine is yours to inspect.

Also reports **orphan skeleton refs** — Blood events whose `domain` doesn't appear in any skeleton file. These aren't auto-fixed (deletion is destructive). Fix manually: either add the missing skeleton or delete/edit the orphan Blood event.

### "A `cairn_session_end` crashed mid-pipeline"

Symptom: `cairn doctor --metrics` shows `session_in_progress: YES (started ..., step decay_done)`.

```bash
cairn doctor --recover
```

Clears the checkpoint. Doesn't replay the pipeline — side effects already written (e.g., decay archived events if it crashed after `decay_done`) are preserved.

Re-run `cairn_session_end` after recovery. The pipeline is idempotent enough that re-running converges.

### "Performance feels slow"

Symptom: `cairn_context` takes seconds instead of milliseconds.

Check:

1. Run `npm run bench` (in the `cli/` directory) on a clean tmpdir at your blood-event scale. Compare to `docs/vi-coordinates/performance.md` numbers.
2. Confirm the BloodStore cache is alive — restart the runtime (the cache is in-process; multiple host restarts each spawn a fresh process).
3. Check `.cairn/blood/` file count. If it's grown into the tens of thousands, decay isn't running enough — either `cairn_session_end` is being skipped, or the cognitive mode is too institutional for the activity rate.

### "An old constraint suddenly came back"

Not a problem — feature. **Resurrection** brought back an archived event because it accumulated ≥ 5 hits in 30 days. The event's `health.state` is now `resurrected`, and you can see it in `cairn blood show <id>`.

If the resurrection was wrong (the hits were coincidence), `cairn blood archive <id>` puts it back. If you want it gone for good, `cairn blood reject <id> <reason>` — recorded in audit.

---

## The four maintenance acts

Most of Cairn runs automatically. There are four acts the team explicitly does:

1. **Ratify staged events.** Daily or at most weekly. `cairn review` for batch; `cairn_stage_accept`/`reject` per item. Each act is fast (≤ 30s) if the staged entries are well-formed.

2. **Ratify DNA candidates.** Rare — maybe once a quarter. `cairn_dna_list` → review each → accept / reject. Take this slowly; a wrong DNA trait is expensive.

3. **Reevaluate when the valve trips.** Whenever `DNA reevaluation: ACTIVE` appears in `cairn doctor`. `cairn dna reevaluate` walks you through.

4. **Confirm or reject stage transitions.** When `StageEngine` proposes "the project has moved from `growth` to `maturity`," it queues a transition for human ratification. `cairn stage list` to see; `cairn stage accept <id>` or `reject <id> <reason>`.

That's the full maintenance surface. The rest runs on its own.

---

## When to ignore the system

There's an inverse failure mode: treating the diagnostic surface as a list of things to "fix."

- `archived: 3` is not a problem. Decay is working.
- `staged: 2` is not a problem. People will ratify those when ready.
- A "rejected" DNA candidate is not a problem. The compression engine will re-propose when more evidence accumulates.

Cairn is meant to be **mostly silent**. If `cairn doctor` outputs no warnings, no incomplete sessions, and the metrics look reasonable for your project's activity, the right move is to do nothing.

---

## The dogfood handle

The Cairn repository itself runs Cairn on Cairn (see `.cairn/` in the repo root). Findings — surprises, friction, false-positives, false-negatives — accumulate in `cli/tests/scenarios/_findings.md`. That file is the slow institutional memory of how Cairn behaves in real use. When something feels off, check there first; it may already be a known pattern with a known workaround.

---

## See also

- [`enter.md`](./enter.md) — install
- [`protocol.md`](./protocol.md) — the AI's contract
- [`../iv-self/`](../iv-self/) — what calibration, trust router, and the safety valve do
- [`../vi-coordinates/performance.md`](../vi-coordinates/performance.md) — SLO and benchmark methodology
- [`../vi-coordinates/migration.md`](../vi-coordinates/migration.md) — version upgrades
