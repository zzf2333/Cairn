#!/usr/bin/env node
import { runCairnRaw } from "./_lib.js";

const args = ["plan"];
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--task" && process.argv[i + 1]) {
        args.push("--task", process.argv[++i]);
    }
}

runCairnRaw(args);
