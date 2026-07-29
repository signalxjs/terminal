/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { trend, resolveColor, GLYPHS } from '@sigx/terminal-zero';

/**
 * A value with its direction of travel against the previous reading: `▲`, `▼`
 * or `·`.
 *
 * **`polarity` is not decoration.** Whether "up" is good news depends entirely
 * on the metric: rising latency is a problem, rising throughput is not. A
 * component that hardcoded `▲ = warning` would be lying about half the numbers
 * on a dashboard, so it has to be said out loud:
 *
 * - `higher-is-worse` (default) — up is `warn`, down is `success`. Latency,
 *   error rate, queue depth, memory.
 * - `higher-is-better` — up is `success`, down is `warn`. Throughput, hit rate,
 *   healthy replicas.
 * - `neutral` — direction only, no judgement.
 *
 * A `null` on either side is a gap, not a direction: comparing across a counter
 * reset would report a crash that never happened.
 */
export const Trend = component<
    Define.Prop<"current", number | null, true> &
    Define.Prop<"previous", number | null, false> &
    Define.Prop<"value", string, false> &
    Define.Prop<"polarity", 'higher-is-worse' | 'higher-is-better' | 'neutral', false> &
    Define.Prop<"color", string, false>
>(({ props }) => {
    return () => {
        const direction = trend(props.current ?? null, props.previous ?? null);
        const polarity = props.polarity || 'higher-is-worse';

        const glyph = direction === 1 ? GLYPHS.up : direction === -1 ? GLYPHS.down : GLYPHS.gap;
        const token = direction === 0 || polarity === 'neutral'
            ? 'dim'
            : polarity === 'higher-is-better'
                ? (direction === 1 ? 'success' : 'warn')
                : (direction === 1 ? 'warn' : 'success');

        return (
            <box>
                {props.value !== undefined
                    ? <text color={resolveColor(props.color || 'fg')}>{props.value}</text>
                    : undefined}
                <text color={resolveColor(token)}>{props.value !== undefined ? ` ${glyph}` : glyph}</text>
            </box>
        );
    };
}, { name: 'Trend' });

export default Trend;
