/** @jsxImportSource @sigx/runtime-core */
import { component, Text, Spacer } from '@sigx/terminal';
import { Table } from '@sigx/terminal';

export const DataDemo = component(() => {
    return () => (
        <box>
            <Text color="dim">A text grid with an accent header and auto-sized columns.</Text>
            <Spacer size={1} />
            <Table
                columns={['Package', 'Layer', 'Version']}
                rows={[
                    ['runtime-terminal', 'renderer', '0.4.4'],
                    ['terminal-zero', 'foundation', '0.4.4'],
                    ['terminal-ui', 'skin', '0.4.4'],
                    ['terminal', 'barrel', '0.4.4'],
                ]}
            />
        </box>
    );
}, { name: 'DataDemo' });
