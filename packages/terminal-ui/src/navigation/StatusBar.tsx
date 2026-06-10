/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { resolveColor } from '@sigx/terminal-zero';

export interface StatusItem {
    key: string;
    label: string;
}

/** Key-hint footer: each item is ` key ` (accent fill) + ` label ` (dim). */
export const StatusBar = component<
    Define.Prop<"items", StatusItem[], true>
>(({ props }) => {
    return () => {
        const items = props.items || [];
        const nodes: any[] = [];
        items.forEach((item) => {
            nodes.push(
                <text backgroundColor={resolveColor('accent')} color={resolveColor('accentText')}> {item.key} </text>
            );
            nodes.push(<text color={resolveColor('dim')}> {item.label}  </text>);
        });
        return <box backgroundColor={resolveColor('chrome')}>{nodes}</box>;
    };
}, { name: 'StatusBar' });

export default StatusBar;
