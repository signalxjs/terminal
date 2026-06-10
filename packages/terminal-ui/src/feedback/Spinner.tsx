/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { resolveColor, GLYPHS, SPINNERS, getTick, subscribeTicker, TICK_MS } from '@sigx/terminal-zero';

/**
 * Animated spinner that resolves to a success check when `done` (or a danger
 * cross when `failed`; `done` wins). `variant` selects a frame set from
 * SPINNERS ('dots' default; note 'moon' glyphs are 2 cells wide). Driven by
 * the shared ticker — one interval for every animated component, frozen on
 * non-TTY output.
 */
export const Spinner = component<
    Define.Prop<"label", string, false> &
    Define.Prop<"done", boolean, false> &
    Define.Prop<"failed", boolean, false> &
    Define.Prop<"interval", number, false> &
    Define.Prop<"variant", keyof typeof SPINNERS, false> &
    Define.Prop<"color", string, false>
>(({ props }) => {
    let unsub: (() => void) | null = null;

    onMounted(() => { unsub = subscribeTicker(); });
    onUnmounted(() => { unsub?.(); });

    return () => {
        const done = !!props.done;
        const failed = !done && !!props.failed;
        const frames = SPINNERS[props.variant || 'dots'] ?? SPINNERS.dots;
        // `interval` is honored in multiples of the shared tick (80ms).
        const step = Math.max(1, Math.round((props.interval || TICK_MS) / TICK_MS));
        const glyph = done ? GLYPHS.check
            : failed ? GLYPHS.cross
            : frames[Math.floor(getTick() / step) % frames.length];
        const glyphColor = resolveColor(done ? 'success' : failed ? 'danger' : (props.color || 'accent'));
        return (
            <box>
                <text color={glyphColor}>{glyph}</text>
                {props.label && <text color={resolveColor(failed ? 'danger' : 'fg')}> {props.label}</text>}
            </box>
        );
    };
}, { name: 'Spinner' });

export default Spinner;
