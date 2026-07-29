// Persistent dev-server TUI — the shape of the future `sigx dev` for lynx:
// a fullscreen tabbed app with the connect QR always one tab away, live
// device logs you can scroll while they stream, and single-key actions.
//
//     node --import tsx src/main.tsx     (needs a real terminal)
//
// Keys: ←/→ or 1-3 switch tabs, Tab moves focus, r pushes a fake reload,
// q / Ctrl+C quits (terminal restored).
import {
    defineApp, component, signal, onMounted, onUnmounted, terminalMount, exitTerminal,
    Table, QRCode, LogView, Row, Badge, Shell, boxChrome,
    createLogStore, onKey, Text, Spacer, Col } from '@sigx/terminal';

const BUNDLE_URL = 'http://192.168.1.10:8788/main.lynx.bundle?v=demo';

const FAKE_LOGS = [
    '📱 ios #0  LOG  app booted in 412ms',
    '📱 android #1  LOG  bridge connected',
    '📱 ios #0  LOG  navigation → Home',
    '📱 android #1  WARN  slow request: /api/feed (2.1s)',
    '📱 ios #0  LOG  state hydrated',
    '📱 android #1  LOG  image cache warm',
];

const TABS = [
    { label: 'Devices', value: 'devices' },
    { label: 'Logs', value: 'logs' },
    { label: 'Connect', value: 'connect' },
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
            // `Shell` places the tab strip but handles no keys, so switching is
            // the app's — which is the point: swap these for `gt`/`j`/`k` and
            // nothing about the frame has to change.
            const move = (delta: number) => {
                const i = TABS.findIndex((t) => t.value === tab.value);
                tab.value = TABS[(i + delta + TABS.length) % TABS.length].value;
            };
            if (key === '\x1B[D') move(-1);
            if (key === '\x1B[C') move(1);
            if (key >= '1' && key <= String(TABS.length)) tab.value = TABS[Number(key) - 1].value;
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

    return () => (
        <Shell
            header="gradient"
            title="sigx dev · my-lynx-app"
            subtitle={BUNDLE_URL}
            tabs={TABS}
            activeTab={tab.value}
            body="plain"
            hints={[
                { key: '←/→', label: 'tabs' },
                { key: 'Tab', label: 'focus' },
                { key: 'r', label: 'reload' },
                { key: '↑/↓', label: 'scroll logs' },
                { key: 'q', label: 'quit' },
            ]}
        >
            {(pane) => {
                // No `rows - 12` any more: the frame reports what it left.
                // LogView still draws its own border and follow/paused footer,
                // so the viewport is the pane minus that — the last hand-count
                // here, and one that goes away when LogView takes a pane
                // directly.
                const logHeight = Math.max(1, pane.height - boxChrome({ border: true }).rows - 1);
                return (
                    <Col>
                        {tab.value === 'devices' && (
                            <Row gap={4}>
                                <QRCode text={BUNDLE_URL} />
                                <Col>
                                    <Table
                                        columns={['Device', 'Platform', 'Status']}
                                        rows={[
                                            ['iPhone 15', 'ios', 'connected'],
                                            ['Pixel 8', 'android', 'connected'],
                                            ['iPhone SE (sim)', 'ios', 'booted'],
                                        ]}
                                    />
                                    <Spacer size={1} />
                                    <Badge label="2 devices live" variant="solid" color="success" />
                                </Col>
                            </Row>
                        )}
                        {tab.value === 'logs' && (
                            <LogView
                                store={store}
                                width={pane.width}
                                height={logHeight}
                                title=" device logs "
                                autofocus
                            />
                        )}
                        {tab.value === 'connect' && (
                            <Col>
                                <Text color="dim">Scan with sigx-lynx-go:</Text>
                                <QRCode text={BUNDLE_URL} />
                            </Col>
                        )}
                    </Col>
                );
            }}
        </Shell>
    );
}, { name: 'Dashboard' });

if (!process.stdin.isTTY) {
    process.stderr.write('\n  The dev dashboard needs an interactive terminal (TTY).\n' +
        '  Run it directly: node --import tsx src/main.tsx\n\n');
    process.exit(1);
}

defineApp(<Dashboard />).mount({ mode: 'fullscreen', clearConsole: true }, terminalMount);
