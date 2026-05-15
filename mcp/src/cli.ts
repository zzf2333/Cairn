#!/usr/bin/env node

const VERSION = "0.2.4";

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case "setup": {
        const { runSetup } = await import("./cli/setup.js");
        await runSetup(args.slice(1));
        break;
    }
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

All operations are MCP tools called by your AI assistant:
  cairn_context      Get project constraints (session start)
  cairn_signal       Report decisions, rejections, constraints
  cairn_session_end  End session processing
  cairn_status       System status + stage management
  cairn_review       Review staged memory entries
  cairn_memory       Browse and manage memories
  cairn_plan         History-aware planning
  cairn_doctor       Health diagnostics

Commands:
  version            Show version`);
        break;
    default:
        console.error(`Unknown command: ${command}\nRun 'cairn help' for usage.`);
        process.exit(1);
}
