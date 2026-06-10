
export function getColorCode(color: string): string {
    switch (color) {
        case 'red': return '\x1b[31m';
        case 'green': return '\x1b[32m';
        case 'blue': return '\x1b[34m';
        case 'yellow': return '\x1b[33m';
        case 'cyan': return '\x1b[36m';
        case 'white': return '\x1b[37m';
        case 'black': return '\x1b[30m';
        // bright variants
        case 'gray':
        case 'grey':
        case 'brightBlack': return '\x1b[90m';
        case 'brightRed': return '\x1b[91m';
        case 'brightGreen': return '\x1b[92m';
        case 'brightYellow': return '\x1b[93m';
        case 'brightBlue': return '\x1b[94m';
        case 'brightMagenta': return '\x1b[95m';
        case 'brightCyan': return '\x1b[96m';
        case 'brightWhite': return '\x1b[97m';
        case 'magenta': return '\x1b[35m';
        default: return '';
    }
}

export function getBackgroundColorCode(color: string): string {
    switch (color) {
        case 'red': return '\x1b[41m';
        case 'green': return '\x1b[42m';
        case 'blue': return '\x1b[44m';
        case 'yellow': return '\x1b[43m';
        case 'cyan': return '\x1b[46m';
        case 'white': return '\x1b[47m';
        case 'black': return '\x1b[40m';
        case 'gray':
        case 'grey':
        case 'brightBlack': return '\x1b[100m';
        case 'magenta': return '\x1b[45m';
        default: return '';
    }
}

export function stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Terminal display width of a single Unicode code point, in cells:
 * 0 for combining/zero-width marks, 2 for wide CJK / emoji, 1 otherwise.
 *
 * Box layout MUST measure with this (not `String.length`) — a CJK glyph or
 * emoji occupies two cells, a combining mark zero, so `.length` misaligns the
 * right border. This is a pragmatic subset of the Unicode East-Asian-Width
 * tables, covering the ranges a TUI realistically renders.
 */
export function charWidth(cp: number): number {
    if (cp === 0) return 0;
    // C0/C1 control characters render as nothing meaningful for layout
    if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0;
    // Combining marks / zero-width
    if (
        (cp >= 0x0300 && cp <= 0x036f) ||   // combining diacriticals
        (cp >= 0x1ab0 && cp <= 0x1aff) ||
        (cp >= 0x1dc0 && cp <= 0x1dff) ||
        (cp >= 0x200b && cp <= 0x200f) ||   // zero-width space .. RTL/LTR marks
        cp === 0xfeff ||                     // BOM / zero-width no-break space
        (cp >= 0x20d0 && cp <= 0x20ff)
    ) return 0;
    // Wide (East-Asian Wide / Fullwidth) + emoji
    if (
        (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo
        cp === 0x2329 || cp === 0x232a ||
        (cp >= 0x2e80 && cp <= 0x303e) ||
        (cp >= 0x3041 && cp <= 0x33ff) ||
        (cp >= 0x3400 && cp <= 0x4dbf) ||
        (cp >= 0x4e00 && cp <= 0x9fff) ||
        (cp >= 0xa000 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe10 && cp <= 0xfe19) ||
        (cp >= 0xfe30 && cp <= 0xfe6f) ||
        (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1faff) || // emoji & symbols
        (cp >= 0x20000 && cp <= 0x3fffd)
    ) return 2;
    return 1;
}

/** Terminal display width of a string in cells, ignoring ANSI escapes. */
export function displayWidth(str: string): number {
    const clean = stripAnsi(str);
    let width = 0;
    for (const ch of clean) {
        width += charWidth(ch.codePointAt(0) ?? 0);
    }
    return width;
}

const ANSI_ESCAPE = /^\x1B\[[0-9;]*[a-zA-Z]/;

/**
 * Truncate a string to at most `maxCells` display cells, preserving ANSI
 * escapes (they occupy no cells and are copied through verbatim).
 *
 * Inline rendering depends on this: a line longer than the terminal width
 * would soft-wrap, throwing off the cursor-up arithmetic that repaints the
 * live region. A wide glyph that would straddle the boundary is dropped
 * (leaving the cell blank) rather than half-painted. If visible content was
 * cut after any escape was emitted, a trailing reset is appended so truncated
 * styling can't bleed into the erase-to-end-of-line that follows.
 */
export function truncateToWidth(str: string, maxCells: number): string {
    let out = '';
    let cells = 0;
    let sawEscape = false;
    let i = 0;
    while (i < str.length) {
        if (str.charCodeAt(i) === 0x1b) {
            const m = ANSI_ESCAPE.exec(str.slice(i));
            if (m) {
                out += m[0];
                sawEscape = true;
                i += m[0].length;
                continue;
            }
        }
        const cp = str.codePointAt(i) ?? 0;
        const w = charWidth(cp);
        if (cells + w > maxCells) {
            return out + (sawEscape ? '\x1b[0m' : '');
        }
        const ch = String.fromCodePoint(cp);
        out += ch;
        cells += w;
        i += ch.length;
    }
    return out;
}
