#!/usr/bin/env node

async function main() {
    try {
        const { runSetup } = await import("./cli/setup.js");
        await runSetup(["--quiet"]);
    } catch {
        // postinstall must never fail npm install
    }
}

main();
