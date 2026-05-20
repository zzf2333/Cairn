import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";
import { readFile } from "node:fs/promises";
import { buildPaths, ALL_DIRS, type CairnPaths } from "../../../src/paths.js";
import {
    makeEvolutionEvent,
    makeSkeletonNode,
    makeDNA,
    makeConfig,
    makeState,
    makeStagedEntry,
} from "../../test-helpers.js";
import type { FixtureSpec } from "./types.js";

const NOW = "2026-05-15T10:00:00Z";

async function ensureDirs(paths: CairnPaths): Promise<void> {
    for (const dir of ALL_DIRS(paths)) {
        await mkdir(dir, { recursive: true });
    }
}

async function writeYaml(path: string, obj: unknown): Promise<void> {
    await writeFile(path, yamlStringify(obj), "utf8");
}

/**
 * Inflate `_scale_marker: N` into N synthetic blood events spread across the listed domains.
 * Lets us write a scale fixture without committing 1000 YAML files to the repo.
 */
function applyScaleMarker(spec: FixtureSpec & { _scale_marker?: number }): FixtureSpec {
    const n = (spec as { _scale_marker?: number })._scale_marker;
    if (!n || typeof n !== "number" || n <= 0) return spec;
    const domains = spec.config?.domains ?? ["api"];
    const synthetic: Array<Record<string, unknown>> = [];
    for (let i = 0; i < n; i++) {
        synthetic.push({
            id: `blood_scale_${i.toString().padStart(4, "0")}`,
            time: "2025-06-01",
            domain: domains[i % domains.length],
            type: "architecture_decision",
            gravity: { level: i % 4 === 0 ? "G2" : "G1" },
            source: { type: "human_explicit", confidence: 0.7, verified: false, refs: [{ type: "commit", id: `commit_${i}` }] },
            subject: { name: `synthetic decision ${i}`, aliases: [] },
            trigger: `auto-seeded scale fixture #${i}`,
            decision_or_change: `decision #${i}`,
            reasoning: "scale fixture",
            behavior_effect: { type: "prefer_approach", instruction: "n/a" },
            affects: { skeleton: false, dna: false, domains: [domains[i % domains.length]] },
            lifecycle: { validity: "tactical", decay_policy: "downgrade", resurrection_count: 0 },
            governance_status: "auto_confirmed",
        });
    }
    return { ...spec, blood: [...(spec.blood ?? []), ...synthetic] };
}

/**
 * Materialize a FixtureSpec into a real .cairn/ directory at `projectRoot`.
 * Uses the project's own factory functions to guarantee schema-conforming output.
 */
export async function buildFixture(projectRoot: string, specIn: FixtureSpec): Promise<void> {
    const spec = applyScaleMarker(specIn);
    const paths = buildPaths(projectRoot);
    await ensureDirs(paths);

    // config.yaml
    const config = makeConfig({
        project: { name: spec.config?.project_name ?? "scenario-project", created: "2026-01" },
        domains: spec.config?.domains ?? [],
        cognitive_mode: spec.config?.cognitive_mode ?? "standard",
        tech_stack: ((spec.config?.tech_stack as unknown) ?? []) as never,
    });
    await writeYaml(paths.config, config);

    // state.yaml
    const stageOverrides = spec.state?.stage
        ? {
              stage: {
                  phase: spec.state.stage.phase,
                  confidence: spec.state.stage.confidence,
                  status: spec.state.stage.status ?? "advisory",
                  evidence: [],
                  guidance: [],
                  ...(spec.state.stage.last_updated
                      ? { last_updated: spec.state.stage.last_updated }
                      : {}),
              },
          }
        : {};
    const activationLogOverrides = spec.state?.activation_log
        ? { activation_log: { recent_hits: spec.state.activation_log.recent_hits ?? {} } }
        : {};
    const state = makeState({
        initialization_status: "complete",
        ...stageOverrides,
        ...activationLogOverrides,
    } as never);
    if (spec.state?.active_session) {
        const as = spec.state.active_session;
        (state as any).active_session = {
            id: as.id,
            started_at: as.started_at,
            last_touched_at: as.last_touched_at,
            task: as.task ?? null,
            files: null,
            context_loaded: as.context_loaded ?? true,
            plan_called: false,
            observe_called: false,
            signals_count: as.signals_count ?? 0,
            degraded_signals_count: as.degraded_signals_count ?? 0,
            observed_candidates_count: 0,
            captured_candidates_count: 0,
            recovered: false,
        };
    }
    await writeYaml(paths.state, state);

    // skeleton/*.yaml
    if (spec.skeleton) {
        for (const node of spec.skeleton) {
            const full = makeSkeletonNode(node.domain, {
                role: node.role,
                owns: node.owns,
                does_not_own: node.does_not_own ?? [],
                causal_keywords: node.causal_keywords ?? [node.domain],
                dependencies: node.dependencies ?? [],
            });
            await writeYaml(join(paths.skeleton, `${node.domain}.yaml`), full);
        }
    }

    // blood/*.yaml — each entry merged onto a baseline EvolutionEvent
    if (spec.blood) {
        for (let i = 0; i < spec.blood.length; i++) {
            const raw = spec.blood[i] as Record<string, unknown>;
            const id = (raw.id as string) ?? `blood_${i + 1}`;
            const event = makeEvolutionEvent(id, raw as never);
            await writeYaml(join(paths.blood, `${id}.yaml`), event);
        }
    }

    // staged/*.yaml — ensure embedded draft_event is a fully-formed EvolutionEvent
    if (spec.staged) {
        for (let i = 0; i < spec.staged.length; i++) {
            const raw = { ...(spec.staged[i] as Record<string, unknown>) };
            const id = (raw.id as string) ?? `staged_${i + 1}`;
            if (raw.draft_event && typeof raw.draft_event === "object") {
                const draftRaw = raw.draft_event as Record<string, unknown>;
                const draftId = (draftRaw.id as string) ?? `draft_${id}`;
                raw.draft_event = makeEvolutionEvent(draftId, draftRaw as never);
            }
            const entry = makeStagedEntry(id, raw as never);
            await writeYaml(join(paths.staged, `${id}.yaml`), entry);
        }
    }

    // domains/<name>/*.yaml
    if (spec.domains) {
        for (const [name, dom] of Object.entries(spec.domains)) {
            const domDir = join(paths.domains, name);
            await mkdir(domDir, { recursive: true });
            if (dom.constraints) {
                await writeYaml(join(domDir, "constraints.yaml"), {
                    domain: name,
                    no_go: dom.constraints.no_go ?? [],
                    stack: [],
                    style: [],
                    updated_at: NOW,
                });
            }
            if (dom.accepted_debt) {
                await writeYaml(join(domDir, "accepted_debt.yaml"), {
                    domain: name,
                    debts: dom.accepted_debt.map((d) => {
                        const r = d as Record<string, unknown>;
                        return {
                            what: r.what,
                            reason: r.reason,
                            source_event: r.source_event ?? "",
                            revisit_when: r.revisit_when ?? [],
                        };
                    }),
                });
            }
            if (dom.rejected_paths) {
                await writeYaml(join(domDir, "rejected_paths.yaml"), {
                    domain: name,
                    paths: dom.rejected_paths.map((p) => {
                        const r = p as Record<string, unknown>;
                        return {
                            path: r.path,
                            reason: r.reason,
                            source_event: r.source_event ?? "",
                        };
                    }),
                });
            }
        }
    }

    // dna/identity.yaml + staged/
    if (spec.dna?.identity) {
        const identity = makeDNA(spec.dna.identity as never);
        await writeYaml(paths.dnaIdentity, identity);
    } else {
        await writeYaml(paths.dnaIdentity, makeDNA());
    }
    if (spec.dna?.imprint) {
        await writeYaml(paths.dnaImprint, spec.dna.imprint);
    }
    if (spec.dna?.staged) {
        for (let i = 0; i < spec.dna.staged.length; i++) {
            const raw = spec.dna.staged[i] as Record<string, unknown>;
            const id = (raw.id as string) ?? `dna_staged_${i + 1}`;
            await writeYaml(join(paths.dnaStaged, `${id}.yaml`), { id, ...raw });
        }
    }

    // governance/*.yaml — write minimal placeholders so tools don't crash.
    // policy is an object; audit log is an array of AuditEntry.
    await writeYaml(paths.governancePolicy, {
        cognitive_mode: spec.config?.cognitive_mode ?? "standard",
        ...(spec.governance?.policy ?? {}),
    });
    await writeYaml(paths.governanceAudit, spec.governance?.audit ?? []);

    // sessions/*.yaml
    if (spec.sessions) {
        for (let i = 0; i < spec.sessions.length; i++) {
            const s = spec.sessions[i] as Record<string, unknown>;
            const id = (s.id as string) ?? `session_${i + 1}`;
            await writeYaml(join(paths.sessions, `${id}.yaml`), s);
        }
    }
}

export async function loadFixtureSpec(path: string): Promise<FixtureSpec> {
    const raw = await readFile(path, "utf8");
    return yamlParse(raw) as FixtureSpec;
}
