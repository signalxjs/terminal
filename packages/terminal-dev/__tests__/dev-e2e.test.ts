/**
 * End-to-end dev-runner test: a real Vite dev server + module runner executes
 * a fixture app. Editing the component module on disk hot-swaps it in the
 * running app (module-level state intact, no teardown); editing the mount
 * module restarts the app in-process; a broken edit recovers once fixed.
 *
 * The fixture lives under this package so its `@sigx/*` imports resolve
 * through the package's own node_modules (workspace links). The fixture entry
 * injects a file-backed output target itself: an in-process restart can give
 * the app a fresh renderer instance (the workspace-linked renderer loads
 * through the module runner, and `clearCache` re-instantiates it), so the
 * capture must be re-applied by the entry on every (re)start.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startDev, type DevHandle } from '../src/dev';

const here = path.dirname(fileURLToPath(import.meta.url));

const TSCONFIG = JSON.stringify({
    compilerOptions: {
        jsx: 'react-jsx',
        jsxImportSource: '@sigx/runtime-core',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
    },
}, null, 4);

const STORE_TS = `
import { signal } from '@sigx/reactivity';
export const store = signal({ n: 0 });
`;

const ui = (version: string) => `
/** @jsxImportSource @sigx/runtime-core */
import { component } from '@sigx/runtime-core';
import { store } from './store';

export const Label = component(() => () => (
    <text>version ${version} n={String(store.n)}</text>
));
`;

const main = (marker: string, outFile: string) => `
/** @jsxImportSource @sigx/runtime-core */
import { appendFileSync } from 'node:fs';
import { renderTerminal, setOutputTarget, syncTerminalSize } from '@sigx/runtime-terminal';
import { Label } from './ui';

setOutputTarget({
    write: (s: string) => { appendFileSync(${JSON.stringify(outFile)}, s); },
    columns: 80,
    rows: 24,
    isTTY: true,
});
syncTerminalSize();

renderTerminal(<text>${marker} <Label /></text>, { patchConsole: false });
`;

async function until(cond: () => boolean, what: string, timeoutMs = 10_000): Promise<void> {
    const start = Date.now();
    while (!cond()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`timed out waiting for ${what}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}

describe('dev runner e2e', () => {
    let dir: string;
    let outFile: string;
    let errors: string[];
    let handle: DevHandle | null = null;

    const output = () => (existsSync(outFile) ? readFileSync(outFile, 'utf8') : '');

    beforeEach(() => {
        dir = path.join(here, '.tmp', `app-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
        outFile = path.join(dir, 'out.txt').replace(/\\/g, '/');
        errors = [];
        mkdirSync(path.join(dir, 'src'), { recursive: true });
        writeFileSync(path.join(dir, 'tsconfig.json'), TSCONFIG);
        writeFileSync(path.join(dir, 'src', 'store.ts'), STORE_TS);
        writeFileSync(path.join(dir, 'src', 'ui.tsx'), ui('one'));
        writeFileSync(path.join(dir, 'src', 'main.tsx'), main('app', outFile));
    });

    afterEach(async () => {
        await handle?.close();
        handle = null;
        rmSync(dir, { recursive: true, force: true });
    });

    async function boot() {
        handle = await startDev({
            entry: 'src/main.tsx',
            root: dir,
            onError: (err) => { errors.push(String(err)); },
        });
    }

    function editFile(rel: string, content: string): void {
        const file = path.join(dir, rel);
        writeFileSync(file, content);
        // Synthetic watcher event: deterministic on CI, same code path as a
        // real fs event.
        handle!.server.watcher.emit('change', file);
    }

    it('hot-swaps an edited component into the running app, state intact', async () => {
        await boot();
        await until(() => output().includes('version one'), 'first frame');

        // Mutate module-level state through the runner's module graph — the
        // same instance the app reads.
        const storeUrl = pathToFileURL(path.join(dir, 'src', 'store.ts')).href;
        const storeMod = await handle!.runner.import(storeUrl);
        storeMod.store.n = 5;
        await until(() => output().includes('version one n=5'), 'state repaint');

        editFile('src/ui.tsx', ui('two'));
        await until(() => output().includes('version two'), 'hot update');

        const out = output();
        // Module-level state survived the hot swap...
        expect(out).toContain('version two n=5');
        // ...and the app never tore down (teardown re-shows the cursor).
        expect(out).not.toContain('\x1B[?25h');
        expect(errors).toEqual([]);
    }, 30_000);

    it('restarts in-process when the mount module changes', async () => {
        await boot();
        await until(() => output().includes('app version one'), 'first frame');

        editFile('src/main.tsx', main('restarted', outFile));
        await until(() => output().includes('restarted version one'), 'restart');

        // A real restart: the old app tore down (cursor re-shown) before the
        // new mount painted.
        expect(output()).toContain('\x1B[?25h');
        expect(errors).toEqual([]);
    }, 30_000);

    it('recovers after a broken edit once it is fixed', async () => {
        await boot();
        await until(() => output().includes('version one'), 'first frame');

        editFile('src/main.tsx', `this is not valid typescript ===`);
        await until(() => errors.length > 0, 'broken entry reported');

        editFile('src/main.tsx', main('fixed', outFile));
        await until(() => output().includes('fixed version one'), 'recovery');
    }, 30_000);
});
