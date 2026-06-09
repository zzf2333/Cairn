#!/usr/bin/env node
import { VERSION } from "../constants.js";
import { runInit, runUninstall } from "./init.js";
import { runStatus } from "./status.js";
import { runDoctor } from "./doctor.js";
import { runReview } from "./review.js";
import { runAudit } from "./audit.js";
import { runDna } from "./dna.js";
import { runSkeleton } from "./skeleton.js";
import { runBlood } from "./blood.js";
import { runStage } from "./stage.js";
import { runMigrate } from "./migrate.js";

import { runRuntimeContext } from "./runtime-context.js";
import { runRuntimePlan } from "./runtime-plan.js";
import { runRuntimeSignal } from "./runtime-signal.js";
import { runRuntimeObserve } from "./runtime-observe.js";
import { runRuntimeSessionEnd } from "./runtime-session-end.js";
import { runRuntimeSessionRecover } from "./runtime-session-recover.js";

const USAGE = `cairn v${VERSION}

Usage: cairn <command> [options]

Commands:
  init                          Initialize .cairn/ scaffold + inject global instructions
  init --empty                  Initialize .cairn/ scaffold (silent, for scripts)
  uninstall                     Remove Cairn global instructions from AI tools
  status                        Show project cognitive status (DNA mode, drift, stage transitions)
  doctor                        Run consistency checks + auto-resurrect low-gravity archived events
  doctor --fix                  Scan for corrupted yaml files + orphan refs; quarantine broken files
  doctor --recover              Clear an incomplete session_in_progress checkpoint
  doctor --metrics              Print .cairn/ health snapshot (blood/DNA/staged/last session)
  doctor --runtime-audit [--json] Report lifecycle telemetry consistency and coverage
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

Runtime commands (for AI / scripts):
  context [--task <t>] [--files <f1,f2>] [--json]
  plan --task <t> [--json]
  signal --type <t> --what <w> [--domain <d>] [--reason <r>] [--json]
  observe --summary <s> [--candidates-file <path>] [--json]
  session-end --summary <s> [--domains <d>] [--json]
  session-recover [--json]

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
                await runReview(args.slice(1));
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
            case "uninstall":
                await runUninstall();
                break;
            case "migrate":
                await runMigrate();
                break;
            case "context":
                await runRuntimeContext(args.slice(1));
                break;
            case "plan":
                await runRuntimePlan(args.slice(1));
                break;
            case "signal":
                await runRuntimeSignal(args.slice(1));
                break;
            case "observe":
                await runRuntimeObserve(args.slice(1));
                break;
            case "session-end":
                await runRuntimeSessionEnd(args.slice(1));
                break;
            case "session-recover":
                await runRuntimeSessionRecover(args.slice(1));
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
