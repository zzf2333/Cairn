#!/usr/bin/env node

import { runInit } from "./cli/init.js";
import { runStatus } from "./cli/status.js";
import { runReview } from "./cli/review.js";
import { runDoctor } from "./cli/doctor.js";
import { runStage } from "./cli/stage.js";
import { runMemory } from "./cli/memory.js";

const VERSION = "0.2.1";

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case "init":
        await runInit(args.slice(1));
        break;
    case "status":
        await runStatus();
        break;
    case "review":
        await runReview();
        break;
    case "doctor":
        await runDoctor(args.slice(1));
        break;
    case "stage":
        await runStage(args.slice(1));
        break;
    case "memory":
        await runMemory(args.slice(1));
        break;
    case "version":
    case "--version":
    case "-v":
        console.log(`cairn ${VERSION}`);
        break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
        console.log(`cairn ${VERSION} — AI-maintained project memory engine

Commands:
  init              Initialize .cairn/ in current project
  status            Show system status
  review            Review staged memory entries
  doctor            Run health diagnostics
  stage confirm     Confirm stage advisory
  memory show <id>  Show a memory entry
  memory archive <id>  Archive a memory entry
  version           Show version
  help              Show this help`);
        break;
    default:
        console.error(`Unknown command: ${command}\nRun 'cairn help' for usage.`);
        process.exit(1);
}
