/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { displayWidth } from '@sigx/runtime-terminal';
import { resolveColor } from '../theme';

/** Horizontal rule of `width` cells, with an optional centered accent label. */
export const Divider = component<
    Define.Prop<'width', number, false> &
    Define.Prop<'label', string, false> &
    Define.Prop<'color', string, false>
>(({ props }) => {
    return () => {
        const width = Math.max(1, props.width ?? 24);
        const ruleColor = resolveColor(props.color ?? 'line');
        const label = props.label;

        if (!label) {
            return <box><text color={ruleColor}>{'─'.repeat(width)}</text></box>;
        }

        const inner = ` ${label} `;
        // Measure in terminal cells, not UTF-16 units — wide glyphs (CJK,
        // emoji) and combining marks would otherwise mis-center the label.
        const remain = Math.max(0, width - displayWidth(inner));
        const left = Math.floor(remain / 2);
        const right = remain - left;
        return (
            <box>
                <text color={ruleColor}>{'─'.repeat(left)}</text>
                <text color={resolveColor('accent')}>{inner}</text>
                <text color={ruleColor}>{'─'.repeat(right)}</text>
            </box>
        );
    };
}, { name: 'Divider' });

export default Divider;
