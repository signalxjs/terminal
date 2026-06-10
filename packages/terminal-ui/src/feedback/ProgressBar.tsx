/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor, getColorDepth, GLYPHS, gradient, hexToSGR } from '@sigx/terminal-zero';
import { GRADIENT_PRESETS } from '../fx/presets';

/**
 * Progress bar in three variants:
 * - `solid`    — single-color fill (default; the classic bar)
 * - `gradient` — fill sampled per-cell across `colors` stops (default
 *                accent→info), revealed as the bar grows
 * - `rainbow`  — gradient with the rainbow preset
 * `smooth` adds a sub-cell leading edge (eighth blocks). Gradient variants
 * fall back to solid at ansi16/none depth.
 */
export const ProgressBar = component<
    Define.Prop<"value", number, false> &
    Define.Prop<"max", number, false> &
    Define.Prop<"width", number, false> &
    Define.Prop<"char", string, false> &
    Define.Prop<"emptyChar", string, false> &
    Define.Prop<"color", string, false> &
    Define.Prop<"variant", 'solid' | 'gradient' | 'rainbow', false> &
    Define.Prop<"colors", string[], false> &
    Define.Prop<"smooth", boolean, false> &
    Define.Prop<"showPercent", boolean, false>
>(({ props }) => {
    return () => {
        const value = props.value || 0;
        const max = props.max || 100;
        const width = props.width || 20;
        const barChar = props.char || GLYPHS.barFull;
        const emptyChar = props.emptyChar || GLYPHS.barEmpty;
        const showPercent = props.showPercent !== false;

        const percentage = Math.min(Math.max(value / max, 0), 1);
        const exact = width * percentage;
        const filledLen = props.smooth ? Math.floor(exact) : Math.round(exact);
        // Sub-cell leading edge: eighth blocks between filled and empty cells.
        const edgeIdx = props.smooth ? Math.floor((exact - filledLen) * 8) : 0;
        const edge = edgeIdx > 0 ? GLYPHS.barEighths[edgeIdx - 1] : '';
        const emptyLen = width - filledLen - (edge ? 1 : 0);

        const depth = getColorDepth();
        const variant = props.variant || 'solid';
        const useGradient = variant !== 'solid' && depth !== 'ansi16' && depth !== 'none';

        const percentText = showPercent
            ? <text color={resolveColor('dim')}>{` ${Math.round(percentage * 100)}%`}</text>
            : undefined;

        if (!useGradient) {
            const fill = resolveColor(props.color || 'accent');
            return (
                <box>
                    <text color={fill}>{barChar.repeat(filledLen) + edge}</text>
                    <text color={resolveColor('faint')}>{emptyChar.repeat(emptyLen)}</text>
                    {percentText}
                </box>
            );
        }

        // Sample the gradient across the FULL width so the bar reveals a
        // stable gradient as it fills (not a compressed one per frame).
        const stops = (variant === 'rainbow'
            ? [...GRADIENT_PRESETS.rainbow]
            : (props.colors?.length ? props.colors : ['accent', 'info'])
        ).map((c) => resolveColor(c));
        const cells = gradient(stops, Math.max(width, 2));

        let painted = '';
        let lastHex: string | null = null;
        for (let i = 0; i < filledLen; i++) {
            if (cells[i] !== lastHex) {
                painted += hexToSGR(cells[i]);
                lastHex = cells[i];
            }
            painted += barChar;
        }
        if (edge) {
            const hex = cells[Math.min(filledLen, cells.length - 1)];
            if (hex !== lastHex) painted += hexToSGR(hex);
            painted += edge;
            lastHex = hex;
        }
        if (lastHex !== null) painted += '\x1b[39m';

        return (
            <box>
                <text>{painted}</text>
                <text color={resolveColor('faint')}>{emptyChar.repeat(emptyLen)}</text>
                {percentText}
            </box>
        );
    };
}, { name: 'ProgressBar' });

export default ProgressBar;
