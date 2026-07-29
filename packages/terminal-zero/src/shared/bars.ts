/**
 * Turning a ratio into cells — the maths behind every horizontal bar.
 *
 * One rule runs through all of it: **a non-zero value never draws as nothing.**
 * Rounding a real 2% down to an empty bar reads as "no traffic", which is a
 * different and wrong answer. So any ratio above zero gets at least one cell.
 */
import { GLYPHS } from './glyphs';

/** A bar decomposed into whole cells plus an optional sub-cell leading edge. */
export interface BarCells {
    /** Whole filled cells. */
    filled: number;
    /** Sub-cell leading edge (an eighth block), or `''` when there is none. */
    edge: string;
    /** Track cells after the fill. */
    empty: number;
}

export interface BarOptions {
    /** Add a sub-cell leading edge, for a bar that grows smoothly. */
    smooth?: boolean;
}

/**
 * Split a `value / max` ratio across `width` cells.
 *
 * `smooth` trades the rounding for an eighth-block leading edge, so a bar
 * animating between two integers moves continuously instead of in jumps.
 */
export function barCells(value: number, max: number, width: number, options: BarOptions = {}): BarCells {
    const w = Math.max(0, Math.floor(width));
    if (w === 0) return { filled: 0, edge: '', empty: 0 };
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
        return { filled: 0, edge: '', empty: w };
    }

    const ratio = Math.max(0, Math.min(1, value / max));
    if (ratio === 0) return { filled: 0, edge: '', empty: w };

    const exact = w * ratio;
    if (!options.smooth) {
        const filled = Math.min(w, Math.max(1, Math.round(exact)));
        return { filled, edge: '', empty: w - filled };
    }

    let filled = Math.floor(exact);
    const eighths = Math.floor((exact - filled) * 8);
    let edge = eighths > 0 && filled < w ? GLYPHS.barEighths[eighths - 1]! : '';
    // A ratio that rounds to no whole cell and no edge would vanish; give it
    // the thinnest edge rather than drawing silence.
    if (filled === 0 && edge === '') edge = GLYPHS.barEighths[0]!;
    if (filled > w) filled = w;
    return { filled, edge, empty: Math.max(0, w - filled - (edge ? 1 : 0)) };
}

/**
 * A horizontal gauge: `████████░░░░`.
 *
 * `ProgressBar` covers determinate progress with a percentage; this is the bare
 * bar, sized to sit inside a table cell or next to a label.
 */
export function meter(value: number, max: number, width = 12, options: BarOptions = {}): string {
    const w = Math.max(0, Math.floor(width));
    if (w === 0) return '';
    const { filled, edge, empty } = barCells(value, max, w, options);
    return GLYPHS.barFull.repeat(filled) + edge + GLYPHS.barEmpty.repeat(empty);
}

export interface ScaleOptions {
    /**
     * Ignore the top tail when picking the scale, as a quantile in `0…1`.
     * `{ clip: 0.99 }` scales to the 99th percentile instead of the maximum, so
     * a single pathological outlier cannot flatten every other bar to nothing.
     */
    clip?: number;
}

/**
 * One scale for a set of series, so bars drawn against it are comparable.
 *
 * Sharing a scale is the entire point of stacking bars — scaling each row to
 * its own maximum makes a 12µs wait and a 47ms turn draw identically. Non-finite
 * and negative values are ignored; the result is never below 0.
 */
export function commonScale(values: readonly (number | null | undefined)[], options: ScaleOptions = {}): number {
    const usable: number[] = [];
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) usable.push(value);
    }
    if (usable.length === 0) return 0;

    const clip = options.clip;
    if (clip === undefined || !Number.isFinite(clip) || clip >= 1) {
        return Math.max(...usable);
    }
    usable.sort((a, b) => a - b);
    const index = Math.min(usable.length - 1, Math.max(0, Math.ceil(Math.max(0, clip) * usable.length) - 1));
    return usable[index]!;
}
