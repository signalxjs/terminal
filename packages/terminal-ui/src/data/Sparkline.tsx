/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import {
    renderSparkline, resolveColor, hexToSGR, fitCell,
    type SparkVariant,
} from '@sigx/terminal-zero';
import { colorAt, type Threshold } from './thresholds';

/**
 * A time series in one line (or a few) — the "is this going up?" glyph a
 * dashboard needs and `ProgressBar` cannot give, since that is a single ratio.
 *
 * Three things it deliberately does not do, because each is a way these lie:
 * it does **not** anchor the scale to the series minimum (pass
 * `baseline="min"` if you really want that — a flat line at 1000 req/s would
 * otherwise draw as a mountain range); it does **not** let a tiny non-zero
 * value round away to the baseline; and it does **not** draw a gap as a zero —
 * `null` renders as `·`, because a counter reset and an idle period are
 * different facts.
 *
 * `variant="braille"` packs two samples per cell for double the horizontal
 * density; `height` buys proportionally more vertical levels.
 */
export const Sparkline = component<
    Define.Prop<"values", (number | null)[], true> &
    Define.Prop<"width", number, false> &
    Define.Prop<"height", number, false> &
    Define.Prop<"max", number, false> &
    Define.Prop<"baseline", number | 'min', false> &
    Define.Prop<"variant", SparkVariant, false> &
    Define.Prop<"label", string, false> &
    Define.Prop<"labelWidth", number, false> &
    Define.Prop<"value", string, false> &
    Define.Prop<"color", string, false> &
    Define.Prop<"thresholds", Threshold[], false> &
    Define.Prop<"pad", boolean, false>
>(({ props }) => {
    return () => {
        const values = props.values || [];
        const { rows, cellRatios } = renderSparkline(values, {
            width: props.width ?? 24,
            height: props.height,
            max: props.max,
            baseline: props.baseline,
            variant: props.variant,
            pad: props.pad !== false,
        });

        const base = props.color || 'accent';
        const thresholds = props.thresholds;
        const dim = resolveColor('dim');

        // One text node per line: a single run-length SGR string beats one vdom
        // node per cell, which would repaint the whole series every tick.
        const paint = (line: string): string => {
            if (!thresholds || thresholds.length === 0) return '';
            let out = '';
            let last: string | null = null;
            const chars = [...line];
            for (let i = 0; i < chars.length; i++) {
                const hex = resolveColor(colorAt(thresholds, cellRatios[i] ?? null, base));
                if (hex !== last) {
                    out += hexToSGR(hex);
                    last = hex;
                }
                out += chars[i];
            }
            return last === null ? line : out + '\x1b[39m';
        };

        const labelWidth = props.labelWidth ?? 12;
        const gutter = props.label ? ' '.repeat(labelWidth + 1) : '';
        const series = (line: string) => thresholds?.length
            ? <text>{paint(line)}</text>
            : <text color={resolveColor(base)}>{line}</text>;

        // The label and the current value sit on the BASELINE row, with the
        // rows above indented to match — so a two-row sparkline reads as one
        // chart rather than as a stack with a caption underneath.
        const lines = rows.flatMap((line, i) => {
            const last = i === rows.length - 1;
            const node = [
                props.label
                    ? <text color={dim}>{last ? `${fitCell(props.label, labelWidth)} ` : gutter}</text>
                    : undefined,
                series(line),
                last && props.value ? <text color={dim}> {props.value}</text> : undefined,
            ];
            return i > 0 ? [<br />, ...node] : node;
        });

        // A single row stays a plain inline box, so it can sit in a status line
        // next to other content.
        return <box>{lines}</box>;
    };
}, { name: 'Sparkline' });

export default Sparkline;
