import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, setOutputTarget } from '../src';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('persistOnExit: false (one-shot inline UIs)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('erases a 2-line region on unmount instead of persisting it', () => {
        const cap = captureOutput();
        const app = linesApp(['line one', 'line two']);
        const handle = renderTerminal(app.vnode, { persistOnExit: false, patchConsole: false });
        flush();
        cap.clear();

        handle.unmount();
        expect(cap.output()).toBe('\r\x1B[1A\x1B[J\x1b[0m\x1B[?25h');
    });

    it('erases a 1-line region without a cursor-up', () => {
        const cap = captureOutput();
        const app = linesApp(['only line']);
        const handle = renderTerminal(app.vnode, { persistOnExit: false, patchConsole: false });
        flush();
        cap.clear();

        handle.unmount();
        expect(cap.output()).toBe('\r\x1B[J\x1b[0m\x1B[?25h');
    });

    it('writes only reset+show-cursor when nothing was painted', () => {
        const cap = captureOutput();
        const app = linesApp(['never shown']);
        const handle = renderTerminal(app.vnode, { persistOnExit: false, patchConsole: false });
        // No flush: nothing has been painted yet.
        cap.clear();

        handle.unmount();
        expect(cap.output()).toBe('\x1b[0m\x1B[?25h');
    });

    it('does NOT flush a pending batched frame before the erase', () => {
        const cap = captureOutput();
        const app = linesApp(['v1']);
        const handle = renderTerminal(app.vnode, { persistOnExit: false, patchConsole: false });
        flush();

        app.setLines(['v2 must never appear']); // schedules, but unmount comes first
        cap.clear();
        handle.unmount();

        expect(cap.output()).not.toContain('v2 must never appear');
        expect(cap.output()).toBe('\r\x1B[J\x1b[0m\x1B[?25h');
    });

    it('default (persist) behavior is unchanged', () => {
        const cap = captureOutput();
        const app = linesApp(['kept']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();
        cap.clear();

        handle.unmount();
        expect(cap.output()).toBe('\n\x1b[0m\x1B[?25h');
    });

    it('suppresses the non-TTY final-frame dump', () => {
        const cap = captureOutput({ isTTY: false });
        const app = linesApp(['silent']);
        const handle = renderTerminal(app.vnode, { persistOnExit: false, patchConsole: false });
        flush();

        handle.unmount();
        expect(cap.output()).toBe('');
    });
});
