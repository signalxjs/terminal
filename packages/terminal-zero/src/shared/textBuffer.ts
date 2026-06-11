/**
 * Headless text-buffer core for multi-line editors: soft-wrap layout and
 * cursor math, all pure functions. The styled editor (`TextArea` in
 * @sigx/terminal-ui) renders on top of this.
 *
 * Conventions: the cursor is a CODE-POINT index into the text (0..length in
 * code points); columns are display cells (wide glyphs count 2, via
 * `charWidth`). A wide glyph never straddles a wrap boundary.
 */
import { charWidth } from '@sigx/runtime-terminal';

export interface TextBufferState {
    text: string;
    /** Code-point index, 0..codePointLength(text). */
    cursor: number;
}

export interface TextRow {
    text: string;
    /** Code-point offset of the row's first character in the full text. */
    start: number;
    /** Exclusive end offset; excludes the `\n` on hard rows. */
    end: number;
    /** True when the row ends at an explicit newline (or end of text). */
    hard: boolean;
}

export interface TextLayout {
    rows: TextRow[];
    width: number;
}

const cps = (text: string): string[] => [...text];

/**
 * Soft-wrap `text` at `width` display cells. Explicit `\n` always breaks a
 * row (hard). Overlong rows break at the last space when one exists in the
 * row, otherwise hard-break mid-word. Empty text yields one empty row.
 */
export function layoutText(text: string, width: number): TextLayout {
    const w = Math.max(1, width);
    const chars = cps(text);
    const rows: TextRow[] = [];

    let rowStart = 0;
    let rowCells = 0;
    let lastSpace = -1; // code-point index of the last space in the current row

    const pushRow = (end: number, hard: boolean, nextStart: number) => {
        rows.push({ text: chars.slice(rowStart, end).join(''), start: rowStart, end, hard });
        rowStart = nextStart;
        lastSpace = -1;
    };

    let i = 0;
    while (i < chars.length) {
        const ch = chars[i];
        if (ch === '\n') {
            pushRow(i, true, i + 1);
            rowCells = 0;
            i++;
            continue;
        }
        const cw = charWidth(ch.codePointAt(0) ?? 0);
        if (rowCells + cw > w && i > rowStart) {
            // The overflowing character IS a space: break right here and
            // swallow it — the row before it fit exactly.
            if (ch === ' ') {
                pushRow(i, false, i + 1);
                rowCells = 0;
                i++;
                continue;
            }
            // Overflow: wrap at the last space if the row has one, else here.
            if (lastSpace > rowStart) {
                pushRow(lastSpace, false, lastSpace + 1); // the space is swallowed by the wrap
            } else {
                pushRow(i, false, i);
            }
            // Recompute cells for the (possibly re-started) row up to i.
            rowCells = 0;
            for (let j = rowStart; j < i; j++) {
                rowCells += charWidth(chars[j].codePointAt(0) ?? 0);
            }
            continue; // re-process chars[i] against the new row
        }
        if (ch === ' ') lastSpace = i;
        rowCells += cw;
        i++;
    }
    rows.push({ text: chars.slice(rowStart).join(''), start: rowStart, end: chars.length, hard: true });
    return { rows, width: w };
}

/**
 * Map a cursor (code-point index) to its visual row and column (cells).
 * A cursor sitting exactly on a soft-wrap boundary maps to the start of the
 * NEXT row — except at the very end of the text, where it stays on the last.
 */
export function cursorToRowCol(layout: TextLayout, cursor: number): { row: number; col: number } {
    const rows = layout.rows;
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const isLast = r === rows.length - 1;
        const next = rows[r + 1];
        // cursor === row.end belongs to THIS row unless the next row starts
        // exactly there (a pure soft wrap, where the boundary cursor renders
        // at the start of the next row). A wrap that swallowed a space leaves
        // next.start === row.end + 1, so the on-the-space cursor stays here.
        const within = cursor >= row.start && (
            cursor < row.end ||
            (cursor === row.end && (isLast || next.start !== row.end)) ||
            (isLast && cursor >= row.end)
        );
        if (!within) continue;
        let col = 0;
        const chars = cps(row.text);
        const upto = Math.min(cursor - row.start, chars.length);
        for (let j = 0; j < upto; j++) {
            col += charWidth(chars[j].codePointAt(0) ?? 0);
        }
        return { row: r, col };
    }
    const last = rows.length - 1;
    return { row: last, col: cps(rows[last].text).reduce((c, ch) => c + charWidth(ch.codePointAt(0) ?? 0), 0) };
}

/**
 * Map a visual (row, goalCol) back to a cursor index. A goal column landing
 * inside a wide glyph snaps to the glyph start; beyond the row end clamps to
 * the row end.
 */
export function rowColToCursor(layout: TextLayout, row: number, goalCol: number): number {
    const r = layout.rows[Math.max(0, Math.min(row, layout.rows.length - 1))];
    const chars = cps(r.text);
    let col = 0;
    for (let j = 0; j < chars.length; j++) {
        const cw = charWidth(chars[j].codePointAt(0) ?? 0);
        if (col + cw > goalCol) return r.start + j;
        col += cw;
    }
    return r.end;
}

export function insertAt(state: TextBufferState, chunk: string): TextBufferState {
    const chars = cps(state.text);
    const at = Math.max(0, Math.min(state.cursor, chars.length));
    const text = chars.slice(0, at).join('') + chunk + chars.slice(at).join('');
    return { text, cursor: at + cps(chunk).length };
}

/** Backspace: delete the code point before the cursor. */
export function deleteBefore(state: TextBufferState): TextBufferState {
    const chars = cps(state.text);
    const at = Math.max(0, Math.min(state.cursor, chars.length));
    if (at === 0) return state;
    return { text: chars.slice(0, at - 1).join('') + chars.slice(at).join(''), cursor: at - 1 };
}

/** Forward delete: delete the code point under the cursor. */
export function deleteAt(state: TextBufferState): TextBufferState {
    const chars = cps(state.text);
    const at = Math.max(0, Math.min(state.cursor, chars.length));
    if (at >= chars.length) return state;
    return { text: chars.slice(0, at).join('') + chars.slice(at + 1).join(''), cursor: at };
}

export function moveLeft(state: TextBufferState): TextBufferState {
    return { ...state, cursor: Math.max(0, state.cursor - 1) };
}

export function moveRight(state: TextBufferState): TextBufferState {
    return { ...state, cursor: Math.min(cps(state.text).length, state.cursor + 1) };
}

/**
 * Move the cursor a visual row up (-1) or down (+1), keeping a sticky goal
 * column: pass the previous call's `goalCol` back in while the user keeps
 * moving vertically (any horizontal move/edit resets it — caller's job).
 */
export function moveVertical(
    state: TextBufferState,
    width: number,
    dir: -1 | 1,
    goalCol?: number,
): { state: TextBufferState; goalCol: number } {
    const layout = layoutText(state.text, width);
    const { row, col } = cursorToRowCol(layout, state.cursor);
    const goal = goalCol !== undefined && goalCol >= 0 ? goalCol : col;
    const targetRow = row + dir;
    if (targetRow < 0 || targetRow >= layout.rows.length) {
        return { state, goalCol: goal };
    }
    return { state: { ...state, cursor: rowColToCursor(layout, targetRow, goal) }, goalCol: goal };
}

/** Jump to the start of the cursor's visual row. */
export function moveLineStart(state: TextBufferState, width: number): TextBufferState {
    const layout = layoutText(state.text, width);
    const { row } = cursorToRowCol(layout, state.cursor);
    return { ...state, cursor: layout.rows[row].start };
}

/** Jump to the end of the cursor's visual row. */
export function moveLineEnd(state: TextBufferState, width: number): TextBufferState {
    const layout = layoutText(state.text, width);
    const { row } = cursorToRowCol(layout, state.cursor);
    return { ...state, cursor: layout.rows[row].end };
}
