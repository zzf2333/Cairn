#!/usr/bin/env node

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

function main() {
    console.log("");
    console.log(`${BOLD}${CYAN}cairn-rt${RESET} installed successfully.`);
    console.log("");
    console.log(`${BOLD}Next:${RESET} Install the Cairn protocol skill for your AI tool:`);
    console.log("");
    console.log(`  npx skills add zzf2333/Cairn           ${DIM}# Claude Code${RESET}`);
    console.log(`  cairn skill show codex >> AGENTS.md     ${DIM}# Codex${RESET}`);
    console.log(`  cairn skill show cursor >> .cursorrules  ${DIM}# Cursor${RESET}`);
    console.log("");
    console.log(`Then open your AI tool in a project and say: ${BOLD}Initialize Cairn for this project${RESET}`);
    console.log("");
}

main();
