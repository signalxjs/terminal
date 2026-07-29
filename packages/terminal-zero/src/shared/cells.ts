/**
 * Cell-aware text fitting — pad, align and truncate a string to an exact number
 * of *display cells*.
 *
 * Everything here measures with `displayWidth` / `truncateToWidth` rather than
 * `String.length`, because the renderer's whole layout pipeline does: a CJK
 * ideograph or an emoji occupies two columns, and a table sized with `.length`
 * misaligns by one column per wide glyph. Truncation is always marked with `…`
 * — a cut identity that looks complete is how you end up chasing the wrong row.
 */
import { displayWidth, truncateToWidth } from '@sigx/runtime-terminal';

/** Horizontal alignment of a cell's content within its width. */
export type CellAlign = 'left' | 'right' | 'center';

/** The character appended to a truncated cell. Width 1 in every terminal. */
export const ELLIPSIS = '…';

/**
 * Shorten `text` to at most `width` display cells, marking the cut with `…`.
 * Text that already fits is returned unchanged (it is *not* padded — see
 * {@link fitCell} for that).
 */
export function ellipsize(text: string, width: number): string {
    if (width <= 0) return '';
    if (displayWidth(text) <= width) return text;
    if (width === 1) return ELLIPSIS;
    // Reserve one cell for the marker. The cut can land a cell short when a
    // 2-cell glyph would have straddled the boundary, so measure what we
    // actually got rather than assuming `width - 1`.
    return truncateToWidth(text, width - 1) + ELLIPSIS;
}

/**
 * Pad `text` out to `width` display cells. Text that is already at least that
 * wide is returned unchanged (it is *not* truncated — see {@link fitCell}).
 */
export function padCell(text: string, width: number, align: CellAlign = 'left'): string {
    if (width <= 0) return text;
    const slack = width - displayWidth(text);
    if (slack <= 0) return text;
    if (align === 'right') return ' '.repeat(slack) + text;
    if (align === 'center') {
        const left = Math.floor(slack / 2);
        return ' '.repeat(left) + text + ' '.repeat(slack - left);
    }
    return text + ' '.repeat(slack);
}

/**
 * Fit `text` to exactly `width` display cells: truncated with `…` when too
 * long, padded when too short. This is the one to reach for when building a
 * column — the result always measures `width`, so cells line up.
 */
export function fitCell(text: string, width: number, align: CellAlign = 'left'): string {
    if (width <= 0) return '';
    return padCell(ellipsize(text, width), width, align);
}
