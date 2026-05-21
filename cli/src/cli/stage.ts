import { createContext } from "../context.js";
import { PROJECT_PHASES } from "../schemas/state.js";

type ProjectPhase = typeof PROJECT_PHASES[number];

function parsePhaseSubject(name: string): ProjectPhase | null {
    if (!name.startsWith("phase:")) return null;
    const phase = name.slice("phase:".length);
    if ((PROJECT_PHASES as readonly string[]).includes(phase)) {
        return phase as ProjectPhase;
    }
    return null;
}

export async function runStage(args: string[]): Promise<void> {
    const sub = args[0];
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);

    if (sub === "confirm") {
        const state = await ctx.stateStore.load();
        state.stage.status = "confirmed";
        state.stage.last_updated = new Date().toISOString();
        await ctx.stateStore.save(state);
        await ctx.governanceEngine.logAudit({
            time: new Date().toISOString(),
            action: "stage_confirmed",
            target: state.stage.phase,
            actor: "human",
        });
        console.log(`Stage confirmed: ${state.stage.phase}`);
        return;
    }

    if (sub === "list") {
        const pending = await ctx.stagedStore.findPending();
        const transitions = pending.filter(e => e.draft_event.type === "stage_transition");
        if (transitions.length === 0) {
            console.log("No pending stage transitions");
            return;
        }
        console.log(`${transitions.length} pending stage transition(s):\n`);
        for (const entry of transitions) {
            console.log(`  ${entry.id}`);
            console.log(`    ${entry.draft_event.decision_or_change}`);
            console.log(`    reasoning: ${entry.draft_event.reasoning}`);
            console.log(`    gravity: ${entry.gravity}, governance: ${entry.governance_required}\n`);
        }
        return;
    }

    if (sub === "accept") {
        const id = args[1];
        if (!id) {
            console.error("Usage: cairn stage accept <id>");
            process.exit(1);
        }
        const entry = await ctx.stagedStore.load(id);
        if (!entry) throw new Error(`Staged entry "${id}" not found`);

        const now = new Date().toISOString();
        entry.draft_event.governance_status = "ratified";
        await ctx.bloodEngine.commit(entry.draft_event);

        let stageApplied = false;
        if (entry.draft_event.type === "stage_transition") {
            const newPhase = parsePhaseSubject(entry.draft_event.subject.name);
            if (newPhase) {
                const state = await ctx.stateStore.load();
                state.stage.phase = newPhase;
                state.stage.status = "confirmed";
                state.stage.last_updated = now;
                state.stage.guidance = entry.draft_event.behavior_effect.instruction
                    .split(";")
                    .map(s => s.trim())
                    .filter(Boolean);
                await ctx.stateStore.save(state);
                stageApplied = true;
            }
        }

        await ctx.stagedStore.remove(entry.id);
        await ctx.governanceEngine.logAudit({ time: now, action: "ratified", target: entry.draft_event.id, actor: "human" });
        await ctx.viewsEngine.regenerate();

        console.log(`Accepted: moved to blood`);
        if (stageApplied) {
            const state = await ctx.stateStore.load();
            console.log(`Stage updated → phase=${state.stage.phase}`);
        }
        return;
    }

    if (sub === "reject") {
        const id = args[1];
        const reason = args.slice(2).join(" ");
        if (!id || !reason) {
            console.error("Usage: cairn stage reject <id> <reason>");
            process.exit(1);
        }
        const entry = await ctx.stagedStore.load(id);
        if (!entry) throw new Error(`Staged entry "${id}" not found`);

        await ctx.stagedStore.remove(entry.id);
        await ctx.governanceEngine.logAudit({ time: new Date().toISOString(), action: "rejected", target: entry.draft_event.id, actor: "human", reason });

        console.log(`Rejected stage transition: ${id}`);
        return;
    }

    console.log("Usage: cairn stage <confirm|list|accept <id>|reject <id> <reason>>");
    process.exit(1);
}
