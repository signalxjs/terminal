import { describe, it, expect, beforeEach } from 'vitest';
import { effect, signal } from '@sigx/reactivity';
import {
    focus,
    focusNext,
    focusPrev,
    focusState,
    registerFocusable,
    unregisterFocusable
} from '../src/focus';

// Reset module-level focus state between tests. `focusState` and the internal
// `focusableIds` set are module singletons, so each test has to undo whatever
// the previous one left behind.
function resetFocus() {
    // unregister every focusable that may still be registered. Repeatedly
    // unregistering the current activeId drains the set.
    while (focusState.activeId !== null) {
        unregisterFocusable(focusState.activeId);
    }
}

beforeEach(() => {
    resetFocus();
});

describe('focus helpers — no effect-dep leakage', () => {
    // The wizard bug: a child component's `onUnmounted` hook calls
    // `unregisterFocusable`. That helper does a read-then-write of
    // `focusState.activeId`. If the read is tracked, whatever effect is
    // currently running (the parent's render effect, for instance) will be
    // subscribed to `focusState.activeId` and then re-triggered synchronously
    // by the write — corrupting the in-flight render.
    //
    // These tests pin down the contract that focus-helper calls inside an
    // effect must not pollute the effect's dep set.

    it('unregisterFocusable does not subscribe the calling effect to focusState', () => {
        registerFocusable('a');
        registerFocusable('b');
        expect(focusState.activeId).toBe('a');

        let runs = 0;
        const trigger = signal({ tick: 0 });
        effect(() => {
            runs++;
            // Read trigger so the effect has at least one tracked dep.
            void trigger.tick;
            if (trigger.tick === 1) {
                // Simulate the child unmount path during the parent's run.
                unregisterFocusable('a');
            }
        });

        expect(runs).toBe(1);
        trigger.tick = 1;
        const runsAfterUnmount = runs;
        expect(runsAfterUnmount).toBe(2);

        // Now mutate focusState from the outside. The effect must NOT re-run
        // — it never legitimately read focusState.
        focusState.activeId = 'b';
        expect(runs).toBe(runsAfterUnmount);
    });

    it('registerFocusable does not subscribe the calling effect to focusState', () => {
        let runs = 0;
        const trigger = signal({ tick: 0 });
        effect(() => {
            runs++;
            void trigger.tick;
            if (trigger.tick === 1) {
                // First register makes activeId go from null -> 'a' (a write
                // path), but the helper also reads activeId. Inside an effect
                // that read must not be tracked.
                registerFocusable('a');
            }
        });

        expect(runs).toBe(1);
        trigger.tick = 1;
        const runsAfterRegister = runs;
        expect(runsAfterRegister).toBe(2);

        focusState.activeId = 'something-else';
        expect(runs).toBe(runsAfterRegister);
    });

    it('focus/focusNext/focusPrev do not subscribe the calling effect to focusState', () => {
        registerFocusable('a');
        registerFocusable('b');
        registerFocusable('c');

        let runs = 0;
        const trigger = signal({ phase: 0 });
        effect(() => {
            runs++;
            void trigger.phase;
            if (trigger.phase === 1) focus('b');
            else if (trigger.phase === 2) focusNext();
            else if (trigger.phase === 3) focusPrev();
        });

        expect(runs).toBe(1);
        trigger.phase = 1;
        trigger.phase = 2;
        trigger.phase = 3;
        const runsAfter = runs;

        // Random external mutation must not re-run the effect.
        focusState.activeId = 'a';
        focusState.activeId = 'b';
        expect(runs).toBe(runsAfter);
    });
});
