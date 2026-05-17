import { resolve, join } from "node:path";

export interface CairnPaths {
    root: string;
    cairn: string;
    config: string;
    state: string;
    skeleton: string;
    domains: string;
    blood: string;
    dna: string;
    dnaIdentity: string;
    dnaImprint: string;
    dnaStaged: string;
    staged: string;
    signals: string;
    signalsGit: string;
    signalsCalibration: string;
    signalsConversation: string;
    governance: string;
    governancePolicy: string;
    governanceAudit: string;
    views: string;
    viewsOutput: string;
    viewsStage: string;
    viewsDomains: string;
    sessions: string;
    logs: string;
}

export function buildPaths(projectRoot: string): CairnPaths {
    const root = resolve(projectRoot);
    const cairn = join(root, ".cairn");
    const signals = join(cairn, "signals");
    const governance = join(cairn, "governance");
    const dna = join(cairn, "dna");
    const views = join(cairn, "views");

    return {
        root,
        cairn,
        config: join(cairn, "config.yaml"),
        state: join(cairn, "state.yaml"),
        skeleton: join(cairn, "skeleton"),
        domains: join(cairn, "domains"),
        blood: join(cairn, "blood"),
        dna,
        dnaIdentity: join(dna, "identity.yaml"),
        dnaImprint: join(dna, "imprint.yaml"),
        dnaStaged: join(dna, "staged"),
        staged: join(cairn, "staged"),
        signals,
        signalsGit: join(signals, "raw_git"),
        signalsCalibration: join(signals, "raw_calibration"),
        signalsConversation: join(signals, "raw_conversation"),
        governance,
        governancePolicy: join(governance, "policy.yaml"),
        governanceAudit: join(governance, "audit.yaml"),
        views,
        viewsOutput: join(views, "output.md"),
        viewsStage: join(views, "stage.md"),
        viewsDomains: join(views, "domains"),
        sessions: join(cairn, "sessions"),
        logs: join(cairn, "logs"),
    };
}

export const ALL_DIRS = (p: CairnPaths): string[] => [
    p.cairn,
    p.skeleton,
    p.domains,
    p.blood,
    p.dna,
    p.dnaStaged,
    p.staged,
    p.signals,
    p.signalsGit,
    p.signalsCalibration,
    p.signalsConversation,
    p.governance,
    p.views,
    p.viewsDomains,
    p.sessions,
];
