#!/usr/bin/env node
import { runCairnRaw } from "./_lib.js";

const args = ["context"];
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--task" && process.argv[i + 1]) {
        args.push("--task", process.argv[++i]);
    } else if (process.argv[i] === "--files" && process.argv[i + 1]) {
        args.push("--files", process.argv[++i]);
    }
}

runCairnRaw(args);
