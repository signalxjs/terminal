import { describe, it, expect } from 'vitest';
import { statusGrid, cellsWithTone, worstTone, type StatusCell } from '../src/shared/statusGrid';

const cells: StatusCell[] = [
    { label: 'p0', tone: 'ok' },
    { label: 'p1', tone: 'danger' },
    { label: 'p2', tone: 'warn' },
    { label: 'p10', tone: 'ok' },
];

describe('statusGrid', () => {
    it('chunks into rows of at most `perRow`, preserving order', () => {
        expect(statusGrid(cells, 8)).toHaveLength(1);
        const rows = statusGrid(cells, 3);
        expect(rows.map((row) => row.map((cell) => cell.label))).toEqual([['p0', 'p1', 'p2'], ['p10']]);
    });

    it('never produces a zero-wide grid', () => {
        expect(statusGrid(cells, 0)).toHaveLength(cells.length);
        expect(statusGrid(cells, Number.NaN)[0]).toHaveLength(4);
    });

    it('handles an empty set', () => {
        expect(statusGrid([], 8)).toEqual([]);
    });
});

describe('cellsWithTone / worstTone', () => {
    it('picks out the subset worth acting on', () => {
        expect(cellsWithTone(cells, 'danger').map((c) => c.label)).toEqual(['p1']);
        expect(cellsWithTone(cells, 'idle')).toEqual([]);
    });

    it('summarises to the most severe tone present', () => {
        // One bad cell in a healthy set is the finding; an average would hide it.
        expect(worstTone(cells)).toBe('danger');
        expect(worstTone([{ label: 'a', tone: 'ok' }, { label: 'b', tone: 'warn' }])).toBe('warn');
        expect(worstTone([{ label: 'a', tone: 'ok' }])).toBe('ok');
        expect(worstTone([])).toBe('idle');
    });
});
