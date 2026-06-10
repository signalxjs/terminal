/**
 * Internal helpers for the FX components: build a single string with embedded
 * SGR escapes (one text node per line — one prop patch per frame, no per-char
 * vdom churn). The renderer passes embedded escapes through intact and its
 * truncation/measurement are escape-aware.
 */
import { hexToSGR, resolveColor } from '@sigx/terminal-zero';
import { GRADIENT_PRESETS, type GradientPreset } from './presets';

/**
 * Colorize per code point. `hexAt(i, len)` returns the hex for visible char
 * `i`. Run-length emission: an SGR is only emitted when the sampled color
 * changes (spaces keep the current run). Ends with default-fg (`\x1b[39m`,
 * not a full reset — it must not clobber renderer-applied backgrounds) when
 * any color was emitted.
 */
export function colorizeByIndex(text: string, hexAt: (i: number, len: number) => string): string {
    const chars = [...text];
    let out = '';
    let lastHex: string | null = null;
    let emitted = false;
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === ' ') {
            out += ch;
            continue;
        }
        const hex = hexAt(i, chars.length);
        if (hex !== lastHex) {
            const sgr = hexToSGR(hex);
            if (sgr) {
                out += sgr;
                emitted = true;
            }
            lastHex = hex;
        }
        out += ch;
    }
    return emitted ? out + '\x1b[39m' : out;
}

/** Resolve gradient stops: explicit colors win over a preset; tokens → hex. */
export function resolveStops(colors: string[] | undefined, preset: string | undefined): string[] {
    const raw = colors && colors.length > 0
        ? colors
        : [...GRADIENT_PRESETS[(preset as GradientPreset) || 'sigx'] ?? GRADIENT_PRESETS.sigx];
    return raw.map((c) => resolveColor(c));
}

/**
 * Ping-pong a sample sequence (a → b → a without repeating the endpoints), so
 * scrolling a non-cyclic palette has no seam.
 */
export function pingPong(samples: string[]): string[] {
    if (samples.length <= 2) return samples;
    return samples.concat(samples.slice(1, -1).reverse());
}
