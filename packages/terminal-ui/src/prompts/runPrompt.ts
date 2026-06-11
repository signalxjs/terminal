/**
 * One-shot mount plumbing for the imperative prompts: each prompt mounts an
 * inline app with `persistOnExit: false` (the UI vanishes on settle) and
 * `exitOnCtrlC: false` (Ctrl+C becomes a cancel). On settle the live region
 * is erased by the unmount and a permanent summary line takes its place —
 * a finished wizard reads as a tidy `◇`-transcript in scrollback.
 *
 * Concurrent calls SERIALIZE through a module-level promise chain — the
 * renderer is a singleton, so two live prompts can never race it.
 */
import {
    renderTerminal, getOutputTarget, writeStatic, printStatic, resolveColor, resolveFg,
} from '@sigx/terminal-zero';
import { CANCEL } from './cancel';

let chain: Promise<unknown> = Promise.resolve();
let interactiveOverride: boolean | undefined;

/** Test seam: force the interactive/non-interactive decision. */
export function __setInteractiveOverride(value?: boolean): void {
    interactiveOverride = value;
}

/** Both ends must be a TTY: output for the live region, stdin for the keys. */
export function isInteractive(): boolean {
    if (interactiveOverride !== undefined) return interactiveOverride;
    return getOutputTarget().isTTY && !!process.stdin.isTTY;
}

/** Foreground SGR for a theme token; '' at depth none (plain output). */
export function tokenSgr(token: string): string {
    return resolveFg(resolveColor(token));
}

/** Wrap text in a token color, with default-fg restore (never a full reset). */
export function paint(text: string, token: string): string {
    const code = tokenSgr(token);
    return code ? `${code}${text}\x1b[39m` : text;
}

export function summaryLine(kind: 'done' | 'cancel', message: string, display?: string): string {
    if (kind === 'cancel') {
        return `${paint('■', 'danger')} ${message} ${paint('· cancelled', 'dim')}`;
    }
    const tail = display !== undefined && display !== '' ? ` ${paint(`· ${display}`, 'dim')}` : '';
    return `${paint('◇', 'success')} ${message}${tail}`;
}

/**
 * Serialize a task behind any prompts already in flight. Exposed to the
 * prompt spinner so it occupies the live region exclusively too.
 */
export function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const p = chain.then(task);
    chain = p.then(() => undefined, () => undefined);
    return p;
}

export interface RunPromptSpec<R> {
    message: string;
    /** Build the prompt vnode; call `done` exactly once to settle. */
    build: (done: (result: R | typeof CANCEL) => void) => unknown;
    /** Human display of the result for the `◇ message · display` summary. */
    display: (result: R) => string;
    /** Non-interactive fallback (the prompt's initialValue, when provided). */
    fallback?: () => { ok: true; value: R } | { ok: false };
}

/**
 * Note on the event loop: a prompt resolves inside the stdin data handler, so
 * back-to-back awaited prompts never let the loop go empty. Pure-promise work
 * between prompts with no other pending handles could end the process —
 * real async work (fs, network, timers) keeps it alive on its own.
 */
export function runPrompt<R>(spec: RunPromptSpec<R>): Promise<R | typeof CANCEL> {
    const run = (): Promise<R | typeof CANCEL> => {
        if (!isInteractive()) {
            const fb = spec.fallback?.();
            if (fb && fb.ok) {
                printStatic(summaryLine('done', spec.message, spec.display(fb.value)));
                return Promise.resolve(fb.value);
            }
            return Promise.reject(new Error(
                `Prompt "${spec.message}" requires an interactive terminal — ` +
                'pass the value via a CLI flag or provide initialValue.',
            ));
        }
        return new Promise<R | typeof CANCEL>((resolve) => {
            let settled = false;
            const done = (result: R | typeof CANCEL) => {
                if (settled) return;
                settled = true;
                // Order matters: unmount erases the live region and pauses
                // stdin; the unmounted writeStatic then prints the summary
                // exactly where the prompt stood.
                handle.unmount();
                writeStatic(result === CANCEL
                    ? summaryLine('cancel', spec.message)
                    : summaryLine('done', spec.message, spec.display(result as R)));
                resolve(result);
            };
            const handle = renderTerminal(spec.build(done), {
                mode: 'inline',
                persistOnExit: false,
                exitOnCtrlC: false,
            });
        });
    };
    return enqueue(run);
}
