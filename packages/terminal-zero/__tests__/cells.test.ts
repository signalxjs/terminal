/**
 * Cell-aware text fitting.
 *
 * The assertions that matter are the wide-glyph ones: a CJK ideograph is two
 * columns, and every table in the library sizes itself with these functions, so
 * measuring in `String.length` here would misalign every column downstream by
 * one cell per wide character.
 */
import { describe, it, expect } from 'vitest';
import { displayWidth } from '@sigx/runtime-terminal';
import { fitCell, padCell, ellipsize, ELLIPSIS } from '../src/shared/cells';

describe('ellipsize', () => {
    it('leaves text that already fits alone', () => {
        expect(ellipsize('abc', 5)).toBe('abc');
        expect(ellipsize('abc', 3)).toBe('abc');
    });

    it('marks a cut rather than making it silently', () => {
        // A truncated value that looks complete is how you chase the wrong row.
        expect(ellipsize('abcdefgh', 4)).toBe('abc…');
        expect(ellipsize('abc', 1)).toBe('…');
    });

    it('returns nothing for a non-positive width', () => {
        expect(ellipsize('abc', 0)).toBe('');
        expect(ellipsize('abc', -3)).toBe('');
    });
});

describe('padCell', () => {
    it('pads to width in each alignment', () => {
        expect(padCell('ab', 6)).toBe('ab    ');
        expect(padCell('ab', 6, 'right')).toBe('    ab');
        expect(padCell('ab', 6, 'center')).toBe('  ab  ');
    });

    it('splits an odd remainder to the right, so a column of centred cells lines up', () => {
        expect(padCell('ab', 5, 'center')).toBe(' ab  ');
    });

    it('never truncates', () => {
        expect(padCell('abcdef', 3)).toBe('abcdef');
    });
});

describe('fitCell', () => {
    it('always measures exactly `width`', () => {
        for (const text of ['', 'a', 'abcdefghij']) {
            expect(displayWidth(fitCell(text, 5))).toBe(5);
        }
    });

    it('truncates then pads, honouring alignment', () => {
        expect(fitCell('ab', 4)).toBe('ab  ');
        expect(fitCell('ab', 4, 'right')).toBe('  ab');
        expect(fitCell('abcdefgh', 4)).toBe('abc…');
        expect(fitCell('abc', 0)).toBe('');
    });

    it('counts a wide glyph as two cells', () => {
        // '日本語' is 6 columns, not 3 — the bug that misaligns every column
        // in a table sized with String.length.
        expect(displayWidth('日本語')).toBe(6);
        expect(fitCell('日本語', 6)).toBe('日本語');
        expect(displayWidth(fitCell('日本語', 8))).toBe(8);
    });

    it('never splits a wide glyph in half', () => {
        // Cutting '日本語' to 5 cells cannot include the third ideograph, and
        // the ellipsis lands in the leftover column rather than half a glyph.
        const cut = fitCell('日本語', 5);
        expect(displayWidth(cut)).toBe(5);
        expect(cut).toBe('日本' + ELLIPSIS);
    });

    it('pads out when a wide glyph leaves the truncation a cell short', () => {
        // Cut to 4 cells: '日' (2) + '…' (1) is only 3, so the result is padded
        // rather than silently narrower than its column.
        const cut = fitCell('日本語', 4);
        expect(displayWidth(cut)).toBe(4);
        expect(cut).toBe('日… ');
    });
});
