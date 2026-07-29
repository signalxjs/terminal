/**
 * A grid of things, each in one of a few states — the "N replicas / shards /
 * checks, how are they doing" display.
 *
 * The states are deliberately not a count you would read off a number: an item
 * nothing is claiming and an item claimed twice are different findings, and
 * both are invisible in an average. Ordering is the caller's — `naturalCompare`
 * is next door if the labels are numbered (`p2` before `p10`).
 */

/** How a cell should read. Mapped to theme tokens by the component. */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'idle';

export interface StatusCell {
    label: string;
    tone: StatusTone;
    /** Optional longer text for a detail line or tooltip-style footer. */
    detail?: string;
}

/** Chunk cells into rows of at most `perRow`, preserving order. */
export function statusGrid(cells: readonly StatusCell[], perRow = 8): StatusCell[][] {
    const columns = Math.max(1, Math.floor(Number.isFinite(perRow) ? perRow : 8));
    const rows: StatusCell[][] = [];
    for (let index = 0; index < cells.length; index += columns) {
        rows.push(cells.slice(index, index + columns));
    }
    return rows;
}

/** The cells in a given state — the subset usually worth acting on. */
export function cellsWithTone(cells: readonly StatusCell[], tone: StatusTone): StatusCell[] {
    return cells.filter((cell) => cell.tone === tone);
}

/** The most severe tone present, for a one-glyph summary. `idle` when empty. */
export function worstTone(cells: readonly StatusCell[]): StatusTone {
    let worst: StatusTone = 'idle';
    for (const cell of cells) {
        if (cell.tone === 'danger') return 'danger';
        if (cell.tone === 'warn') worst = 'warn';
        else if (cell.tone === 'ok' && worst === 'idle') worst = 'ok';
    }
    return worst;
}
