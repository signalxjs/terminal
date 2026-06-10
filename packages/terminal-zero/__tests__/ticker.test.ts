import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setOutputTarget, type OutputTarget } from '@sigx/runtime-terminal';
import { getTick, subscribeTicker, TICK_MS } from '../src/shared/ticker';

function fakeTarget(isTTY: boolean): OutputTarget {
    return { write: () => {}, columns: 80, rows: 24, isTTY };
}

describe('shared animation ticker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    it('advances while subscribed on a TTY', () => {
        setOutputTarget(fakeTarget(true));
        const start = getTick();
        const unsub = subscribeTicker();
        vi.advanceTimersByTime(TICK_MS * 3);
        expect(getTick()).toBe(start + 3);
        unsub();
    });

    it('stays frozen when output is not a TTY', () => {
        setOutputTarget(fakeTarget(false));
        const start = getTick();
        const unsub = subscribeTicker();
        vi.advanceTimersByTime(TICK_MS * 10);
        expect(getTick()).toBe(start);
        unsub();
    });

    it('stops the interval after the last unsubscribe', () => {
        setOutputTarget(fakeTarget(true));
        const a = subscribeTicker();
        const b = subscribeTicker();
        a();
        vi.advanceTimersByTime(TICK_MS * 2);
        const afterA = getTick();
        expect(afterA).toBeGreaterThan(0); // b still keeps it alive
        b();
        vi.advanceTimersByTime(TICK_MS * 5);
        expect(getTick()).toBe(afterA); // fully stopped
    });

    it('double-unsubscribe is safe', () => {
        setOutputTarget(fakeTarget(true));
        const a = subscribeTicker();
        const b = subscribeTicker();
        a();
        a(); // second call must not decrement again
        vi.advanceTimersByTime(TICK_MS * 2);
        const ticked = getTick();
        b();
        expect(ticked).toBeGreaterThan(0);
    });
});
