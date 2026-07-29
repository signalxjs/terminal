/**
 * Table layout — column sizing, alignment, a scrolling viewport and a stable
 * sort. Pure over plain data, so the parts that are easy to get subtly wrong
 * and hard to spot on a running dashboard are the parts that carry tests.
 *
 * Two sizing rules worth stating up front:
 *
 * - **Shrinking takes space from the rightmost columns first.** The left column
 *   is nearly always the identity (an id, a key, a name), and a table whose
 *   identities are truncated to make room for a latency figure is unusable.
 * - **Truncation is always marked.** A cut value that looks complete is how you
 *   end up chasing the wrong row.
 */
import { displayWidth } from '@sigx/runtime-terminal';
import { fitCell, type CellAlign } from './cells';

export interface TableColumn<T> {
    /** Stable id — used to address the column when sorting. */
    key: string;
    header: string;
    /** Cell text. Formatting belongs to the caller, not to the table. */
    value: (row: T) => string;
    /** Fixed width in display cells; otherwise sized to the widest cell. */
    width?: number;
    /** Floor this column may be shrunk to. Default `min(natural, 3)`. */
    min?: number;
    /** Absorb leftover space when the table is given more width than it needs. */
    flex?: boolean;
    align?: CellAlign;
    /** Per-cell theme token, e.g. to redden a column that has gone out of range. */
    color?: (row: T) => string | undefined;
    /** This column's sort order. Defaults to {@link naturalCompare} on `value()`. */
    compare?: (a: T, b: T) => number;
    /** Set `false` to skip this column when cycling sort columns. Default `true`. */
    sortable?: boolean;
}

export interface TableLayoutOptions {
    /** Total width available in display cells. Omit for natural width. */
    width?: number;
    /** Columns of spacing between cells. Default 2. */
    gap?: number;
}

export interface TableLayout {
    /** The header row, ready to print. */
    header: string;
    /** Header text per column, each padded to its column width. */
    headerCells: string[];
    /** Each row, ready to print. */
    rows: string[];
    /** Cell text per row, each padded to its column width — for per-cell colour. */
    cells: string[][];
    /** Final width of each column, in declaration order. */
    widths: number[];
    /** The gap actually used, so a caller joining `cells` matches `rows`. */
    gap: number;
}

/**
 * Lay a table out, fitting `width` when one is given.
 *
 * Trailing padding is trimmed from `header` and `rows`. It is invisible on its
 * own, but a selected row gets painted to its own length — keeping the padding
 * would extend the highlight past the last character by however much the final
 * column happened to be padded.
 */
export function layoutTable<T>(
    columns: readonly TableColumn<T>[],
    rows: readonly T[],
    options: TableLayoutOptions = {},
): TableLayout {
    const gap = Math.max(0, Math.floor(options.gap ?? 2));
    const text = rows.map((row) => columns.map((column) => column.value(row) ?? ''));

    const widths = columns.map((column, index) => {
        if (column.width !== undefined && Number.isFinite(column.width)) {
            return Math.max(0, Math.floor(column.width));
        }
        let widest = displayWidth(column.header);
        for (const line of text) widest = Math.max(widest, displayWidth(line[index]!));
        return widest;
    });

    if (options.width !== undefined && Number.isFinite(options.width)) {
        fitWidths(widths, columns, Math.max(0, Math.floor(options.width)), gap);
    }

    const sep = ' '.repeat(gap);
    const fitRow = (values: readonly string[]): string[] =>
        values.map((value, index) => fitCell(value, widths[index]!, columns[index]!.align ?? 'left'));
    const joinRow = (fitted: readonly string[]): string => fitted.join(sep).replace(/\s+$/, '');

    const headerCells = fitRow(columns.map((column) => column.header));
    const cells = text.map(fitRow);

    return {
        header: joinRow(headerCells),
        headerCells,
        rows: cells.map(joinRow),
        cells,
        widths,
        gap,
    };
}

/**
 * Reconcile the natural widths with the space available: take from the right
 * when over budget, and hand any surplus to the columns that asked for it.
 */
function fitWidths<T>(
    widths: number[],
    columns: readonly TableColumn<T>[],
    available: number,
    gap: number,
): void {
    const gaps = Math.max(0, widths.length - 1) * gap;
    let total = widths.reduce((sum, width) => sum + width, 0) + gaps;

    if (total > available) {
        for (let index = widths.length - 1; index >= 0 && total > available; index--) {
            const floor = columns[index]!.min ?? Math.min(widths[index]!, 3);
            const give = Math.min(Math.max(0, widths[index]! - floor), total - available);
            if (give > 0) {
                widths[index]! -= give;
                total -= give;
            }
        }
        return;
    }

    // Surplus goes only to columns that opted in. Silently stretching the last
    // column would just add padding that the trailing trim removes again.
    const flexible: number[] = [];
    columns.forEach((column, index) => { if (column.flex) flexible.push(index); });
    if (flexible.length === 0) return;

    let surplus = available - total;
    for (let i = 0; i < flexible.length; i++) {
        const share = Math.floor(surplus / (flexible.length - i));
        widths[flexible[i]!]! += share;
        surplus -= share;
    }
}

/**
 * Which slice of a list a viewport should show, as an offset from the top.
 *
 * Keeps the cursor in view while moving the window as little as possible — so
 * stepping one row past the edge scrolls by one row, not by a screenful, which
 * is the difference between a list you can follow and one you cannot.
 */
export function scrollWindow(total: number, cursor: number, height: number, offset: number): number {
    if (height <= 0 || total <= height) return 0;
    const clamped = Math.max(0, Math.min(total - 1, cursor));
    let next = Math.max(0, Math.min(offset, total - height));
    if (clamped < next) next = clamped;
    else if (clamped >= next + height) next = clamped - height + 1;
    return next;
}

/**
 * Move a cursor by `delta`, clamped rather than wrapped.
 *
 * Holding ↓ on a long list should stop at the bottom, not silently return to
 * the top and look like nothing happened.
 */
export function moveCursor(cursor: number, delta: number, total: number): number {
    if (total <= 0) return 0;
    return Math.max(0, Math.min(total - 1, cursor + delta));
}

/**
 * Sort rows by a comparator, with a stable tiebreak on each row's identity.
 *
 * The tiebreak is the point. A dashboard re-sorts every poll, and rows with
 * equal values would otherwise swap places each time — motion that reads as
 * activity when nothing has changed. The input array is not mutated.
 */
export function sortRows<T>(
    rows: readonly T[],
    compare: (a: T, b: T) => number,
    identity: (row: T) => string,
): T[] {
    return [...rows].sort((a, b) => {
        const primary = compare(a, b);
        if (primary !== 0) return primary;
        return naturalCompare(identity(a), identity(b));
    });
}

/**
 * Compare two strings with embedded numbers read as numbers, so `p2` sorts
 * before `p10` and `node-9` before `node-10`. Falls back to a plain comparison
 * for the non-numeric parts.
 */
export function naturalCompare(a: string, b: string): number {
    const left = chunk(a);
    const right = chunk(b);
    const shared = Math.min(left.length, right.length);
    for (let i = 0; i < shared; i++) {
        const x = left[i]!;
        const y = right[i]!;
        if (typeof x === 'number' && typeof y === 'number') {
            if (x !== y) return x - y;
            continue;
        }
        const sx = String(x);
        const sy = String(y);
        if (sx !== sy) return sx < sy ? -1 : 1;
    }
    return left.length - right.length;
}

/** Split a string into alternating text and numeric runs. */
function chunk(value: string): (string | number)[] {
    const parts = value.match(/\d+|\D+/g);
    if (!parts) return [];
    return parts.map((part) => (/^\d/.test(part) ? Number(part) : part));
}

/**
 * The comparator a column sorts by: its own `compare` when it declares one,
 * otherwise a natural comparison of the rendered cell text.
 */
export function columnComparator<T>(column: TableColumn<T>): (a: T, b: T) => number {
    if (column.compare) return column.compare;
    return (a, b) => naturalCompare(column.value(a) ?? '', column.value(b) ?? '');
}
