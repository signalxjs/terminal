/** @jsxImportSource @sigx/runtime-core */
// Persistent dev-server TUI — the shape of the future `sigx dev` for lynx:
// a fullscreen tabbed app with the connect QR always one tab away, live
// device logs you can scroll while they stream, and single-key actions.
//
//     node --import tsx src/main.tsx     (needs a real terminal)
//
// Keys: ←/→ or h/l switch tabs (when the tab strip is focused), Tab moves
// focus, r pushes a fake reload, q / Ctrl+C quits (terminal restored).
import {
    defineApp, component, signal, onMounted, onUnmounted, terminalMount, exitTerminal,
    Tabs, Table, KeyHints, QRCode, LogView, Row, Gradient, Badge,
    createLogStore, onKey, resolveColor, getOutputTarget,
} from '@sigx/terminal';

const BUNDLE_URL = 'http://192.168.1.10:8788/main.lynx.bundle?v=demo';

const FAKE_LOGS = [
    '📱 ios #0  LOG  app booted in 412ms',
    '📱 android #1  LOG  bridge connected',
    '📱 ios #0  LOG  navigation → Home',
    '📱 android #1  WARN  slow request: /api/feed (2.1s)',
    '📱 ios #0  LOG  state hydrated',
    '📱 android #1  LOG  image cache warm',
];

const Dashboard = component(() => {
    const tab = signal('devices');
    const store = createLogStore({ passthrough: false });
    let timer: ReturnType<typeof setInterval> | null = null;
    let line = 0;
    let offKey: (() => void) | null = null;

    onMounted(() => {
        timer = setInterval(() => {
            store.push(FAKE_LOGS[line % FAKE_LOGS.length].replace('LOG', `LOG #${line}`) + '\n');
            line++;
        }, 600);
        offKey = onKey((key) => {
            if (key === 'r') store.push('⚡ reload sent to 2 devices\n');
            if (key === 'q') {
                exitTerminal();
                process.exit(0);
            }
        });
    });
    onUnmounted(() => {
        if (timer) clearInterval(timer);
        offKey?.();
    });

    return () => {
        const logHeight = Math.max(6, getOutputTarget().rows - 12);
        return (
            <box>
                <box><Gradient text="sigx dev · my-lynx-app" preset="sigx" /></box>
                <box><text color={resolveColor('dim')}>{BUNDLE_URL}</text></box>
                <box></box>
                <Tabs
                    model={tab}
                    autofocus
                    options={[
                        { label: 'Devices', value: 'devices' },
                        { label: 'Logs', value: 'logs' },
                        { label: 'Connect', value: 'connect' },
                    ]}
                />
                <box></box>
                {tab.value === 'devices' && (
                    <Row gap={4}>
                        <QRCode text={BUNDLE_URL} />
                        <box>
                            <Table
                                columns={['Device', 'Platform', 'Status']}
                                rows={[
                                    ['iPhone 15', 'ios', 'connected'],
                                    ['Pixel 8', 'android', 'connected'],
                                    ['iPhone SE (sim)', 'ios', 'booted'],
                                ]}
                            />
                            <box></box>
                            <Badge label="2 devices live" variant="solid" color="success" />
                        </box>
                    </Row>
                )}
                {tab.value === 'logs' && (
                    <LogView store={store} height={logHeight} title=" device logs " />
                )}
                {tab.value === 'connect' && (
                    <box>
                        <text color={resolveColor('dim')}>Scan with sigx-lynx-go:</text>
                        <QRCode text={BUNDLE_URL} />
                    </box>
                )}
                <box></box>
                <KeyHints hints={[
                    { key: '←/→', label: 'tabs' },
                    { key: 'Tab', label: 'focus' },
                    { key: 'r', label: 'reload' },
                    { key: '↑/↓', label: 'scroll logs' },
                    { key: 'q', label: 'quit' },
                ]} />
            </box>
        );
    };
}, { name: 'Dashboard' });

if (!process.stdin.isTTY) {
    process.stderr.write('\n  The dev dashboard needs an interactive terminal (TTY).\n' +
        '  Run it directly: node --import tsx src/main.tsx\n\n');
    process.exit(1);
}

defineApp(<Dashboard />).mount({ mode: 'fullscreen', clearConsole: true }, terminalMount);
