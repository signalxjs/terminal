/** @jsxImportSource @sigx/runtime-core */
import { component, signal } from '@sigx/terminal';
import { Tabs, StatusBar, KeyHints, resolveColor } from '@sigx/terminal';

export const NavigationDemo = component(() => {
    const tab = signal('overview');

    return () => (
        <box>
            <text color={resolveColor('dim')}>Tab to focus the switcher, then ←/→ (or h/l) to change tabs.</text>
            <box></box>
            <Tabs
                model={tab}
                options={[
                    { label: 'Overview', value: 'overview' },
                    { label: 'Details', value: 'details' },
                    { label: 'Settings', value: 'settings' },
                ]}
            />
            <box></box>
            <text color={resolveColor('fg')}>Active tab: </text>
            <text color={resolveColor('accent')}>{tab.value}</text>
            <box></box>
            <text color={resolveColor('dim')}>StatusBar (key-hint footer):</text>
            <StatusBar items={[
                { key: '↵', label: 'select' },
                { key: 'q', label: 'quit' },
                { key: '?', label: 'help' },
            ]} />
            <box></box>
            <text color={resolveColor('dim')}>KeyHints (lighter dev-server footer):</text>
            <KeyHints hints={[
                { key: 'r', label: 'reload' },
                { key: 'd', label: 'devices' },
                { key: 'q', label: 'quit' },
            ]} />
        </box>
    );
}, { name: 'NavigationDemo' });
