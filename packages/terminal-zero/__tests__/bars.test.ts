/**
 * Bar / gauge maths.
 *
 * The recurring assertion is that a small non-zero value never draws as
 * nothing: rounding a real 2% down to an empty bar reads as "no traffic", which
 * is a different and wrong answer.
 */
import { describe, it, expect } from 'vitest';
import { barCells, meter, commonScale } from '../src/shared/bars';

describe('meter', () => {
    it('fills proportionally', () => {
        expect(meter(50, 100, 10)).toBe('█████░░░░░');
        expect(meter(0, 100, 4)).toBe('░░░░');
        expect(meter(100, 100, 4)).toBe('████');
    });

    it('shows at least one cell for a small non-zero ratio', () => {
        expect(meter(2, 100, 10)).toBe('█░░░░░░░░░');
    });

    it('clamps rather than overflowing', () => {
        expect(meter(500, 100, 4)).toBe('████');
        expect(meter(-5, 100, 4)).toBe('░░░░');
    });

    it('draws an empty track when there is no usable scale', () => {
        expect(meter(1, 0, 4)).toBe('░░░░');
        expect(meter(Number.NaN, 100, 4)).toBe('░░░░');
        expect(meter(1, Number.POSITIVE_INFINITY, 4)).toBe('░░░░');
    });

    it('returns nothing at zero width', () => {
        expect(meter(1, 2, 0)).toBe('');
    });

    it('adds a sub-cell leading edge when smooth', () => {
        // 2.8 cells of 8: two full blocks plus a six-eighths edge.
        expect(meter(35, 100, 8, { smooth: true })).toBe('██▊░░░░░');
        // Without it the same value rounds to a whole cell.
        expect(meter(35, 100, 8)).toBe('███░░░░░');
    });

    it('keeps a sliver visible in smooth mode too', () => {
        // 0.08 of a cell would floor to nothing; it gets the thinnest edge.
        expect(meter(1, 100, 8, { smooth: true })).toBe('▏░░░░░░░');
    });
});

describe('barCells', () => {
    it('accounts for every cell of the width', () => {
        for (const value of [0, 1, 37, 99, 100]) {
            const { filled, edge, empty } = barCells(value, 100, 12, { smooth: true });
            expect(filled + (edge ? 1 : 0) + empty).toBe(12);
        }
    });

    it('reports nothing at zero width', () => {
        expect(barCells(5, 10, 0)).toEqual({ filled: 0, edge: '', empty: 0 });
    });
});

describe('commonScale', () => {
    it('is the highest usable value', () => {
        expect(commonScale([3, 47, 12])).toBe(47);
    });

    it('ignores gaps, non-finite values and non-positives', () => {
        expect(commonScale([null, undefined, Number.NaN, -4, 0, 9])).toBe(9);
        expect(commonScale([])).toBe(0);
        expect(commonScale([null, 0])).toBe(0);
    });

    it('clips the top tail so one outlier cannot flatten the rest', () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100_000];
        // Scaled to the max, every real value would draw as an empty bar.
        expect(commonScale(values)).toBe(100_000);
        expect(commonScale(values, { clip: 0.9 })).toBe(9);
    });

    it('treats a clip at or above 1 as no clipping', () => {
        expect(commonScale([1, 2, 30], { clip: 1 })).toBe(30);
        expect(commonScale([1, 2, 30], { clip: Number.NaN })).toBe(30);
    });
});
