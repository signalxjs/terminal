/** @jsxImportSource @sigx/runtime-core */
import { component } from '@sigx/terminal';
import { Box, Divider, Spacer, Card, resolveColor } from '@sigx/terminal';

export const LayoutDemo = component(() => {
    return () => (
        <box>
            <text color={resolveColor('dim')}>Layout primitives from terminal-zero + the Card from terminal-ui.</text>
            <Spacer size={1} />
            <Box label="Themed Box" padX={1}>
                <text color={resolveColor('fg')}>A themed Box defaults to a rounded line border.</text>
            </Box>
            <Spacer size={1} />
            <Divider label="section" width={36} />
            <Spacer size={1} />
            <Card title="Card" dropShadow={true}>
                <text color={resolveColor('fg')}>A Card is a padded panel with an optional title</text>
                <br />
                <text color={resolveColor('fg')}>and a themed drop shadow.</text>
            </Card>
        </box>
    );
}, { name: 'LayoutDemo' });
