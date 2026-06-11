import { describe, it, expect } from 'vitest';
import {
    layoutText, cursorToRowCol, rowColToCursor,
    insertAt, deleteBefore, deleteAt, moveLeft, moveRight, moveVertical, moveLineStart, moveLineEnd,
} from '../src/shared/textBuffer';

describe('layoutText', () => {
    it('wraps at width, breaking at the last space', () => {
        const l = layoutText('hello brave world', 11);
        expect(l.rows.map((r) => r.text)).toEqual(['hello brave', 'world']);
        expect(l.rows[0].hard).toBe(false);
    });

    it('hard-breaks words longer than the width', () => {
        const l = layoutText('abcdefgh', 3);
        expect(l.rows.map((r) => r.text)).toEqual(['abc', 'def', 'gh']);
    });

    it('explicit newlines always break (hard rows)', () => {
        const l = layoutText('a\nb\n\nc', 10);
        expect(l.rows.map((r) => r.text)).toEqual(['a', 'b', '', 'c']);
        expect(l.rows.every((r) => r.hard)).toBe(true);
    });

    it('empty text yields one empty row', () => {
        const l = layoutText('', 10);
        expect(l.rows).toHaveLength(1);
        expect(l.rows[0]).toMatchObject({ text: '', start: 0, end: 0, hard: true });
    });

    it('wide glyphs wrap whole, never straddling the boundary', () => {
        const l = layoutText('ありがとう', 4); // each glyph is 2 cells
        expect(l.rows.map((r) => r.text)).toEqual(['あり', 'がと', 'う']);
    });

    it('mixed narrow + wide near the boundary', () => {
        const l = layoutText('abc漢', 4); // 3 cells + 2 would overflow
        expect(l.rows.map((r) => r.text)).toEqual(['abc', '漢']);
    });
});

describe('cursor mapping', () => {
    it('maps a soft boundary to the next row start', () => {
        const l = layoutText('abcdef', 3); // rows abc/def, pure soft wrap at 3
        expect(cursorToRowCol(l, 3)).toEqual({ row: 1, col: 0 });
        expect(cursorToRowCol(l, 2)).toEqual({ row: 0, col: 2 });
    });

    it('keeps the cursor on a wrap-swallowed space on its own row', () => {
        const l = layoutText('ab cd', 4); // rows: 'ab' (space swallowed), 'cd'
        expect(l.rows.map((r) => r.text)).toEqual(['ab', 'cd']);
        expect(cursorToRowCol(l, 2)).toEqual({ row: 0, col: 2 }); // ON the space
        expect(cursorToRowCol(l, 3)).toEqual({ row: 1, col: 0 }); // first char of cd
    });

    it('end of text maps to the end of the last row', () => {
        const l = layoutText('abc', 10);
        expect(cursorToRowCol(l, 3)).toEqual({ row: 0, col: 3 });
    });

    it('columns count display cells for wide glyphs', () => {
        const l = layoutText('漢a', 10);
        expect(cursorToRowCol(l, 1)).toEqual({ row: 0, col: 2 });
        expect(cursorToRowCol(l, 2)).toEqual({ row: 0, col: 3 });
    });

    it('rowColToCursor snaps a mid-wide-glyph goal column to the glyph start', () => {
        const l = layoutText('漢字', 10);
        expect(rowColToCursor(l, 0, 1)).toBe(0); // inside 漢 → its start
        expect(rowColToCursor(l, 0, 2)).toBe(1);
        expect(rowColToCursor(l, 0, 99)).toBe(2); // clamps to row end
    });
});

describe('edit operations', () => {
    it('insertAt splices at the cursor and advances by the chunk length', () => {
        const s = insertAt({ text: 'ad', cursor: 1 }, 'bc');
        expect(s).toEqual({ text: 'abcd', cursor: 3 });
    });

    it('insert/delete operate in code points around wide glyphs', () => {
        const s = insertAt({ text: '漢字', cursor: 1 }, 'x');
        expect(s.text).toBe('漢x字');
        expect(deleteBefore(s).text).toBe('漢字');
        expect(deleteAt({ text: '漢字', cursor: 0 }).text).toBe('字');
    });

    it('deleteBefore at 0 and deleteAt at end are no-ops', () => {
        expect(deleteBefore({ text: 'a', cursor: 0 }).text).toBe('a');
        expect(deleteAt({ text: 'a', cursor: 1 }).text).toBe('a');
    });

    it('moveLeft/Right clamp at the edges', () => {
        expect(moveLeft({ text: 'ab', cursor: 0 }).cursor).toBe(0);
        expect(moveRight({ text: 'ab', cursor: 2 }).cursor).toBe(2);
        expect(moveRight({ text: 'ab', cursor: 0 }).cursor).toBe(1);
    });
});

describe('vertical movement', () => {
    it('moves between visual rows preserving the goal column across short rows', () => {
        // rows: 'abcdef' wraps at 6? Use explicit lines: long, short, long.
        const text = 'abcdef\nx\nuvwxyz';
        let state = { text, cursor: 4 }; // row 0, col 4
        let r = moveVertical(state, 10, 1);
        expect(cursorToRowCol(layoutText(text, 10), r.state.cursor)).toEqual({ row: 1, col: 1 }); // clamped to 'x' end
        r = moveVertical(r.state, 10, 1, r.goalCol);
        expect(cursorToRowCol(layoutText(text, 10), r.state.cursor)).toEqual({ row: 2, col: 4 }); // goal restored
    });

    it('clamps at the first and last rows', () => {
        const state = { text: 'a\nb', cursor: 0 };
        expect(moveVertical(state, 10, -1).state.cursor).toBe(0);
        const end = { text: 'a\nb', cursor: 3 };
        expect(moveVertical(end, 10, 1).state.cursor).toBe(3);
    });

    it('moveLineStart/End jump within the visual row', () => {
        const text = 'abcdef'; // wraps at 3: abc/def
        expect(moveLineStart({ text, cursor: 5 }, 3).cursor).toBe(3);
        expect(moveLineEnd({ text, cursor: 4 }, 3).cursor).toBe(6);
        expect(moveLineStart({ text, cursor: 1 }, 3).cursor).toBe(0);
        expect(moveLineEnd({ text, cursor: 1 }, 3).cursor).toBe(3);
    });
});
