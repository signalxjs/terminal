/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import { onKey, resolveColor, GLYPHS } from '@sigx/terminal-zero';

export interface SuggestionItem {
    value: string;
    /** Defaults to value. */
    label?: string;
    description?: string;
}

/**
 * Intellisense popup for an input: mount it to open it (typically rendered
 * conditionally under a TextArea while the value matches a trigger like `/`).
 * It registers an OVERLAY-layer key handler that consumes only navigation
 * keys — ↑/↓ move, Tab/Enter accept the highlighted item, Esc dismisses —
 * while printable characters, backspace, etc. fall through to the input
 * below, so filtering keeps working as the user types.
 */
export const SuggestionList = component<
    Define.Prop<'items', SuggestionItem[], true> &
    Define.Prop<'maxVisible', number, false> &
    Define.Event<'accept', string> &
    Define.Event<'dismiss'>
>(({ props, emit }) => {
    const ESC = String.fromCharCode(27);
    const state = signal({ cursor: 0, itemsKey: '' });

    const items = () => props.items ?? [];
    const syncCursor = () => {
        const key = items().map((i) => i.value).join('\x00');
        if (key !== state.itemsKey) {
            state.itemsKey = key;
            state.cursor = 0;
        }
        return Math.min(state.cursor, Math.max(0, items().length - 1));
    };

    const handleKey = (key: string): boolean | void => {
        const list = items();
        if (key === ESC + '[A') {
            if (list.length === 0) return true;
            state.cursor = syncCursor() > 0 ? syncCursor() - 1 : list.length - 1;
            return true;
        }
        if (key === ESC + '[B') {
            if (list.length === 0) return true;
            state.cursor = syncCursor() < list.length - 1 ? syncCursor() + 1 : 0;
            return true;
        }
        if (key === '\t' || key === '\r') {
            if (list.length === 0) return; // nothing to accept — let it fall through
            emit('accept', list[syncCursor()].value);
            return true;
        }
        if (key === ESC) {
            emit('dismiss');
            return true;
        }
        // Everything else (printables, backspace, \n) falls through to the
        // input below so filtering keeps working.
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        // No READY_DELAY: this mounts in reaction to a key that was already
        // dispatched — the very next key is legitimately for the list.
        keyCleanup = onKey(handleKey, { layer: 'overlay' });
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
    });

    return () => {
        const list = items();
        const cursor = syncCursor();
        const maxVisible = Math.max(1, props.maxVisible || 6);

        let top = 0;
        if (list.length > maxVisible) {
            top = Math.min(Math.max(0, cursor - maxVisible + 1), list.length - maxVisible);
        }
        const windowed = list.slice(top, top + maxVisible);

        return (
            <box>
                {windowed.map((item, i) => {
                    const onCursor = top + i === cursor;
                    return (
                        <box>
                            <text color={resolveColor(onCursor ? 'accent' : 'faint')}>{onCursor ? GLYPHS.cursor : ' '} </text>
                            <text color={resolveColor(onCursor ? 'accent' : 'fg')}>{item.label ?? item.value}</text>
                            {item.description && <text color={resolveColor('dim')}>  {item.description}</text>}
                        </box>
                    );
                })}
                {list.length > maxVisible && (
                    <box><text color={resolveColor('faint')}>  {cursor + 1}/{list.length}</text></box>
                )}
            </box>
        );
    };
}, { name: 'SuggestionList' });

export default SuggestionList;
