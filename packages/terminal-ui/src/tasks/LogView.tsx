/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, signal, type Define } from '@sigx/runtime-core';
import {
    onKey, registerFocusable, unregisterFocusable, focusState, focus, resolveColor,
    getTerminalSize, truncateToWidth, displayWidth, READY_DELAY_MS,
} from '@sigx/terminal-zero';
import type { LogStore } from './logStore';

/**
 * Focusable, scrollable log viewer — the "logs tab" of a persistent dev TUI.
 * Follows the tail by default; scrolling up pauses follow and pins the
 * visible window even while the stream keeps growing; scrolling back to the
 * bottom (or End / `f`) re-engages follow.
 *
 * Keys while focused: ↑/k ↓/j scroll one line, PgUp/PgDn a page,
 * Home jump to the oldest, End jump to the tail (re-follows), `f` toggle.
 */
export const LogView = component<
    Define.Prop<'store', LogStore, false> &
    Define.Prop<'lines', string[], false> &
    Define.Prop<'height', number, false> &
    Define.Prop<'width', number, false> &
    Define.Prop<'title', string, false> &
    Define.Prop<'autofocus', boolean, false>
>(({ props }) => {
    const id = Math.random().toString(36).slice(2);
    let isReady = false;
    const isFocused = () => focusState.activeId === id;

    // `offset` counts lines back from the tail. `anchorTotal` records the
    // stream length when the offset was set, so while paused the window stays
    // pinned to the same CONTENT as new lines arrive (drift compensation) —
    // without writing signals during render.
    const state = signal({ offset: 0, follow: true, anchorTotal: 0 });

    const src = () => (props.store ? props.store.lines() : (props.lines ?? []));
    const getHeight = () => props.height || 10;

    const effOffset = (total: number) => {
        if (state.follow) return 0;
        const drifted = state.offset + Math.max(0, total - state.anchorTotal);
        return Math.min(Math.max(0, drifted), Math.max(0, total - getHeight()));
    };

    const setOffset = (next: number, total: number) => {
        const max = Math.max(0, total - getHeight());
        const clamped = Math.min(Math.max(0, next), max);
        state.offset = clamped;
        state.anchorTotal = total;
        state.follow = clamped === 0;
    };

    const handleKey = (key: string) => {
        if (!isFocused() || !isReady) return;
        const total = src().length;
        const cur = effOffset(total);
        const page = getHeight();

        if (key === '\x1B[A' || key === 'k') {
            setOffset(cur + 1, total);
            return;
        }
        if (key === '\x1B[B' || key === 'j') {
            setOffset(cur - 1, total);
            return;
        }
        if (key === '\x1b[5~') { // PgUp
            setOffset(cur + page, total);
            return;
        }
        if (key === '\x1b[6~') { // PgDn
            setOffset(cur - page, total);
            return;
        }
        if (key === '\x1b[H' || key === '\x1b[1~') { // Home → oldest
            setOffset(Number.MAX_SAFE_INTEGER, total);
            return;
        }
        if (key === '\x1b[F' || key === '\x1b[4~') { // End → tail, re-follow
            setOffset(0, total);
            return;
        }
        if (key === 'f') {
            if (state.follow) {
                // Pause in place.
                state.offset = cur;
                state.anchorTotal = total;
                state.follow = false;
            } else {
                setOffset(0, total);
            }
        }
    };

    let keyCleanup: (() => void) | null = null;

    onMounted(() => {
        registerFocusable(id);
        if (props.autofocus) focus(id);
        keyCleanup = onKey(handleKey);
        setTimeout(() => { isReady = true; }, READY_DELAY_MS);
    });

    onUnmounted(() => {
        if (keyCleanup) keyCleanup();
        unregisterFocusable(id);
    });

    return () => {
        const focused = isFocused();
        const height = getHeight();
        const width = props.width || Math.max(20, getTerminalSize().columns - 4);
        const all = src();
        const total = all.length;
        const off = effOffset(total);
        const end = total - off;
        const start = Math.max(0, end - height);

        // The box sizes itself to its widest line, so pad every line to the
        // interior width — the viewport then spans the full configured width
        // (terminal width by default) instead of hugging its content.
        const inner = Math.max(1, width - 4); // rounded border (2) + padX (2)
        const window = all.slice(start, end).map((line) => {
            const cut = truncateToWidth(line, inner);
            return cut + ' '.repeat(Math.max(0, inner - displayWidth(cut)));
        });
        while (window.length < height) window.push(' '.repeat(inner)); // stable frame height

        const rows = window.flatMap((line, i) => {
            const node = <text color={resolveColor('dim')}>{line}</text>;
            return i > 0 ? [<br />, node] : [node];
        });

        return (
            <box>
                <box
                    border="rounded"
                    borderColor={resolveColor(focused ? 'accent' : 'line')}
                    label={props.title}
                    labelColor={resolveColor(focused ? 'accent' : 'dim')}
                    padX={1}
                >
                    {rows}
                </box>
                <box>
                    <text color={resolveColor('dim')}>  {total ? `${start + 1}–${end}/${total}` : '0/0'} · </text>
                    {state.follow
                        ? <text color={resolveColor('dim')}>following</text>
                        : <text color={resolveColor('warn')}>paused</text>}
                </box>
            </box>
        );
    };
}, { name: 'LogView' });

export default LogView;
