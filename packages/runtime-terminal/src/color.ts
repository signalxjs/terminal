/**
 * Device-level color: the renderer's half of the token pipeline.
 *
 * The semantic half (token -> color name/hex, theme, fallback aliases) lives in
 * `@sigx/terminal-zero`. This module only knows how to turn a *concrete* color
 * — a `#rrggbb` hex or a named ANSI color — into the SGR escape the terminal
 * paints, honoring the detected (or overridden) color depth. The seam between
 * the two halves is a plain string passed to `<box>` / `<text>`.
 */
import { signal } from '@sigx/reactivity';
import { getColorCode, getBackgroundColorCode } from './utils';

export type ColorDepth = 'truecolor' | 'ansi256' | 'ansi16' | 'none';

function detectColorDepth(): ColorDepth {
    const env = process.env;
    // FORCE_COLOR wins over everything — including a non-TTY stdout, which is
    // exactly what it exists to override (e.g. colored output into a pager/CI).
    const force = env.FORCE_COLOR;
    if (force !== undefined) {
        if (force === '0' || force === 'false') return 'none';
        if (force === '1') return 'ansi16';
        if (force === '2') return 'ansi256';
        return 'truecolor'; // '3', 'true', or bare FORCE_COLOR=
    }
    if (env.NO_COLOR) return 'none';
    // Piped / redirected output (CI, `| cat`): plain text.
    if (!process.stdout.isTTY) return 'none';
    const colorterm = env.COLORTERM;
    if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor';
    const term = env.TERM ?? '';
    if (term === 'dumb' || term === '') {
        // No TERM: assume a modern emulator (VS Code, Warp, Windows Terminal all
        // support truecolor but don't always set COLORTERM).
        return term === 'dumb' ? 'none' : 'truecolor';
    }
    if (/-256(color)?$/.test(term)) return 'ansi256';
    if (/-?16(color)?$/.test(term)) return 'ansi16';
    if (/^(xterm|screen|tmux|vt100|linux|ansi)/.test(term)) return 'ansi16';
    return 'truecolor';
}

// Reactive so setColorDepth() repaints components that read it during render.
const depthState = signal({ value: detectColorDepth() as ColorDepth });

export function getColorDepth(): ColorDepth {
    return depthState.value;
}

export function setColorDepth(depth: ColorDepth): void {
    depthState.value = depth;
}

/**
 * Re-run environment detection and apply the result. Detection normally runs
 * once at module load; call this after the environment changes (tests stubbing
 * FORCE_COLOR/NO_COLOR/TERM, or an embedder redirecting stdout).
 */
export function redetectColorDepth(): ColorDepth {
    const depth = detectColorDepth();
    setColorDepth(depth);
    return depth;
}

function parseHex(hex: string): [number, number, number] | null {
    const s = hex.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(s)) {
        return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    }
    if (/^[0-9a-f]{3}$/i.test(s)) {
        return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
    }
    return null;
}

// Approximate RGB of the 16 standard ANSI colors, for nearest-color fallback.
const ANSI16_RGB: ReadonlyArray<readonly [number, number, number]> = [
    [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
    [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
    [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
    [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];

function nearestAnsi16(r: number, g: number, b: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < 16; i++) {
        const [pr, pg, pb] = ANSI16_RGB[i];
        const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (dist < bestDist) { bestDist = dist; best = i; }
    }
    return best;
}

function ansi16Sgr(r: number, g: number, b: number, isBg: boolean): string {
    const idx = nearestAnsi16(r, g, b);
    const code = idx < 8 ? (isBg ? 40 : 30) + idx : (isBg ? 100 : 90) + (idx - 8);
    return `\x1b[${code}m`;
}

function rgbToAnsi256(r: number, g: number, b: number): number {
    if (r === g && g === b) {
        if (r < 8) return 16;
        if (r > 248) return 231;
        return Math.round(((r - 8) / 247) * 24) + 232;
    }
    return 16
        + 36 * Math.round((r / 255) * 5)
        + 6 * Math.round((g / 255) * 5)
        + Math.round((b / 255) * 5);
}

/** Convert a `#rrggbb` hex to an SGR escape at the current color depth. */
export function hexToSGR(hex: string, opts: { isBg?: boolean } = {}): string {
    const depth = getColorDepth();
    if (depth === 'none') return '';
    const rgb = parseHex(hex);
    if (!rgb) return '';
    const [r, g, b] = rgb;
    const isBg = !!opts.isBg;
    if (depth === 'truecolor') return `\x1b[${isBg ? 48 : 38};2;${r};${g};${b}m`;
    if (depth === 'ansi256') return `\x1b[${isBg ? 48 : 38};5;${rgbToAnsi256(r, g, b)}m`;
    return ansi16Sgr(r, g, b, isBg);
}

/**
 * Resolve any concrete color (hex or ANSI name) to a foreground SGR escape.
 * This is what the renderer calls for `color` / `borderColor` props.
 */
export function resolveFg(color?: string): string {
    if (!color) return '';
    if (color[0] === '#') return hexToSGR(color, { isBg: false });
    if (getColorDepth() === 'none') return '';
    return getColorCode(color);
}

/** Resolve any concrete color (hex or ANSI name) to a background SGR escape. */
export function resolveBg(color?: string): string {
    if (!color) return '';
    if (color[0] === '#') return hexToSGR(color, { isBg: true });
    if (getColorDepth() === 'none') return '';
    return getBackgroundColorCode(color);
}
