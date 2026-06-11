/**
 * Reactive view/navigation stack — the headless half of screen navigation.
 * Push a view (a settings page, a model picker), pop back with Esc:
 *
 *     const views = createViewStack<'shell' | 'model'>('shell');
 *     onKey((key) => {
 *         if (isEsc(key) && views.depth() > 1) {
 *             views.pop();
 *             return true;            // consume — nothing below sees Esc
 *         }
 *     }, { layer: 'view' });
 *     // render: views.current() === 'model' ? <ModelPicker/> : <Shell/>
 */
import { signal } from '@sigx/reactivity';

export interface ViewStack<T> {
    push(view: T): void;
    /** Pop the current view. Returns false (and stays) at the root. */
    pop(): boolean;
    /** Swap the current view without growing the stack. */
    replace(view: T): void;
    /** The top of the stack. Reactive. */
    current(): T;
    /** Stack size (root = 1). Reactive. */
    depth(): number;
}

export function createViewStack<T>(root: T): ViewStack<T> {
    // The array is replaced wholesale on every mutation so signal subscribers
    // re-run reliably.
    const state = signal({ stack: [root] as T[] });

    return {
        push(view: T) {
            state.stack = [...state.stack, view];
        },
        pop(): boolean {
            if (state.stack.length <= 1) return false;
            state.stack = state.stack.slice(0, -1);
            return true;
        },
        replace(view: T) {
            state.stack = [...state.stack.slice(0, -1), view];
        },
        current(): T {
            return state.stack[state.stack.length - 1];
        },
        depth(): number {
            return state.stack.length;
        },
    };
}
