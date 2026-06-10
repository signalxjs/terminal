import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, writeStatic, printStatic, setOutputTarget } from '../src';
import { patchConsoleTo, restoreConsole } from '../src/lifecycle';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('static output', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        unmount?.();
        unmount = null;
        restoreConsole();
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('writes straight through when nothing is mounted', () => {
        const cap = captureOutput();
        writeStatic('plain line');
        expect(cap.output()).toBe('plain line\n');
    });

    it('erases the live region, emits the lines, and repaints — one ordered burst', () => {
        const cap = captureOutput();
        const app = linesApp(['spinner']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();
        cap.clear();

        writeStatic('step 1 done');

        // Erase the 1-line region, static line scrolls into history, repaint below.
        expect(cap.output()).toBe('\r\x1B[J' + 'step 1 done\x1B[K\n' + 'spinner\x1B[K\x1B[J');
    });

    it('cancels a pending batched frame so the burst cannot be interleaved', () => {
        const cap = captureOutput();
        const app = linesApp(['v1']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();

        app.setLines(['v2']); // schedules a frame
        cap.clear();
        writeStatic('log'); // must absorb it, not race it

        const out = cap.output();
        expect(out).toBe('\r\x1B[J' + 'log\x1B[K\n' + 'v2\x1B[K\x1B[J');
        // The cancelled timer must not fire a duplicate repaint afterwards.
        cap.clear();
        flush();
        expect(cap.output()).toBe('');
    });

    it('printStatic is an alias of writeStatic', () => {
        expect(printStatic).toBe(writeStatic);
    });

    it('routes console methods through static output while patched', () => {
        const cap = captureOutput();
        const app = linesApp(['ui']);
        unmount = renderTerminal(app.vnode, { patchConsole: true }).unmount;
        flush();
        cap.clear();

        console.log('library %s', 'noise');

        const out = cap.output();
        expect(out).toContain('library noise\x1B[K\n');
        expect(out.endsWith('ui\x1B[K\x1B[J')).toBe(true);

        unmount?.();
        unmount = null;
        cap.clear();
        console.log('after unmount');
        // Restored: goes to the real console, not our output target.
        expect(cap.output()).toBe('');
    });

    it('re-entrant console writes fall through to the real console', () => {
        const calls: string[] = [];
        const sink = (text: string) => {
            calls.push(text);
            console.log('from inside the sink'); // must not recurse
        };
        patchConsoleTo(sink);
        console.log('outer');
        restoreConsole();

        expect(calls).toEqual(['outer']);
    });
});
