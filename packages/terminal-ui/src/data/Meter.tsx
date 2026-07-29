/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { meter, resolveColor, fitCell } from '@sigx/terminal-zero';
import { colorAt, type Threshold } from './thresholds';

/**
 * A bare gauge: `████████░░░░` for a single ratio, with an optional label and
 * trailing text.
 *
 * `ProgressBar` covers determinate progress and owns the percentage readout and
 * the gradient variants; this is the compact shape — no chrome, sized to sit in
 * a table cell or a row of stats. A non-zero ratio always shows at least one
 * cell, since rounding a real 2% down to an empty bar reads as "nothing".
 *
 * `thresholds` colour the bar by how far along it is, so a gauge can go amber
 * at 80% and red at 95% without the app re-deriving that every frame.
 */
export const Meter = component<
    Define.Prop<"value", number, true> &
    Define.Prop<"max", number, false> &
    Define.Prop<"width", number, false> &
    Define.Prop<"label", string, false> &
    Define.Prop<"labelWidth", number, false> &
    Define.Prop<"text", string, false> &
    Define.Prop<"smooth", boolean, false> &
    Define.Prop<"color", string, false> &
    Define.Prop<"thresholds", Threshold[], false>
>(({ props }) => {
    return () => {
        const value = props.value || 0;
        const max = props.max ?? 100;
        const width = props.width ?? 16;
        const dim = resolveColor('dim');

        const bar = meter(value, max, width, { smooth: props.smooth });
        const ratio = Number.isFinite(value) && Number.isFinite(max) && max > 0
            ? Math.max(0, Math.min(1, value / max))
            : null;
        const color = resolveColor(colorAt(props.thresholds, ratio, props.color || 'accent'));

        return (
            <box>
                {props.label
                    ? <text color={dim}>{fitCell(props.label, props.labelWidth ?? 12)} </text>
                    : undefined}
                <text color={color}>{bar}</text>
                {props.text ? <text color={dim}> {props.text}</text> : undefined}
            </box>
        );
    };
}, { name: 'Meter' });

export default Meter;
