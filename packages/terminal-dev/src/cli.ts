/**
 * `sigx-terminal-dev [entry]` — run a SignalX terminal app with HMR.
 *
 *   sigx-terminal-dev                  # auto-detects src/main.tsx etc.
 *   sigx-terminal-dev src/main.tsx
 *   sigx-terminal-dev --root examples/showcase
 *   sigx-terminal-dev --config vite.config.ts
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startDev } from './dev.js';

const ENTRY_CANDIDATES = [
    'src/main.tsx',
    'src/main.ts',
    'src/index.tsx',
    'src/index.ts',
    'main.tsx',
    'main.ts',
];

function fail(message: string): never {
    process.stderr.write(`[sigx-terminal-dev] ${message}\n`);
    process.exit(1);
}

const args = process.argv.slice(2);
let entry: string | undefined;
let root = process.cwd();
let configFile: string | false = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root') {
        const value = args[++i];
        if (!value) fail('--root needs a directory');
        root = path.resolve(root, value);
    } else if (arg === '--config') {
        const value = args[++i];
        if (!value) fail('--config needs a file');
        configFile = value;
    } else if (arg === '--help' || arg === '-h') {
        process.stdout.write(
            'Usage: sigx-terminal-dev [entry] [--root <dir>] [--config <vite config>]\n' +
            '\nRuns a SignalX terminal app under a Vite dev server with HMR:\n' +
            'saving a component module updates the running TUI in place;\n' +
            'saving the mount module restarts the app in-process.\n',
        );
        process.exit(0);
    } else if (arg.startsWith('-')) {
        fail(`unknown option ${arg}`);
    } else {
        entry = arg;
    }
}

if (!entry) {
    entry = ENTRY_CANDIDATES.find((candidate) => existsSync(path.join(root, candidate)));
    if (!entry) {
        fail(`no entry given and none of ${ENTRY_CANDIDATES.join(', ')} exists in ${root}`);
    }
} else if (!existsSync(path.resolve(root, entry))) {
    fail(`entry not found: ${path.resolve(root, entry)}`);
}

process.stderr.write(`[sigx-terminal-dev] ${path.join(path.basename(root), entry)} — edit a component to hot-update\n`);

// Raw mode swallows SIGINT, so quitting the app with Ctrl+C is the renderer
// calling process.exit(130) — only this process sees it, and a wrapping pnpm
// script would report ELIFECYCLE 130. For a dev session that's the normal way
// to stop, not a failure: translate it to 0. Bin-only policy — programmatic
// startDev() embedders keep their own exit handling. Other codes pass through.
const realExit = process.exit.bind(process);
process.exit = ((code?: number | string | null) =>
    // Coerced compare: node also accepts integer strings ('130').
    realExit(code != null && Number(code) === 130 ? 0 : code)) as typeof process.exit;

const handle = await startDev({
    entry,
    root,
    configFile,
    onError: (err) => {
        // While the app is mounted the renderer routes console.error into the
        // transcript above the live region; before/after a mount it's stderr.
        console.error('[sigx-terminal-dev] app failed, fix the error and save to retry:\n', err);
    },
});

// The app owns SIGINT while mounted (raw-mode Ctrl+C tears down and exits).
// This covers external SIGTERM and an unmounted app.
const stop = () => {
    void handle.close().finally(() => process.exit(0));
};
process.on('SIGTERM', stop);
