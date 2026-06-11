/**
 * Vite plugin for SignalX terminal dev mode.
 *
 * Two jobs:
 *
 * 1. Keep the framework out of the hot module graph. Every `@sigx/*` package
 *    is externalized for SSR, so the terminal renderer (raw mode, alt screen,
 *    the render loop) and the reactivity instance are plain node singletons
 *    that survive every hot update — only app code re-executes.
 *
 * 2. Make component modules hot. Project files that define components get
 *    `registerHMRModule(<id>)` injected at the top (component identity for
 *    the HMR runtime) and a self-`accept()` at the bottom, so an edit
 *    re-executes just that module and the runtime patches live instances in
 *    place. Modules that MOUNT the app (`defineApp`/`renderTerminal`/
 *    `mountTerminal`) are registered but never self-accept — re-executing
 *    them would mount a second app — so edits there bubble out as a
 *    full-reload, which the dev runner turns into a clean in-process restart.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export interface TerminalDevPluginOptions {
    /**
     * Inject HMR registration/accept code into component modules.
     * @default true
     */
    hmr?: boolean;
    /**
     * Module specifier injected to import the HMR runtime from. Defaults to
     * the runtime file shipped next to this plugin, so apps don't need
     * `@sigx/terminal-dev` in their own dependency graph.
     */
    hmrRuntime?: string;
    /**
     * Extra SSR externals on top of the `@sigx/*` packages.
     */
    external?: string[];
}

/**
 * Packages that must stay singletons outside the hot module graph. The
 * renderer holds TTY state; reactivity holds the effect tracking; splitting
 * any of them between node and the module runner breaks signals silently.
 */
const SIGX_EXTERNALS = [
    '@sigx/terminal',
    '@sigx/terminal-ui',
    '@sigx/terminal-zero',
    '@sigx/terminal-dev',
    '@sigx/runtime-terminal',
    '@sigx/runtime-core',
    '@sigx/reactivity',
    'sigx',
];

/** A module that defines at least one `component(...)`. */
const COMPONENT_RE = /\bcomponent\s*[<(]/;
/** A module that mounts an app — re-executing it would double-mount. */
const MOUNT_RE = /\b(defineApp|renderTerminal|mountTerminal)\s*\(/;

function defaultHmrRuntime(): string {
    // Built layout: dist/index.js (this file, bundled) next to dist/hmr.js.
    // Repo/test layout: src/plugin.ts next to src/hmr.ts.
    const dir = path.dirname(fileURLToPath(import.meta.url));
    for (const candidate of ['hmr.js', 'hmr.ts']) {
        const p = path.join(dir, candidate);
        if (existsSync(p)) return p.replace(/\\/g, '/');
    }
    return '@sigx/terminal-dev/hmr';
}

/**
 * Turn the runtime location into a valid import specifier. Absolute fs paths
 * (notably Windows drive paths like `C:/…`) are not portable module
 * specifiers, so they're injected in Vite's explicit fs-path form
 * (`/@fs/C:/…` / `/@fs/home/…`); bare specifiers pass through.
 */
function toImportSpecifier(runtime: string): string {
    // Platform-agnostic on purpose: a windows drive path must be recognized
    // even when this code runs under a posix `path` (and vice versa).
    const isAbsolute = path.isAbsolute(runtime) || /^[A-Za-z]:[\\/]/.test(runtime);
    if (!isAbsolute) return runtime;
    return '/@fs/' + runtime.replace(/\\/g, '/').replace(/^\//, '');
}

export function terminalDevPlugin(options: TerminalDevPluginOptions = {}): Plugin {
    const { hmr = true } = options;
    const hmrRuntime = options.hmrRuntime ?? defaultHmrRuntime();

    let command: 'serve' | 'build' = 'serve';

    return {
        name: 'sigx-terminal-dev',
        enforce: 'pre',

        config(_userConfig, env) {
            command = env.command;
            if (env.command !== 'serve') return;
            // The HMR runtime usually lives outside the app root (next to
            // this plugin). The module runner's fetches don't go through the
            // HTTP fs allowlist, but a browser environment served from the
            // same config would — allow exactly the runtime's directory
            // rather than disabling strict mode.
            const isAbsoluteRuntime = path.isAbsolute(hmrRuntime) || /^[A-Za-z]:[\\/]/.test(hmrRuntime);
            return {
                ssr: {
                    external: [...SIGX_EXTERNALS, ...(options.external ?? [])],
                },
                ...(isAbsoluteRuntime
                    ? { server: { fs: { allow: [path.dirname(hmrRuntime)] } } }
                    : {}),
            };
        },

        configResolved(resolved) {
            command = resolved.command;
        },

        transform(code, id) {
            if (!hmr || command !== 'serve') return null;
            if (!/\.[jt]sx?$/.test(id)) return null;
            if (id.includes('node_modules') || id.includes('/dist/') || id.includes('\\dist\\')) return null;

            const moduleId = id.replace(/\\/g, '/');
            // Never instrument the HMR runtime itself.
            if (moduleId === hmrRuntime || moduleId.endsWith('/hmr.ts') || moduleId.endsWith('/hmr.js')) return null;

            if (!COMPONENT_RE.test(code)) return null;

            const escapedId = moduleId.replace(/'/g, "\\'");
            const header =
                `import { registerHMRModule as __sigxRegisterHMRModule, clearHMRModule as __sigxClearHMRModule } from '${toImportSpecifier(hmrRuntime)}';\n` +
                `__sigxRegisterHMRModule('${escapedId}');\n`;

            // The definition scope closes after the module body, so later
            // definitions from non-instrumented code can't inherit this id.
            // Mount modules get identity registration (their components are
            // still patchable when OTHER modules change) but no self-accept.
            const footer =
                `\n__sigxClearHMRModule('${escapedId}');\n` +
                (MOUNT_RE.test(code)
                    ? ''
                    : `if (import.meta.hot) {\n    import.meta.hot.accept();\n}\n`);

            return { code: header + code + footer, map: null };
        },
    };
}

export default terminalDevPlugin;
