import { bootstrapEmpty } from "../bootstrap.js";
import { injectGlobalInstructions, removeGlobalInstructions } from "../global-instructions.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";

export async function runInit(args: string[]): Promise<void> {
    const silent = args.includes("--empty");

    await bootstrapEmpty(process.cwd());

    const results = await injectGlobalInstructions();

    if (silent) {
        console.log("Cairn initialized (empty structure)");
        return;
    }

    console.log("Cairn initialized — .cairn/ scaffold created.");
    console.log("");

    const acted = results.filter(r => r.action !== "skipped");
    const skipped = results.filter(r => r.action === "skipped");

    if (acted.length > 0) {
        console.log("Global instructions:");
        for (const r of acted) {
            const verb = r.action === "injected" ? "写入" : "更新";
            console.log(`  ${GREEN}✓${RESET} ${r.target}: 协议已${verb} ${DIM}${r.path}${RESET}`);
        }
    }

    if (skipped.length > 0) {
        console.log("");
        for (const r of skipped) {
            console.log(`  - ${r.target}: skipped (not installed)`);
        }
    }

    console.log("");
    console.log("Then tell your AI tool: Initialize Cairn for this project");
}

export async function runUninstall(): Promise<void> {
    const results = await removeGlobalInstructions();

    const acted = results.filter(r => r.action !== "skipped");
    if (acted.length > 0) {
        for (const r of acted) {
            console.log(`${GREEN}✓${RESET} ${r.target}: 协议已移除 ${DIM}${r.path}${RESET}`);
        }
    } else {
        console.log("No global instructions found to remove.");
    }
}
