import { readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { VERSION } from "../constants.js";
import {
    assembleProtocol,
    parseInstalledVersion,
    hasProtocolBlock,
    replaceProtocolBlock,
    appendProtocolBlock,
    getTargetFileName,
} from "../skill-assembler.js";
import { listPlatforms } from "../skill-paths.js";

const USAGE = `Usage: cairn skill <subcommand> [options]

Subcommands:
  install [platform]    Install Cairn protocol into project instructions
  status                Check installed protocol version
  update                Update installed protocol to current version
  show [platform]       Print assembled protocol to stdout

Platforms: claude-code (default), codex, cursor

Options:
  --target <path>       Override target file path
  --mode <mode>         Set cognitive mode (strict, balanced, lightweight). Default: balanced
`;

export async function runSkill(args: string[]): Promise<void> {
    const sub = args[0];

    if (!sub || sub === "--help" || sub === "-h") {
        console.log(USAGE);
        return;
    }

    switch (sub) {
        case "install":
            await runInstall(args.slice(1));
            break;
        case "status":
            await runStatus(args.slice(1));
            break;
        case "update":
            await runUpdate(args.slice(1));
            break;
        case "show":
            await runShow(args.slice(1));
            break;
        default:
            console.error(`Unknown subcommand: ${sub}`);
            console.log(USAGE);
            process.exit(1);
    }
}

function parseFlags(args: string[]): { platform: string; target?: string; mode: string } {
    let platform = "";
    let target: string | undefined;
    let mode = "balanced";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--target" && args[i + 1]) {
            target = args[++i];
        } else if (args[i] === "--mode" && args[i + 1]) {
            mode = args[++i];
        } else if (!args[i].startsWith("-") && !platform) {
            platform = args[i];
        }
    }

    if (!platform) {
        platform = detectPlatform();
    }

    return { platform, target, mode };
}

function detectPlatform(): string {
    const cwd = process.cwd();
    try {
        const checks: [string, string][] = [
            [join(cwd, ".claude"), "claude-code"],
            [join(cwd, ".codex"), "codex"],
            [join(cwd, ".cursor"), "cursor"],
        ];
        for (const [dir, name] of checks) {
            try {
                require("node:fs").accessSync(dir);
                return name;
            } catch { /* continue */ }
        }
    } catch { /* fallthrough */ }
    return "claude-code";
}

async function resolveTargetPath(platform: string, targetOverride?: string): Promise<string> {
    if (targetOverride) return join(process.cwd(), targetOverride);
    const fileName = await getTargetFileName(platform);
    return join(process.cwd(), fileName);
}

async function runInstall(args: string[]): Promise<void> {
    const { platform, target, mode } = parseFlags(args);
    const targetPath = await resolveTargetPath(platform, target);

    const assembled = await assembleProtocol({ platform, mode });

    let existing = "";
    try {
        existing = await readFile(targetPath, "utf8");
    } catch { /* file doesn't exist yet */ }

    let output: string;
    if (hasProtocolBlock(existing)) {
        output = replaceProtocolBlock(existing, assembled);
        console.log(`Updated existing Cairn protocol block in ${targetPath}`);
    } else {
        output = appendProtocolBlock(existing, assembled);
        console.log(`Installed Cairn protocol into ${targetPath}`);
    }

    await writeFile(targetPath, output, "utf8");
    console.log(`  Version: ${VERSION}`);
    console.log(`  Platform: ${platform}`);
    console.log(`  Mode: ${mode}`);
}

async function runStatus(args: string[]): Promise<void> {
    const { platform, target } = parseFlags(args);
    const targetPath = await resolveTargetPath(platform, target);

    let content: string;
    try {
        content = await readFile(targetPath, "utf8");
    } catch {
        console.log(`No protocol installed. Target file not found: ${targetPath}`);
        console.log(`Run: cairn skill install ${platform}`);
        return;
    }

    const installed = parseInstalledVersion(content);
    if (!installed) {
        console.log(`No Cairn protocol block found in ${targetPath}`);
        console.log(`Run: cairn skill install ${platform}`);
        return;
    }

    console.log(`Installed: v${installed}`);
    console.log(`Current:   v${VERSION}`);
    if (installed === VERSION) {
        console.log("Up to date.");
    } else {
        console.log(`Update available. Run: cairn skill update ${platform}`);
    }
}

async function runUpdate(args: string[]): Promise<void> {
    const { platform, target } = parseFlags(args);
    const targetPath = await resolveTargetPath(platform, target);

    let existing: string;
    try {
        existing = await readFile(targetPath, "utf8");
    } catch {
        console.log(`Target file not found: ${targetPath}`);
        console.log(`Use "cairn skill install" instead.`);
        return;
    }

    if (!hasProtocolBlock(existing)) {
        console.log(`No existing Cairn protocol block in ${targetPath}`);
        console.log(`Use "cairn skill install" instead.`);
        return;
    }

    await runInstall(args);
}

async function runShow(args: string[]): Promise<void> {
    const { platform, mode } = parseFlags(args);
    const assembled = await assembleProtocol({ platform, mode });
    console.log(assembled);
}
