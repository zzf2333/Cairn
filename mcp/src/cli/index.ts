#!/usr/bin/env node
import { VERSION } from "../constants.js";
import { runInit } from "./init.js";
import { runStatus } from "./status.js";
import { runDoctor } from "./doctor.js";
import { runReview } from "./review.js";
import { runAudit } from "./audit.js";
import { runDna } from "./dna.js";
import { runSkeleton } from "./skeleton.js";
import { runBlood } from "./blood.js";
import { runStage } from "./stage.js";
import { runMigrate } from "./migrate.js";
import { runSkill } from "./skill.js";

const USAGE = `cairn v${VERSION}

Usage: cairn <command> [options]

Commands:
  init                          Initialize .cairn/ scaffold and print setup guide
  init --empty                  Initialize .cairn/ scaffold (silent, for scripts)
  status                        Show project cognitive status (DNA mode, drift, stage transitions)
  doctor                        Run consistency checks + auto-resurrect low-gravity archived events
  doctor --fix                  Scan for corrupted yaml files + orphan refs; quarantine broken files
  doctor --recover              Clear an incomplete session_in_progress checkpoint
  doctor --metrics              Print .cairn/ health snapshot (blood/DNA/staged/last session)
  review                        List pending staged entries
  audit                         Show governance audit log
  dna show                      List current DNA traits
  dna reevaluate                Toggle reevaluation_mode
  dna list                      List pending DNA trait candidates
  dna accept <id>               Confirm a DNA trait candidate
  dna reject <id> <reason>      Reject a DNA trait candidate
  skeleton                      Show skeleton nodes
  blood                         Show/manage blood events
  stage confirm                 Confirm current stage advisory
  stage list                    List pending stage_transition entries
  stage accept <id>             Accept a stage transition (applies new phase)
  stage reject <id> <reason>    Reject a stage transition
  migrate                       Stamp .cairn/state.yaml with current cairn_version, apply pending migrations
  skill install [platform]      Install Cairn protocol into CLAUDE.md / AGENTS.md / .cursorrules
  skill status                  Check installed protocol version
  skill update                  Update installed protocol to current version
  skill show [platform]         Print assembled protocol to stdout

Options:
  --version                     Show version
`;

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === "--help" || command === "-h") {
        console.log(USAGE);
        return;
    }

    if (command === "--version" || command === "-v") {
        console.log(VERSION);
        return;
    }

    try {
        switch (command) {
            case "init":
                await runInit(args.slice(1));
                break;
            case "status":
                await runStatus();
                break;
            case "doctor":
                await runDoctor(args.slice(1));
                break;
            case "review":
                await runReview();
                break;
            case "audit":
                await runAudit();
                break;
            case "dna":
                await runDna(args.slice(1));
                break;
            case "skeleton":
                await runSkeleton(args.slice(1));
                break;
            case "blood":
                await runBlood(args.slice(1));
                break;
            case "stage":
                await runStage(args.slice(1));
                break;
            case "migrate":
                await runMigrate();
                break;
            case "skill":
                await runSkill(args.slice(1));
                break;
            default:
                console.error(`Unknown command: ${command}`);
                console.log(USAGE);
                process.exit(1);
        }
    } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

main();
