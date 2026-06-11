import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderTerminal, setOutputTarget, onKey, dispatchKey } from '../src';
import { registerFocusable, unregisterFocusable, focusState } from '../src/focus';
import { captureOutput, linesApp } from './harness';

const flush = () => vi.advanceTimersByTime(20);

describe('layered key dispatch', () => {
    let unmount: (() => void) | null = null;
    let cleanups: Array<() => void> = [];
    const sub = (...args: Parameters<typeof onKey>) => {
        const off = onKey(...args);
        cleanups.push(off);
        return off;
    };

    beforeEach(() => {
        vi.useFakeTimers();
        captureOutput();
        const app = linesApp(['ui']);
        unmount = renderTerminal(app.vnode, { patchConsole: false }).unmount;
        flush();
    });
    afterEach(() => {
        cleanups.forEach((off) => off());
        cleanups = [];
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('dispatches overlay → control → view → global in order', () => {
        const order: string[] = [];
        sub(() => { order.push('global'); }, { layer: 'global' });
        sub(() => { order.push('view'); }, { layer: 'view' });
        sub(() => { order.push('control'); }); // default layer
        sub(() => { order.push('overlay'); }, { layer: 'overlay' });
        dispatchKey('x');
        expect(order).toEqual(['overlay', 'control', 'view', 'global']);
    });

    it('strict true consumes and stops lower layers', () => {
        const seen: string[] = [];
        sub(() => { seen.push('overlay'); return true; }, { layer: 'overlay' });
        sub(() => { seen.push('control'); });
        dispatchKey('x');
        expect(seen).toEqual(['overlay']);
    });

    it('a truthy-but-not-true return does NOT consume', () => {
        const seen: string[] = [];
        sub((k) => seen.push(k) as unknown as boolean, { layer: 'overlay' }); // push returns a number
        const after: string[] = [];
        sub((k) => { after.push(k); });
        dispatchKey('x');
        expect(seen).toEqual(['x']);
        expect(after).toEqual(['x']);
    });

    it('within a layer, handlers run in registration order', () => {
        const order: string[] = [];
        sub(() => { order.push('first'); });
        sub(() => { order.push('second'); });
        dispatchKey('x');
        expect(order).toEqual(['first', 'second']);
    });

    it('Tab cycles focus when nothing consumes it', () => {
        registerFocusable('a');
        registerFocusable('b');
        expect(focusState.activeId).toBe('a');
        dispatchKey('\t');
        expect(focusState.activeId).toBe('b');
        dispatchKey('\x1b[Z');
        expect(focusState.activeId).toBe('a');
        unregisterFocusable('a');
        unregisterFocusable('b');
    });

    it('an overlay handler can consume Tab before focus cycling', () => {
        registerFocusable('a');
        registerFocusable('b');
        const seen: string[] = [];
        sub((k) => {
            if (k === '\t') {
                seen.push('tab-consumed');
                return true;
            }
        }, { layer: 'overlay' });
        dispatchKey('\t');
        expect(seen).toEqual(['tab-consumed']);
        expect(focusState.activeId).toBe('a'); // focus did NOT move
        unregisterFocusable('a');
        unregisterFocusable('b');
    });

    it('unsubscribing inside a handler does not skip or crash dispatch', () => {
        const seen: string[] = [];
        const offA = onKey(() => {
            seen.push('a');
            offA(); // unsubscribe self mid-dispatch
        });
        cleanups.push(offA);
        sub(() => { seen.push('b'); });
        dispatchKey('x');
        expect(seen).toEqual(['a', 'b']);
        dispatchKey('y');
        expect(seen).toEqual(['a', 'b', 'b']); // a is gone
    });
});
