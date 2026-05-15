import { stringify as yamlStringify } from "yaml";
import { createContext } from "../context.js";

export async function runBlood(args: string[]): Promise<void> {
    const sub = args[0];
    const id = args[1];
    const projectRoot = process.env.CAIRN_ROOT ?? process.cwd();
    const ctx = await createContext(projectRoot);

    if (sub === "show") {
        if (!id) {
            console.log("Usage: cairn blood show <id>");
            process.exit(1);
        }
        const event = await ctx.bloodStore.load(id);
        if (!event) {
            console.log(`Event not found: ${id}`);
            process.exit(1);
        }
        console.log(yamlStringify(event));
        return;
    }

    if (sub === "archive") {
        if (!id) {
            console.log("Usage: cairn blood archive <id>");
            process.exit(1);
        }
        await ctx.bloodEngine.archive(id, "archived via CLI");
        await ctx.governanceEngine.logAudit({
            time: new Date().toISOString(),
            action: "archived",
            target: id,
            actor: "human",
        });
        console.log(`Archived: ${id}`);
        return;
    }

    if (sub === "resurrect") {
        if (!id) {
            console.log("Usage: cairn blood resurrect <id>");
            process.exit(1);
        }
        await ctx.bloodEngine.resurrect(id);
        await ctx.governanceEngine.logAudit({
            time: new Date().toISOString(),
            action: "resurrected",
            target: id,
            actor: "human",
        });
        console.log(`Resurrected: ${id}`);
        return;
    }

    if (sub === "trauma") {
        if (!id) {
            console.log("Usage: cairn blood trauma <id>");
            process.exit(1);
        }
        await ctx.bloodEngine.markTrauma(id);
        await ctx.governanceEngine.logAudit({
            time: new Date().toISOString(),
            action: "trauma_marked",
            target: id,
            actor: "human",
        });
        console.log(`Marked as trauma: ${id}`);
        return;
    }

    console.log("Usage: cairn blood <show|archive|resurrect|trauma> <id>");
    process.exit(1);
}
