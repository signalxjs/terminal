/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor, displayWidth, padCell } from '@sigx/terminal-zero';

/**
 * A simple text grid. Columns are auto-sized to their widest cell; the header
 * is accent-colored and separated from the body by a rule. Widths are measured
 * in display cells, so a wide glyph (CJK, emoji) counts as the two columns it
 * occupies and the separators stay in line.
 *
 * For anything that needs to scroll, sort or carry a cursor, reach for
 * `DataTable` — this one is a static grid of strings.
 */
export const Table = component<
    Define.Prop<"columns", string[], true> &
    Define.Prop<"rows", string[][], false>
>(({ props }) => {
    return () => {
        const cols = props.columns || [];
        const rows = props.rows || [];

        const widths = cols.map((c, i) =>
            rows.reduce((widest, r) => Math.max(widest, displayWidth(r[i] ?? '')), displayWidth(c))
        );
        const pad = (s: string, w: number) => padCell(s, w);

        const lineColor = resolveColor('line');
        const sep = () => <text color={lineColor}>│</text>;

        const headerCells: any[] = [];
        cols.forEach((c, i) => {
            if (i > 0) headerCells.push(sep());
            headerCells.push(<text color={resolveColor('accent')}>{` ${pad(c, widths[i])} `}</text>);
        });

        const ruleWidth = widths.reduce((a, w) => a + w + 2, 0) + Math.max(0, cols.length - 1);

        const bodyRows = rows.map((row) => {
            const cells: any[] = [];
            cols.forEach((_, i) => {
                if (i > 0) cells.push(sep());
                cells.push(<text color={resolveColor('fg')}>{` ${pad(row[i] ?? '', widths[i])} `}</text>);
            });
            return <box>{cells}</box>;
        });

        return (
            <box>
                <box>{headerCells}</box>
                <box><text color={lineColor}>{'─'.repeat(ruleWidth)}</text></box>
                {bodyRows}
            </box>
        );
    };
}, { name: 'Table' });

export default Table;
