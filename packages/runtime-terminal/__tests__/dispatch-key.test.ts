import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, setOutputTarget, onKey, dispatchKey } from '../src';
import { registerFocusable, unregisterFocusable, focusState } from '../src/focus';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);
const CTRL_C = String.fromCharCode(3); // \u0003

describe('dispatchKey', () => {
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

    it('reaches onKey subscribers through the real input path', () => {
        captureOutput();
        const app = linesApp(['ui']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();

        const seen: string[] = [];
        const off = onKey((k) => seen.push(k));
        dispatchKey('x');
        dispatchKey('\x1b[B');
        off();
        expect(seen).toEqual(['x', '\x1b[B']);
    });

    it('Tab cycles the focus registry', () => {
        captureOutput();
        const app = linesApp(['ui']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();

        registerFocusable('first');
        registerFocusable('second');
        expect(focusState.activeId).toBe('first');
        dispatchKey('\t');
        expect(focusState.activeId).toBe('second');
        unregisterFocusable('first');
        unregisterFocusable('second');
    });

    it('Ctrl+C with exitOnCtrlC:false reaches handlers and does not exit', () => {
        captureOutput();
        const app = linesApp(['prompt']);
        unmount = renderTerminal(app.vnode, { exitOnCtrlC: false, patchConsole: false }).unmount;
        flush();

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        const seen: string[] = [];
        const off = onKey((k) => seen.push(k));
        dispatchKey(CTRL_C);
        off();

        expect(seen).toEqual([CTRL_C]);
        expect(exitSpy).not.toHaveBeenCalled();
        exitSpy.mockRestore();
    });

    it('Ctrl+C by default tears down and exits 130', () => {
        const cap = captureOutput();
        const app = linesApp(['app']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();
        cap.clear();

        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        dispatchKey(CTRL_C);

        expect(exitSpy).toHaveBeenCalledWith(130);
        expect(cap.output()).toContain('\x1B[?25h'); // cursor restored by teardown
        exitSpy.mockRestore();
        unmount = null; // already torn down
    });
});
