export interface SemVer {
    major: number;
    minor: number;
    patch: number;
}

export function parseSemVer(v: string): SemVer | null {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    if (!match) return null;
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    };
}

export function compareSemVer(a: string, b: string): number {
    const pa = parseSemVer(a);
    const pb = parseSemVer(b);
    if (!pa || !pb) return 0;
    if (pa.major !== pb.major) return pa.major - pb.major;
    if (pa.minor !== pb.minor) return pa.minor - pb.minor;
    return pa.patch - pb.patch;
}

export type VersionMismatch =
    | { kind: "none" }
    | { kind: "missing"; runtime: string }
    | { kind: "older"; recorded: string; runtime: string }
    | { kind: "newer"; recorded: string; runtime: string };

export function checkVersionMismatch(
    recorded: string | undefined,
    runtime: string
): VersionMismatch {
    if (!recorded) return { kind: "missing", runtime };
    const cmp = compareSemVer(recorded, runtime);
    if (cmp === 0) return { kind: "none" };
    if (cmp < 0) return { kind: "older", recorded, runtime };
    return { kind: "newer", recorded, runtime };
}
