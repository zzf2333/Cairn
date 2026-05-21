#!/usr/bin/env node
import { runCairnRaw } from "./_lib.js";

const args = ["observe"];
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--summary" && process.argv[i + 1]) {
        args.push("--summary", process.argv[++i]);
    } else if (process.argv[i] === "--candidates-file" && process.argv[i + 1]) {
        args.push("--candidates-file", process.argv[++i]);
    }
}

runCairnRaw(args);
