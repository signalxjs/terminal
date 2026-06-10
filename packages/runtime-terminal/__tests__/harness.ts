/**
 * Test harness for the renderer: a capturing OutputTarget (no real TTY) and a
 * minimal reactive app whose lines tests mutate between frames.
 */
import { jsx, component } from '@sigx/runtime-core';
import { signal } from '@sigx/reactivity';
import { setOutputTarget, type OutputTarget } from '../src/output';

export interface Capture {
    target: OutputTarget;
    chunks: string[];
    /** Everything written so far, concatenated. */
    output(): string;
    clear(): void;
}

export function captureOutput(opts: { columns?: number; rows?: number; isTTY?: boolean } = {}): Capture {
    const chunks: string[] = [];
    const target: OutputTarget = {
        write: (s: string) => { chunks.push(s); },
        columns: opts.columns ?? 40,
        rows: opts.rows ?? 10,
        isTTY: opts.isTTY ?? true,
    };
    setOutputTarget(target);
    return {
        target,
        chunks,
        output: () => chunks.join(''),
        clear: () => { chunks.length = 0; },
    };
}

/** An app rendering one terminal line per entry of a mutable signal array. */
export function linesApp(initial: string[] = ['hello']) {
    const state = signal({ lines: initial });
    const App = component(() => () => {
        const kids: unknown[] = [];
        state.lines.forEach((line, i) => {
            if (i > 0) kids.push(jsx('br', {}));
            kids.push(line);
        });
        return jsx('text', { children: kids });
    });
    return {
        vnode: jsx(App, {}),
        setLines: (lines: string[]) => { state.lines = lines; },
    };
}
