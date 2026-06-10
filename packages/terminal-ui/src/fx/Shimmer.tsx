/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { resolveColor, getColorDepth, mixHex, getTick, subscribeTicker } from '@sigx/terminal-zero';
import { colorizeByIndex } from './paint';

/**
 * A highlight sweep travelling across muted text — the "thinking…" effect.
 * `color` is the base (default `dim`), `highlight` the sweep peak (default
 * `fg`), `width` the sweep half-width in characters. Static base color at
 * ansi16/none depth.
 */
export const Shimmer = component<
    Define.Prop<"text", string, true> &
    Define.Prop<"color", string, false> &
    Define.Prop<"highlight", string, false> &
    Define.Prop<"width", number, false> &
    Define.Prop<"speed", number, false>
>(({ props }) => {
    let unsub: (() => void) | null = null;

    onMounted(() => { unsub = subscribeTicker(); });
    onUnmounted(() => { unsub?.(); });

    return () => {
        const text = props.text ?? '';
        const baseToken = props.color || 'dim';
        const depth = getColorDepth();
        if (depth === 'none') return <text>{text}</text>;
        if (depth === 'ansi16') return <text color={resolveColor(baseToken)}>{text}</text>;

        const base = resolveColor(baseToken);
        const highlight = resolveColor(props.highlight || 'fg');
        const w = Math.max(1, props.width || 3);
        const len = [...text].length;
        // The sweep runs off both ends so the text rests between passes.
        const span = len + 2 * w;
        const pos = (getTick() * (props.speed || 1)) % span - w;

        return (
            <text>
                {colorizeByIndex(text, (i) => {
                    const d = Math.abs(i - pos);
                    return d < w ? mixHex(base, highlight, 1 - d / w) : base;
                })}
            </text>
        );
    };
}, { name: 'Shimmer' });

export default Shimmer;
