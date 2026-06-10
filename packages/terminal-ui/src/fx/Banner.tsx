/** @jsxImportSource @sigx/runtime-core */
import { component, onMounted, onUnmounted, type Define } from '@sigx/runtime-core';
import { resolveColor, getColorDepth, gradient, hexToSGR, getTick, subscribeTicker } from '@sigx/terminal-zero';
import { renderBlock, BLOCK_FONT_HEIGHT } from './blockFont';
import { resolveStops, pingPong } from './paint';
import type { GradientPreset } from './presets';

/**
 * A large gradient-filled headline in the built-in 5-row block font
 * (A–Z 0–9 and basic punctuation; other characters render as spaces).
 * `direction` picks the gradient axis; `animate` scrolls it.
 */
export const Banner = component<
    Define.Prop<"text", string, true> &
    Define.Prop<"colors", string[], false> &
    Define.Prop<"preset", GradientPreset, false> &
    Define.Prop<"direction", 'horizontal' | 'vertical' | 'diagonal', false> &
    Define.Prop<"animate", boolean, false> &
    Define.Prop<"speed", number, false>
>(({ props }) => {
    let unsub: (() => void) | null = null;

    onMounted(() => {
        if (props.animate) unsub = subscribeTicker();
    });
    onUnmounted(() => { unsub?.(); });

    return () => {
        const rows = renderBlock(props.text ?? '');
        const depth = getColorDepth();

        if (depth === 'none' || depth === 'ansi16') {
            const color = depth === 'none' ? undefined : resolveColor('accent');
            return (
                <box>
                    {rows.flatMap((row, r) => {
                        const line = <text color={color}>{row}</text>;
                        return r > 0 ? [<br />, line] : [line];
                    })}
                </box>
            );
        }

        const stops = resolveStops(props.colors, props.preset);
        const direction = props.direction || 'horizontal';
        const W = rows[0]?.length ?? 0;
        const H = BLOCK_FONT_HEIGHT;
        const axis = direction === 'horizontal' ? W : direction === 'vertical' ? H : W + H - 1;
        const samples = gradient(stops, Math.max(axis, 2));
        const cycle = props.animate ? pingPong(samples) : samples;
        const phase = props.animate ? Math.floor(getTick() * (props.speed || 1)) : 0;
        const sampleAt = (col: number, row: number) => {
            const i = direction === 'horizontal' ? col : direction === 'vertical' ? row : col + row;
            return cycle[(i + phase) % cycle.length];
        };

        return (
            <box>
                {rows.flatMap((row, r) => {
                    // Run-length SGR per row: only emit when the cell color changes.
                    let painted = '';
                    let lastHex: string | null = null;
                    for (let c = 0; c < row.length; c++) {
                        const ch = row[c];
                        if (ch === ' ') {
                            painted += ch;
                            continue;
                        }
                        const hex = sampleAt(c, r);
                        if (hex !== lastHex) {
                            painted += hexToSGR(hex);
                            lastHex = hex;
                        }
                        painted += ch;
                    }
                    if (lastHex !== null) painted += '\x1b[39m';
                    const line = <text>{painted}</text>;
                    return r > 0 ? [<br />, line] : [line];
                })}
            </box>
        );
    };
}, { name: 'Banner' });

export default Banner;
