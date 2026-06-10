import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, setOutputTarget } from '../src';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('resize handling', () => {
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

    it('repaints an inline app to the new width on resize', () => {
        const cap = captureOutput({ columns: 20 });
        const app = linesApp(['x'.repeat(30)]);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();
        expect(cap.output()).toContain('x'.repeat(20) + '\x1B[K');

        cap.clear();
        cap.target.columns = 8;
        process.stdout.emit('resize');
        flush();

        expect(cap.output()).toContain('x'.repeat(8) + '\x1B[K');
        expect(cap.output()).not.toContain('x'.repeat(9));
    });

    it('clears and repaints a fullscreen app on resize', () => {
        const cap = captureOutput();
        const app = linesApp(['full']);
        unmount = renderTerminal(app.vnode, { mode: 'fullscreen', patchConsole: false }).unmount;
        flush();
        cap.clear();

        process.stdout.emit('resize');
        flush();

        const out = cap.output();
        expect(out).toContain('\x1B[2J\x1B[H'); // immediate clear (alt buffer, safe)
        expect(out).toContain('full');
    });

    it('stops listening after unmount', () => {
        const cap = captureOutput();
        const app = linesApp(['gone']);
        const handle = renderTerminal(app.vnode, { patchConsole: false });
        flush();
        handle.unmount();
        cap.clear();

        process.stdout.emit('resize');
        flush();
        expect(cap.output()).toBe('');
    });
});
