/** @jsxImportSource @sigx/runtime-core */
import { component } from '@sigx/terminal';
import { Table, resolveColor } from '@sigx/terminal';

export const DataDemo = component(() => {
    return () => (
        <box>
            <text color={resolveColor('dim')}>A text grid with an accent header and auto-sized columns.</text>
            <box></box>
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
