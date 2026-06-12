/**
 * HMR runtime for SignalX terminal apps.
 *
 * The dev plugin injects `registerHMRModule(<id>)` at the top of every
 * transformed module that defines components, so each `component(...)` call
 * gets a stable identity of `<moduleId>:<definition index>`. When an edited
 * module re-executes, its definitions land on the same identities; for every
 * live instance of that identity the NEW setup re-runs against the EXISTING
 * context, the render function is swapped, and the instance re-renders in
 * place — the terminal never tears down.
 *
 * This is the terminal-side counterpart of `@sigx/vite/hmr`, which hooks the
 * `sigx` DOM facade (`sigx/internals`) and therefore can't be used here. Two
 * deliberate differences: it hooks `@sigx/runtime-core/internals` directly,
 * and it installs synchronously at module load — the async install in the DOM
 * runtime leaves a window where definitions evaluated before the dynamic
 * import resolves are never tracked.
 */
import { registerComponentPlugin } from '@sigx/runtime-core/internals';
import type { ComponentSetupContext, SetupFn } from '@sigx/runtime-core/internals';

interface InstanceEntry {
    ctx: ComponentSetupContext;
}

interface HmrState {
    /** Live instances per component identity (`moduleId:index`). */
    instancesByComponentId: Map<string, Set<InstanceEntry>>;
    /**
     * Every factory ever defined under an identity. Importers capture factory
     * references at import time and keep them across hot updates (a tab
     * catalog, a navigation parent), so on redefine each old factory must be
     * repointed at the new setup or remounts resurrect the old code.
     */
    factoriesByComponentId: Map<string, Set<{ __setup?: unknown }>>;
    /** Definition order within the module currently executing. */
    moduleComponentIndex: Map<string, number>;
    currentModuleId: string | null;
    installed: boolean;
}

// This module can be instantiated more than once in a dev session: it loads
// through the module runner, and an in-process restart clears the runner's
// cache. The component plugin hooks a node singleton (runtime-core), so the
// tracking state must be a process singleton too — a second instance with its
// own maps would register a second plugin and skew every identity index.
const STATE_KEY = Symbol.for('sigx.terminal-dev.hmr-state');
const state: HmrState = ((globalThis as any)[STATE_KEY] ??= {
    instancesByComponentId: new Map(),
    factoriesByComponentId: new Map(),
    moduleComponentIndex: new Map(),
    currentModuleId: null,
    installed: false,
} satisfies HmrState);
// An older runtime instance may have seeded the singleton without this map.
state.factoriesByComponentId ??= new Map();

/**
 * Mark `moduleId` as the module currently executing. Injected by the dev
 * plugin at the top of each transformed module (and on every hot
 * re-execution, which resets the definition counter so identities line up).
 */
export function registerHMRModule(moduleId: string): void {
    state.currentModuleId = moduleId;
    state.moduleComponentIndex.set(moduleId, 0);
}

/**
 * Close `moduleId`'s definition scope. Injected by the dev plugin at the
 * bottom of each transformed module, so a `component(...)` executed later
 * from a NON-instrumented module (an externalized package, a runtime
 * callback) can't be misattributed to the last instrumented module's
 * identity counter. Guarded: an inner instrumented import has already
 * shifted the current id, and must not be clobbered. (ESM evaluation order
 * makes the common case safe — imports evaluate before the importer's body —
 * so by the time this module's footer runs it IS the current one.)
 */
export function clearHMRModule(moduleId: string): void {
    if (state.currentModuleId === moduleId) state.currentModuleId = null;
}

function getNextComponentId(): string | null {
    if (!state.currentModuleId) return null;
    const index = state.moduleComponentIndex.get(state.currentModuleId) ?? 0;
    state.moduleComponentIndex.set(state.currentModuleId, index + 1);
    return `${state.currentModuleId}:${index}`;
}

/** Hook component definition. Runs once, synchronously, at module load. */
export function installHMRPlugin(): void {
    if (state.installed) return;
    state.installed = true;

    registerComponentPlugin({
        onDefine(name: string | undefined, factory: any, setup: Function) {
            const componentId = getNextComponentId();
            if (!componentId) return;

            factory.__hmrId = componentId;

            // Re-execution of an edited module: patch every live instance of
            // this identity with the new setup's render function.
            const existing = state.instancesByComponentId.get(componentId);
            if (existing && existing.size > 0) {
                existing.forEach((instance) => {
                    try {
                        const newRenderFn = (setup as SetupFn)(instance.ctx);
                        if (newRenderFn instanceof Promise) {
                            throw new Error('async setup is not hot-reloadable');
                        }
                        instance.ctx.renderFn = newRenderFn;
                        instance.ctx.update();
                    } catch (e) {
                        console.error(`[sigx-terminal-dev] HMR failed for ${name || componentId}:`, e);
                    }
                });
            }

            // Wrap setup so future mounts of this identity are tracked.
            const originalSetup = setup as SetupFn;
            const trackedSetup = (ctx: ComponentSetupContext) => {
                const renderFn = originalSetup(ctx);

                const instance: InstanceEntry = { ctx };
                let instances = state.instancesByComponentId.get(componentId);
                if (!instances) {
                    instances = new Set();
                    state.instancesByComponentId.set(componentId, instances);
                }
                instances.add(instance);
                ctx.onUnmounted(() => {
                    state.instancesByComponentId.get(componentId)?.delete(instance);
                });

                return renderFn;
            };
            factory.__setup = trackedSetup;

            // Repoint every PREVIOUS factory of this identity at the new
            // setup: importers that captured a factory before the edit (tab
            // catalogs, navigation parents) keep mounting through it —
            // runtime-core reads `__setup` at instantiation, so this makes
            // those stale references mount the new code instead of the old.
            let factories = state.factoriesByComponentId.get(componentId);
            if (!factories) {
                factories = new Set();
                state.factoriesByComponentId.set(componentId, factories);
            }
            for (const previous of factories) {
                previous.__setup = trackedSetup;
            }
            factories.add(factory);
        },
    });
}

installHMRPlugin();
