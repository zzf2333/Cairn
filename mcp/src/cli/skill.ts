import { assembleProtocol } from "../skill-assembler.js";

const USAGE = `Usage: cairn skill <subcommand> [options]

Subcommands:
  show [platform]       Print assembled protocol to stdout

Platforms: claude-code (default), codex, cursor

Options:
  --mode <mode>         Set cognitive mode (strict, balanced, lightweight). Default: balanced

Install as Claude Code skill:
  npx skills add zzf2333/Cairn
`;

export async function runSkill(args: string[]): Promise<void> {
    const sub = args[0];

    if (!sub || sub === "--help" || sub === "-h") {
        console.log(USAGE);
        return;
    }

    switch (sub) {
        case "show":
            await runShow(args.slice(1));
            break;
        case "install":
        case "status":
        case "update":
            console.log(`"cairn skill ${sub}" has been removed.`);
            console.log("");
            console.log("Install as Claude Code skill:");
            console.log("  npx skills add zzf2333/Cairn");
            console.log("");
            console.log("For Codex/Cursor, manually append:");
            console.log("  cairn skill show codex >> AGENTS.md");
            console.log("  cairn skill show cursor >> .cursorrules");
            process.exit(1);
            break;
        default:
            console.error(`Unknown subcommand: ${sub}`);
            console.log(USAGE);
            process.exit(1);
    }
}

function parseFlags(args: string[]): { platform: string; mode: string } {
    let platform = "";
    let mode = "balanced";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--mode" && args[i + 1]) {
            mode = args[++i];
        } else if (!args[i].startsWith("-") && !platform) {
            platform = args[i];
        }
    }

    return { platform: platform || "claude-code", mode };
}

async function runShow(args: string[]): Promise<void> {
    const { platform, mode } = parseFlags(args);
    const assembled = await assembleProtocol({ platform, mode });
    console.log(assembled);
}
