import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, writeStatic, setOutputTarget } from '../src';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('fullscreen rendering (alt screen)', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('enters the alt screen on mount and homes each frame', () => {
        const cap = captureOutput();
        const app = linesApp(['full']);
        unmount = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false }).unmount;

        expect(cap.output()).toContain('\x1B[?1049h');
        expect(cap.output()).toContain('\x1B[?25l');

        cap.clear();
        flush();
        expect(cap.output().startsWith('\x1B[H')).toBe(true);
        expect(cap.output().endsWith('\x1B[J')).toBe(true);
    });

    it('legacy fullscreen:true maps to fullscreen mode', () => {
        const cap = captureOutput();
        const app = linesApp(['legacy']);
        unmount = renderTerminal(app.vnode, { fullscreen: true, patchConsole: false }).unmount;
        expect(cap.output()).toContain('\x1B[?1049h');
    });

    it('leaves the alt screen on unmount and flushes queued static output after it', () => {
        const cap = captureOutput();
        const app = linesApp(['full']);
        const handle = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false });
        flush();

        writeStatic('queued while in alt screen');
        // Queued, not painted into the alt screen.
        expect(cap.output()).not.toContain('queued while in alt screen');

        cap.clear();
        handle.unmount();

        const out = cap.output();
        const leave = out.indexOf('\x1B[?1049l');
        const log = out.indexOf('queued while in alt screen');
        expect(leave).toBeGreaterThanOrEqual(0);
        expect(log).toBeGreaterThan(leave);
        expect(out).toContain('\x1B[?25h');
    });

    it('never erases the real scrollback (no 3J), even with clearConsole', () => {
        const cap = captureOutput();
        const app = linesApp(['full']);
        unmount = renderTerminal(app.vnode, {
            mode: 'fullscreen',
            clearConsole: true,
            patchConsole: false,
        }).unmount;
        flush();
        expect(cap.output()).not.toContain('\x1B[3J');
    });
});
