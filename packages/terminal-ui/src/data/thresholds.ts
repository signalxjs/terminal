/**
 * Threshold palettes — "colour this by how bad it is".
 *
 * A gauge that turns amber at 80% and red at 95% is the commonest dashboard
 * requirement there is, and re-deriving it in every app is how two panels end
 * up disagreeing about what "hot" means. Thresholds are expressed as positions
 * on the scale (`0…1`), not as raw values, so the same palette works for a
 * latency gauge and a queue-depth gauge.
 */

export interface Threshold {
    /** Position on the scale, `0…1`, at or above which this colour applies. */
    at: number;
    /** Theme token or `#hex`. */
    color: string;
}

/**
 * The colour for a position on the scale: the highest threshold at or below it,
 * falling back to `base` when none matches (or when the position is unknown).
 */
export function colorAt(
    thresholds: readonly Threshold[] | undefined,
    ratio: number | null,
    base: string,
): string {
    if (!thresholds || thresholds.length === 0 || ratio === null || !Number.isFinite(ratio)) return base;
    let color = base;
    let best = -Infinity;
    for (const threshold of thresholds) {
        if (!Number.isFinite(threshold.at)) continue;
        if (ratio >= threshold.at && threshold.at >= best) {
            best = threshold.at;
            color = threshold.color;
        }
    }
    return color;
}
