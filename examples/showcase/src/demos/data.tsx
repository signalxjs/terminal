import { component, Text, Spacer, Col } from '@sigx/terminal';
import { Table, DataTable, type TableColumn } from '@sigx/terminal';

interface Silo {
    id: string;
    state: 'ready' | 'joining' | 'draining';
    grains: number;
    p99: number;
}

const STATES = ['ready', 'joining', 'draining'] as const;

// Enough rows to overflow the viewport, so scrolling is actually exercised.
const silos: Silo[] = Array.from({ length: 24 }, (_, i) => ({
    id: `silo-${String(i + 1).padStart(2, '0')}`,
    state: STATES[i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0],
    grains: (i * 137) % 900,
    p99: [4, 9, 17, 42, 130][i % 5],
}));

const columns: TableColumn<Silo>[] = [
    // `flex` hands this column any width left over; it also shrinks last,
    // because space is always taken from the right.
    { key: 'id', header: 'SILO', value: (s) => s.id, flex: true, min: 6 },
    { key: 'state', header: 'STATE', value: (s) => s.state },
    { key: 'grains', header: 'GRAINS', value: (s) => String(s.grains), align: 'right' },
    {
        key: 'p99',
        header: 'P99',
        value: (s) => `${s.p99}ms`,
        align: 'right',
        compare: (a, b) => a.p99 - b.p99,
        // Per-cell colour: the latency column reddens on its own, without
        // repainting the whole row.
        color: (s) => (s.p99 >= 100 ? 'danger' : s.p99 >= 40 ? 'warn' : undefined),
    },
];

export const DataDemo = component(() => {
    return () => (
        <Col>
            <Text color="dim">Table — a static text grid with auto-sized columns.</Text>
            <Spacer size={1} />
            <Table
                columns={['Package', 'Layer', 'Version']}
                rows={[
                    ['runtime-terminal', 'renderer', '0.9.0'],
                    ['terminal-zero', 'foundation', '0.9.0'],
                    ['terminal-ui', 'skin', '0.9.0'],
                    ['terminal', 'barrel', '0.9.0'],
                ]}
            />
            <Spacer size={1} />
            {/* Text is inline: each caption line needs its own block. */}
            <Col><Text color="dim">DataTable — scrolls, sorts and carries a cursor. Tab to focus it:</Text></Col>
            <Col><Text color="dim">  ↑/k ↓/j move · PgUp/PgDn page · Home/End ends · ←/→ sort · r reverse</Text></Col>
            <Spacer size={1} />
            <DataTable
                columns={columns}
                rows={silos}
                height={8}
                width={54}
                sortable
                variant="boxed"
                title="silos"
                identity={(s: Silo) => s.id}
                tone={(s: Silo) => (s.state === 'draining' ? 'dim' : undefined)}
            />
        </Col>
    );
}, { name: 'DataDemo' });
