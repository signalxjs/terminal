/**
 * Shared helpers for prompt tests: a capturing OutputTarget plus fake-timer
 * key driving. Prompts gate readiness behind READY_DELAY_MS (50ms) and paint
 * on the 16ms render batch, so `settle()` advances past both (flushing
 * microtasks) before keys are dispatched.
 */
import { vi } from 'vitest';
import { setOutputTarget, dispatchKey, type OutputTarget } from '@sigx/runtime-terminal';

export const ESC = String.fromCharCode(27);
export const CTRL_C = String.fromCharCode(3);
export const ENTER = '\r';
export const UP = ESC + '[A';
export const DOWN = ESC + '[B';
export const LEFT = ESC + '[D';
export const RIGHT = ESC + '[C';

export interface Capture {
    target: OutputTarget;
    chunks: string[];
    output(): string;
    clear(): void;
}

export function captureOutput(opts: { columns?: number; rows?: number; isTTY?: boolean } = {}): Capture {
    const chunks: string[] = [];
    const target: OutputTarget = {
        write: (s: string) => { chunks.push(s); },
        columns: opts.columns ?? 60,
        rows: opts.rows ?? 20,
        isTTY: opts.isTTY ?? true,
    };
    setOutputTarget(target);
    // Frames are wrapped in synchronized-update markers; strip them in
    // output() so content assertions stay focused.
    const stripSync = (s: string) => s.split('\x1b[?2026h').join('').split('\x1b[?2026l').join('');
    return {
        target,
        chunks,
        output: () => stripSync(chunks.join('')),
        clear: () => { chunks.length = 0; },
    };
}

/** Advance past mount + READY_DELAY + a paint, flushing microtasks. */
export async function settle(ms = 80): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
}

/** Dispatch a key, then let the repaint batch run. */
export async function press(key: string): Promise<void> {
    dispatchKey(key);
    await vi.advanceTimersByTimeAsync(20);
}

export async function type(text: string): Promise<void> {
    for (const ch of text) {
        dispatchKey(ch);
    }
    await vi.advanceTimersByTimeAsync(20);
}
