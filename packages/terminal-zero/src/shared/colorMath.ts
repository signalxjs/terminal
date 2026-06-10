/**
 * Pure color→color math for gradients and animated effects. Deliberately
 * dependency-free: token→color stays in the theme layer, color→SGR in the
 * renderer — this module only mixes concrete colors in between. Invalid input
 * degrades to white instead of throwing; these run inside render functions.
 */

export function parseHex(hex: string): [number, number, number] | null {
    const s = hex.trim().replace(/^#/, '');
    if (/^[0-9a-f]{6}$/i.test(s)) {
        return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    }
    if (/^[0-9a-f]{3}$/i.test(s)) {
        return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
    }
    return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Per-channel linear mix of two hex colors; `t` clamped to 0..1. */
export function mixHex(a: string, b: string, t: number): string {
    const ca = parseHex(a) ?? [255, 255, 255];
    const cb = parseHex(b) ?? [255, 255, 255];
    const k = Math.max(0, Math.min(1, t));
    return rgbToHex(
        ca[0] + (cb[0] - ca[0]) * k,
        ca[1] + (cb[1] - ca[1]) * k,
        ca[2] + (cb[2] - ca[2]) * k,
    );
}

/** Sample `n` colors evenly across a multi-stop gradient. */
export function gradient(stops: string[], n: number): string[] {
    if (n <= 0) return [];
    if (stops.length === 0) return new Array(n).fill('#ffffff');
    if (stops.length === 1) return new Array(n).fill(stops[0]);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        const pos = n === 1 ? 0 : i / (n - 1);
        const seg = pos * (stops.length - 1);
        const k = Math.min(Math.floor(seg), stops.length - 2);
        out.push(mixHex(stops[k], stops[k + 1], seg - k));
    }
    return out;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s === 0) {
        const v = l * 255;
        return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/** Rotate a hex color's hue by `degrees` (HSL space). */
export function hueShift(hex: string, degrees: number): string {
    const rgb = parseHex(hex) ?? [255, 255, 255];
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const shifted = (((h + degrees / 360) % 1) + 1) % 1;
    const [r, g, b] = hslToRgb(shifted, s, l);
    return rgbToHex(r, g, b);
}
