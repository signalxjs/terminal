import { signal, untrack } from '@sigx/reactivity';

const focusableIds = new Set<string>();
export const focusState = signal({ activeId: null as string | null });

export function registerFocusable(id: string) {
    focusableIds.add(id);
    untrack(() => {
        if (focusState.activeId === null) {
            focusState.activeId = id;
        }
    });
}

export function unregisterFocusable(id: string) {
    focusableIds.delete(id);
    untrack(() => {
        if (focusState.activeId === id) {
            focusState.activeId = null;
            // Try to focus another one
            if (focusableIds.size > 0) {
                focusState.activeId = focusableIds.values().next().value || null;
            }
        }
    });
}

export function focus(id: string) {
    if (focusableIds.has(id)) {
        untrack(() => {
            focusState.activeId = id;
        });
    }
}

export function focusNext() {
    if (focusableIds.size === 0) return;
    const ids = Array.from(focusableIds);
    untrack(() => {
        const currentIndex = focusState.activeId ? ids.indexOf(focusState.activeId) : -1;
        const nextIndex = (currentIndex + 1) % ids.length;
        focusState.activeId = ids[nextIndex];
    });
}

export function focusPrev() {
    if (focusableIds.size === 0) return;
    const ids = Array.from(focusableIds);
    untrack(() => {
        const currentIndex = focusState.activeId ? ids.indexOf(focusState.activeId) : -1;
        const prevIndex = (currentIndex - 1 + ids.length) % ids.length;
        focusState.activeId = ids[prevIndex];
    });
}
