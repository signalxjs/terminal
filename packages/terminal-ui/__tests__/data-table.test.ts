/**
 * DataTable — cursor, viewport and sorting.
 *
 * The pure maths is covered in terminal-zero's `table-layout` tests; what is
 * asserted here is that the component wires it up: that a keypress moves the
 * cursor the amount it claims, that the window follows one row at a time, and
 * that a re-sort does not shuffle rows whose values are identical.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jsx } from '@sigx/runtime-core';
import { renderTerminal, setOutputTarget } from '@sigx/runtime-terminal';
import type { TableColumn } from '@sigx/terminal-zero';
import { DataTable } from '../src/data/DataTable';
import { captureOutput, settle, press, UP, DOWN, LEFT, RIGHT, ENTER } from './prompt-harness';

const PGDN = '\x1b[6~';
const HOME = '\x1b[H';
const END = '\x1b[F';

interface Row { id: string; n: number }

const columns: TableColumn<Row>[] = [
    { key: 'id', header: 'ID', value: (r) => r.id },
    { key: 'n', header: 'N', value: (r) => String(r.n), align: 'right' },
];

const feed = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: `row-${i + 1}`, n: i + 1 }));

describe('DataTable', () => {
    let unmount: (() => void) | null = null;

    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        unmount?.();
        unmount = null;
        setOutputTarget(undefined);
        vi.useRealTimers();
    });

    async function mount(props: Record<string, unknown>) {
        const cap = captureOutput({ columns: 60, rows: 30 });
        unmount = renderTerminal(
            jsx(DataTable, { columns, autofocus: true, ...props }),
            { patchConsole: false },
        ).unmount;
        await settle();
        return cap;
    }

    it('renders a header and the first window of rows', async () => {
        const cap = await mount({ rows: feed(20), height: 4 });
        const out = cap.output();
        expect(out).toContain('ID');
        expect(out).toContain('row-1');
        expect(out).toContain('row-4');
        expect(out).not.toContain('row-5');
        expect(out).toContain('1–4/20');
    });

    it('moves the cursor without scrolling while it stays in view', async () => {
        const cap = await mount({ rows: feed(20), height: 4 });
        cap.clear();
        await press(DOWN);
        const out = cap.output();
        expect(out).toContain('row-1');
        expect(out).toContain('1–4/20');
    });

    it('scrolls by exactly one row when the cursor steps past the edge', async () => {
        // A screenful jump per keypress makes a list impossible to follow.
        const cap = await mount({ rows: feed(20), height: 4 });
        for (const _ of [0, 1, 2]) await press(DOWN);   // cursor at the last visible row
        cap.clear();
        await press(DOWN);                              // one step past the edge
        const out = cap.output();
        expect(out).toContain('2–5/20');
        expect(out).toContain('row-5');
        expect(out).not.toContain('row-1');
    });

    it('clamps at the ends rather than wrapping', async () => {
        const cap = await mount({ rows: feed(6), height: 3 });
        for (const _ of Array.from({ length: 20 })) await press(DOWN);
        expect(cap.output()).toContain('4–6/6');
        cap.clear();
        // Holding ↓ past the bottom must not silently return to the top.
        await press(DOWN);
        expect(cap.output()).not.toContain('1–3/6');
    });

    it('pages and jumps to the ends', async () => {
        const cap = await mount({ rows: feed(30), height: 5 });
        await press(PGDN);
        expect(cap.output()).toContain('2–6/30');
        await press(END);
        expect(cap.output()).toContain('26–30/30');
        await press(HOME);
        expect(cap.output()).toContain('1–5/30');
    });

    it('emits select as the cursor moves and submit on Enter', async () => {
        const selected: Row[] = [];
        const submitted: Row[] = [];
        await mount({
            rows: feed(5),
            height: 5,
            onSelect: (row: Row) => selected.push(row),
            onSubmit: (row: Row) => submitted.push(row),
        });
        await press(DOWN);
        await press(ENTER);
        expect(selected.at(-1)?.id).toBe('row-2');
        expect(submitted).toHaveLength(1);
        expect(submitted[0]!.id).toBe('row-2');
    });

    it('sorts on demand and reports the active column', async () => {
        const changes: unknown[] = [];
        const cap = await mount({
            rows: feed(4),
            height: 4,
            sortable: true,
            onSortChange: (state: unknown) => changes.push(state),
        });
        cap.clear();
        await press(RIGHT);          // pick the first sortable column
        await press('r');            // reverse it
        expect(changes).toEqual([{ key: 'id', dir: 'asc' }, { key: 'id', dir: 'desc' }]);
        expect(cap.output()).toContain('sorted by id desc');
    });

    it('reorders rows when the sort direction flips', async () => {
        const cap = await mount({
            rows: feed(3),
            height: 3,
            sortable: true,
            sortKey: 'n',
            identity: (row: Row) => row.id,
        });
        const ascending = firstDataLine(cap.output());
        cap.clear();
        await press('r');
        expect(firstDataLine(cap.output())).not.toBe(ascending);
    });

    it('does not shuffle rows whose sort values are equal', async () => {
        // A dashboard re-sorts every poll; equal rows swapping places reads as
        // activity when nothing has changed.
        const rows: Row[] = [{ id: 'c', n: 1 }, { id: 'a', n: 1 }, { id: 'b', n: 1 }];
        const cap = await mount({
            rows,
            height: 3,
            sortable: true,
            sortKey: 'n',
            identity: (row: Row) => row.id,
        });
        const order = () => cap.output()
            .split('\n')
            .map((line) => line.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '').trim())
            .filter((line) => /^.?[abc]\s+1$/.test(line));
        const before = order();
        expect(before).toHaveLength(3);

        // Cycling the sort column away and back must land on the same order…
        cap.clear();
        await press(RIGHT);
        const cycled = order();
        cap.clear();
        await press(LEFT);
        expect(cycled).toEqual(before);
        expect(order()).toEqual(before);
    });

    it('ignores sort keys unless sortable', async () => {
        const changes: unknown[] = [];
        const cap = await mount({ rows: feed(3), height: 3, onSortChange: (s: unknown) => changes.push(s) });
        await press(RIGHT);
        await press('r');
        expect(changes).toEqual([]);
        expect(cap.output()).not.toContain('sorted by');
    });

    it('shows an empty state and still holds its height', async () => {
        const cap = await mount({ rows: [], height: 4, emptyText: 'no rows' });
        const out = cap.output();
        expect(out).toContain('no rows');
        expect(out).toContain('0/0');
    });

    it('marks truncation instead of cutting silently when squeezed', async () => {
        const narrow: TableColumn<Row>[] = [
            { key: 'id', header: 'ID', value: (r) => r.id, width: 5 },
        ];
        const cap = captureOutput({ columns: 60, rows: 30 });
        unmount = renderTerminal(
            jsx(DataTable, { columns: narrow, rows: [{ id: 'a-very-long-id', n: 1 }], height: 2 }),
            { patchConsole: false },
        ).unmount;
        await settle();
        expect(cap.output()).toContain('a-ve…');
    });

    it('renders the three variants', async () => {
        for (const variant of ['plain', 'ruled', 'boxed'] as const) {
            unmount?.();
            const cap = await mount({ rows: feed(3), height: 3, variant, title: 'Rows' });
            const out = cap.output();
            expect(out).toContain('row-1');
            // Only `ruled` and `boxed` draw chrome; `plain` is bare text.
            expect(out.includes('─')).toBe(variant !== 'plain');
        }
    });

    it('ignores UP at the very top', async () => {
        const cap = await mount({ rows: feed(20), height: 4 });
        await press(UP);
        expect(cap.output()).toContain('1–4/20');
    });
});

/** The first row of table data in a frame, stripped of escapes and chrome. */
function firstDataLine(output: string): string {
    const lines = output
        .split('\n')
        .map((line) => line.replace(/\x1B\[[0-9;?]*[a-zA-Z]/g, '').trimEnd())
        .filter((line) => /row-\d/.test(line));
    return lines[0] ?? '';
}
