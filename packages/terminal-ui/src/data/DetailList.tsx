/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor, fitCell, displayWidth, type CellAlign } from '@sigx/terminal-zero';

export interface DetailRow {
    label: string;
    value: string;
    /** Theme token for the value, e.g. `danger` for a figure out of range. */
    tone?: string;
}

/**
 * Aligned label/value pairs — the detail pane beside a table, or the header
 * block of a status screen.
 *
 * Labels are fitted to one width so the values form a column; that alignment is
 * the only reason to reach for this over hand-written text, and it is measured
 * in display cells so a label containing wide glyphs still lines up.
 */
export const DetailList = component<
    Define.Prop<"rows", DetailRow[], true> &
    Define.Prop<"labelWidth", number, false> &
    Define.Prop<"align", CellAlign, false> &
    Define.Prop<"gap", number, false>
>(({ props }) => {
    return () => {
        const rows = props.rows || [];
        const labelWidth = props.labelWidth ?? rows.reduce(
            (widest, row) => Math.max(widest, displayWidth(row.label)),
            1,
        );
        const gap = ' '.repeat(Math.max(0, props.gap ?? 1));
        const dim = resolveColor('dim');

        return (
            <box>
                {rows.map((row) => (
                    <box>
                        <text color={dim}>{fitCell(row.label, labelWidth, props.align)}{gap}</text>
                        <text color={resolveColor(row.tone || 'fg')}>{row.value}</text>
                    </box>
                ))}
            </box>
        );
    };
}, { name: 'DetailList' });

export default DetailList;
