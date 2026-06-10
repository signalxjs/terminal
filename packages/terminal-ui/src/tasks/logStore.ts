/**
 * Reactive log store for streaming tool output (pod install, gradle, …) into
 * a LogPanel: a ring buffer of completed lines plus the live partial line.
 * Headless and transport-agnostic — pipe anything into it:
 *
 *     proc.stdout.on('data', (d) => store.push(d.toString()));
 *
 * `\r` inside a line is resolved with terminal overlay semantics, so progress
 * lines ("Downloading 42%\r") render their latest frame, and a shorter frame
 * overwrites only the prefix of a longer one — like a real terminal.
 */
import { signal } from '@sigx/reactivity';
import { resolveColor, GLYPHS, getOutputTarget, printStatic, resolveFg } from '@sigx/terminal-zero';

export interface LogStoreOptions {
    /** Max retained completed lines (ring buffer). Default 10 000. */
    limit?: number;
    /**
     * Stream completed lines straight to printStatic as they arrive.
     * Default: on when stdout is not a TTY (piped/CI logs stay complete and
     * ordered), off when interactive (the LogPanel shows the tail instead).
     */
    passthrough?: boolean;
}

export interface LogStore {
    /** Whether this store streams lines to printStatic (fixed at creation). */
    readonly passthrough: boolean;
    push(chunk: string): void;
    /** Commit a trailing partial line, if any. */
    end(): void;
    clear(): void;
    /** Completed lines, plus the live partial as the last entry. Reactive. */
    lines(): readonly string[];
    /** The last `n` of lines(). Reactive. */
    tail(n: number): string[];
    count(): number;
}

/** Resolve `\r` overwrites: each segment overlays the prefix of what it follows. */
function overlayCR(line: string): string {
    if (!line.includes('\r')) return line;
    return line.split('\r').reduce((acc, seg) => seg + acc.slice(seg.length));
}

export function createLogStore(opts: LogStoreOptions = {}): LogStore {
    const limit = opts.limit ?? 10_000;
    const passthrough = opts.passthrough ?? !getOutputTarget().isTTY;
    const state = signal({ lines: [] as string[], partial: '' });

    const commit = (raw: string) => {
        const line = overlayCR(raw);
        state.lines.push(line);
        if (state.lines.length > limit) {
            state.lines.splice(0, state.lines.length - limit);
        }
        if (passthrough) printStatic(line);
    };

    return {
        passthrough,
        push(chunk: string) {
            const buf = state.partial + chunk.replace(/\r\n/g, '\n');
            const parts = buf.split('\n');
            state.partial = parts.pop()!;
            for (const part of parts) commit(part);
        },
        end() {
            if (state.partial) {
                const rest = state.partial;
                state.partial = '';
                commit(rest);
            }
        },
        clear() {
            state.lines.splice(0, state.lines.length);
            state.partial = '';
        },
        lines() {
            const all = state.lines.slice();
            if (state.partial) all.push(overlayCR(state.partial));
            return all;
        },
        count() {
            return state.lines.length + (state.partial ? 1 : 0);
        },
        tail(n: number) {
            if (n <= 0) return [];
            return this.lines().slice(-n);
        },
    };
}

function formatDuration(ms: number): string {
    return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export interface CollapseOptions {
    label: string;
    ok: boolean;
    durationMs?: number;
    /** On failure, the full captured log is flushed into scrollback first. */
    store?: LogStore;
}

/**
 * Print a task's permanent one-line summary above the live region —
 * `✔ pod install (3.2s)` on success; on failure the full log flushes first so
 * it's greppable in scrollback, then `✖ label`. The live-region collapse
 * itself is the consumer flipping the task off `running` (the panel unmounts
 * and the repaint shrinks the region). Inline-mode pattern: in fullscreen,
 * static output queues until the alt screen exits, by design.
 */
export function collapseTask(o: CollapseOptions): void {
    // resolveFg accepts both hex (truecolor/256) and ANSI names (ansi16) and
    // returns '' at depth none — exactly the degradation static lines need.
    const sgr = (token: string) => resolveFg(resolveColor(token));
    const dim = sgr('dim');
    const off = (code: string) => (code ? '\x1b[39m' : '');

    if (!o.ok && o.store && !o.store.passthrough) {
        const lines = o.store.lines();
        if (lines.length) printStatic(lines.join('\n'));
    }

    const mark = sgr(o.ok ? 'success' : 'danger');
    const glyph = o.ok ? GLYPHS.check : GLYPHS.cross;
    const duration = o.durationMs !== undefined
        ? ` ${dim}(${formatDuration(o.durationMs)})${off(dim)}`
        : '';
    printStatic(`${mark}${glyph}${off(mark)} ${o.label}${duration}`);
}
