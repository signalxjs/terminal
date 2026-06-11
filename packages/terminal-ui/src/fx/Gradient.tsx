/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { resolveColor, getColorDepth, gradient, getTick, subscribeTicker } from '@sigx/terminal-zero';
import { colorizeByIndex, resolveStops, pingPong } from './paint';
import type { GradientPreset } from './presets';

/**
 * Text colored across a multi-stop gradient, one sample per character.
 * Stops are theme tokens or hex; `animate` scrolls the gradient through the
 * text (ping-pong, seamless). Degrades by color depth: a single accent color
 * at ansi16 (per-char nearest-16 is speckle noise), plain text at none.
 */
export const Gradient = component<
    Define.Prop<"text", string, true> &
    Define.Prop<"colors", string[], false> &
    Define.Prop<"preset", GradientPreset, false> &
    Define.Prop<"animate", boolean, false> &
    Define.Prop<"speed", number, false>
>(({ props }) => {
    let unsub: (() => void) | null = null;

    onMounted(() => {
        if (props.animate) unsub = subscribeTicker();
    });
    onUnmounted(() => { unsub?.(); });

    return () => {
        // Block root (<box>), like every other component in the library — an
        // inline root glues onto whatever line precedes it. For inline
        // gradient strings, use colorizeByIndex/paintToken directly.
        const text = props.text ?? '';
        const depth = getColorDepth();
        if (depth === 'none') return <box><text>{text}</text></box>;
        if (depth === 'ansi16') return <box><text color={resolveColor('accent')}>{text}</text></box>;

        const stops = resolveStops(props.colors, props.preset);
        const len = [...text].length;
        const samples = gradient(stops, Math.max(len, 2));

        if (!props.animate) {
            return <box><text>{colorizeByIndex(text, (i) => samples[Math.min(i, samples.length - 1)])}</text></box>;
        }
        const cycle = pingPong(samples);
        const phase = Math.floor(getTick() * (props.speed || 1));
        return <box><text>{colorizeByIndex(text, (i) => cycle[(i + phase) % cycle.length])}</text></box>;
    };
}, { name: 'Gradient' });

export default Gradient;
