/**
 * Sparklines — a time series drawn in text.
 *
 * Three decisions here are the whole point, and all three are about not
 * misleading the reader:
 *
 * 1. **The scale starts at zero, not at the series minimum.** A min-anchored
 *    sparkline turns a flat line at 1000 req/s into a dramatic mountain range
 *    of noise, which is the single most common way these lie. Pass
 *    `baseline: 'min'` if you genuinely want the other behaviour.
 * 2. **The lowest level is reserved for a value at the baseline**, so anything
 *    above it gets at least the second. It costs one level of resolution and
 *    buys the distinction that matters at a glance: "nothing happened" versus
 *    "something did, but barely". Without it, 1 req/s against a scale of 1000
 *    draws exactly like silence.
 * 3. **A gap is not a zero.** `null` (and any non-finite value) renders as a
 *    floating mark, never at the baseline. A counter reset, an unreachable
 *    poll and a genuine idle period are three different facts, and drawing the
 *    first two on the floor claims the third.
 *
 * Pure: values in, strings out. The JSX layer is a `<text>` around this, which
 * keeps the interesting part testable without a renderer.
 */
import { GLYPHS } from './glyphs';

/**
 * How each column is drawn.
 *
 * - `blocks` — one sample per cell, 8 levels per row (`▁▂▃▄▅▆▇█`).
 * - `braille` — two samples per cell, 4 levels per row. At the same width that
 *   is double the horizontal density, and `height: 2` still gives 8 levels.
 */
export type SparkVariant = 'blocks' | 'braille';

export interface SparklineOptions {
    /**
     * Top of the scale. Defaults to the highest value in the visible window.
     *
     * Pass it explicitly to compare two sparklines — auto-scaling makes every
     * series fill the same height, so 3 req/s looks identical to 30,000.
     */
    max?: number;
    /**
     * Bottom of the scale. Defaults to `0` — deliberately **not** the series
     * minimum. `'min'` opts into min-anchoring for series where zero is not a
     * meaningful floor (a temperature, a saturation level).
     */
    baseline?: number | 'min';
    /**
     * Output width in cells. Defaults to whatever the values need.
     *
     * Only the newest samples are kept when there are more than fit — right,
     * not left, because the latest sample is the one being watched and a
     * left-aligned series would push it off the edge as history grows.
     */
    width?: number;
    /** Rows tall. Default 1. More rows means proportionally more levels. */
    height?: number;
    variant?: SparkVariant;
    /** Pad to `width` with blanks when there is not enough history yet. */
    pad?: boolean;
}

/** Levels a single cell can express, per variant. */
const LEVELS_PER_ROW: Record<SparkVariant, number> = { blocks: 8, braille: 4 };
/** Samples a single cell can hold, per variant. */
const SAMPLES_PER_CELL: Record<SparkVariant, number> = { blocks: 1, braille: 2 };

/**
 * Braille dot bits, per column, ordered top row → bottom row.
 * Dots 1-2-3-7 are the left column, 4-5-6-8 the right.
 */
const BRAILLE_LEFT = [0x01, 0x02, 0x04, 0x40];
const BRAILLE_RIGHT = [0x08, 0x10, 0x20, 0x80];
const BRAILLE_BASE = 0x2800;
/** The mark a braille gap leaves: one floating dot, clear of the baseline. */
const BRAILLE_GAP_ROW = 1;

export interface SparklineRender {
    /** The drawn lines, topmost first. */
    rows: string[];
    /**
     * Position of each drawn cell on the scale, `0…1`, or `null` where the cell
     * holds no reading. One entry per column of every row, so a caller can
     * colour cell `i` of any row by `cellRatios[i]` — which is how a threshold
     * palette gets applied without re-deriving the scale.
     */
    cellRatios: (number | null)[];
    /** The scale actually used. */
    baseline: number;
    max: number;
}

/**
 * Draw the series, and report the scale and per-cell position alongside — what
 * a component needs to colour cells by threshold without re-deriving anything.
 */
export function renderSparkline(
    values: readonly (number | null)[],
    options: SparklineOptions = {},
): SparklineRender {
    const variant: SparkVariant = options.variant === 'braille' ? 'braille' : 'blocks';
    const height = clampInt(options.height, 1, 1);
    const perCell = SAMPLES_PER_CELL[variant];

    const cells = options.width !== undefined && Number.isFinite(options.width)
        ? Math.max(0, Math.floor(options.width))
        : Math.ceil(values.length / perCell);
    const capacity = cells * perCell;
    const visible = values.length > capacity ? values.slice(values.length - capacity) : values;
    // Scaled to what is on screen, not to history that has scrolled off — a
    // spike an hour ago should not flatten the window you are looking at.
    const { baseline, max } = sparkScale(visible, options);

    if (cells === 0) {
        return { rows: Array.from({ length: height }, () => ''), cellRatios: [], baseline, max };
    }

    const ratios = toRatios(visible, baseline, max);
    const steps = LEVELS_PER_ROW[variant] * height;
    const levels = ratios.map((ratio) => toLevel(ratio, steps));

    const rows = variant === 'braille'
        ? brailleRows(levels, height)
        : blockRows(levels, height);

    // One ratio per drawn cell. A braille cell holds two samples; take the
    // higher, so a threshold trips on the worse of the pair rather than the
    // one that happened to land on the left.
    const cellRatios: (number | null)[] = [];
    for (let i = 0; i < ratios.length; i += perCell) {
        const pair = ratios.slice(i, i + perCell).filter((r): r is number => r !== null);
        cellRatios.push(pair.length === 0 ? null : Math.max(...pair));
    }

    if (!options.pad) return { rows, cellRatios, baseline, max };
    const slack = Math.max(0, cells - cellRatios.length);
    if (slack === 0) return { rows, cellRatios, baseline, max };
    return {
        rows: rows.map((row) => ' '.repeat(slack) + row),
        cellRatios: [...Array.from({ length: slack }, () => null), ...cellRatios],
        baseline,
        max,
    };
}

/** Render the series as `height` lines, topmost first. */
export function sparklineRows(
    values: readonly (number | null)[],
    options: SparklineOptions = {},
): string[] {
    return renderSparkline(values, options).rows;
}

/**
 * Render the series as one string — the common single-row case. Taller
 * sparklines come back newline-separated; use {@link sparklineRows} if you need
 * the lines individually (a terminal component almost always does).
 */
export function sparkline(values: readonly (number | null)[], options: SparklineOptions = {}): string {
    return sparklineRows(values, options).join('\n');
}

/**
 * The scale a series will be drawn against: zero-anchored unless told otherwise,
 * topped by the highest value present unless `max` is given.
 */
export function sparkScale(
    values: readonly (number | null)[],
    options: SparklineOptions = {},
): { baseline: number; max: number } {
    const baseline = options.baseline === 'min'
        ? troughOf(values)
        : (typeof options.baseline === 'number' && Number.isFinite(options.baseline) ? options.baseline : 0);
    const max = options.max !== undefined && Number.isFinite(options.max) ? options.max : peakOf(values);
    return { baseline, max };
}

/** Highest finite value in the series, or 0. */
export function peakOf(values: readonly (number | null)[]): number {
    let peak = 0;
    for (const value of values) {
        if (value !== null && typeof value === 'number' && Number.isFinite(value) && value > peak) peak = value;
    }
    return peak;
}

/** Lowest finite value in the series, or 0 when there is none. */
export function troughOf(values: readonly (number | null)[]): number {
    let trough: number | null = null;
    for (const value of values) {
        if (value !== null && typeof value === 'number' && Number.isFinite(value)) {
            if (trough === null || value < trough) trough = value;
        }
    }
    return trough ?? 0;
}

/**
 * Direction of travel against the previous reading: `1` up, `-1` down, `0` flat.
 *
 * A number rather than a glyph, because whether "up" is good news depends
 * entirely on the metric — that decision belongs to the component drawing it.
 * `null` on either side is a gap, not a direction: comparing across a counter
 * reset would report a crash that never happened.
 */
export function trend(current: number | null, previous: number | null): 1 | -1 | 0 {
    if (current === null || previous === null) return 0;
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
    if (current > previous) return 1;
    if (current < previous) return -1;
    return 0;
}

/** Position each sample on the scale, `0…1`, or `null` for a gap. */
function toRatios(
    values: readonly (number | null)[],
    baseline: number,
    max: number,
): (number | null)[] {
    const span = max - baseline;
    return values.map((value) => {
        if (value === null || typeof value !== 'number' || !Number.isFinite(value)) return null;
        // Every reading sits on the floor: a real, flat, true answer.
        if (span <= 0) return 0;
        return Math.max(0, Math.min(1, (value - baseline) / span));
    });
}

/**
 * Quantize a ratio onto `0 … steps - 1`.
 *
 * Level 0 is reserved for a value at (or below) the baseline; anything above it
 * lands on 1 at the least, so "barely anything" never draws as "nothing".
 */
function toLevel(ratio: number | null, steps: number): number | null {
    if (ratio === null) return null;
    if (ratio === 0) return 0;
    return Math.min(steps - 1, Math.max(1, Math.ceil(ratio * (steps - 1))));
}

/** One sample per cell, `height` rows of eighth-blocks. */
function blockRows(levels: readonly (number | null)[], height: number): string[] {
    const gapRow = Math.floor((height - 1) / 2);
    const rows: string[] = [];
    // Emitted top row first; `r` counts up from the bottom.
    for (let r = height - 1; r >= 0; r--) {
        let line = '';
        for (const level of levels) {
            if (level === null) {
                line += r === gapRow ? GLYPHS.gap : ' ';
                continue;
            }
            const local = level - r * 8;
            line += local < 0 ? ' ' : GLYPHS.blocksVertical[Math.min(7, local)]!;
        }
        rows.push(line);
    }
    return rows;
}

/** Two samples per cell, `height` rows of 4-dot braille columns. */
function brailleRows(levels: readonly (number | null)[], height: number): string[] {
    const gapRow = Math.floor((height - 1) / 2);
    const rows: string[] = [];
    for (let r = height - 1; r >= 0; r--) {
        let line = '';
        for (let i = 0; i < levels.length; i += 2) {
            const mask =
                brailleColumn(levels[i] ?? null, r, gapRow, BRAILLE_LEFT) |
                (i + 1 < levels.length ? brailleColumn(levels[i + 1] ?? null, r, gapRow, BRAILLE_RIGHT) : 0);
            line += String.fromCharCode(BRAILLE_BASE + mask);
        }
        rows.push(line);
    }
    return rows;
}

/** Dot bits one sample contributes to one cell of one row. */
function brailleColumn(level: number | null, row: number, gapRow: number, dots: readonly number[]): number {
    if (level === null) return row === gapRow ? dots[BRAILLE_GAP_ROW]! : 0;
    // How many of this row's four dot-rows the column reaches, filled upward
    // from the bottom (dot index 3 is the bottom of the cell).
    const filled = Math.max(0, Math.min(4, level + 1 - row * 4));
    let mask = 0;
    for (let d = 0; d < filled; d++) mask |= dots[3 - d]!;
    return mask;
}

function clampInt(value: number | undefined, min: number, fallback: number): number {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.max(min, Math.floor(value));
}
