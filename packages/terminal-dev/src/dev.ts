/**
 * The dev runner: an in-process Vite dev server + module runner that executes
 * a SignalX terminal app with HMR.
 *
 * Component-module edits re-execute just that module; the HMR runtime patches
 * live instances in place and the renderer repaints — the TUI never restarts.
 * Edits that can't be hot-applied (the mount module, or a module nothing
 * accepts) surface as a full-reload payload, which is intercepted and turned
 * into a clean in-process restart: tear the terminal down, drop the module
 * cache, re-import the entry.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
    createServer,
    createServerModuleRunner,
    type ViteDevServer,
} from 'vite';
import type { ModuleRunner } from 'vite/module-runner';
import { terminalDevPlugin, type TerminalDevPluginOptions } from './plugin.js';

export interface DevOptions {
    /** App entry module (the file that mounts), relative to `root`. */
    entry: string;
    /** Project root for the dev server. @default process.cwd() */
    root?: string;
    /**
     * Vite config file to load on top of the built-in setup.
     * @default false (no config file — deterministic dev setup)
     */
    configFile?: string | false;
    /** Options forwarded to the terminal dev plugin. */
    plugin?: TerminalDevPluginOptions;
    /** Called after every successful (re)start of the entry. */
    onRestart?: () => void;
    /** Called when (re)starting the entry fails. */
    onError?: (err: unknown) => void;
}

export interface DevHandle {
    server: ViteDevServer;
    runner: ModuleRunner;
    /** Tear down the running app and re-import the entry. */
    restart: () => Promise<void>;
    /** Stop everything: unmount the app, close the runner and the server. */
    close: () => Promise<void>;
}

/**
 * Unmount the running app via the same renderer instance(s) the app used.
 * Resolution nuances (workspace links load the renderer through the runner,
 * published installs externalize it; an importer-less `runner.import` can
 * even land on a different copy) make "import the renderer and call
 * exitTerminal" unreliable — so instead walk every evaluated module and tear
 * down any that exposes `exitTerminal`. Idempotent per instance, synchronous,
 * and exact: only instances the app actually loaded are touched.
 */
function exitApp(runner: ModuleRunner): void {
    for (const mod of runner.evaluatedModules.idToModuleMap.values()) {
        const exitTerminal = (mod.exports as { exitTerminal?: unknown } | undefined)?.exitTerminal;
        if (typeof exitTerminal === 'function') {
            try {
                (exitTerminal as () => void)();
            } catch {
                // Teardown of a half-mounted app must not block the restart.
            }
        }
    }
}

export async function startDev(options: DevOptions): Promise<DevHandle> {
    const root = path.resolve(options.root ?? process.cwd());
    const entryAbs = path.resolve(root, options.entry);
    const entryUrl = pathToFileURL(entryAbs).href;
    const onError = options.onError ?? ((err: unknown) => {
        console.error('[sigx-terminal-dev] failed to start app:', err);
    });

    const server = await createServer({
        root,
        configFile: options.configFile ?? false,
        plugins: [terminalDevPlugin(options.plugin)],
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
    });

    const runner = createServerModuleRunner(server.environments.ssr, {
        hmr: { logger: false },
    });

    let closed = false;
    let entryBroken = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let restarting: Promise<void> | null = null;

    async function importEntry(): Promise<void> {
        try {
            await runner.import(entryUrl);
            entryBroken = false;
            options.onRestart?.();
        } catch (err) {
            entryBroken = true;
            onError(err);
        }
    }

    async function restart(): Promise<void> {
        // Serialize restarts; a request during one queues exactly one more.
        if (restarting) {
            return restarting.then(() => (closed ? undefined : restart()));
        }
        restarting = (async () => {
            exitApp(runner);
            runner.clearCache();
            if (!closed) await importEntry();
        })();
        try {
            await restarting;
        } finally {
            restarting = null;
        }
    }

    function scheduleRestart(): void {
        if (closed || restartTimer) return;
        restartTimer = setTimeout(() => {
            restartTimer = null;
            void restart();
        }, 50);
    }

    // Hot payloads flow to the runner through this channel — INCLUDING the
    // runner's own module-fetch round-trips (`custom`/`vite:invoke`), so only
    // `full-reload` may ever be swallowed; anything else must pass through or
    // every import deadlocks. Full-reload is swallowed and replaced with a
    // controlled restart: the runner's built-in handler would re-import the
    // entry without tearing the old app down first (a double mount). An
    // `update` while the entry is broken also schedules a restart (patching
    // modules of a dead app can't revive it) but still forwards.
    const hot = server.environments.ssr.hot;
    const origSend = hot.send.bind(hot);
    hot.send = ((...args: unknown[]) => {
        const payload = args[0] as { type?: string } | undefined;
        if (payload && typeof payload === 'object' && payload.type === 'full-reload') {
            scheduleRestart();
            return;
        }
        if (entryBroken && payload && typeof payload === 'object' && payload.type === 'update') {
            scheduleRestart();
        }
        (origSend as (...a: unknown[]) => void)(...args);
    }) as typeof hot.send;

    async function close(): Promise<void> {
        if (closed) return;
        closed = true;
        if (restartTimer) {
            clearTimeout(restartTimer);
            restartTimer = null;
        }
        exitApp(runner);
        await runner.close();
        await server.close();
    }

    await importEntry();

    return { server, runner, restart, close };
}
