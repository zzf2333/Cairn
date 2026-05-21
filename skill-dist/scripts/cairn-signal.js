#!/usr/bin/env node
import { runCairnRaw } from "./_lib.js";

const args = ["signal"];
const flags = ["--type", "--what", "--domain", "--reason", "--user-said"];

for (let i = 2; i < process.argv.length; i++) {
    if (flags.includes(process.argv[i]) && process.argv[i + 1]) {
        args.push(process.argv[i], process.argv[++i]);
    }
}

runCairnRaw(args);
