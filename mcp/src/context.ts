import type { CairnPaths } from "./paths.js";
import { MemoryStore } from "./stores/memory-store.js";
import { SignalStore } from "./stores/signal-store.js";
import { StagedStore } from "./stores/staged-store.js";
import { StateStore } from "./stores/state-store.js";
import { ViewsEngine } from "./engines/views-engine.js";
import { TrustRouter } from "./engines/trust-router.js";
import { GitEar } from "./engines/git-ear.js";
import { StageEngine } from "./engines/stage-engine.js";
import { MemoryEngine } from "./engines/memory-engine.js";
import type { BootstrapResult } from "./bootstrap.js";

export interface CairnContext {
    paths: CairnPaths;
    memoryStore: MemoryStore;
    signalStore: SignalStore;
    stagedStore: StagedStore;
    stateStore: StateStore;
    viewsEngine: ViewsEngine;
    trustRouter: TrustRouter;
    gitEar: GitEar;
    stageEngine: StageEngine;
    memoryEngine: MemoryEngine;
    bootstrapResult?: BootstrapResult;
}

export function createCairnContextFromPaths(paths: CairnPaths): CairnContext {
    const memoryStore = new MemoryStore(paths.memoryDir);
    const signalStore = new SignalStore(paths.signalsDir);
    const stagedStore = new StagedStore(paths.stagedDir);
    const stateStore = new StateStore(paths.stateYaml);
    const viewsEngine = new ViewsEngine(paths, memoryStore, stateStore);
    const memoryEngine = new MemoryEngine(memoryStore, viewsEngine);
    const trustRouter = new TrustRouter(
        memoryStore,
        signalStore,
        stagedStore,
        memoryEngine,
        stateStore,
    );
    const gitEar = new GitEar(paths.root);
    const stageEngine = new StageEngine();

    return {
        paths,
        memoryStore,
        signalStore,
        stagedStore,
        stateStore,
        viewsEngine,
        trustRouter,
        gitEar,
        stageEngine,
        memoryEngine,
    };
}
