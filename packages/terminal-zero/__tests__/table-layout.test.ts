/**
 * Table layout, viewport and sorting.
 *
 * This is the maths that is easy to get subtly wrong and hard to notice by
 * looking at a running dashboard, so it is the part that carries tests. Several
 * assertions are about *not misleading*: a truncated key is marked, the
 * identity column survives a squeeze, and an unchanged list does not appear to
 * move.
 */
import { describe, it, expect } from 'vitest';
import { displayWidth } from '@sigx/runtime-terminal';
import {
    layoutTable, scrollWindow, moveCursor, sortRows, naturalCompare, columnComparator,
    type TableColumn,
} from '../src/shared/tableLayout';

interface Row { id: string; n: number }

const columns: TableColumn<Row>[] = [
    { key: 'id', header: 'ID', value: (r) => r.id },
    { key: 'n', header: 'N', value: (r) => String(r.n), align: 'right' },
];

describe('layoutTable', () => {
    it('sizes columns to the widest cell and aligns', () => {
        const table = layoutTable(columns, [
            { id: 'silo-a', n: 5 },
            { id: 'b', n: 1200 },
        ]);
        // 'silo-a' is 6 wide; '1200' is 4.
        expect(table.widths).toEqual([6, 4]);
        // Right-aligned numbers line up on their last digit, which is the only
        // way a column of magnitudes is comparable at a glance.
        expect(table.rows[0]!.endsWith('   5')).toBe(true);
        expect(table.rows[1]!.endsWith('1200')).toBe(true);
        expect(displayWidth(table.rows[0]!)).toBe(displayWidth(table.rows[1]!));
        expect(table.rows[0]!.startsWith('silo-a')).toBe(true);
        expect(table.rows[1]!.startsWith('b ')).toBe(true);
        expect(table.header.startsWith('ID')).toBe(true);
        expect(table.header.endsWith('N')).toBe(true);
    });

    it('trims trailing padding so a row highlight ends at the content', () => {
        const table = layoutTable(columns, [{ id: 'a', n: 1 }]);
        expect(table.header).toBe(table.header.trimEnd());
        for (const row of table.rows) expect(row).toBe(row.trimEnd());
    });

    it('exposes padded cells alongside the joined rows, for per-cell colour', () => {
        const table = layoutTable(columns, [{ id: 'a', n: 1 }]);
        // Widths are 2 ('ID') and 1 ('N'/'1'); the right-aligned cell pads left.
        expect(table.cells[0]).toEqual(['a ', '1']);
        expect(table.headerCells).toEqual(['ID', 'N']);
        // Joining the cells with the reported gap reproduces the row.
        expect(table.cells[0]!.join(' '.repeat(table.gap)).trimEnd()).toBe(table.rows[0]);
    });

    it('takes space from the right when it has to shrink', () => {
        const table = layoutTable(columns, [{ id: 'a-very-long-silo-id', n: 1 }], { width: 14 });
        // The left column is the identity; truncating it to make room for a
        // number would make the table unusable.
        expect(table.widths[0]).toBeGreaterThan(table.widths[1]!);
        expect(displayWidth(table.header)).toBeLessThanOrEqual(14);
    });

    it('marks a truncated cell rather than cutting it silently', () => {
        const narrow: TableColumn<Row>[] = [{ key: 'id', header: 'ID', value: (r) => r.id, width: 4 }];
        expect(layoutTable(narrow, [{ id: 'abcdefgh', n: 0 }]).rows[0]).toBe('abc…');
    });

    it('respects a column floor when shrinking', () => {
        const floored: TableColumn<Row>[] = [
            { key: 'id', header: 'ID', value: (r) => r.id },
            { key: 'n', header: 'N', value: (r) => String(r.n), min: 6 },
        ];
        const table = layoutTable(floored, [{ id: 'aaaaaaaaaa', n: 123456789 }], { width: 12 });
        expect(table.widths[1]).toBe(6);
    });

    it('hands surplus width only to a column that asked for it', () => {
        const flexed: TableColumn<Row>[] = [
            { key: 'id', header: 'ID', value: (r) => r.id, flex: true },
            { key: 'n', header: 'N', value: (r) => String(r.n) },
        ];
        const rows = [{ id: 'a', n: 1 }];
        // Natural width is 2 + gap 2 + 1 = 5; 20 leaves 15 spare.
        expect(layoutTable(flexed, rows, { width: 20 }).widths).toEqual([17, 1]);
        // Without `flex`, nothing stretches — padding would only be trimmed off.
        expect(layoutTable(columns, rows, { width: 20 }).widths).toEqual([2, 1]);
    });

    it('measures wide glyphs as two cells', () => {
        const table = layoutTable(columns, [{ id: '日本語', n: 1 }]);
        expect(table.widths[0]).toBe(6);
        // Every laid-out cell measures exactly its column width.
        expect(displayWidth(table.cells[0]![0]!)).toBe(6);
    });

    it('handles no rows', () => {
        const table = layoutTable(columns, []);
        expect(table.rows).toEqual([]);
        expect(table.header).toBe('ID  N');
    });
});

describe('scrollWindow', () => {
    it('does not scroll when everything fits', () => {
        expect(scrollWindow(3, 2, 10, 0)).toBe(0);
    });

    it('scrolls by one when the cursor steps past the edge', () => {
        // A screenful jump per keypress makes a list impossible to follow.
        expect(scrollWindow(100, 10, 10, 0)).toBe(1);
        expect(scrollWindow(100, 11, 10, 1)).toBe(2);
    });

    it('follows the cursor upwards', () => {
        expect(scrollWindow(100, 4, 10, 20)).toBe(4);
    });

    it('never scrolls past the end', () => {
        expect(scrollWindow(15, 14, 10, 99)).toBe(5);
    });
});

describe('moveCursor', () => {
    it('clamps instead of wrapping', () => {
        // Holding ↓ should stop at the bottom, not silently return to the top
        // and look like nothing happened.
        expect(moveCursor(9, 1, 10)).toBe(9);
        expect(moveCursor(0, -1, 10)).toBe(0);
        expect(moveCursor(5, 3, 10)).toBe(8);
        expect(moveCursor(0, 5, 0)).toBe(0);
    });
});

describe('sortRows', () => {
    it('breaks ties on identity, so equal rows do not shuffle between polls', () => {
        const rows: Row[] = [
            { id: 'c', n: 1 },
            { id: 'a', n: 1 },
            { id: 'b', n: 1 },
        ];
        const once = sortRows(rows, (x, y) => y.n - x.n, (r) => r.id).map((r) => r.id);
        const twice = sortRows(rows, (x, y) => y.n - x.n, (r) => r.id).map((r) => r.id);
        expect(once).toEqual(['a', 'b', 'c']);
        expect(twice).toEqual(once);
    });

    it('does not mutate the input', () => {
        const rows: Row[] = [{ id: 'b', n: 2 }, { id: 'a', n: 1 }];
        sortRows(rows, (x, y) => x.n - y.n, (r) => r.id);
        expect(rows[0]!.id).toBe('b');
    });
});

describe('naturalCompare', () => {
    it('reads embedded numbers as numbers', () => {
        // Lexically, 'p10' sorts between 'p1' and 'p2' — which puts a shard map
        // in an order nobody can read.
        expect(['p10', 'p2', 'p1'].sort(naturalCompare)).toEqual(['p1', 'p2', 'p10']);
        expect(['node-10', 'node-9'].sort(naturalCompare)).toEqual(['node-9', 'node-10']);
    });

    it('falls back to a plain comparison elsewhere', () => {
        expect(['beta', 'alpha'].sort(naturalCompare)).toEqual(['alpha', 'beta']);
        expect(naturalCompare('a', 'a')).toBe(0);
        expect(naturalCompare('', '')).toBe(0);
    });
});

describe('columnComparator', () => {
    it('defaults to a natural comparison of the rendered text', () => {
        const compare = columnComparator(columns[0]!);
        expect(compare({ id: 'p2', n: 0 }, { id: 'p10', n: 0 })).toBeLessThan(0);
    });

    it('prefers the column\'s own comparator', () => {
        const compare = columnComparator({ ...columns[1]!, compare: (a, b) => a.n - b.n });
        expect(compare({ id: 'x', n: 9 }, { id: 'y', n: 100 })).toBeLessThan(0);
    });
});
