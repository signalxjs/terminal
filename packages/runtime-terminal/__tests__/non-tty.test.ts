import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, writeStatic, setOutputTarget } from '../src';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('non-TTY fallback (piped / CI)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('emits no escape codes during the app lifetime', () => {
        const cap = captureOutput({ isTTY: false });
        const app = linesApp(['progress 1/3']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();
        app.setLines(['progress 2/3']);
        flush();

        expect(cap.output()).toBe(''); // live frames are not written at all

        handle.unmount();
        expect(cap.output()).not.toContain('\x1B[');
    });

    it('emits the final frame once, as plain text, at unmount', () => {
        const cap = captureOutput({ isTTY: false });
        const app = linesApp(['done: 3 files written']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();
        app.setLines(['done: 4 files written']); // pending frame at unmount

        handle.unmount();
        expect(cap.output()).toBe('done: 4 files written\n');
    });

    it('writeStatic passes straight through', () => {
        const cap = captureOutput({ isTTY: false });
        const app = linesApp(['live']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();

        writeStatic('a finished line');
        expect(cap.output()).toBe('a finished line\n');
        handle.unmount();
    });
});
