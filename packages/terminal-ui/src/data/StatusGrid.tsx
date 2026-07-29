/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import {
    statusGrid, resolveColor, fitCell, GLYPHS,
    type StatusCell, type StatusTone,
} from '@sigx/terminal-zero';

/**
 * A wrapping grid of things, each in one of four states — replicas, shards,
 * partitions, health checks.
 *
 * The states are deliberately not a number you would read off a gauge. "Three
 * of sixteen are unclaimed" is a finding; the average of sixteen booleans is
 * not, and an item nothing is looking after is invisible in one. Each cell is a
 * glyph and a colour, so the exceptions are the things that catch the eye.
 */
const GLYPH_FOR: Record<StatusTone, string> = {
    ok: GLYPHS.radioOn,
    warn: GLYPHS.diamond,
    danger: GLYPHS.radioOff,
    idle: GLYPHS.gap,
};

const TOKEN_FOR: Record<StatusTone, string> = {
    ok: 'success',
    warn: 'warn',
    danger: 'danger',
    idle: 'faint',
};

export const StatusGrid = component<
    Define.Prop<"cells", StatusCell[], true> &
    Define.Prop<"perRow", number, false> &
    Define.Prop<"labelWidth", number, false> &
    Define.Prop<"showLabels", boolean, false> &
    Define.Prop<"legend", string, false> &
    Define.Prop<"emptyText", string, false>
>(({ props }) => {
    return () => {
        const cells = props.cells || [];
        const dim = resolveColor('dim');

        if (cells.length === 0) {
            return <box><text color={dim}>{props.emptyText ?? 'nothing to show'}</text></box>;
        }

        const rows = statusGrid(cells, props.perRow ?? 8);
        const showLabels = props.showLabels !== false;
        const labelWidth = props.labelWidth ?? 4;

        return (
            <box>
                {props.legend ? <box><text color={dim}>{props.legend}</text></box> : undefined}
                {rows.map((row) => (
                    // Cells are inline <text> runs, not nested boxes — a box is
                    // a block here and would put every cell on its own line.
                    <box>
                        {row.flatMap((cell) => [
                            ...(showLabels ? [<text color={dim}>{fitCell(cell.label, labelWidth)}</text>] : []),
                            <text color={resolveColor(TOKEN_FOR[cell.tone])}>{GLYPH_FOR[cell.tone]} </text>,
                        ])}
                    </box>
                ))}
            </box>
        );
    };
}, { name: 'StatusGrid' });

export default StatusGrid;
