/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '@sigx/terminal-zero';

/**
 * A small label indicator in one of three styles:
 * - `solid`   — color fill with `accentText` (uses inline background)
 * - `accent`  — colored text only (default)
 * - `bracket` — `[ label ]` in color, no fill
 */
export const Badge = component<
    Define.Prop<"label", string, true> &
    Define.Prop<"variant", 'solid' | 'accent' | 'bracket', false> &
    Define.Prop<"color", string, false>
>(({ props }) => {
    return () => {
        const label = props.label ?? '';
        const variant = props.variant || 'accent';
        const color = props.color || 'accent';

        if (variant === 'solid') {
            return (
                <box>
                    <text backgroundColor={resolveColor(color)} color={resolveColor('accentText')}> {label} </text>
                </box>
            );
        }
        if (variant === 'bracket') {
            return <box><text color={resolveColor(color)}>[ {label} ]</text></box>;
        }
        return <box><text color={resolveColor(color)}>{label}</text></box>;
    };
}, { name: 'Badge' });

export default Badge;
