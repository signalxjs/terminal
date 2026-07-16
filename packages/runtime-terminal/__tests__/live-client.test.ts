/**
 * The terminal runtime must declare itself a live client. Core otherwise infers
 * "is this a live client" from `typeof window !== 'undefined'` — a check that
 * keeps server renders safe but reads as `false` in a TUI, leaving keyed
 * `useData` reads parked in `pending` forever.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isLiveClient } from '@sigx/runtime-core/internals';
import { component, jsx, useData } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget } from '../src';
import { captureOutput } from './harness';

describe('live-client declaration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('declares the terminal runtime a live client despite having no window', () => {
        // The premise: importing ../src is what runs declareLiveClient().
        expect(typeof (globalThis as Record<string, unknown>).window).toBe('undefined');
        expect(isLiveClient()).toBe(true);
    });

    it('lets a keyed useData read reach its ready arm instead of parking in pending', async () => {
        const cap = captureOutput({ isTTY: false });
        const App = component(() => {
            const greeting = useData('greeting', async () => 'fetched-value');
            return () => jsx('text', {
                children: greeting.match({
                    pending: () => 'still-pending',
                    ready: (v) => v
                })
            });
        });

        const handle = renderTerminal(jsx(App, {}), { patchConsole: false });
        // Async advance: settles the fetcher's promise (microtasks) as well as
        // the renderer's 16ms batch timer, without depending on wall-clock.
        await vi.advanceTimersByTimeAsync(20);
        // Non-TTY writes the final frame once, at unmount.
        handle.unmount();

        expect(cap.output()).toContain('fetched-value');
        expect(cap.output()).not.toContain('still-pending');
    });
});
