import type { EvolutionEvent } from "../schemas/index.js";
import type { BloodStore, DomainStore } from "../stores/index.js";
import { GRAVITY_ORDER, type GravityLevel } from "../constants.js";
import { CairnError, CairnErrorCode } from "../errors.js";
import type { ViewsEngine } from "./views-engine.js";

export class BloodEngine {
    constructor(
        private readonly bloodStore: BloodStore,
        private readonly domainStore: DomainStore,
        private readonly viewsEngine: ViewsEngine,
    ) {}

    async commit(event: EvolutionEvent): Promise<void> {
        await this.bloodStore.save(event);

        const domain = event.domain;

        if (event.behavior_effect.type === "avoid_suggestion") {
            const rejected = await this.domainStore.loadRejectedPaths(domain);
            const pathsToAdd = event.rejected_paths.length > 0
                ? event.rejected_paths.map(rp => ({ path: rp.path, reason: rp.reason }))
                : [{ path: event.subject.name, reason: event.behavior_effect.instruction }];
            for (const rp of pathsToAdd) {
                const exists = rejected.paths.some(p => p.path === rp.path && p.source_event === event.id);
                if (!exists) {
                    rejected.paths.push({
                        path: rp.path,
                        reason: rp.reason,
                        source_event: event.id,
                    });
                }
            }
            await this.domainStore.saveRejectedPaths(rejected);
        }

        if (event.constraints_added.length > 0) {
            const constraints = await this.domainStore.loadConstraints(domain);
            for (const c of event.constraints_added) {
                const exists = constraints.constraints.some(
                    x => x.what === c && x.source_event === event.id,
                );
                if (!exists) {
                    constraints.constraints.push({
                        what: c,
                        reason: event.reasoning,
                        source_event: event.id,
                        gravity: event.gravity.level,
                    });
                }
            }
            await this.domainStore.saveConstraints(constraints);
        }

        if (event.accepted_debt.length > 0) {
            const debt = await this.domainStore.loadAcceptedDebt(domain);
            for (const d of event.accepted_debt) {
                const exists = debt.debts.some(
                    x => x.what === d && x.source_event === event.id,
                );
                if (!exists) {
                    debt.debts.push({
                        what: d,
                        reason: event.reasoning,
                        source_event: event.id,
                        revisit_when: event.revisit?.when ?? [],
                    });
                }
            }
            await this.domainStore.saveAcceptedDebt(debt);
        }

        await this.viewsEngine.regenerate();
    }

    async markStale(eventId: string, reason: string): Promise<void> {
        const event = await this.bloodStore.load(eventId);
        if (!event) {
            throw new CairnError(CairnErrorCode.EVENT_NOT_FOUND, `Event ${eventId} not found`);
        }

        event.health.state = "stale";
        event.health.reason = reason;
        event.updated_at = new Date().toISOString();

        await this.bloodStore.save(event);
        await this.viewsEngine.regenerate();
    }

    async archive(eventId: string, reason: string): Promise<void> {
        const event = await this.bloodStore.load(eventId);
        if (!event) {
            throw new CairnError(CairnErrorCode.EVENT_NOT_FOUND, `Event ${eventId} not found`);
        }

        event.health.state = "archived";
        event.health.reason = reason;
        event.updated_at = new Date().toISOString();

        await this.bloodStore.save(event);
        await this.viewsEngine.regenerate();
    }

    async resurrect(eventId: string): Promise<void> {
        const event = await this.bloodStore.load(eventId);
        if (!event) {
            throw new CairnError(CairnErrorCode.EVENT_NOT_FOUND, `Event ${eventId} not found`);
        }

        event.health.state = "resurrected";
        event.lifecycle.resurrection_count++;
        event.updated_at = new Date().toISOString();

        await this.bloodStore.save(event);
        await this.viewsEngine.regenerate();
    }

    async mergeRefs(eventId: string, newRefs: Array<{ type: string; id: string }>): Promise<void> {
        const event = await this.bloodStore.load(eventId);
        if (!event) {
            throw new CairnError(CairnErrorCode.EVENT_NOT_FOUND, `Event ${eventId} not found`);
        }
        for (const ref of newRefs) {
            const exists = event.source.refs.some(r => r.type === ref.type && r.id === ref.id);
            if (!exists) {
                event.source.refs.push(ref);
            }
        }
        event.updated_at = new Date().toISOString();
        await this.bloodStore.save(event);
    }

    async markTrauma(eventId: string): Promise<EvolutionEvent> {
        const event = await this.bloodStore.load(eventId);
        if (!event) {
            throw new CairnError(CairnErrorCode.EVENT_NOT_FOUND, `Event ${eventId} not found`);
        }

        event.trauma.is_trauma = true;
        event.trauma.decay_override = "permanent";
        event.trauma.sensitivity_multiplier = 2.0;
        event.trauma.requires_human_ratification = true;

        if (GRAVITY_ORDER[event.gravity.level as GravityLevel] < GRAVITY_ORDER["G2"]) {
            event.gravity.level = "G2";
        }

        event.lifecycle.decay_policy = "permanent";
        event.updated_at = new Date().toISOString();

        await this.bloodStore.save(event);
        await this.viewsEngine.regenerate();

        return event;
    }

    async downgradeTrauma(eventId: string, reason: string): Promise<EvolutionEvent> {
        const event = await this.bloodStore.load(eventId);
        if (!event) {
            throw new CairnError(CairnErrorCode.EVENT_NOT_FOUND, `Event ${eventId} not found`);
        }
        if (!event.trauma.is_trauma) {
            throw new CairnError(CairnErrorCode.INVALID_INPUT, `Event ${eventId} is not a trauma event`);
        }

        event.trauma.is_trauma = false;
        event.trauma.decay_override = null;
        event.trauma.sensitivity_multiplier = 1.0;
        event.lifecycle.decay_policy = "downgrade";
        event.health.reason = `Trauma downgraded: ${reason}`;
        event.updated_at = new Date().toISOString();

        await this.bloodStore.save(event);
        await this.viewsEngine.regenerate();

        return event;
    }
}
