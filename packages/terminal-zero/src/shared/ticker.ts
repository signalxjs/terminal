/**
 * Shared animation ticker: ONE refcounted interval drives every animated
 * component (spinners, gradients, shimmers), instead of a timer per instance.
 * Frozen at 0 when stdout is not a TTY, so piped/CI runs render frame zero
 * everywhere — deterministic plain output, no wasted wakeups.
 */
import { signal } from '@sigx/reactivity';
import { getOutputTarget } from '@sigx/runtime-terminal';

/** Global animation granularity, ms. Components derive slower rates from it. */
export const TICK_MS = 80;

const tick = signal({ t: 0 });
let timer: ReturnType<typeof setInterval> | null = null;
let refs = 0;

/** Reactive frame counter — read it in a render function to re-render per tick. */
export function getTick(): number {
    return tick.t;
}

/**
 * Refcounted subscription: the first subscriber starts the interval, the last
 * unsubscribe stops it. Returns an idempotent unsubscribe function.
 */
export function subscribeTicker(): () => void {
    if (!getOutputTarget().isTTY) return () => {};
    refs++;
    if (!timer) {
        timer = setInterval(() => { tick.t++; }, TICK_MS);
    }
    let active = true;
    return () => {
        if (!active) return;
        active = false;
        refs--;
        if (refs === 0 && timer) {
            clearInterval(timer);
            timer = null;
        }
    };
}
