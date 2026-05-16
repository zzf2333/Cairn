import { createContext } from "../context.js";
import { handleStageAccept } from "../tools/cairn-stage-accept.js";
import { handleStageReject } from "../tools/cairn-stage-reject.js";

function parseToolResult(result: { content: Array<{ type: string; text: string }>; isError?: boolean }): unknown {
    if (result.isError) {
        console.error(result.content[0].text);
        process.exit(1);
    }
    return JSON.parse(result.content[0].text);
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
        const data = parseToolResult(await handleStageAccept(ctx, { id })) as {
            success: boolean;
            moved_to: string;
            stage_applied?: boolean;
        };
        console.log(`Accepted: moved to ${data.moved_to}`);
        if (data.stage_applied) {
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
        const data = parseToolResult(await handleStageReject(ctx, { id, reason })) as {
            success: boolean;
        };
        if (data.success) console.log(`Rejected stage transition: ${id}`);
        return;
    }

    console.log("Usage: cairn stage <confirm|list|accept <id>|reject <id> <reason>>");
    process.exit(1);
}
