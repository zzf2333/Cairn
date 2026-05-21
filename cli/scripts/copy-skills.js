#!/usr/bin/env node
import { cpSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, "..", "..", "skills");
const dest = resolve(__dirname, "..", "skills");

if (!existsSync(src)) {
    console.log("skills/ source not found at repo root — skipping copy");
    process.exit(0);
}

if (existsSync(dest)) {
    rmSync(dest, { recursive: true });
}

cpSync(src, dest, { recursive: true });
console.log("skills/ copied into cli/skills/ for packaging");
