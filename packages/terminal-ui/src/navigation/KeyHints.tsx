/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '@sigx/terminal-zero';

export interface KeyHint {
    key: string;
    label: string;
}

/**
 * The dev-server shortcuts footer: `r reload · d devices · q quit`.
 * Deliberately lighter than StatusBar (no chips, no background fill) —
 * accent keys, dim labels, faint separators, one line.
 */
export const KeyHints = component<
    Define.Prop<"hints", KeyHint[], true> &
    Define.Prop<"separator", string, false>
>(({ props }) => {
    return () => {
        const hints = props.hints || [];
        const separator = props.separator || '·';

        return (
            <box>
                {hints.map((hint, i) => (
                    <text>
                        {i > 0 && <text color={resolveColor('faint')}> {separator} </text>}
                        <text color={resolveColor('accent')}>{hint.key}</text>
                        <text color={resolveColor('dim')}> {hint.label}</text>
                    </text>
                ))}
            </box>
        );
    };
}, { name: 'KeyHints' });

export default KeyHints;
