#!/usr/bin/env node

import { injectGlobalInstructions } from "./global-instructions.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";

async function main() {
    console.log("");
    console.log(`${BOLD}${CYAN}cairn-rt${RESET} installed successfully.`);

    try {
        const results = await injectGlobalInstructions();
        const acted = results.filter(r => r.action !== "skipped");
        if (acted.length > 0) {
            console.log("");
            for (const r of acted) {
                const verb = r.action === "injected" ? "injected" : "updated";
                console.log(`  ${GREEN}✓${RESET} ${r.target}: skill bootstrap ${verb} ${DIM}${r.path}${RESET}`);
            }
        }
    } catch {
        // postinstall 失败不阻塞安装
    }

    console.log("");
    console.log(`Then open your AI tool in a project and say: ${BOLD}Initialize Cairn for this project${RESET}`);
    console.log("");
}

main();
