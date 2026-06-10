import { describe, it, expect } from 'vitest';
import { truncateToWidth, displayWidth } from '../src/utils';

describe('truncateToWidth', () => {
    it('passes short strings through unchanged', () => {
        expect(truncateToWidth('hello', 10)).toBe('hello');
        expect(truncateToWidth('', 10)).toBe('');
    });

    it('truncates to the cell budget', () => {
        expect(truncateToWidth('abcdefgh', 5)).toBe('abcde');
        expect(truncateToWidth('abcdefgh', 0)).toBe('');
    });

    it('copies ANSI escapes through without counting them', () => {
        const styled = '\x1b[31mred\x1b[0m and more';
        expect(truncateToWidth(styled, 100)).toBe(styled);
        // 3 visible cells: the escapes survive, only text is cut.
        expect(truncateToWidth('\x1b[31mredder\x1b[0m', 3)).toBe('\x1b[31mred\x1b[0m');
    });

    it('appends a reset when styled content is cut', () => {
        const out = truncateToWidth('\x1b[31m' + 'x'.repeat(20), 5);
        expect(out).toBe('\x1b[31m' + 'x'.repeat(5) + '\x1b[0m');
    });

    it('does not append a reset when plain content is cut', () => {
        expect(truncateToWidth('x'.repeat(20), 5)).toBe('xxxxx');
    });

    it('drops a wide glyph that would straddle the boundary', () => {
        // 漢 is 2 cells: 'a' + 漢 = 3 cells. Budget 2 keeps only 'a'.
        expect(truncateToWidth('a漢b', 2)).toBe('a');
        expect(truncateToWidth('a漢b', 3)).toBe('a漢');
        expect(displayWidth(truncateToWidth('漢漢漢', 5))).toBeLessThanOrEqual(5);
    });

    it('handles astral-plane code points without splitting surrogates', () => {
        const out = truncateToWidth('🚀🚀🚀', 4);
        expect(out).toBe('🚀🚀');
    });
});
