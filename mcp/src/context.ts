import { buildPaths, ALL_DIRS, type CairnPaths } from "./paths.js";
import { mkdir } from "node:fs/promises";
import {
    BloodStore, SkeletonStore, DnaStore, DomainStore,
    SignalStore, StagedStore, DnaStagedStore, StateStore, ConfigStore,
    GovernanceStore, SessionStore,
} from "./stores/index.js";
import { ToolLogger } from "./observability/logger.js";
import {
    ActivationEngine, ChallengeEngine, StageEngine,
    DecayEngine, CompressionEngine, ResurrectionEngine,
    ConsistencyEngine, BloodEngine, ViewsEngine,
    GovernanceEngine, TrustRouter, GitEar, CalibrationEar,
    RecoveryEngine,
} from "./engines/index.js";

export interface CairnContext {
    paths: CairnPaths;
    bloodStore: BloodStore;
    skeletonStore: SkeletonStore;
    dnaStore: DnaStore;
    domainStore: DomainStore;
    signalStore: SignalStore;
    stagedStore: StagedStore;
    dnaStagedStore: DnaStagedStore;
    stateStore: StateStore;
    configStore: ConfigStore;
    governanceStore: GovernanceStore;
    sessionStore: SessionStore;
    activationEngine: ActivationEngine;
    challengeEngine: ChallengeEngine;
    stageEngine: StageEngine;
    decayEngine: DecayEngine;
    compressionEngine: CompressionEngine;
    resurrectionEngine: ResurrectionEngine;
    consistencyEngine: ConsistencyEngine;
    bloodEngine: BloodEngine;
    viewsEngine: ViewsEngine;
    governanceEngine: GovernanceEngine;
    trustRouter: TrustRouter;
    gitEar: GitEar;
    calibrationEar: CalibrationEar;
    recoveryEngine: RecoveryEngine;
    logger: ToolLogger;
    hostName?: string;
}

export async function createContext(projectRoot: string): Promise<CairnContext> {
    const paths = buildPaths(projectRoot);

    const bloodStore = new BloodStore(paths.blood);
    const skeletonStore = new SkeletonStore(paths.skeleton);
    const dnaStore = new DnaStore(paths.dnaIdentity, paths.dnaImprint);
    const domainStore = new DomainStore(paths.domains);
    const signalStore = new SignalStore(paths.signalsGit, paths.signalsCalibration, paths.signalsConversation);
    const stagedStore = new StagedStore(paths.staged);
    const dnaStagedStore = new DnaStagedStore(paths.dnaStaged);
    const stateStore = new StateStore(paths.state);
    const configStore = new ConfigStore(paths.config);
    const governanceStore = new GovernanceStore(paths.governancePolicy, paths.governanceAudit);
    const sessionStore = new SessionStore(paths.sessions);

    const challengeEngine = new ChallengeEngine(bloodStore, skeletonStore, dnaStore);
    const activationEngine = new ActivationEngine(bloodStore, skeletonStore, dnaStore, domainStore, stateStore, challengeEngine);
    const stageEngine = new StageEngine();
    const decayEngine = new DecayEngine(bloodStore);
    const compressionEngine = new CompressionEngine(bloodStore);
    const resurrectionEngine = new ResurrectionEngine(bloodStore, stateStore);
    const consistencyEngine = new ConsistencyEngine(bloodStore, skeletonStore, dnaStore, stateStore);
    const governanceEngine = new GovernanceEngine(governanceStore, configStore);
    const trustRouter = new TrustRouter(bloodStore, dnaStore, governanceEngine);
    const viewsEngine = new ViewsEngine(
        bloodStore, skeletonStore, domainStore, dnaStore, stateStore,
        paths.viewsOutput, paths.viewsStage, paths.viewsDomains,
        dnaStagedStore,
    );
    const bloodEngine = new BloodEngine(bloodStore, domainStore, viewsEngine);
    const gitEar = new GitEar(paths.root, skeletonStore);
    const calibrationEar = new CalibrationEar(paths.root, bloodStore, skeletonStore, domainStore, dnaStore);
    const recoveryEngine = new RecoveryEngine(paths, bloodStore, skeletonStore, stateStore);

    const cfg = await configStore.load();
    const loggerConfig = cfg?.logging ?? { enabled: true, retention_days: 30 };
    const logger = new ToolLogger(paths.logs, loggerConfig);

    return {
        paths,
        bloodStore, skeletonStore, dnaStore, domainStore,
        signalStore, stagedStore, dnaStagedStore, stateStore, configStore,
        governanceStore, sessionStore,
        activationEngine, challengeEngine, stageEngine,
        decayEngine, compressionEngine, resurrectionEngine,
        consistencyEngine, bloodEngine, viewsEngine,
        governanceEngine, trustRouter, gitEar, calibrationEar,
        recoveryEngine, logger,
    };
}

export async function ensureCairnDirs(paths: CairnPaths): Promise<void> {
    for (const dir of ALL_DIRS(paths)) {
        await mkdir(dir, { recursive: true });
    }
}
