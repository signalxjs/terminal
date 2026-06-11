/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor, resolveFg, resolveBg } from '@sigx/terminal-zero';

/**
 * Render a pixel grid as terminal half-blocks (two pixel rows per terminal
 * line). Each character in `rows` is a pixel keyed into `palette`; `.` and
 * space are transparent. Palette values are theme tokens or `#hex` —
 * resolved per color depth (plain block glyphs at depth none).
 *
 * The pure builder is exported so apps can `printStatic` a logo into the
 * scrollback transcript; the component renders it live.
 */
export function renderPixelArt(rows: string[], palette: Record<string, string>): string[] {
    const resolve = (ch: string | undefined): string | null => {
        if (!ch || ch === '.' || ch === ' ') return null;
        const color = palette[ch];
        return color ? resolveColor(color) : null;
    };

    const lines: string[] = [];
    for (let r = 0; r < rows.length; r += 2) {
        const upperRow = rows[r];
        const lowerRow = rows[r + 1] ?? '';
        const cols = Math.max(upperRow.length, lowerRow.length);
        let line = '';
        let lastFg: string | null = null;
        let lastBg: string | null = null;
        let emitted = false;

        for (let c = 0; c < cols; c++) {
            const upper = resolve(upperRow[c]);
            const lower = resolve(lowerRow[c]);

            if (!upper && !lower) {
                if (lastBg !== null) {
                    if (emitted) line += '\x1b[0m'; // close any open background run
                    lastFg = null;
                    lastBg = null;
                }
                line += ' ';
                continue;
            }

            // Pick glyph + colors: both → fg=upper on bg=lower '▀';
            // upper only → fg '▀'; lower only → fg '▄' (no bg bleed).
            const glyph = upper ? '▀' : '▄';
            const fg = upper ?? lower;
            const bg = upper && lower ? lower : null;

            if (fg !== lastFg || bg !== lastBg) {
                if (lastBg !== null && bg === null && emitted) line += '\x1b[0m';
                const sgr = (fg ? resolveFg(fg) : '') + (bg ? resolveBg(bg) : '');
                line += sgr;
                if (sgr) emitted = true;
                lastFg = fg;
                lastBg = bg;
            }
            line += glyph;
        }
        if (emitted) line += '\x1b[0m';
        lines.push(line);
    }
    return lines;
}

export const PixelArt = component<
    Define.Prop<'rows', string[], true> &
    Define.Prop<'palette', Record<string, string>, true>
>(({ props }) => {
    return () => {
        const lines = renderPixelArt(props.rows ?? [], props.palette ?? {});
        return (
            <box>
                {lines.flatMap((line, i) => {
                    const node = <text>{line}</text>;
                    return i > 0 ? [<br />, node] : [node];
                })}
            </box>
        );
    };
}, { name: 'PixelArt' });

export default PixelArt;
