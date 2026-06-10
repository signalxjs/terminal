import { describe, it, expect } from 'vitest';
import { renderBlock, BLOCK_FONT_HEIGHT } from '../src/fx/blockFont';

describe('block font', () => {
    const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.!:/';

    it('every glyph renders 5 uniform-width rows of block/space cells', () => {
        for (const ch of CHARSET) {
            const rows = renderBlock(ch);
            expect(rows).toHaveLength(BLOCK_FONT_HEIGHT);
            const width = rows[0].length;
            for (const row of rows) {
                expect(row.length).toBe(width);
                expect(/^[█ ]*$/.test(row)).toBe(true);
            }
        }
    });

    it('separates glyphs with a one-column gap', () => {
        const a = renderBlock('A')[0].length;
        const b = renderBlock('B')[0].length;
        expect(renderBlock('AB')[0].length).toBe(a + 1 + b);
    });

    it('uppercases input and substitutes unknown characters with a space glyph', () => {
        expect(renderBlock('sigx')).toEqual(renderBlock('SIGX'));
        const unknown = renderBlock('@');
        expect(unknown).toEqual(renderBlock(' '));
    });

    it('renders empty input as five empty rows', () => {
        expect(renderBlock('')).toEqual(['', '', '', '', '']);
    });
});
