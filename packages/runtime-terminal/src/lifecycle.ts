/**
 * Process-level safety for a mounted terminal app: console patching (stray
 * logs become static output instead of corrupting the live frame) and
 * exit/signal hooks that guarantee the terminal is never left in raw mode,
 * with a hidden cursor, or stuck in the alternate screen — however the
 * process dies.
 */
import { format } from 'node:util';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';
const METHODS: ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];

const originals = new Map<ConsoleMethod, (...args: unknown[]) => void>();
let inSink = false;

/**
 * Route console.log/info/warn/error/debug through `sink` (formatted with
 * util.format). Idempotent; returns a restore function. A log emitted from
 * inside the sink itself (re-entrancy) falls through to the real console so
 * the render path can never recurse into itself.
 */
export function patchConsoleTo(sink: (text: string) => void): () => void {
    if (originals.size === 0) {
        for (const m of METHODS) {
            const original = console[m].bind(console);
            originals.set(m, original);
            console[m] = (...args: unknown[]) => {
                if (inSink) {
                    original(...args);
                    return;
                }
                inSink = true;
                try {
                    sink(format(...args));
                } finally {
                    inSink = false;
                }
            };
        }
    }
    return restoreConsole;
}

export function restoreConsole(): void {
    for (const [m, original] of originals) {
        console[m] = original;
    }
    originals.clear();
}

/** The unpatched console.error, for reporting crashes the patch must not eat. */
export function originalConsoleError(...args: unknown[]): void {
    (originals.get('error') ?? console.error.bind(console))(...args);
}

// --- Exit safety ---
// One restore function at a time (the renderer is a singleton). It must be
// synchronous and idempotent: the 'exit' event allows no async work, and a
// signal may fire after a clean teardown already ran.

let restoreFn: (() => void) | null = null;
let hooksInstalled = false;

function runRestore(): void {
    const fn = restoreFn;
    restoreFn = null;
    fn?.();
}

const onExit = () => runRestore();
const onSigint = () => {
    runRestore();
    process.exit(130);
};
const onSigterm = () => {
    runRestore();
    process.exit(143);
};
const onUncaught = (err: unknown) => {
    runRestore();
    originalConsoleError(err);
    process.exit(1);
};

export function registerCleanup(restore: () => void): void {
    restoreFn = restore;
    if (hooksInstalled) return;
    hooksInstalled = true;
    process.on('exit', onExit);
    // In raw mode Ctrl+C never raises SIGINT (it arrives as \u0003 on stdin);
    // these cover non-raw stdin and external kills.
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);
    process.on('uncaughtException', onUncaught);
}

export function unregisterCleanup(): void {
    restoreFn = null;
    if (!hooksInstalled) return;
    hooksInstalled = false;
    process.off('exit', onExit);
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
    process.off('uncaughtException', onUncaught);
}
