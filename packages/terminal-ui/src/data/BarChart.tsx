/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { meter, resolveColor, fitCell } from '@sigx/terminal-zero';
import { colorAt, type Threshold } from './thresholds';

export interface BarChartItem {
    label: string;
    /** The magnitude. `null` means "no reading" — drawn as such, not as zero. */
    value: number | null;
    /** Optional per-item theme token, overriding `color`/`thresholds`. */
    tone?: string;
    /** Text shown after the bar. Defaults to the value through `format`. */
    text?: string;
}

/**
 * Labelled horizontal bars, all measured against one scale.
 *
 * **`scale` is required, and that is the whole point.** Sizing each bar to its
 * own value is not a chart, it is a list of full bars: a 12µs queue wait and a
 * 47ms turn would draw identically, and the comparison you opened the panel for
 * is exactly what you would lose. Derive it once with `commonScale(values)` —
 * or `commonScale(values, { clip: 0.99 })`, which ignores the top tail so a
 * single pathological outlier cannot flatten every other bar to nothing.
 *
 * Percentile rows (p50 / p90 / p99) are three items; so is anything else you
 * want compared side by side.
 */
export const BarChart = component<
    Define.Prop<"items", BarChartItem[], true> &
    Define.Prop<"scale", number, true> &
    Define.Prop<"width", number, false> &
    Define.Prop<"labelWidth", number, false> &
    Define.Prop<"format", (value: number) => string, false> &
    Define.Prop<"color", string, false> &
    Define.Prop<"thresholds", Threshold[], false> &
    Define.Prop<"emptyText", string, false>
>(({ props }) => {
    return () => {
        const items = props.items || [];
        const scale = props.scale;
        const width = props.width ?? 12;
        const labelWidth = props.labelWidth ?? 8;
        const format = props.format ?? ((value: number) => String(value));
        const dim = resolveColor('dim');

        if (items.length === 0) {
            return <box><text color={dim}>{props.emptyText ?? 'no data'}</text></box>;
        }

        return (
            <box>
                {items.map((item) => {
                    const label = <text color={dim}>{fitCell(item.label, labelWidth)} </text>;
                    // A missing reading says so. Drawing an empty bar would
                    // claim we measured and it was zero.
                    if (item.value === null || !Number.isFinite(item.value)) {
                        return (
                            <box>
                                {label}
                                <text color={dim}>{props.emptyText ?? 'no samples'}</text>
                            </box>
                        );
                    }
                    const ratio = scale > 0 ? Math.max(0, Math.min(1, item.value / scale)) : null;
                    const color = resolveColor(item.tone ?? colorAt(props.thresholds, ratio, props.color || 'accent'));
                    return (
                        <box>
                            {label}
                            <text color={color}>{meter(item.value, scale, width)}</text>
                            <text color={resolveColor('fg')}> {item.text ?? format(item.value)}</text>
                        </box>
                    );
                })}
            </box>
        );
    };
}, { name: 'BarChart' });

export default BarChart;
