import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, writeStatic, setOutputTarget, setScreenBackground, setColorDepth } from '../src';
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
        setScreenBackground(undefined);
        setColorDepth('truecolor');
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

    it('queues empty-string spacers and flushes them as blank lines', () => {
        const cap = captureOutput();
        const app = linesApp(['full']);
        const handle = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false });
        flush();

        writeStatic('first');
        writeStatic('');      // spacer — must survive the queue
        writeStatic('second');
        cap.clear();
        handle.unmount();

        expect(cap.output()).toContain('first\n\nsecond');
    });

    /**
     * A fullscreen frame taller than the viewport used to be emitted whole.
     * The alt buffer then scrolls, so the next frame's `\x1B[H` no longer lands
     * on the frame's first row and every subsequent row is off by the overflow
     * — the whole dashboard shears, and stays sheared. Clipping keeps the top,
     * unlike the inline path: a dashboard's title bar and tab strip are at the
     * top, and losing them to keep the footer is the wrong trade.
     */
    describe('a frame taller than the terminal', () => {
        const tall = (rows: number) => Array.from({ length: rows }, (_, i) => `row${i + 1}`);

        it('is clipped to the terminal height, keeping the top', () => {
            const cap = captureOutput({ columns: 40, rows: 5 });
            const app = linesApp(tall(9));
            unmount = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false }).unmount;
            cap.clear();
            flush();

            const body = cap.output().split('\x1B[H')[1].split('\x1B[J')[0];
            const lines = body.split('\n').map((l) => l.split('\x1B[K').join(''));
            expect(lines).toHaveLength(5);
            expect(lines[0]).toBe('row1');
            expect(lines[4]).toBe('row5');
            expect(cap.output()).not.toContain('row6');
        });

        it('clips with a themed canvas too, where short frames are padded', () => {
            const cap = captureOutput({ columns: 40, rows: 4 });
            setColorDepth('truecolor');
            setScreenBackground('#101010');
            const app = linesApp(tall(8));
            unmount = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false }).unmount;
            cap.clear();
            flush();

            const body = cap.output().split('\x1B[H')[1].split('\x1B[J')[0];
            expect(body.split('\n')).toHaveLength(4);
            expect(cap.output()).not.toContain('row5');
        });

        it('still pads a short frame out to the terminal height', () => {
            // The clamp must not turn "fill the screen we own" into "clip only".
            const cap = captureOutput({ columns: 40, rows: 6 });
            setColorDepth('truecolor');
            setScreenBackground('#101010');
            const app = linesApp(tall(2));
            unmount = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false }).unmount;
            cap.clear();
            flush();

            const body = cap.output().split('\x1B[H')[1].split('\x1B[J')[0];
            expect(body.split('\n')).toHaveLength(6);
        });

        it('re-clips against the new height after a resize', () => {
            const cap = captureOutput({ columns: 40, rows: 8 });
            const app = linesApp(tall(8));
            unmount = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false }).unmount;
            flush();

            cap.target.rows = 3;
            process.stdout.emit('resize');
            cap.clear();
            flush();

            const body = cap.output().split('\x1B[H').pop()!.split('\x1B[J')[0];
            expect(body.split('\n')).toHaveLength(3);
        });
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
