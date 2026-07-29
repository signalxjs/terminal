/**
 * Sparklines.
 *
 * Most of these assertions are about *not misleading*: a flat series must look
 * flat, a gap must not look like a zero, and a tiny non-zero value must not
 * look like silence.
 */
import { describe, it, expect } from 'vitest';
import {
    sparkline, sparklineRows, renderSparkline, sparkScale, peakOf, troughOf, trend,
} from '../src/shared/sparkline';

const mask = (cell: string): number => cell.codePointAt(0)! - 0x2800;

describe('sparkline (blocks)', () => {
    it('scales from zero, not from the minimum', () => {
        // A min-anchored sparkline turns a flat line at 1000 into a mountain
        // range of noise — the commonest way these lie.
        expect(sparkline([1000, 1001, 1000, 999])).toBe('████');
        // Zero sits on the reserved lowest block; the rest spread above it.
        expect(sparkline([0, 50, 100])).toBe('▁▅█');
    });

    it('min-anchors only when explicitly asked', () => {
        expect(sparkline([1000, 1001, 1000, 999], { baseline: 'min' })).toBe('▅█▅▁');
    });

    it('accepts an explicit numeric baseline', () => {
        // Only the part of the range above 990 is interesting here.
        expect(sparkline([990, 995, 1000], { baseline: 990, max: 1000 })).toBe('▁▅█');
    });

    it('draws a gap as neither a zero nor a blank', () => {
        const line = sparkline([10, null, 10]);
        expect(line).toBe('█·█');
        // Crucially not the baseline block: a counter reset would otherwise
        // read as "traffic stopped".
        expect(line[1]).not.toBe('▁');
    });

    it('never renders a non-zero value the same as zero', () => {
        const line = sparkline([0, 1], { max: 1000 });
        expect(line[0]).toBe('▁');
        // 1 of 1000 is tiny but real; rounding it away hides that anything
        // happened at all.
        expect(line[1]).toBe('▂');
    });

    it('shows the newest values when history exceeds the width', () => {
        // Right-aligned: the newest sample is the one being watched.
        expect(sparkline([0, 0, 0, 0, 100], { width: 2, max: 100 })).toBe('▁█');
    });

    it('scales to the visible window, not to history that scrolled off', () => {
        // A spike an hour ago should not flatten the two minutes on screen.
        expect(sparkline([1000, 1, 5], { width: 3 })).toBe('█▂▂');
        expect(sparkline([1000, 1, 5], { width: 2 })).toBe('▃█');
    });

    it('renders an all-zero series flat rather than full', () => {
        expect(sparkline([0, 0, 0])).toBe('▁▁▁');
    });

    it('honours an explicit max, so two sparklines are comparable', () => {
        // Auto-scaled, both would fill the height and look identical.
        expect(sparkline([50], { max: 100 })).toBe('▅');
        expect(sparkline([100], { max: 100 })).toBe('█');
        expect(sparkline([50])).toBe('█');
    });

    it('pads to width only when asked', () => {
        expect(sparkline([1], { width: 4, pad: true })).toBe('   █');
        expect(sparkline([1], { width: 4 })).toBe('█');
    });

    it('survives nonsense input', () => {
        expect(sparkline([])).toBe('');
        expect(sparkline([1, 2], { width: 0 })).toBe('');
        expect(sparkline([Number.NaN, 1], { max: 1 })).toBe('·█');
    });
});

describe('sparkline (multi-row)', () => {
    it('stacks levels across rows, topmost first', () => {
        expect(sparklineRows([0, 50, 100], { max: 100, height: 2 })).toEqual([' ▁█', '▁██']);
    });

    it('gives more rows proportionally more resolution', () => {
        // Two values one row of eight levels cannot tell apart…
        expect(sparkline([200], { max: 1000 })).toBe(sparkline([250], { max: 1000 }));
        // …separate once there are sixteen levels to spend.
        expect(sparklineRows([200], { max: 1000, height: 2 }))
            .not.toEqual(sparklineRows([250], { max: 1000, height: 2 }));
    });

    it('floats the gap mark clear of the baseline row', () => {
        expect(sparklineRows([null], { height: 2 })).toEqual([' ', '·']);
    });

    it('joins rows with newlines when asked for one string', () => {
        expect(sparkline([0, 100], { max: 100, height: 2 })).toBe(' █\n▁█');
    });
});

describe('sparkline (braille)', () => {
    it('packs two samples into every cell', () => {
        // Four samples, two cells — double the density of the block variant.
        expect(sparklineRows([0, 100, 0, 100], { max: 100, variant: 'braille' })[0]).toHaveLength(2);
    });

    it('fills from the bottom of the cell upward', () => {
        // A full column is every dot; an at-baseline column is the bottom pair.
        expect(sparkline([100, 100], { max: 100, variant: 'braille' })).toBe('⣿');
        expect(sparkline([0, 0], { variant: 'braille' })).toBe('⣀');
    });

    it('leaves a floating dot for a gap, not a baseline dot', () => {
        const cell = sparkline([null, null], { variant: 'braille' });
        // Dots 2 and 5 — the second row down, clear of the floor.
        expect(mask(cell)).toBe(0x02 | 0x10);
        expect(cell).not.toBe('⣀');
    });

    it('counts `width` in cells, so a wider window fits in the same space', () => {
        const values = [0, 0, 0, 0, 100, 100];
        // Two cells hold the last four samples: two at the floor, two full.
        const row = sparklineRows(values, { max: 100, width: 2, variant: 'braille' })[0]!;
        expect(row).toHaveLength(2);
        expect(mask(row[0]!)).toBe(0x40 | 0x80);
        expect(row[1]).toBe('⣿');
    });
});

describe('renderSparkline', () => {
    it('reports where each drawn cell sits on the scale, for threshold colouring', () => {
        const { cellRatios, baseline, max } = renderSparkline([0, 50, 100], { max: 100 });
        expect(cellRatios).toEqual([0, 0.5, 1]);
        expect({ baseline, max }).toEqual({ baseline: 0, max: 100 });
    });

    it('takes the worse of the two samples sharing a braille cell', () => {
        // A threshold should trip on the spike, not on whichever sample
        // happened to land in the left half of the cell.
        expect(renderSparkline([0, 100], { max: 100, variant: 'braille' }).cellRatios).toEqual([1]);
    });

    it('keeps ratios aligned with cells when padding', () => {
        const { rows, cellRatios } = renderSparkline([100], { max: 100, width: 3, pad: true });
        expect(rows[0]).toHaveLength(3);
        expect(cellRatios).toEqual([null, null, 1]);
    });

    it('reports a gap cell as having no position', () => {
        expect(renderSparkline([null, 5], { max: 5 }).cellRatios).toEqual([null, 1]);
    });
});

describe('sparkScale', () => {
    it('is zero-anchored and peak-topped by default', () => {
        expect(sparkScale([3, 9])).toEqual({ baseline: 0, max: 9 });
        expect(sparkScale([3, 9], { baseline: 'min' })).toEqual({ baseline: 3, max: 9 });
        expect(sparkScale([3, 9], { max: 100 })).toEqual({ baseline: 0, max: 100 });
    });
});

describe('peakOf / troughOf', () => {
    it('ignore gaps and non-finite values', () => {
        expect(peakOf([null, Number.NaN, 3])).toBe(3);
        expect(troughOf([null, Number.NaN, 3, 1])).toBe(1);
    });

    it('fall back to zero on an empty series', () => {
        expect(peakOf([])).toBe(0);
        expect(troughOf([])).toBe(0);
    });
});

describe('trend', () => {
    it('reports direction as a number, leaving the glyph to the caller', () => {
        expect(trend(5, 3)).toBe(1);
        expect(trend(3, 5)).toBe(-1);
        expect(trend(3, 3)).toBe(0);
    });

    it('reports no direction across a gap', () => {
        // Comparing across a counter reset would show a crash that never
        // happened.
        expect(trend(5, null)).toBe(0);
        expect(trend(null, 5)).toBe(0);
        expect(trend(Number.NaN, 5)).toBe(0);
    });
});
