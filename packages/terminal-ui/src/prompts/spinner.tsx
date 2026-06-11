/** @jsxImportSource @sigx/runtime-core */
import { component, signal } from '@sigx/runtime-core';
import { renderTerminal, printStatic, GLYPHS } from '@sigx/terminal-zero';
import { Spinner } from '../feedback/Spinner';
import { enqueue, isInteractive, paint } from './runPrompt';

export interface SpinnerHandle {
    start(label?: string): void;
    /** Update the label while spinning. */
    message(label: string): void;
    /** Stop and leave a permanent `✔ label` / `✖ label` line. */
    stop(label?: string, code?: 'success' | 'error'): void;
}

/**
 * Imperative spinner for prompt flows:
 *
 *     const s = spinner();
 *     s.start('Installing dependencies');
 *     await install();
 *     s.stop('Dependencies installed');
 *
 * Queues behind any in-flight prompts and occupies the live region until
 * stopped — don't await another prompt between start() and stop() (it would
 * wait for the spinner's slot and deadlock). Ctrl+C stays the renderer
 * default here (exit): a long task should be interruptible.
 * Non-TTY: start() renders nothing; stop() prints the summary line.
 */
export function spinner(): SpinnerHandle {
    const state = signal({ label: '' });
    let active = false;
    let handle: { unmount: () => void } | null = null;
    let release: (() => void) | null = null;

    return {
        start(label = '') {
            if (active) return;
            active = true;
            state.label = label;
            const gate = new Promise<void>((resolve) => { release = resolve; });
            void enqueue(() => {
                if (!active) return Promise.resolve(); // stopped before its slot came up
                if (isInteractive()) {
                    const View = component(() => () => <Spinner label={state.label} />, { name: 'PromptSpinner' });
                    handle = renderTerminal(<View />, { mode: 'inline', persistOnExit: false });
                }
                return gate;
            });
        },
        message(label: string) {
            state.label = label;
        },
        stop(label?: string, code: 'success' | 'error' = 'success') {
            if (!active) return;
            active = false;
            handle?.unmount();
            handle = null;
            const finalLabel = label ?? state.label;
            const mark = code === 'success' ? paint(GLYPHS.check, 'success') : paint(GLYPHS.cross, 'danger');
            printStatic(`${mark} ${finalLabel}`);
            release?.();
            release = null;
        },
    };
}
