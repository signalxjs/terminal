import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, setOutputTarget } from '../src';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('inline rendering', () => {
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

    it('paints the first frame at the cursor with no home/clear', () => {
        const cap = captureOutput();
        const app = linesApp(['hello']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();

        const out = cap.output();
        expect(out).not.toContain('\x1B[H');
        expect(out).not.toContain('\x1B[2J');
        expect(out).not.toContain('\x1B[3J');
        expect(out).toContain('hello\x1B[K\x1B[J');
        // The frame ends without a trailing newline (cursor rests on the last line).
        expect(cap.chunks[cap.chunks.length - 1].endsWith('\x1B[J')).toBe(true);
    });

    it('repaints by moving up over the previous frame', () => {
        const cap = captureOutput();
        const app = linesApp(['a', 'b', 'c']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();
        cap.clear();

        app.setLines(['x', 'y', 'z']);
        flush();

        // 3-line previous frame: carriage return + 2 up, then the new lines.
        expect(cap.output()).toBe('\r\x1B[2A' + 'x\x1B[K\ny\x1B[K\nz\x1B[K' + '\x1B[J');
    });

    it('clears leftover lines when the frame shrinks', () => {
        const cap = captureOutput();
        const app = linesApp(['a', 'b', 'c']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();
        cap.clear();

        app.setLines(['only']);
        flush();

        const out = cap.output();
        expect(out.startsWith('\r\x1B[2A')).toBe(true);
        expect(out.endsWith('only\x1B[K\x1B[J')).toBe(true);

        // Next repaint only moves up over the 1-line region.
        cap.clear();
        app.setLines(['again']);
        flush();
        expect(cap.output()).toBe('\ragain\x1B[K\x1B[J');
    });

    it('clamps frames taller than the viewport to the bottom rows', () => {
        const cap = captureOutput({ rows: 3 });
        const app = linesApp(['1', '2', '3', '4', '5']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();

        const out = cap.output();
        expect(out).not.toContain('1\x1B[K');
        expect(out).not.toContain('2\x1B[K');
        expect(out).toContain('3\x1B[K\n4\x1B[K\n5\x1B[K');
    });

    it('truncates lines to the terminal width so they cannot soft-wrap', () => {
        const cap = captureOutput({ columns: 10 });
        const app = linesApp(['a'.repeat(25)]);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();

        expect(cap.output()).toContain('a'.repeat(10) + '\x1B[K');
        expect(cap.output()).not.toContain('a'.repeat(11));
    });

    it('persists the final frame on unmount and drops the cursor below it', () => {
        const cap = captureOutput();
        const app = linesApp(['result: 42']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();
        cap.clear();

        handle.unmount();

        // No repaint/erase of the live region — just newline, reset, show cursor.
        expect(cap.output()).toBe('\n\x1b[0m\x1B[?25h');
    });

    it('flushes a pending batched frame before persisting on unmount', () => {
        const cap = captureOutput();
        const app = linesApp(['working...']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();

        app.setLines(['done']); // schedules, but we unmount before the timer fires
        cap.clear();
        handle.unmount();

        const out = cap.output();
        expect(out).toContain('done\x1B[K');
        expect(out.endsWith('\n\x1b[0m\x1B[?25h')).toBe(true);
    });
});
