#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT = join(ROOT, "SKILL.md");

const FRONTMATTER = `---
name: cairn
description: >-
  Cairn Cognitive Runtime Protocol. Activates for all technical sessions
  when cairn MCP server is connected. Governs: context loading, plan
  validation, signal capture, observation before commits, session closure.
---

`;

const order = JSON.parse(readFileSync(join(SKILLS_DIR, "_assembly-order.json"), "utf8"));

const parts = [FRONTMATTER, "# Cairn Cognitive Runtime Protocol\n\n"];

for (const relPath of order.protocol) {
    const content = readFileSync(join(SKILLS_DIR, relPath), "utf8").trim();
    parts.push(content, "\n\n---\n\n");
}

const adapter = readFileSync(join(SKILLS_DIR, order.platforms["claude-code"].adapter), "utf8").trim();
parts.push(adapter, "\n");

const assembled = parts.join("");

if (process.argv.includes("--check")) {
    let existing = "";
    try { existing = readFileSync(OUTPUT, "utf8"); } catch {}
    if (existing === assembled) {
        console.log("SKILL.md is up to date.");
        process.exit(0);
    } else {
        console.error("SKILL.md is out of date. Run: node scripts/assemble-skill.js");
        process.exit(1);
    }
}

writeFileSync(OUTPUT, assembled, "utf8");
console.log("Generated SKILL.md");
