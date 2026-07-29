/**
 * Frame arithmetic — how much room a `<box>` spends on itself, and how to fill
 * what is left.
 *
 * The renderer's layout is single-pass and content-driven: a `<box>` sizes
 * itself to its widest line, there is no `width`/`height` prop, and nothing
 * clips. So a component that wants to fill a known area has to know what its
 * own chrome costs and pad its content to the remainder. Every component that
 * has needed this so far hardcoded the answer — `- 4` for "rounded border (2) +
 * padX (2)", `1 + (variant === 'boxed' ? 4 : 0)`, `rows - 12` — and each copy
 * is a number that silently goes wrong when the box it describes changes shape.
 *
 * {@link boxChrome} is that number, derived once. {@link fitLines} is the other
 * half: the padding convention that makes a component actually occupy the area
 * it was given.
 */
import { fitCell, type CellAlign } from './cells';

/** Rows and columns a `<box>` spends on its own chrome, leaving the rest for content. */
export interface BoxChrome {
    /** Rows consumed: top + bottom border, plus the drop-shadow row. */
    rows: number;
    /** Columns consumed: left + right border, both pads, plus the shadow column. */
    cols: number;
}

/** How a `<box>` was configured, for the terms that cost space. */
export interface BoxChromeOptions {
    /**
     * Whether the box draws a border, as either a plain boolean or any style
     * name the renderer accepts — so a caller can forward a `<box>`'s own
     * `border` prop without special-casing it. `'none'` is falsy here, as it
     * is to the renderer.
     *
     * Every style costs the same, so this union is about *accepting* input,
     * not distinguishing styles; `boolean` is here because callers derive it
     * from a variant (`border: boxed`) as often as they forward it.
     */
    border?: boolean | 'single' | 'double' | 'rounded' | 'thick' | 'none';
    /**
     * The `padX` prop: cells of padding on *each* side. Truncated to a
     * whole number of cells, because `' '.repeat()` truncates too. Inert
     * without a border — see {@link boxChrome}.
     */
    padX?: number;
    /** The `dropShadow` prop. Inert without a border. */
    dropShadow?: boolean;
}

/**
 * The rows and columns a `<box>` spends on chrome, so a caller can subtract
 * them from the space it has and hand the remainder to its content.
 *
 * Mirrors `drawBox` in `@sigx/runtime-terminal` exactly: a border adds one row
 * top and bottom and one column each side; `padX` widens every content line
 * symmetrically; a drop shadow appends one column to every row below the top
 * border and pushes one extra row underneath.
 *
 * **A borderless box costs nothing**, `padX` and `dropShadow` included.
 * `drawBox` runs only when a border is drawn, so on a bare `<box>` — the
 * grouping element `Col` and friends render — those two props are silently
 * inert. `border="none"` is the same case, which is why the border term is
 * taken as the prop rather than as a boolean the caller has to derive.
 *
 * ```ts
 * // A rounded, padX={1}, shadowed panel filling the terminal:
 * const chrome = boxChrome({ border: true, padX: 1, dropShadow: true });
 * const inner = getTerminalSize().columns - chrome.cols;   // 5 columns of chrome
 * ```
 */
export function boxChrome(opts: BoxChromeOptions = {}): BoxChrome {
    // A borderless box costs nothing at all. `padX` and `dropShadow` are
    // `drawBox` options, and `drawBox` only runs when a border is drawn
    // (`runtime-terminal/src/index.ts:470`) — so on a bare `<box>` they are
    // inert, and charging for them would report space nothing spent.
    if (!opts.border || opts.border === 'none') return { rows: 0, cols: 0 };

    // Floored, not rounded: the renderer pads with `' '.repeat(padX)`, and
    // `repeat` truncates its argument. Charging 2 columns for `padX={1.5}`
    // would leave the box a column wider than anything drew.
    const padX = Math.max(0, Math.floor(opts.padX ?? 0));
    const shadow = opts.dropShadow ? 1 : 0;
    return {
        rows: 2 + shadow,
        cols: 2 + padX * 2 + shadow,
    };
}

/** The area a component has to fill: a width and height in terminal cells. */
export interface ContentBox {
    width: number;
    height: number;
}

/**
 * Fit `lines` to exactly `box.height` lines of exactly `box.width` display
 * cells — the convention that makes a component occupy the area it was given
 * rather than hugging its content.
 *
 * Both axes are enforced: each line is truncated (marked with `…`) or padded to
 * `width` by {@link fitCell}, and the list is padded with blank lines or clipped
 * to `height`. Clipping keeps the **first** `height` lines, so a component that
 * wants a different window — a log tailing the end, say — slices before calling.
 *
 * ```ts
 * // Fill the pane <Shell> handed us, whatever the data does:
 * const rows = fitLines(visible, pane);
 * ```
 */
export function fitLines(lines: string[], box: ContentBox, align: CellAlign = 'left'): string[] {
    const width = Math.max(0, Math.floor(box.width));
    const height = Math.max(0, Math.floor(box.height));
    const out: string[] = [];
    for (let i = 0; i < height; i++) {
        out.push(fitCell(lines[i] ?? '', width, align));
    }
    return out;
}
