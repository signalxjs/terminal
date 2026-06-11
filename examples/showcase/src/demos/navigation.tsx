/** @jsxImportSource @sigx/runtime-core */
import { component, signal, Text, Spacer } from '@sigx/terminal';
import { Tabs, StatusBar, KeyHints } from '@sigx/terminal';

export const NavigationDemo = component(() => {
    const tab = signal('overview');

    return () => (
        <box>
            <Text color="dim">Tab to focus the switcher, then ←/→ (or h/l) to change tabs.</Text>
            <Spacer size={1} />
            <Tabs
                model={tab}
                options={[
                    { label: 'Overview', value: 'overview' },
                    { label: 'Details', value: 'details' },
                    { label: 'Settings', value: 'settings' },
                ]}
            />
            <Spacer size={1} />
            <Text color="fg">Active tab: </Text>
            <Text color="accent">{tab.value}</Text>
            <Spacer size={1} />
            <Text color="dim">StatusBar (key-hint footer):</Text>
            <StatusBar items={[
                { key: '↵', label: 'select' },
                { key: 'q', label: 'quit' },
                { key: '?', label: 'help' },
            ]} />
            <Spacer size={1} />
            <Text color="dim">KeyHints (lighter dev-server footer):</Text>
            <KeyHints hints={[
                { key: 'r', label: 'reload' },
                { key: 'd', label: 'devices' },
                { key: 'q', label: 'quit' },
            ]} />
        </box>
    );
}, { name: 'NavigationDemo' });
