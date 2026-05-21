#!/usr/bin/env node
import { runCairnRaw } from "./_lib.js";

const args = ["session-end"];
const flags = ["--summary", "--domains", "--decisions", "--unresolved"];

for (let i = 2; i < process.argv.length; i++) {
    if (flags.includes(process.argv[i]) && process.argv[i + 1]) {
        args.push(process.argv[i], process.argv[++i]);
    }
}

runCairnRaw(args);
