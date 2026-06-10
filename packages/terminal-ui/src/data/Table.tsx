/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '@sigx/terminal-zero';

/**
 * A simple text grid. Columns are auto-sized to their widest cell; the header
 * is accent-colored and separated from the body by a rule. (Cell widths use
 * `string.length` — adequate for the ASCII data tables usually shown in a TUI.)
 */
export const Table = component<
    Define.Prop<"columns", string[], true> &
    Define.Prop<"rows", string[][], false>
>(({ props }) => {
    return () => {
        const cols = props.columns || [];
        const rows = props.rows || [];

        const widths = cols.map((c, i) =>
            Math.max(c.length, ...rows.map(r => (r[i] ?? '').length), 0)
        );
        const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));

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
