/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { getColorCode } from '../utils';

export const ProgressBar = component<
    Define.Prop<"value", number, false> &
    Define.Prop<"max", number, false> &
    Define.Prop<"width", number, false> &
    Define.Prop<"char", string, false> &
    Define.Prop<"emptyChar", string, false> &
    Define.Prop<"color", string, false>
>(({ props }) => {
    return () => {
        const value = props.value || 0;
        const max = props.max || 100;
        const width = props.width || 20;
        const barChar = props.char || '█';
        const emptyChar = props.emptyChar || '░';
        const color = props.color;
        const colorCode = color ? getColorCode(color) : '';
        const reset = color ? '\x1b[0m' : '';

        const percentage = Math.min(Math.max(value / max, 0), 1);
        const filledLen = Math.round(width * percentage);
        const emptyLen = width - filledLen;

        const bar = colorCode + barChar.repeat(filledLen) + emptyChar.repeat(emptyLen) + reset;
        const label = ` ${Math.round(percentage * 100)}%`;

        return (
            <box>
                <text>{bar + label}</text>
            </box>
        );
    };
}, { name: 'ProgressBar' });
